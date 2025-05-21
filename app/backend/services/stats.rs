//! Application statistics and metrics.
//!
//! This module provides endpoints for retrieving system-wide statistics,
//! including user counts, role and permission metrics, collection counts,
//! and embedding cache monitoring. It aggregates data from multiple tables
//! to provide dashboard metrics and cache management functionality.

use actix_web::{web, HttpResponse};
use diesel::dsl::count_distinct;
use diesel::prelude::*;
use serde::Serialize;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::histtext::embeddings;
use crate::services::crud::{execute_db_query, CrudError};
use crate::services::database::Database;

/// Dashboard statistics model
///
/// Represents high-level metrics about the application,
/// including user counts, role counts, and system statistics.
#[derive(Serialize, ToSchema)]
pub struct DashboardStats {
    /// Number of activated user accounts
    #[schema(example = 42)]
    pub active_users: i64,

    /// Total number of user accounts (active and inactive)
    #[schema(example = 100)]
    pub total_users: i64,

    /// Number of distinct roles in the system
    #[schema(example = 5)]
    pub total_roles: i64,

    /// Number of distinct permissions in the system
    #[schema(example = 10)]
    pub total_permissions: i64,

    /// Number of Solr collections configured
    #[schema(example = 3)]
    pub solr_collections: i64,

    /// Number of embedding files currently loaded in memory
    #[schema(example = 2)]
    pub embedding_files_loaded: usize,

    /// Number of collections with cached embeddings
    #[schema(example = 5)]
    pub embedding_collections_cached: usize,

    /// Total number of words loaded in embedding cache
    #[schema(example = 400000)]
    pub embedding_words_loaded: usize,
}

/// Handler for statistics operations
///
/// Encapsulates business logic for gathering and returning
/// statistics from various parts of the application.
pub struct StatsHandler {
    /// Application configuration
    #[allow(dead_code)]
    config: Arc<Config>,
}

impl StatsHandler {
    /// Creates a new handler with the provided configuration
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new StatsHandler instance
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Retrieves comprehensive dashboard statistics
    ///
    /// Aggregates metrics from multiple database tables and embedding cache
    /// to provide a complete overview of the system state.
    ///
    /// # Arguments
    /// * `db` - Database connection
    ///
    /// # Returns
    /// HTTP response with dashboard statistics as JSON
    pub async fn get_dashboard_stats(
        &self,
        db: web::Data<Database>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::role_permissions::dsl as role_permissions_dsl;
        use crate::schema::solr_databases::dsl as solr_dbs_dsl;
        use crate::schema::user_roles::dsl as user_roles_dsl;
        use crate::schema::users::dsl as users_dsl;

        // Count active users
        let active_users = execute_db_query(db.clone(), |conn| {
            users_dsl::users
                .filter(users_dsl::activated.eq(true))
                .count()
                .get_result(conn)
        })
        .await?;

        // Count total users
        let total_users =
            execute_db_query(db.clone(), |conn| users_dsl::users.count().get_result(conn)).await?;

        // Count distinct roles
        let total_roles = execute_db_query(db.clone(), |conn| {
            user_roles_dsl::user_roles
                .select(count_distinct(user_roles_dsl::role))
                .first(conn)
        })
        .await?;

        // Count distinct permissions
        let total_permissions = execute_db_query(db.clone(), |conn| {
            role_permissions_dsl::role_permissions
                .select(count_distinct(role_permissions_dsl::permission))
                .first(conn)
        })
        .await?;

        // Count Solr collections
        let solr_collections = execute_db_query(db, |conn| {
            solr_dbs_dsl::solr_databases.count().get_result(conn)
        })
        .await?;

        // Get embedding cache statistics
        let cache_stats = embeddings::get_cache_stats();

        // Assemble all stats into one response
        let stats = DashboardStats {
            active_users,
            total_users,
            total_roles,
            total_permissions,
            solr_collections,
            embedding_files_loaded: cache_stats.path_cache_entries,
            embedding_collections_cached: cache_stats.collection_cache_entries,
            embedding_words_loaded: cache_stats.total_embeddings_loaded,
        };

        Ok(HttpResponse::Ok().json(stats))
    }
}

/// Retrieves application dashboard statistics
///
/// Aggregates metrics from multiple tables to provide high-level
/// information about users, roles, permissions, and system configuration.
/// Requires admin permissions to access.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with dashboard metrics as JSON
#[utoipa::path(
    get,
    path = "/api/stats",
    tag = "Stats",
    responses(
        (status = 200, description = "Dashboard statistics with user, role, permission, and system counts", body = DashboardStats),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_dashboard_stats(
    db: web::Data<Database>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = StatsHandler::new(config.get_ref().clone());
    handler
        .get_dashboard_stats(db)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))
}

/// Retrieves detailed embedding cache statistics
///
/// Returns information about currently loaded word embeddings,
/// including file counts, collection mappings, and memory usage.
///
/// # Returns
/// HTTP response with cache statistics as JSON
#[utoipa::path(
    get,
    path = "/api/embeddings/stats",
    tag = "Embeddings",
    responses(
        (status = 200, description = "Detailed embedding cache statistics", body = Object)
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_embeddings_stats() -> HttpResponse {
    let stats = embeddings::get_cache_stats();
    HttpResponse::Ok().json(stats)
}

/// Clears all embedding caches
///
/// Removes all loaded embeddings from memory, forcing them
/// to be reloaded on next access. This endpoint is useful for
/// troubleshooting or after updating embedding files.
/// Requires admin permissions.
///
/// # Returns
/// HTTP response with confirmation message
#[utoipa::path(
    post,
    path = "/api/embeddings/clear",
    tag = "Embeddings",
    responses(
        (status = 200, description = "Cache cleared successfully")
    ),
    security(("bearer_auth" = []))
)]
pub async fn clear_embeddings_cache() -> HttpResponse {
    embeddings::clear_caches().await;
    HttpResponse::Ok()
        .json(serde_json::json!({ "message": "Embeddings cache cleared successfully" }))
}
