use actix_web::{web, HttpResponse, Responder};
use diesel::prelude::*;
use log::info;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::time::{timeout, Duration};
use utoipa::ToSchema;

use crate::histtext::embeddings::{cache, stats as embedding_stats};
use crate::schema::solr_database_info::dsl as info_dsl;
use crate::schema::solr_databases::dsl as solr_dsl;
use crate::schema::user_sessions::dsl as session_dsl;
use crate::schema::users::dsl::*;
use crate::services::crud::execute_db_query;
use crate::services::database::Database;
use crate::services::error::AppError;
use crate::services::request_analytics::{get_analytics_store, RequestAnalytics};
use crate::services::{
    collection_intelligence, query_analytics, request_analytics, user_behavior_analytics,
};

use crate::services::security_events::SecurityEventLogger;
use chrono::{DateTime, Duration as ChronoDuration, Utc};

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UserActivity {
    pub recent_logins: Vec<RecentLogin>,
    pub failed_login_attempts: Vec<FailedLoginAttempt>,
    pub user_registrations: Vec<UserRegistration>,
    pub session_statistics: SessionStatistics,
    pub security_events: Vec<SecurityEvent>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RecentLogin {
    pub user_id: i32,
    pub email: String,
    pub firstname: String,
    pub lastname: String,
    pub login_time: chrono::DateTime<chrono::Utc>,
    pub device: Option<String>,
    pub ip_address: Option<String>,
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FailedLoginAttempt {
    pub email: String,
    pub attempt_time: chrono::DateTime<chrono::Utc>,
    pub ip_address: Option<String>,
    pub reason: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UserRegistration {
    pub user_id: i32,
    pub email: String,
    pub firstname: String,
    pub lastname: String,
    pub registration_time: chrono::DateTime<chrono::Utc>,
    pub activated: bool,
    pub activation_time: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SessionStatistics {
    pub total_active_sessions: i64,
    pub sessions_last_24h: i64,
    pub sessions_last_week: i64,
    pub average_session_duration_minutes: f64,
    pub unique_users_24h: i64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SecurityEvent {
    pub event_type: String,
    pub user_email: Option<String>,
    pub description: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub severity: String,
    pub ip_address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DashboardStats {
    #[schema(example = "41254")]
    total_docs: i64,
    #[schema(example = "18")]
    total_collections: i64,
    #[schema(example = "3")]
    total_users: i64,
    #[schema(example = "5")]
    active_collections: i64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ComprehensiveDashboardStats {
    #[schema(example = "41254")]
    total_documents: i64,
    #[schema(example = "18")]
    total_collections: i64,
    #[schema(example = "3")]
    total_users: i64,
    #[schema(example = "5")]
    active_collections: i64,
    #[schema(example = "2")]
    active_sessions: i64,
    #[schema(example = "1")]
    recent_registrations_24h: i64,
    solr_databases: Vec<SolrDatabaseStatus>,
    embedding_summary: EmbeddingSummary,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SolrDatabaseStatus {
    id: i32,
    name: String,
    status: String, // "online", "offline", "error"
    document_count: Option<i64>,
    collections: Vec<CollectionStatus>,
    response_time_ms: Option<u64>,
    error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CollectionStatus {
    name: String,
    document_count: Option<i64>,
    has_embeddings: bool,
    embedding_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct EmbeddingSummary {
    total_cached_embeddings: usize,
    cache_hit_ratio: f64,
    memory_usage_mb: f64,
    memory_usage_percent: f64,
    cached_collections: usize,
}

async fn check_solr_database_status(
    client: &Client,
    db: &crate::services::solr_database::SolrDatabase,
    db_pool: &web::Data<Database>,
) -> SolrDatabaseStatus {
    let start_time = std::time::Instant::now();

    // Test basic connectivity
    let base_url = format!("http://localhost:{}/solr", db.local_port);
    let status_check = timeout(
        Duration::from_secs(5),
        client
            .get(&format!("{}/admin/cores?action=STATUS&wt=json", base_url))
            .send(),
    )
    .await;

    match status_check {
        Ok(Ok(response)) if response.status().is_success() => {
            let response_time = start_time.elapsed().as_millis() as u64;

            // Get collections info
            let collections = get_collections_status(client, db, db_pool).await;
            let total_docs: i64 = collections.iter().filter_map(|c| c.document_count).sum();

            SolrDatabaseStatus {
                id: db.id,
                name: db.name.clone(),
                status: "online".to_string(),
                document_count: Some(total_docs),
                collections,
                response_time_ms: Some(response_time),
                error_message: None,
            }
        }
        Ok(Ok(response)) => SolrDatabaseStatus {
            id: db.id,
            name: db.name.clone(),
            status: "error".to_string(),
            document_count: None,
            collections: vec![],
            response_time_ms: Some(start_time.elapsed().as_millis() as u64),
            error_message: Some(format!("HTTP {}", response.status())),
        },
        Ok(Err(e)) => SolrDatabaseStatus {
            id: db.id,
            name: db.name.clone(),
            status: "error".to_string(),
            document_count: None,
            collections: vec![],
            response_time_ms: None,
            error_message: Some(e.to_string()),
        },
        Err(_) => SolrDatabaseStatus {
            id: db.id,
            name: db.name.clone(),
            status: "offline".to_string(),
            document_count: None,
            collections: vec![],
            response_time_ms: None,
            error_message: Some("Connection timeout".to_string()),
        },
    }
}

async fn get_collections_status(
    client: &Client,
    db: &crate::services::solr_database::SolrDatabase,
    db_pool: &web::Data<Database>,
) -> Vec<CollectionStatus> {
    let mut collections = vec![];

    // Get collection info from database
    let solr_db_id = db.id; // Copy the i32 value instead of capturing the reference
    let db_infos = execute_db_query(db_pool.clone(), move |conn| {
        info_dsl::solr_database_info
            .filter(info_dsl::solr_database_id.eq(solr_db_id))
            .load::<crate::services::solr_database_info::SolrDatabaseInfo>(conn)
    })
    .await
    .unwrap_or_default();

    for info in db_infos {
        let doc_count = get_collection_document_count(client, db, &info.collection_name).await;

        collections.push(CollectionStatus {
            name: info.collection_name,
            document_count: doc_count,
            has_embeddings: info.embeddings != "none",
            embedding_path: if info.embeddings == "none" || info.embeddings == "default" {
                None
            } else {
                Some(info.embeddings)
            },
        });
    }

    collections
}

async fn get_collection_document_count(
    client: &Client,
    db: &crate::services::solr_database::SolrDatabase,
    collection: &str,
) -> Option<i64> {
    let url = format!(
        "http://localhost:{}/solr/{}/select?q=*:*&rows=0&wt=json",
        db.local_port, collection
    );

    match timeout(Duration::from_secs(10), client.get(&url).send()).await {
        Ok(Ok(response)) if response.status().is_success() => {
            if let Ok(json) = response.json::<serde_json::Value>().await {
                json.get("response")
                    .and_then(|r| r.get("numFound"))
                    .and_then(|n| n.as_i64())
            } else {
                None
            }
        }
        _ => None,
    }
}

#[utoipa::path(
    get,
    path = "/api/stats",
    tag = "Stats",
    responses(
        (status = 200, description = "System dashboard statistics", body = DashboardStats),
        (status = 500, description = "Database error or calculation failure")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_dashboard_stats(db: web::Data<Database>) -> Result<HttpResponse, AppError> {
    let user_count =
        execute_db_query(db.clone(), |conn| users.count().get_result::<i64>(conn)).await?;

    let collection_count = execute_db_query(db.clone(), |conn| {
        solr_dsl::solr_databases.count().get_result::<i64>(conn)
    })
    .await?;

    let active_collections = execute_db_query(db.clone(), |conn| {
        info_dsl::solr_database_info
            .filter(info_dsl::embeddings.ne("none"))
            .count()
            .get_result::<i64>(conn)
    })
    .await
    .unwrap_or(0);

    let cache_info = cache::get_cache_info().await;
    let total_docs = cache_info.2 as i64;

    let stats = DashboardStats {
        total_docs,
        total_collections: collection_count,
        total_users: user_count,
        active_collections,
    };

    Ok(HttpResponse::Ok().json(stats))
}

#[utoipa::path(
    get,
    path = "/api/dashboard/comprehensive",
    tag = "Stats",
    responses(
        (status = 200, description = "Comprehensive system dashboard statistics", body = ComprehensiveDashboardStats),
        (status = 500, description = "Database error or system check failure")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_comprehensive_dashboard_stats(
    db: web::Data<Database>,
) -> Result<HttpResponse, AppError> {
    let client = Client::new();

    // Get basic user stats
    let user_count =
        execute_db_query(db.clone(), |conn| users.count().get_result::<i64>(conn)).await?;

    let collection_count = execute_db_query(db.clone(), |conn| {
        solr_dsl::solr_databases.count().get_result::<i64>(conn)
    })
    .await?;

    let active_collections = execute_db_query(db.clone(), |conn| {
        info_dsl::solr_database_info
            .filter(info_dsl::embeddings.ne("none"))
            .count()
            .get_result::<i64>(conn)
    })
    .await
    .unwrap_or(0);

    // Get active sessions (sessions from last 24 hours)
    let active_sessions = execute_db_query(db.clone(), |conn| {
        use chrono::{Duration as ChronoDuration, Utc};
        let yesterday = Utc::now().naive_utc() - ChronoDuration::hours(24);

        session_dsl::user_sessions
            .filter(session_dsl::updated_at.gt(yesterday))
            .count()
            .get_result::<i64>(conn)
    })
    .await
    .unwrap_or(0);

    // Get recent registrations (last 24 hours)
    let recent_registrations = execute_db_query(db.clone(), |conn| {
        use chrono::{Duration as ChronoDuration, Utc};
        let yesterday = Utc::now().naive_utc() - ChronoDuration::hours(24);

        users
            .filter(created_at.gt(yesterday))
            .count()
            .get_result::<i64>(conn)
    })
    .await
    .unwrap_or(0);

    // Get all Solr databases
    let solr_databases_list = execute_db_query(db.clone(), |conn| {
        solr_dsl::solr_databases.load::<crate::services::solr_database::SolrDatabase>(conn)
    })
    .await?;

    // Check status of each Solr database
    let mut solr_statuses = vec![];
    let mut total_documents = 0i64;

    for solr_db in solr_databases_list {
        let status = check_solr_database_status(&client, &solr_db, &db).await;
        if let Some(doc_count) = status.document_count {
            total_documents += doc_count;
        }
        solr_statuses.push(status);
    }

    // Get embedding statistics
    let cache_stats = cache::get_cache_statistics().await;
    let embedding_summary = EmbeddingSummary {
        total_cached_embeddings: cache_stats.total_embeddings_loaded,
        cache_hit_ratio: cache_stats.hit_ratio(),
        memory_usage_mb: cache_stats.memory_usage as f64 / 1024.0 / 1024.0,
        memory_usage_percent: cache_stats.memory_usage_ratio() * 100.0,
        cached_collections: cache_stats.entries_count,
    };

    let comprehensive_stats = ComprehensiveDashboardStats {
        total_documents,
        total_collections: collection_count,
        total_users: user_count,
        active_collections,
        active_sessions,
        recent_registrations_24h: recent_registrations,
        solr_databases: solr_statuses,
        embedding_summary,
    };

    Ok(HttpResponse::Ok().json(comprehensive_stats))
}

#[utoipa::path(
    get,
    path = "/api/embeddings/stats",
    tag = "Embeddings",
    responses(
        (status = 200, description = "Embedding cache statistics", body = embedding_stats::CacheStats)
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_embeddings_stats() -> impl Responder {
    let stats = embedding_stats::get_cache_stats().await;
    HttpResponse::Ok().json(stats)
}

#[utoipa::path(
    post,
    path = "/api/embeddings/clear",
    tag = "Embeddings",
    responses(
        (status = 200, description = "Cache cleared successfully")
    ),
    security(("bearer_auth" = []))
)]
pub async fn clear_embeddings_cache() -> impl Responder {
    cache::clear_caches().await;
    info!("Embedding cache cleared by admin request");

    HttpResponse::Ok().json(serde_json::json!({
        "message": "Embedding cache cleared successfully",
        "timestamp": chrono::Utc::now()
    }))
}

#[utoipa::path(
    get,
    path = "/api/dashboard/analytics",
    tag = "Stats",
    responses(
        (status = 200, description = "API usage analytics and performance metrics", body = RequestAnalytics),
        (status = 500, description = "Failed to generate analytics")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_request_analytics() -> Result<HttpResponse, AppError> {
    let analytics = get_analytics_store().get_analytics().await;
    Ok(HttpResponse::Ok().json(analytics))
}

// Updated get_user_activity function with fixed variable names

#[utoipa::path(
    get,
    path = "/api/dashboard/user-activity",
    tag = "Stats",
    responses(
        (status = 200, description = "User activity and security monitoring data", body = UserActivity),
        (status = 500, description = "Failed to fetch user activity data")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_user_activity(db: web::Data<Database>) -> Result<HttpResponse, AppError> {
    let now = Utc::now().naive_utc();
    let twenty_four_hours_ago = now - ChronoDuration::hours(24);
    let one_week_ago = now - ChronoDuration::weeks(1);
    let one_hour_ago = now - ChronoDuration::hours(1);

    // Get recent successful logins (from sessions)
    let recent_logins = execute_db_query(db.clone(), move |conn| {
        use crate::schema::users::dsl as users_dsl;

        session_dsl::user_sessions
            .inner_join(users_dsl::users.on(users_dsl::id.eq(session_dsl::user_id)))
            .filter(session_dsl::created_at.gt(twenty_four_hours_ago))
            .order(session_dsl::created_at.desc())
            .limit(20)
            .select((
                users_dsl::id,
                users_dsl::email,
                users_dsl::firstname,
                users_dsl::lastname,
                session_dsl::created_at,
                session_dsl::device,
            ))
            .load::<(
                i32,
                String,
                String,
                String,
                chrono::NaiveDateTime,
                Option<String>,
            )>(conn)
    })
    .await
    .unwrap_or_default();

    let recent_logins: Vec<RecentLogin> = recent_logins
        .into_iter()
        .map(
            |(user_id, user_email, user_firstname, user_lastname, login_time, device)| {
                RecentLogin {
                    user_id,
                    email: user_email,
                    firstname: user_firstname,
                    lastname: user_lastname,
                    login_time: DateTime::from_naive_utc_and_offset(login_time, Utc),
                    device,
                    ip_address: None, // Would need to be tracked separately
                    success: true,
                }
            },
        )
        .collect();

    // Get recent user registrations
    let user_registrations = execute_db_query(db.clone(), move |conn| {
        use crate::schema::users::dsl as users_dsl;

        users_dsl::users
            .filter(users_dsl::created_at.gt(one_week_ago))
            .order(users_dsl::created_at.desc())
            .limit(10)
            .select((
                users_dsl::id,
                users_dsl::email,
                users_dsl::firstname,
                users_dsl::lastname,
                users_dsl::created_at,
                users_dsl::activated,
            ))
            .load::<(i32, String, String, String, chrono::NaiveDateTime, bool)>(conn)
    })
    .await
    .unwrap_or_default();

    let user_registrations: Vec<UserRegistration> = user_registrations
        .into_iter()
        .map(
            |(
                user_id,
                user_email,
                user_firstname,
                user_lastname,
                registration_time,
                user_activated,
            )| {
                UserRegistration {
                    user_id,
                    email: user_email,
                    firstname: user_firstname,
                    lastname: user_lastname,
                    registration_time: DateTime::from_naive_utc_and_offset(registration_time, Utc),
                    activated: user_activated,
                    activation_time: None, // Would need to be tracked separately
                }
            },
        )
        .collect();

    // Calculate session statistics
    let session_stats = execute_db_query(db.clone(), move |conn| {
        // Total active sessions (updated in last hour)
        let total_active = session_dsl::user_sessions
            .filter(session_dsl::updated_at.gt(one_hour_ago))
            .count()
            .get_result::<i64>(conn)?;

        // Sessions in last 24h
        let sessions_24h = session_dsl::user_sessions
            .filter(session_dsl::created_at.gt(twenty_four_hours_ago))
            .count()
            .get_result::<i64>(conn)?;

        // Sessions in last week
        let sessions_week = session_dsl::user_sessions
            .filter(session_dsl::created_at.gt(one_week_ago))
            .count()
            .get_result::<i64>(conn)?;

        // Unique users in last 24h
        let unique_users_24h = session_dsl::user_sessions
            .filter(session_dsl::created_at.gt(twenty_four_hours_ago))
            .select(session_dsl::user_id)
            .distinct()
            .count()
            .get_result::<i64>(conn)?;

        Ok((total_active, sessions_24h, sessions_week, unique_users_24h))
    })
    .await
    .unwrap_or((0, 0, 0, 0));

    let session_statistics = SessionStatistics {
        total_active_sessions: session_stats.0,
        sessions_last_24h: session_stats.1,
        sessions_last_week: session_stats.2,
        average_session_duration_minutes: 45.0, // Mock value - would need session tracking
        unique_users_24h: session_stats.3,
    };

    let security_events_data = SecurityEventLogger::get_recent_events(db.clone(), 20)
        .await
        .unwrap_or_default();

    let security_events: Vec<SecurityEvent> = security_events_data
        .into_iter()
        .map(|event| SecurityEvent {
            event_type: event.event_type,
            user_email: event.user_email,
            description: event.description,
            timestamp: DateTime::from_naive_utc_and_offset(event.created_at, Utc),
            severity: event.severity,
            ip_address: event.ip_address,
        })
        .collect();

    // Get real failed login attempts from security events
    let failed_login_events = execute_db_query(db.clone(), move |conn| {
        use crate::schema::security_events::dsl::*;

        security_events
            .filter(event_type.eq("failed_login"))
            .filter(created_at.gt(twenty_four_hours_ago))
            .order(created_at.desc())
            .limit(10)
            .load::<crate::services::security_events::SecurityEvent>(conn)
    })
    .await
    .unwrap_or_default();

    let failed_login_attempts: Vec<FailedLoginAttempt> = failed_login_events
        .into_iter()
        .map(|event| FailedLoginAttempt {
            email: event.user_email.unwrap_or_else(|| "unknown".to_string()),
            attempt_time: DateTime::from_naive_utc_and_offset(event.created_at, Utc),
            ip_address: event.ip_address,
            reason: event.description,
            count: 1, // Individual events, not aggregated
        })
        .collect();

    let activity = UserActivity {
        recent_logins,
        failed_login_attempts,
        user_registrations,
        session_statistics,
        security_events,
        last_updated: Utc::now(),
    };

    Ok(HttpResponse::Ok().json(activity))
}

/// Get enhanced request analytics with detailed error tracking
#[utoipa::path(
    get,
    path = "/api/dashboard/enhanced-analytics",
    tag = "Stats",
    responses(
        (status = 200, description = "Enhanced request analytics with error tracking", body = crate::services::request_analytics::RequestAnalytics),
        (status = 500, description = "Analytics retrieval failed")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_enhanced_request_analytics() -> Result<HttpResponse, AppError> {
    let analytics = request_analytics::get_analytics_store()
        .get_analytics()
        .await;
    Ok(HttpResponse::Ok().json(analytics))
}

/// Get user behavior analytics
#[utoipa::path(
    get,
    path = "/api/dashboard/user-behavior",
    tag = "Stats",
    responses(
        (status = 200, description = "User behavior analytics and patterns", body = crate::services::user_behavior_analytics::UserBehaviorAnalytics),
        (status = 500, description = "Analytics retrieval failed")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_user_behavior_analytics() -> Result<HttpResponse, AppError> {
    let analytics = user_behavior_analytics::get_user_behavior_store()
        .get_user_behavior_analytics()
        .await;
    Ok(HttpResponse::Ok().json(analytics))
}

/// Get query analytics with search patterns and performance
#[utoipa::path(
    get,
    path = "/api/dashboard/query-analytics",
    tag = "Stats",
    responses(
        (status = 200, description = "Query analytics with search patterns and performance metrics", body = crate::services::query_analytics::QueryAnalytics),
        (status = 500, description = "Analytics retrieval failed")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_query_analytics() -> Result<HttpResponse, AppError> {
    let analytics = query_analytics::get_query_analytics_store()
        .get_query_analytics()
        .await;
    Ok(HttpResponse::Ok().json(analytics))
}

/// Get collection usage intelligence
#[utoipa::path(
    get,
    path = "/api/dashboard/collection-intelligence",
    tag = "Stats", 
    responses(
        (status = 200, description = "Collection usage intelligence and optimization insights", body = crate::services::collection_intelligence::CollectionIntelligence),
        (status = 500, description = "Analytics retrieval failed")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_collection_intelligence() -> Result<HttpResponse, AppError> {
    let intelligence = collection_intelligence::get_collection_intelligence_store()
        .get_collection_intelligence()
        .await;
    Ok(HttpResponse::Ok().json(intelligence))
}
