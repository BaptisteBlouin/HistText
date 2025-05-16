//! This module provides Named Entity Recognition (NER) functionality.
//! 
//! Features:
//! - Reading cached NER input data from disk
//! - Invoking Solr-based NER annotation service in batches
//! - Processing and returning structured JSON annotations
//! - Caching results for improved performance

use crate::config::Config;
use actix_web::{web, HttpResponse};
use dashmap::DashMap;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value as SerdeValue;
use serde_json::{Map, Value};
use std::{
    collections::HashMap,
    io::{self},
};
use utoipa::{IntoParams, ToSchema};

use log::{debug, error, info};
use tokio::fs;

use lazy_static::lazy_static;

lazy_static! {
    /// Cache for storing index data by collection
    static ref INDEX_CACHE: DashMap<String, HashMap<String, Vec<SerdeValue>>> = DashMap::new();
    /// Cache for storing binary annotation data
    static ref ANNOTATION_CACHE: DashMap<String, Vec<u8>> = DashMap::new();
}

/// Query parameters for NER data requests
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct PathQueryParams {
    /// Path to cached NER payload file
    #[schema(example = "/tmp/ner_cache.json")]
    pub path: Option<String>,
}

/// Retrieves named entity annotations for documents
///
/// Reads a cached NER payload (collection and document IDs) from a JSON file,
/// queries a specialized Solr collection with `-ner` suffix in batches,
/// and returns a mapping of document IDs to their entity annotations.
///
/// # Arguments
/// * `query` - Optional path parameter pointing to the cached payload file
///
/// # Returns
/// HTTP response with a JSON mapping of document IDs to NER annotations, or an error
#[utoipa::path(
    get,
    path = "/api/solr/ner",
    tag = "Named Entity Recognition",
    params(PathQueryParams),
    responses(
        (status = 200, description = "Named entity annotations mapped by document ID", body = Object),
        (status = 500, description = "Error reading cache file, invalid JSON format, or Solr NER query failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn fetch_ner_data(query: web::Query<PathQueryParams>) -> Result<HttpResponse, io::Error> {
    let ner_path = query.path.as_deref().unwrap_or("");

    info!("Loading NER data from path: {}", ner_path);

    let cached_ner_data = match fs::read_to_string(ner_path).await {
        Ok(data) => data,
        Err(e) => {
            error!("Failed to read NER cache file: {}", e);
            return Err(e);
        }
    };

    let ner_data: Value = match serde_json::from_str(&cached_ner_data) {
        Ok(data) => data,
        Err(e) => {
            error!("Failed to parse NER cache JSON: {}", e);
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("Failed to parse NER cache JSON: {}", e),
            ));
        }
    };

    let collection = ner_data["collection"].as_str().unwrap_or_default();
    debug!("Processing NER for collection: {}", collection);

    let collected_ids: Vec<String> = match serde_json::from_value(ner_data["collected_ids"].clone())
    {
        Ok(ids) => ids,
        Err(e) => {
            error!("Failed to extract collected_ids from NER cache: {}", e);
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("Failed to extract collected_ids: {}", e),
            ));
        }
    };

    debug!(
        "Found {} document IDs for NER processing",
        collected_ids.len()
    );

    if collected_ids.is_empty() {
        info!("No document IDs found for NER processing, returning null");
        return Ok(HttpResponse::Ok().json(serde_json::Value::Null));
    }

    let ner_results = match get_ner_annotation_batch(collection, &collected_ids).await {
        Ok(results) => results,
        Err(e) => {
            error!("Error during NER annotation batch processing: {}", e);
            return Err(e);
        }
    };

    debug!("Retrieved NER results for {} documents", ner_results.len());

    let ner_data_map: Map<String, Value> = ner_results.into_iter().collect();

    // Only delete the cache file if processing was successful
    if let Err(e) = fs::remove_file(ner_path).await {
        error!("Failed to remove NER cache file: {}", e);
        // Continue anyway - this is not critical
    }

    info!(
        "Successfully processed NER data for collection: {}",
        collection
    );
    Ok(HttpResponse::Ok().json(Some(ner_data_map)))
}

