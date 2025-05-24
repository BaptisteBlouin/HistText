use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use diesel::prelude::*;
use log::info;

use crate::schema::users::dsl::*;
use crate::schema::solr_databases::dsl as solr_dsl;
use crate::schema::solr_database_info::dsl as info_dsl;
use crate::services::database::Database;
use crate::services::error::{AppError, AppResult};
use crate::services::crud::execute_db_query;
use crate::histtext::embeddings::{cache, stats as embedding_stats};

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