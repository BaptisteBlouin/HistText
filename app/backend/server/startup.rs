//! Server startup procedures and initialization tasks.
//!
//! This module contains functions that are executed during server initialization
//! to prepare resources, load data, and ensure the system is ready for operation.
//! It handles tasks like verifying embedding files availability.

use crate::config::Config;
use crate::schema::solr_database_info::dsl as info_dsl;
use crate::schema::solr_databases::dsl::*;
use crate::server::error::AppError;
use crate::server::state::DbPool;
use crate::services::solr_database::SolrDatabase;
use crate::services::solr_database_info::SolrDatabaseInfo;
use anyhow::Context;
use diesel::prelude::*;
use log::{info, warn};

/// Verifies and prepares embeddings for all configured collections
///
/// This function runs during server startup to:
/// 1. Fetch all Solr databases from the database
/// 2. For each database, find all collections with embeddings enabled
/// 3. Verify that embedding files exist and are accessible
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// Result indicating success or an error wrapped in AppError
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
