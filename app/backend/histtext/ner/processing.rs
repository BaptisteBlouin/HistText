//! NER processing logic and Solr integration.

use reqwest::Client;
use serde_json::Value as SerdeValue;
use std::collections::HashMap;
use std::io;
use log::{debug, error, info};

use crate::config::Config;

/// Processes NER annotations for a batch of document IDs
/// 
/// This function queries a Solr NER collection to retrieve named entity
/// annotations for the provided document IDs. It processes documents in
/// chunks to handle large batches efficiently.
/// 
/// # Arguments
/// * `collection` - Base collection name (NER collection will be derived)
/// * `ids` - Document IDs to process
/// 
/// # Returns
/// Result containing HashMap of document_id -> NER annotations
pub async fn get_ner_annotation_batch(
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
    let mut results = HashMap::with_capacity(ids.len());
    
    for (chunk_index, ids_chunk) in ids.chunks(50).enumerate() {
        debug!(
            "Processing NER chunk {} with {} IDs",
            chunk_index + 1,
            ids_chunk.len()
        );

        let chunk_results = process_ner_chunk(&client, &solr_base_url, &solr_collection, ids_chunk, config.solr_ner_port).await?;
        results.extend(chunk_results);
    }

    info!("Successfully processed NER for {} documents", results.len());
    Ok(results)
}

/// Processes a single chunk of document IDs for NER
async fn process_ner_chunk(
    client: &Client,
    solr_base_url: &str,
    solr_collection: &str,
    ids_chunk: &[String],
    solr_port: u16,
) -> Result<HashMap<String, SerdeValue>, io::Error> {
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

    let response = client.get(&url).send().await
        .map_err(|e| {
            error!("HTTP request to Solr NER failed: {}", e);
            error!("NER collection '{}' may not exist or Solr service at '{}' is not accessible", solr_collection, solr_base_url);
            error!("To fix this issue: 1) Ensure Solr is running on port {}, 2) Verify the '{}' collection exists, 3) Check network connectivity", solr_port, solr_collection);
            io::Error::new(io::ErrorKind::Other, format!("HTTP request failed: {}", e))
        })?;

    if !response.status().is_success() {
        error!("Solr NER query failed with status: {}", response.status());
        return Err(io::Error::new(
            io::ErrorKind::Other,
            format!("Solr query failed with status: {}", response.status()),
        ));
    }

    let response_text = response.text().await
        .map_err(|e| {
            error!("Failed to read Solr NER response: {}", e);
            io::Error::new(io::ErrorKind::InvalidData, format!("Failed to read response: {}", e))
        })?;

    let response_json: SerdeValue = serde_json::from_str(&response_text)
        .map_err(|e| {
            error!("Failed to parse Solr NER response as JSON: {}", e);
            error!("Response text (truncated): {:.200}...", response_text);
            io::Error::new(io::ErrorKind::InvalidData, format!("Failed to parse Solr response: {}", e))
        })?;

    let docs = response_json
        .get("response")
        .and_then(|r| r.get("docs"))
        .and_then(|d| d.as_array())
        .ok_or_else(|| {
            error!("Malformed Solr response: missing response.docs array");
            debug!("Solr response structure: {:?}", response_json);
            io::Error::new(io::ErrorKind::InvalidData, "Malformed Solr response")
        })?;

    debug!("Retrieved {} NER documents from Solr", docs.len());

    let mut chunk_results = HashMap::new();
    for doc in docs {
        if let Some(doc_id) = extract_doc_id(doc) {
            debug!("Found NER data for document ID: {}", doc_id);
            chunk_results.insert(doc_id, doc.clone());
        } else {
            debug!("Skipping NER document without proper ID: {:?}", doc);
        }
    }

    Ok(chunk_results)
}

/// Extracts document ID from a NER document
/// 
/// Tries multiple field names to find the document identifier
/// 
/// # Arguments
/// * `doc` - JSON document from Solr NER response
/// 
/// # Returns
/// Optional document ID string
pub fn extract_doc_id(doc: &SerdeValue) -> Option<String> {
    // Try doc_id as array first
    if let Some(doc_ids) = doc.get("doc_id").and_then(|ids| ids.as_array()) {
        if let Some(first_id) = doc_ids.first().and_then(|id| id.as_str()) {
            return Some(String::from(first_id));
        }
    }

    // Try doc_id as string
    if let Some(id_str) = doc.get("doc_id").and_then(|id| id.as_str()) {
        return Some(String::from(id_str));
    }

    // Try generic id field
    if let Some(id_str) = doc.get("id").and_then(|id| id.as_str()) {
        return Some(String::from(id_str));
    }

    None
}