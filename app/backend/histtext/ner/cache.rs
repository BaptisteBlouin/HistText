//! Caching functionality for NER operations.

use dashmap::DashMap;
use lazy_static::lazy_static;
use serde_json::Value as SerdeValue;
use std::collections::HashMap;

lazy_static! {
    /// Cache for NER results to avoid repeated Solr queries
    /// Key format: "collection:id1,id2,id3..."
    /// Value: HashMap of document_id -> NER annotations
    pub static ref NER_CACHE: DashMap<String, HashMap<String, SerdeValue>> = DashMap::new();
}

/// Generates a cache key for NER results
/// 
/// # Arguments
/// * `collection` - Collection name
/// * `ids` - Document IDs to include in the key
/// 
/// # Returns
/// String cache key for the given collection and IDs
pub fn generate_cache_key(collection: &str, ids: &[String]) -> String {
    format!("{}:{}", collection, ids.join(","))
}

/// Retrieves cached NER results if available
/// 
/// # Arguments
/// * `cache_key` - Cache key to look up
/// 
/// # Returns
/// Optional HashMap containing cached NER results
pub fn get_cached_ner_results(cache_key: &str) -> Option<HashMap<String, SerdeValue>> {
    NER_CACHE.get(cache_key).map(|entry| entry.clone())
}

/// Stores NER results in cache
/// 
/// # Arguments
/// * `cache_key` - Cache key for storage
/// * `results` - NER results to cache
pub fn cache_ner_results(cache_key: String, results: HashMap<String, SerdeValue>) {
    NER_CACHE.insert(cache_key, results);
}