//! Utility functions for document processing and text manipulation.

use serde_json::{json, Value};
use actix_web::Error;
use std::time::Instant;
use log::info;

use crate::services::solr_database::SolrDatabase;
use crate::services::database::DbPool;
use crate::schema::solr_databases::dsl::*;
use diesel::prelude::*;
use actix_web::web;

/// Creates an empty Solr response structure
pub fn empty_solr_response() -> Value {
    json!({
        "response": {
            "docs": [],
            "numFound": 0
        }
    })
}

/// Finds all case-insensitive occurrences of a needle in haystack
/// 
/// # Arguments
/// * `haystack` - Text to search in
/// * `needle` - Text to find
/// 
/// # Returns
/// Vector of (start, end) position tuples
pub fn find_all_occurrences_case_insensitive(haystack: &str, needle: &str) -> Vec<(usize, usize)> {
    let haystack_lower = haystack.to_lowercase();
    let needle_lower = needle.to_lowercase();
    let mut results = Vec::new();
    let mut start_pos = 0;

    while let Some(pos) = haystack_lower[start_pos..].find(&needle_lower) {
        let absolute_start = start_pos + pos;
        let absolute_end = absolute_start + needle.len();
        results.push((absolute_start, absolute_end));
        start_pos = absolute_end;
    }

    results
}

/// Extracts text context around a specific position with character boundary safety
/// 
/// # Arguments
/// * `full_text` - Source text
/// * `start_idx` - Start position of highlighted term
/// * `end_idx` - End position of highlighted term
/// * `context_len` - Number of characters to include on each side
/// 
/// # Returns
/// Text snippet with context around the highlighted term
pub fn extract_context(
    full_text: &str,
    start_idx: usize,
    end_idx: usize,
    context_len: usize,
) -> String {
    let text_len = full_text.len();
    let raw_start = start_idx.saturating_sub(context_len);
    let raw_end = (end_idx + context_len).min(text_len);
    let cstart = clamp_to_char_boundary(full_text, raw_start);
    let cend = clamp_to_char_boundary(full_text, raw_end);
    full_text[cstart..cend].to_string()
}

/// Ensures byte index falls on a valid UTF-8 character boundary
fn clamp_to_char_boundary(s: &str, byte_index: usize) -> usize {
    if byte_index >= s.len() {
        return s.len();
    }

    let mut prev_boundary = 0;
    for (i, _ch) in s.char_indices() {
        if i > byte_index {
            break;
        }
        prev_boundary = i;
    }
    prev_boundary
}

/// Retrieves Solr database configuration by ID
/// 
/// # Arguments
/// * `pool` - Database connection pool
/// * `solr_database_id` - Database identifier
/// 
/// # Returns
/// Result containing SolrDatabase configuration
pub async fn get_solr_database(
    pool: &web::Data<DbPool>,
    solr_database_id: i32,
) -> Result<SolrDatabase, String> {
    let mut conn = pool
        .get()
        .map_err(|e| format!("Database connection error: {}", e))?;
    solr_databases
        .filter(id.eq(solr_database_id))
        .first::<SolrDatabase>(&mut conn)
        .map_err(|_| "Solr database not found".to_string())
}

/// Logs elapsed time with a descriptive message
pub fn log_elapsed(start: Instant, message: &str) {
    info!("{} in: {:?}", message, start.elapsed());
}

/// Writes JSON data to a cache file asynchronously
pub async fn write_cache_file(path: &str, data: &Value) -> Result<(), Error> {
    tokio::fs::write(path, serde_json::to_string(data).unwrap()).await?;
    Ok(())
}