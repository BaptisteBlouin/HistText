//! Utility functions for statistical analysis.

use anyhow::Result;
use serde_json::Value;
use std::collections::HashSet;
use whatlang::detect;

use super::types::CacheConfig;

/// Reads and parses the cache file containing statistics data
///
/// # Arguments
/// * `path` - Path to the cache file
///
/// # Returns
/// Result containing the parsed cache configuration
pub async fn read_cache_file(path: &str) -> Result<CacheConfig> {
    let file_contents = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to read cache file: {}", e))?;

    let cache_config: CacheConfig = serde_json::from_str(&file_contents)
        .map_err(|e| anyhow::anyhow!("Failed to parse JSON from cache file: {}", e))?;

    Ok(cache_config)
}

/// Detects if the document collection contains CJK languages
///
/// # Arguments
/// * `docs` - Collection of documents to analyze
/// * `text_fields` - Fields containing text content
///
/// # Returns
/// True if CJK languages are detected, false otherwise
pub fn detect_language_fast(docs: &[Value], text_fields: &[String]) -> bool {
    if let Some(first_doc) = docs.first() {
        let sample: String = text_fields
            .iter()
            .take(3)
            .filter_map(|f| first_doc.get(f)?.as_str())
            .take(500)
            .collect::<Vec<_>>()
            .join(" ");

        if sample.len() < 50 {
            return false;
        }

        detect(&sample)
            .map(|info| ["zh", "ja", "ko"].contains(&info.lang().code()))
            .unwrap_or(false)
    } else {
        false
    }
}

/// Creates appropriate stopwords set based on language detection
///
/// # Arguments
/// * `is_chinese_like` - Whether CJK languages were detected
///
/// # Returns
/// HashSet containing stopwords for the detected language
pub fn get_stopwords(is_chinese_like: bool) -> HashSet<String> {
    use stop_words::{get, LANGUAGE as SwLang};

    if is_chinese_like {
        get(SwLang::Chinese).into_iter().collect()
    } else {
        get(SwLang::English)
            .into_iter()
            .map(|w| w.to_lowercase())
            .collect()
    }
}
