//! Caching functionality for metadata operations.

use dashmap::DashMap;
use lazy_static::lazy_static;

lazy_static! {
    /// Cache for field metadata to avoid repeated Solr schema requests
    /// Key format: "database_id:collection_name"
    /// Value: (relevant_fields, text_general_fields, id_fields)
    pub static ref FIELD_CACHE: DashMap<String, (Vec<String>, Vec<String>, Vec<String>)> = DashMap::new();
}

/// Generates a cache key for field metadata
pub fn generate_cache_key(database_id: i32, collection: &str) -> String {
    format!("{}:{}", database_id, collection)
}

/// Retrieves cached field metadata if available
pub fn get_cached_fields(cache_key: &str) -> Option<(Vec<String>, Vec<String>, Vec<String>)> {
    FIELD_CACHE.get(cache_key).map(|entry| entry.clone())
}

/// Stores field metadata in cache
pub fn cache_fields(
    cache_key: String,
    relevant: Vec<String>,
    text_general: Vec<String>,
    id_fields: Vec<String>,
) {
    FIELD_CACHE.insert(cache_key, (relevant, text_general, id_fields));
}