/// Processes document IDs in batches to retrieve entity annotations
///
/// Splits document IDs into chunks, queries a Solr "-ner" collection for each chunk,
/// and assembles a mapping of document IDs to their annotation data.
///
/// # Arguments
/// * `collection` - Base collection name
/// * `ids` - Slice of document ID strings
///
/// # Returns
/// HashMap mapping each document ID to its annotation JSON, or an error
async fn get_ner_annotation_batch(
    collection: &str,
    ids: &[String],
) -> Result<HashMap<String, SerdeValue>, io::Error> {
    let config = Config::global();
    let solr_base_url = format!("http://localhost:{}", config.solr_ner_port);
    let solr_collection = format!("{}-{}", collection, "ner");

    info!(
        "Processing NER batch for collection: {}, NER collection: {}",
        collection, solr_collection
    );
    debug!("Using Solr NER URL: {}", solr_base_url);

    if ids.is_empty() {
        info!("Empty ID list provided for NER processing");
        return Ok(HashMap::new());
    }

    debug!("Processing {} IDs for NER", ids.len());
    let client = Client::new();

    let mut results = HashMap::new();
    // Process IDs in chunks to avoid excessively long URLs
    for (chunk_index, ids_chunk) in ids.chunks(50).enumerate() {
        debug!(
            "Processing NER chunk {} with {} IDs",
            chunk_index + 1,
            ids_chunk.len()
        );

        // Construct a Solr query for all IDs in this chunk
        let ids_query = ids_chunk
            .iter()
            .map(|id| format!("doc_id:\"{}\"", id))
            .collect::<Vec<_>>()
            .join(" OR ");

        let num_ids = ids_chunk.len();
        let query = format!("q=({})&rows={}", ids_query, num_ids);
        let url = format!(
            "{}/solr/{}/select?{}&wt=json",
            solr_base_url, solr_collection, query
        );

        debug!("NER Solr query URL: {}", url);

        let response = match client.get(&url).send().await {
            Ok(resp) => resp,
            Err(e) => {
                error!("HTTP request to Solr NER failed: {}", e);
                return Err(io::Error::new(
                    io::ErrorKind::Other,
                    format!("HTTP request failed: {}", e),
                ));
            }
        };

        if !response.status().is_success() {
            error!("Solr NER query failed with status: {}", response.status());
            return Err(io::Error::new(
                io::ErrorKind::Other,
                format!("Solr query failed with status: {}", response.status()),
            ));
        }

        let response_text = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                error!("Failed to read Solr NER response: {}", e);
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("Failed to read response: {}", e),
                ));
            }
        };

        let response_json: SerdeValue = match serde_json::from_str(&response_text) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to parse Solr NER response as JSON: {}", e);
                error!("Response text (truncated): {:.200}...", response_text);
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("Failed to parse Solr response: {}", e),
                ));
            }
        };

        let docs = match response_json
            .get("response")
            .and_then(|r| r.get("docs"))
            .and_then(|d| d.as_array())
        {
            Some(docs) => docs,
            None => {
                error!("Malformed Solr response: missing response.docs array");
                debug!("Solr response structure: {:?}", response_json);
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "Malformed Solr response",
                ));
            }
        };

        debug!("Retrieved {} NER documents from Solr", docs.len());

        // Extract document IDs and store the results
        for doc in docs {
            if let Some(doc_id) = extract_doc_id(doc) {
                debug!("Found NER data for document ID: {}", doc_id);
                results.insert(doc_id, doc.clone());
            } else {
                debug!("Skipping NER document without proper ID: {:?}", doc);
            }
        }
    }

    info!("Successfully processed NER for {} documents", results.len());
    Ok(results)
}

/// Extracts a document ID from a Solr document
///
/// Handles different possible ID field formats (array of strings, 
/// single string, alternate field names).
///
/// # Arguments
/// * `doc` - The Solr document JSON
///
/// # Returns
/// Document ID if found, or None if no ID field could be extracted
fn extract_doc_id(doc: &SerdeValue) -> Option<String> {
    // Try as array of strings first (most common case)
    if let Some(doc_ids) = doc.get("doc_id").and_then(|ids| ids.as_array()) {
        if let Some(first_id) = doc_ids.first().and_then(|id| id.as_str()) {
            return Some(String::from(first_id));
        }
    }

    // Try as a single string
    if let Some(id_str) = doc.get("doc_id").and_then(|id| id.as_str()) {
        return Some(String::from(id_str));
    }

    // Try alternate field name "id"
    if let Some(id_str) = doc.get("id").and_then(|id| id.as_str()) {
        return Some(String::from(id_str));
    }

    None
}