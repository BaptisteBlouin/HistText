//! This module provides document corpus statistics computation functionality.
//! 
//! Features:
//! - Reading cached query results from Solr
//! - Language detection for proper stopword selection
//! - Parallel processing of documents using Rayon
//! - Word, bigram, and trigram frequency distributions
//! - Metadata field value distributions
//! - Time-based document counts and vocabulary metrics

use actix_web::{web, HttpResponse};
use anyhow::{Context, Result};
use log::{error, info};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use std::time::Instant;
use stop_words::{get, LANGUAGE as SwLang};
use utoipa::{IntoParams, ToSchema};
use whatlang::detect;

use crate::config::Config;
use crate::histtext::tokenizer::tokenize_text;
use rustc_hash::FxHashMap;

/// Query parameters for statistics requests
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct PathQueryParams {
    /// Path to cached statistics data
    #[schema(example = "/tmp/stats_cache.json")]
    pub path: Option<String>,
}

/// Dashboard statistics for the application
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DashboardStats {
    /// Total number of documents in the system
    #[schema(example = "41254")]
    total_docs: i64,
    /// Total number of collections
    #[schema(example = "18")]
    total_collections: i64,
    /// Total number of registered users
    #[schema(example = "3")]
    total_users: i64,
    /// Number of currently active collections
    #[schema(example = "5")]
    active_collections: i64,
}

/// Cache configuration structure from disk
#[derive(Debug, Serialize, Deserialize)]
pub struct CacheConfig {
    /// Level of statistics to compute (None, Partial, All)
    stats_level: String,
    /// Total number of results in the query
    total_results: u64,
    /// Array of document objects
    concatenated_docs: Vec<Value>,
    /// Fields considered relevant for metadata statistics
    relevant_fields: Vec<String>,
    /// Text fields for language processing
    text_general_fields: Vec<String>,
}

/// Accumulates statistics during document processing
#[derive(Debug, Default)]
struct Accumulator {
    /// Distribution of documents by year
    date_counts: FxHashMap<String, u64>,
    /// Distribution of values within metadata fields
    metadata_distributions: FxHashMap<String, FxHashMap<String, u64>>,
    /// Combined text from all documents
    aggregated_text: String,
    /// Word frequency counts
    word_counts: FxHashMap<String, u64>,
    /// Bigram frequency counts
    ngram_counts_2: FxHashMap<String, u64>,
    /// Trigram frequency counts
    ngram_counts_3: FxHashMap<String, u64>,
}

impl Accumulator {
    /// Merges another accumulator's data into this one
    ///
    /// # Arguments
    /// * `other` - Another accumulator to merge from
    fn merge(&mut self, other: Accumulator) {
        // Merge date counts
        for (key, value) in other.date_counts {
            *self.date_counts.entry(key).or_insert(0) += value;
        }

        // Merge metadata distributions
        for (key, field_distribution) in other.metadata_distributions {
            let self_distribution = self.metadata_distributions.entry(key).or_default();

            for (field_key, field_value) in field_distribution {
                *self_distribution.entry(field_key).or_insert(0) += field_value;
            }
        }

        // Append text
        self.aggregated_text.push_str(&other.aggregated_text);

        // Merge word counts
        for (key, value) in other.word_counts {
            *self.word_counts.entry(key).or_insert(0) += value;
        }

        // Merge bigram counts
        for (key, value) in other.ngram_counts_2 {
            *self.ngram_counts_2.entry(key).or_insert(0) += value;
        }

        // Merge trigram counts
        for (key, value) in other.ngram_counts_3 {
            *self.ngram_counts_3.entry(key).or_insert(0) += value;
        }
    }
}

/// Reads a cache file containing document data and configuration
///
/// # Arguments
/// * `path` - Filesystem path to the cache JSON file
///
/// # Returns
/// Parsed configuration or an I/O/parse error
async fn read_cache_file(path: &str) -> Result<CacheConfig> {
    let file_contents = tokio::fs::read_to_string(path)
        .await
        .context("Failed to read cache file")?;
    let cache_config: CacheConfig =
        serde_json::from_str(&file_contents).context("Failed to parse JSON from cache file")?;
    Ok(cache_config)
}

/// Detects if the document corpus is in a CJK language
///
/// # Arguments
/// * `docs` - Slice of JSON documents
/// * `text_fields` - List of field names to concatenate for sampling
///
/// # Returns
/// Boolean indicating whether the detected language is Chinese, Japanese, or Korean
fn detect_language(docs: &[Value], text_fields: &[String]) -> bool {
    docs.first()
        .and_then(|first_doc| {
            // Concatenate the first document's text fields
            let sample: String = text_fields
                .iter()
                .filter_map(|f| {
                    first_doc
                        .get(f)
                        .and_then(|v| v.as_str())
                        .map(String::from)
                })
                .collect::<Vec<_>>()
                .join(" ");
            detect(&sample).map(|info| ["zh", "ja", "ko"].contains(&info.lang().code()))
        })
        .unwrap_or(false)
}

