//! Database operations for metadata retrieval.

use diesel::prelude::*;
use log::error;
use reqwest::Client;
use serde_json::Value;

use crate::config::Config;
use crate::schema::solr_databases::dsl::*;
use crate::services::database::DbPool;
use crate::services::solr_database::SolrDatabase;

use super::cache::{cache_fields, generate_cache_key, get_cached_fields};

/// Fetches and categorizes field metadata for a collection
///
/// This function retrieves field schema information from Solr and categorizes
/// fields into relevant fields, text fields, and ID fields based on configuration.
/// Results are cached to improve performance on subsequent requests.
///
/// # Arguments
/// * `client` - HTTP client for Solr requests
/// * `pool` - Database connection pool
/// * `solr_database_id` - Database identifier
/// * `collection` - Collection name
/// * `ids` - Mutable vector to store discovered ID field names
///
/// # Returns
/// Tuple containing (relevant_fields, text_general_fields)
pub async fn fetch_metadata(
    client: &Client,
    pool: &DbPool,
    solr_database_id: i32,
    collection: &str,
    ids: &mut Vec<String>,
) -> (Vec<String>, Vec<String>) {
    let cache_key = generate_cache_key(solr_database_id, collection);

    if let Some((relevant, text_general, id_fields)) = get_cached_fields(&cache_key) {
        ids.extend(id_fields);
        return (relevant, text_general);
    }

    let config = Config::global();

    let mut conn = match pool.get() {
        Ok(conn) => conn,
        Err(e) => {
            error!("Database connection error: {}", e);
            return (Vec::new(), Vec::new());
        }
    };

    let solr_db = match solr_databases
        .filter(id.eq(solr_database_id))
        .first::<SolrDatabase>(&mut conn)
    {
        Ok(db) => db,
        Err(e) => {
            error!("Solr database not found: {}", e);
            return (Vec::new(), Vec::new());
        }
    };

    let port = solr_db.local_port;
    let metadata_url = format!(
        "http://localhost:{}/solr/{}/schema/fields?wt=json",
        port, collection
    );

    let exclude_field_types = &config.exclude_field_types;
    let exclude_request_name_starts_with = &config.exclude_request_name_starts_with;
    let exclude_request_name_ends_with = &config.exclude_request_name_ends_with;
    let id_starts_with = &config.id_starts_with;
    let id_ends_with = &config.id_ends_with;

    if let Ok(response) = client.get(&metadata_url).send().await {
        if response.status().is_success() {
            if let Ok(metadata) = response.json::<Value>().await {
                if let Some(fields) = metadata["fields"].as_array() {
                    let mut relevant = Vec::new();
                    let mut text_general = Vec::new();
                    let mut id_fields = Vec::new();

                    for field in fields {
                        if let Some(field_name) = field["name"].as_str() {
                            let lower_name = field_name.to_lowercase();

                            // Check if field is an ID field
                            if lower_name.starts_with(id_starts_with)
                                || lower_name.ends_with(id_ends_with)
                            {
                                id_fields.push(field_name.to_string());
                                continue;
                            }

                            // Skip excluded field names
                            if field_name.starts_with(exclude_request_name_starts_with)
                                || field_name.ends_with(exclude_request_name_ends_with)
                            {
                                continue;
                            }

                            // Categorize by field type
                            if let Some(field_type) = field["type"].as_str() {
                                if exclude_field_types.contains(&field_type.to_string()) {
                                    text_general.push(field_name.to_string());
                                } else {
                                    relevant.push(field_name.to_string());
                                }
                            }
                        }
                    }

                    ids.extend(id_fields.clone());
                    cache_fields(cache_key, relevant.clone(), text_general.clone(), id_fields);
                    return (relevant, text_general);
                }
            }
        }
    }

    (Vec::new(), Vec::new())
}

/// Retrieves Solr database configuration by ID
pub async fn get_solr_database(
    pool: &DbPool,
    database_id: i32,
) -> Result<SolrDatabase, diesel::result::Error> {
    let mut conn = pool.get().map_err(|_| {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UnableToSendCommand,
            Box::new("Failed to get database connection".to_string()),
        )
    })?;

    solr_databases
        .filter(id.eq(database_id))
        .first::<SolrDatabase>(&mut conn)
}
