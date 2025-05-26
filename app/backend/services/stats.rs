use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use diesel::prelude::*;
use log::info;
use reqwest::Client;
use tokio::time::{timeout, Duration};

use crate::schema::users::dsl::*;
use crate::schema::solr_databases::dsl as solr_dsl;
use crate::schema::solr_database_info::dsl as info_dsl;
use crate::schema::user_sessions::dsl as session_dsl;
use crate::services::database::Database;
use crate::services::error::AppError;
use crate::services::crud::execute_db_query;
use crate::histtext::embeddings::{cache, stats as embedding_stats};
use crate::services::request_analytics::{get_analytics_store, RequestAnalytics};


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
        client.get(&format!("{}/admin/cores?action=STATUS&wt=json", base_url)).send()
    ).await;

    match status_check {
        Ok(Ok(response)) if response.status().is_success() => {
            let response_time = start_time.elapsed().as_millis() as u64;
            
            // Get collections info
            let collections = get_collections_status(client, db, db_pool).await;
            let total_docs: i64 = collections.iter()
                .filter_map(|c| c.document_count)
                .sum();

            SolrDatabaseStatus {
                id: db.id,
                name: db.name.clone(),
                status: "online".to_string(),
                document_count: Some(total_docs),
                collections,
                response_time_ms: Some(response_time),
                error_message: None,
            }
        },
        Ok(Ok(response)) => {
            SolrDatabaseStatus {
                id: db.id,
                name: db.name.clone(),
                status: "error".to_string(),
                document_count: None,
                collections: vec![],
                response_time_ms: Some(start_time.elapsed().as_millis() as u64),
                error_message: Some(format!("HTTP {}", response.status())),
            }
        },
        Ok(Err(e)) => {
            SolrDatabaseStatus {
                id: db.id,
                name: db.name.clone(),
                status: "error".to_string(),
                document_count: None,
                collections: vec![],
                response_time_ms: None,
                error_message: Some(e.to_string()),
            }
        },
        Err(_) => {
            SolrDatabaseStatus {
                id: db.id,
                name: db.name.clone(),
                status: "offline".to_string(),
                document_count: None,
                collections: vec![],
                response_time_ms: None,
                error_message: Some("Connection timeout".to_string()),
            }
        }
    }
}

async fn get_collections_status(
    client: &Client,
    db: &crate::services::solr_database::SolrDatabase,
    db_pool: &web::Data<Database>,
) -> Vec<CollectionStatus> {
    let mut collections = vec![];
    
    // Get collection info from database
    let solr_db_id = db.id;  // Copy the i32 value instead of capturing the reference
    let db_infos = execute_db_query(db_pool.clone(), move |conn| {
        info_dsl::solr_database_info
            .filter(info_dsl::solr_database_id.eq(solr_db_id))
            .load::<crate::services::solr_database_info::SolrDatabaseInfo>(conn)
    }).await.unwrap_or_default();

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
        },
        _ => None
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
    let user_count = execute_db_query(db.clone(), |conn| {
        users.count().get_result::<i64>(conn)
    }).await?;

    let collection_count = execute_db_query(db.clone(), |conn| {
        solr_dsl::solr_databases.count().get_result::<i64>(conn)
    }).await?;

    let active_collections = execute_db_query(db.clone(), |conn| {
        info_dsl::solr_database_info
            .filter(info_dsl::embeddings.ne("none"))
            .count()
            .get_result::<i64>(conn)
    }).await.unwrap_or(0);

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
    db: web::Data<Database>
) -> Result<HttpResponse, AppError> {
    let client = Client::new();
    
    // Get basic user stats
    let user_count = execute_db_query(db.clone(), |conn| {
        users.count().get_result::<i64>(conn)
    }).await?;

    let collection_count = execute_db_query(db.clone(), |conn| {
        solr_dsl::solr_databases.count().get_result::<i64>(conn)
    }).await?;

    let active_collections = execute_db_query(db.clone(), |conn| {
        info_dsl::solr_database_info
            .filter(info_dsl::embeddings.ne("none"))
            .count()
            .get_result::<i64>(conn)
    }).await.unwrap_or(0);

    // Get active sessions (sessions from last 24 hours)
    let active_sessions = execute_db_query(db.clone(), |conn| {
        use chrono::{Utc, Duration as ChronoDuration};
        let yesterday = Utc::now().naive_utc() - ChronoDuration::hours(24);
        
        session_dsl::user_sessions
            .filter(session_dsl::updated_at.gt(yesterday))
            .count()
            .get_result::<i64>(conn)
    }).await.unwrap_or(0);

    // Get recent registrations (last 24 hours)
    let recent_registrations = execute_db_query(db.clone(), |conn| {
        use chrono::{Utc, Duration as ChronoDuration};
        let yesterday = Utc::now().naive_utc() - ChronoDuration::hours(24);
        
        users.filter(created_at.gt(yesterday))
            .count()
            .get_result::<i64>(conn)
    }).await.unwrap_or(0);

    // Get all Solr databases
    let solr_databases_list = execute_db_query(db.clone(), |conn| {
        solr_dsl::solr_databases.load::<crate::services::solr_database::SolrDatabase>(conn)
    }).await?;

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