/// Processes documents to extract statistics
///
/// # Arguments
/// * `docs` - Slice of JSON documents
/// * `text_general_fields` - Fields to include in text aggregation
/// * `stopwords` - Set of stopwords to exclude
/// * `stats_level` - Level of statistics to compute
/// * `relevant_fields` - Fields to include in metadata distributions
/// * `main_date_field` - Field name for date-based counts
///
/// # Returns
/// Accumulator containing all intermediate counts and aggregated text
fn process_documents(
    docs: &[Value],
    text_general_fields: &[String],
    stopwords: &HashSet<String>,
    stats_level: &str,
    relevant_fields: &[String],
    main_date_field: &str,
) -> Accumulator {
    docs.par_iter()
        .fold(Accumulator::default, |mut acc, doc| {
            // Extract and count years from date field
            if let Some(Value::String(date_str)) = doc.get(main_date_field) {
                if let Some(year) = date_str.get(0..4) {
                    *acc.date_counts.entry(year.to_string()).or_insert(0) += 1;
                }
            }

            // Extract text from document fields
            let mut doc_text = String::new();
            if let Some(obj) = doc.as_object() {
                for key in text_general_fields {
                    if let Some(Value::String(txt)) = obj.get(key) {
                        acc.aggregated_text.push_str(txt);
                        acc.aggregated_text.push(' ');
                        doc_text.push_str(txt);
                        doc_text.push(' ');
                    }
                }
            }

            // Tokenize text and count words
            let tokens: Vec<String> = tokenize_text(&doc_text, true)
                .into_iter()
                .filter(|tok| !tok.trim().is_empty())
                .collect();

            // Count words (excluding stopwords)
            for tok in &tokens {
                if !stopwords.contains(tok) {
                    *acc.word_counts.entry(tok.clone()).or_insert(0) += 1;
                }
            }

            // Generate and count bigrams and trigrams
            for i in 0..tokens.len() {
                if i + 1 < tokens.len() {
                    let bigram = format!("{} {}", tokens[i], tokens[i + 1]);
                    *acc.ngram_counts_2.entry(bigram).or_insert(0) += 1;
                }
                if i + 2 < tokens.len() {
                    let trigram = format!("{} {} {}", tokens[i], tokens[i + 1], tokens[i + 2]);
                    *acc.ngram_counts_3.entry(trigram).or_insert(0) += 1;
                }
            }

            // Gather metadata field distributions if requested
            if stats_level != "None" {
                if let Some(obj) = doc.as_object() {
                    for (key, value) in obj {
                        let key_lc = key.to_lowercase();
                        if relevant_fields.contains(key)
                            && !key_lc.starts_with("date")
                            && !key_lc.ends_with("date")
                        {
                            let dist = acc.metadata_distributions.entry(key.clone()).or_default();

                            match value {
                                Value::String(s) => {
                                    *dist.entry(s.clone()).or_insert(0) += 1;
                                }
                                Value::Array(arr) => {
                                    for v in arr {
                                        if let Value::String(s) = v {
                                            *dist.entry(s.clone()).or_insert(0) += 1;
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }

            acc
        })
        .reduce(Accumulator::default, |mut a, b| {
            a.merge(b);
            a
        })
}

/// Converts the accumulated statistics into a JSON-serializable map
///
/// # Arguments
/// * `total_results` - Total number of documents processed
/// * `accumulator` - Merged counts and text from processing
/// * `stats_level` - Configured statistics depth
///
/// # Returns
/// Map containing the final statistics or an error
fn calculate_final_statistics(
    total_results: u64,
    accumulator: Accumulator,
    stats_level: &str,
) -> Result<Map<String, Value>> {
    let mut stats = Map::new();

    if stats_level != "None" {
        let Accumulator {
            date_counts,
            metadata_distributions,
            aggregated_text,
            word_counts,
            ngram_counts_2,
            ngram_counts_3,
        } = accumulator;

        // Add distribution statistics for each metadata field
        for (field, dist) in metadata_distributions {
            stats.insert(format!("distribution_over_{}", field), json!(dist));
        }

        // Add time-based distribution if available
        if !date_counts.is_empty() {
            stats.insert("distribution_over_time".into(), json!(date_counts));
        }

        // Add detailed statistics if requested
        if stats_level == "All" {
            let total_words: u64 = word_counts.values().sum();
            let avg_words_per_doc = total_words as f64 / total_results as f64;
            let unique_words = word_counts.len();
            let sentences = aggregated_text.matches('.').count() as u64;
            let avg_sentence_length = if sentences > 0 {
                total_words as f64 / sentences as f64
            } else {
                0.0
            };

            stats.insert("average_words_per_doc".into(), json!(avg_words_per_doc));
            stats.insert(
                "average_unique_words_per_doc".into(),
                json!(unique_words as f64 / total_results as f64),
            );
            stats.insert("vocabulary_size".into(), json!(unique_words));
            stats.insert("average_sentence_length".into(), json!(avg_sentence_length));

            // Calculate top 50 most frequent words
            let mut wvec: Vec<_> = word_counts.into_iter().collect();
            wvec.par_sort_unstable_by(|a, b| b.1.cmp(&a.1));
            stats.insert(
                "most_frequent_words".into(),
                json!(wvec.into_iter().take(50).collect::<Vec<_>>()),
            );

            // Calculate top 50 most frequent bigrams
            let mut b2: Vec<_> = ngram_counts_2.into_iter().collect();
            b2.par_sort_unstable_by(|a, b| b.1.cmp(&a.1));
            stats.insert(
                "most_frequent_bigrams".into(),
                json!(b2.into_iter().take(50).collect::<Vec<_>>()),
            );

            // Calculate top 50 most frequent trigrams
            let mut b3: Vec<_> = ngram_counts_3.into_iter().collect();
            b3.par_sort_unstable_by(|a, b| b.1.cmp(&a.1));
            stats.insert(
                "most_frequent_trigrams".into(),
                json!(b3.into_iter().take(50).collect::<Vec<_>>()),
            );
        }

        stats.insert("total_results".into(), json!(total_results));
    }

    Ok(stats)
}

/// Computes statistical analysis for a corpus of documents
///
/// Orchestrates the process of:
/// 1. Reading the cache file containing Solr documents
/// 2. Detecting document language for stopword selection
/// 3. Loading appropriate stopwords for the detected language
/// 4. Processing documents in parallel to gather statistics
/// 5. Generating final statistical outputs
/// 6. Cleaning up the cache file after processing
///
/// # Arguments
/// * `query` - Optional path parameter to the JSON cache file
///
/// # Returns
/// HTTP response with JSON statistics or detailed error description
#[utoipa::path(
    get,
    path = "/api/solr/stats",
    tag = "Statistics",
    params(PathQueryParams),
    responses(
        (status = 200, description = "Statistical analysis of query results including distributions, frequency metrics, and n-grams", body = Object),
        (status = 500, description = "Error reading cache file, language detection failure, or statistical calculation error")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn calculate_statistics(
    query: web::Query<PathQueryParams>,
) -> Result<HttpResponse, actix_web::Error> {
    let config = Config::global();
    let start_total_time = Instant::now();
    let cache_file_path = query.path.as_deref().unwrap_or("");

    // Load cache
    let cache_config = match read_cache_file(cache_file_path).await {
        Ok(cfg) => cfg,
        Err(e) => {
            error!("Failed to read cache file: {}", e);
            return Ok(HttpResponse::InternalServerError().json(json!({
                "error": "Failed to read cache file",
                "details": e.to_string()
            })));
        }
    };

    // Detect document language for proper stopword selection
    let is_chinese_like = detect_language(
        &cache_config.concatenated_docs,
        &cache_config.text_general_fields,
    );

    // Select appropriate stopwords based on detected language
    let stopwords: HashSet<String> = if is_chinese_like {
        get(SwLang::Chinese).into_iter().collect()
    } else {
        get(SwLang::English)
            .into_iter()
            .map(|w| w.to_lowercase())
            .collect()
    };

    // Process documents to extract statistics
    let accumulator = process_documents(
        &cache_config.concatenated_docs,
        &cache_config.text_general_fields,
        &stopwords,
        &cache_config.stats_level,
        &cache_config.relevant_fields,
        &config.main_date_value,
    );

    // Calculate final statistics from accumulated data
    let stats_result = match calculate_final_statistics(
        cache_config.total_results,
        accumulator,
        &cache_config.stats_level,
    ) {
        Ok(m) => m,
        Err(e) => {
            error!("Failed to calculate statistics: {}", e);
            return Ok(HttpResponse::InternalServerError().json(json!({
                "error": "Failed to calculate statistics",
                "details": e.to_string()
            })));
        }
    };

    // Cleanup cache file
    if let Err(e) = tokio::fs::remove_file(cache_file_path).await {
        error!("Failed to remove cache file: {}", e);
    }

    info!("Total processing time: {:?}", start_total_time.elapsed());
    Ok(HttpResponse::Ok().json(stats_result))
}