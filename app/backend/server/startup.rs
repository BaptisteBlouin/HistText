//! Server startup procedures and initialization tasks.

use crate::config::Config;
use crate::schema::solr_database_info::dsl as info_dsl;
use crate::schema::solr_databases::dsl::*;
use crate::server::error::AppError;
use crate::services::database::{Database, DbPool};
use crate::services::role_assignment::get_role_assignment_service;
use crate::services::solr_database::SolrDatabase;
use crate::services::solr_database_info::SolrDatabaseInfo;
use actix_web::web::Data;
use anyhow::{self, Context};
use diesel::prelude::*;
use log::{info, warn};

/// Enhanced startup initialization with role setup
pub async fn initialize_application(pool: DbPool) -> Result<(), AppError> {
    info!("Starting application initialization...");

    // Initialize embeddings (existing functionality)
    if let Err(e) = preload_embeddings(pool.clone()).await {
        return Err(AppError::External(anyhow::Error::msg(format!(
            "Failed to preload embeddings: {}",
            e
        ))));
    }

    // Initialize default roles
    if let Err(e) = initialize_default_roles(pool.clone()).await {
        return Err(AppError::External(anyhow::Error::msg(format!(
            "Failed to initialize default roles: {}",
            e
        ))));
    }

    info!("Application initialization completed successfully");
    Ok(())
}

/// Initialize default roles and permissions
async fn initialize_default_roles(_pool: DbPool) -> Result<(), AppError> {
    info!("Initializing default roles and permissions...");

    let db_data = Data::new(Database::new());
    let role_service = get_role_assignment_service();

    // Ensure the default role exists
    role_service
        .ensure_default_role_exists(db_data.clone())
        .await
        .map_err(|e| {
            AppError::External(anyhow::Error::msg(format!(
                "Failed to ensure default role exists: {}",
                e
            )))
        })?;

    // Check for and fix any users missing the default role
    let missing_users = role_service
        .get_users_missing_default_role(db_data.clone())
        .await
        .map_err(|e| {
            AppError::External(anyhow::Error::msg(format!(
                "Failed to get users missing default role: {}",
                e
            )))
        })?;

    if !missing_users.is_empty() {
        info!(
            "Found {} activated users missing default role, assigning now...",
            missing_users.len()
        );
        role_service
            .batch_assign_default_role(db_data, missing_users, None)
            .await
            .map_err(|e| {
                AppError::External(anyhow::Error::msg(format!(
                    "Failed to batch assign default role: {}",
                    e
                )))
            })?;
    }

    info!("Default roles initialization completed");
    Ok(())
}

/// Verifies and prepares embeddings for all configured collections (existing function)
pub async fn preload_embeddings(pool: DbPool) -> Result<(), AppError> {
    info!("Starting to preload embeddings on server startup...");
    let config = Config::global();

    // Fetch all Solr databases from the database
    let mut conn = pool.get().context("Failed to get DB connection")?;
    let solr_dbs: Vec<SolrDatabase> = solr_databases
        .load::<SolrDatabase>(&mut conn)
        .context("Failed to load solr_databases")?;

    info!("Found {} Solr databases", solr_dbs.len());

    // Process each database's collections
    for db_entry in solr_dbs {
        let solr_database_id = db_entry.id;

        // Fetch all collections for this database that have embeddings configured
        let collections: Vec<SolrDatabaseInfo> = info_dsl::solr_database_info
            .filter(info_dsl::solr_database_id.eq(solr_database_id))
            .load::<SolrDatabaseInfo>(&mut conn)
            .unwrap_or_else(|_| {
                warn!(
                    "Failed to load collections for database ID {}",
                    solr_database_id
                );
                Vec::new()
            });

        info!(
            "Found {} collections for database ID {}",
            collections.len(),
            solr_database_id
        );

        // Process each collection
        for collection in collections {
            // Skip collections with disabled embeddings
            if collection.embeddings == "none" {
                info!(
                    "Skipping embeddings for collection '{}' (database ID {}): embeddings disabled",
                    collection.collection_name, solr_database_id
                );
                continue;
            }

            // Determine the embedding path - use default or specified path
            let embedding_path = match collection.embeddings.as_str() {
                "default" => config.embed_path.clone(),
                path => path.to_string(),
            };

            info!(
                "Preloading embeddings for collection '{}' (database ID {}) from path: {}",
                collection.collection_name, solr_database_id, embedding_path
            );

            // Spawn a task to verify the embedding file exists
            let file_path = embedding_path.clone();
            let collection_name = collection.collection_name.clone();

            tokio::spawn(async move {
                match tokio::fs::metadata(&file_path).await {
                    Ok(_) => {
                        info!(
                            "Verified embeddings file exists for collection {} (database ID {}): {}", 
                            collection_name, solr_database_id, file_path
                        );
                    }
                    Err(e) => {
                        warn!("Embeddings file does not exist at {}: {}", file_path, e);
                    }
                }
            });
        }
    }

    info!("Embeddings file verification complete");
    Ok(())
}
