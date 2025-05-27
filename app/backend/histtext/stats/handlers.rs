//! HTTP request handlers for statistical operations.

use actix_web::{web, Error, HttpResponse};
use anyhow::Result;
use log::{error, info};
use rayon::prelude::*;
use serde_json::{json, Map, Value};
use std::time::Instant;
use rustc_hash::FxHashMap;

use crate::config::Config;
use super::types::{PathQueryParams, Accumulator};
use super::utils::{read_cache_file, detect_language_fast, get_stopwords};
use super::processing::process_documents_ultra_optimized;

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
) -> Result<HttpResponse, Error> {
    let start_total_time = Instant::now();
    let cache_file_path = query.path.as_deref().unwrap_or("");

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

    info!("Processing {} documents with stats level: {}", 
          cache_config.concatenated_docs.len(), 
          cache_config.stats_level);

    let is_chinese_like = detect_language_fast(
        &cache_config.concatenated_docs,
        &cache_config.text_general_fields,
    );

    let stopwords = get_stopwords(is_chinese_like);
    let config = Config::global();
    
    let accumulator = process_documents_ultra_optimized(
        &cache_config.concatenated_docs,
        &cache_config.text_general_fields,
        &stopwords,
        &cache_config.stats_level,
        &cache_config.relevant_fields,
        &config.main_date_value,
    );

    info!("Generated {} metadata distributions, {} words, {} bigrams, {} trigrams",
          accumulator.metadata_distributions.len(),
          accumulator.word_counts.len(),
          accumulator.ngram_counts_2.len(),
          accumulator.ngram_counts_3.len());

    let stats_result = match calculate_final_statistics_optimized(
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

    info!("Final statistics contains {} entries", stats_result.len());

    if let Err(e) = tokio::fs::remove_file(cache_file_path).await {
        error!("Failed to remove cache file: {}", e);
    }

    info!("Total processing time: {:?}", start_total_time.elapsed());
    Ok(HttpResponse::Ok().json(stats_result))
}

/// Calculates final statistics from the accumulated data
/// 
/// # Arguments
/// * `total_results` - Total number of documents processed
/// * `accumulator` - Accumulated statistical data
/// * `stats_level` - Level of detail for statistics
/// 
/// # Returns
/// Result containing the final statistics map
fn calculate_final_statistics_optimized(
    total_results: u64,
    accumulator: Accumulator,
    stats_level: &str,
) -> Result<Map<String, Value>> {
    let mut stats = Map::new();

    if stats_level == "None" {
        stats.insert("total_results".into(), json!(total_results));
        return Ok(stats);
    }

    let Accumulator {
        date_counts,
        metadata_distributions,
        aggregated_text: _,
        word_counts,
        ngram_counts_2,
        ngram_counts_3,
        total_text_length: _,
        sentence_count,
        document_lengths,
        word_lengths,
        capitalized_words,
        numeric_values,
        languages_detected,
        punctuation_counts,
        paragraph_count,
        empty_documents,
        date_decades,
        field_completeness,
    } = accumulator;

    // Add metadata distributions
    for (field, dist) in metadata_distributions {
        if !dist.is_empty() {
            stats.insert(format!("distribution_over_{}", field), json!(dist));
        }
    }

    // Add temporal distributions
    if !date_counts.is_empty() {
        stats.insert("distribution_over_time".into(), json!(date_counts));
    }

    if !date_decades.is_empty() {
        stats.insert("distribution_over_decades".into(), json!(date_decades));
    }

    // Add document length statistics
    if !document_lengths.is_empty() {
        add_document_length_stats(&mut stats, &document_lengths);
    }

    // Add word length distribution
    if !word_lengths.is_empty() {
        let mut wl_vec: Vec<_> = word_lengths.into_iter().collect();
        wl_vec.sort_by_key(|&(len, _)| len);
        stats.insert("word_length_distribution".into(), json!(wl_vec));
    }

    // Add language detection results
    if !languages_detected.is_empty() {
        stats.insert("languages_detected".into(), json!(languages_detected));
    }

    // Add field completeness
    if !field_completeness.is_empty() {
        add_field_completeness_stats(&mut stats, &field_completeness, total_results);
    }

    // Add punctuation statistics
    if !punctuation_counts.is_empty() {
        add_punctuation_stats(&mut stats, punctuation_counts);
    }

    // Add corpus overview
    add_corpus_overview(&mut stats, total_results, &word_counts, empty_documents, 
                       paragraph_count, sentence_count, capitalized_words, &numeric_values);

    // Add word frequency analysis
    if (stats_level == "All" || stats_level == "Partial") && !word_counts.is_empty() {
        add_word_frequency_stats(&mut stats, word_counts, total_results, sentence_count, stats_level);
    }

    // Add n-gram analysis for detailed statistics
    if stats_level == "All" {
        add_ngram_stats(&mut stats, ngram_counts_2, ngram_counts_3);
    }

    stats.insert("total_results".into(), json!(total_results));
    Ok(stats)
}

/// Adds document length statistics to the results
fn add_document_length_stats(stats: &mut Map<String, Value>, document_lengths: &[usize]) {
    let min_doc_length = *document_lengths.iter().min().unwrap_or(&0);
    let max_doc_length = *document_lengths.iter().max().unwrap_or(&0);
    let avg_doc_length = document_lengths.iter().sum::<usize>() as f64 / document_lengths.len() as f64;
    
    let mut sorted_lengths = document_lengths.to_vec();
    sorted_lengths.sort_unstable();
    let median_doc_length = if sorted_lengths.len() % 2 == 0 {
        (sorted_lengths[sorted_lengths.len() / 2 - 1] + sorted_lengths[sorted_lengths.len() / 2]) as f64 / 2.0
    } else {
        sorted_lengths[sorted_lengths.len() / 2] as f64
    };

    stats.insert("document_length_stats".into(), json!({
        "min": min_doc_length,
        "max": max_doc_length,
        "average": avg_doc_length,
        "median": median_doc_length
    }));
}

/// Adds field completeness statistics
fn add_field_completeness_stats(
    stats: &mut Map<String, Value>, 
    field_completeness: &FxHashMap<String, u64>, 
    total_results: u64
) {
    let total_docs = total_results as f64;
    let completeness_percentages: FxHashMap<String, f64> = field_completeness
        .iter()
        .map(|(field, count)| (field.clone(), (*count as f64 / total_docs) * 100.0))
        .collect();
    stats.insert("field_completeness_percentage".into(), json!(completeness_percentages));
}

/// Adds punctuation statistics
fn add_punctuation_stats(stats: &mut Map<String, Value>, punctuation_counts: FxHashMap<char, u64>) {
    let mut punct_vec: Vec<_> = punctuation_counts.into_iter().collect();
    punct_vec.sort_by(|a, b| b.1.cmp(&a.1));
    stats.insert("most_common_punctuation".into(), json!(punct_vec.into_iter().take(10).collect::<Vec<_>>()));
}

/// Adds corpus overview statistics
fn add_corpus_overview(
    stats: &mut Map<String, Value>,
    total_results: u64,
    word_counts: &FxHashMap<String, u64>,
    empty_documents: u64,
    paragraph_count: u64,
    sentence_count: u64,
    capitalized_words: u64,
    numeric_values: &[String],
) {
    stats.insert("corpus_overview".into(), json!({
        "total_documents": total_results,
        "documents_with_content": total_results - empty_documents,
        "empty_documents": empty_documents,
        "total_paragraphs": paragraph_count,
        "total_sentences": sentence_count,
        "total_words": word_counts.values().sum::<u64>(),
        "unique_words": word_counts.len(),
        "capitalized_words": capitalized_words,
        "numeric_tokens": numeric_values.len(),
        "average_paragraphs_per_doc": if total_results > 0 { paragraph_count as f64 / total_results as f64 } else { 0.0 },
        "average_sentences_per_doc": if total_results > 0 { sentence_count as f64 / total_results as f64 } else { 0.0 }
    }));
}

/// Adds word frequency statistics
fn add_word_frequency_stats(
    stats: &mut Map<String, Value>,
    word_counts: FxHashMap<String, u64>,
    total_results: u64,
    sentence_count: u64,
    stats_level: &str,
) {
    let total_words: u64 = word_counts.values().sum();
    let unique_words = word_counts.len();
    
    let avg_words_per_doc = if total_results > 0 {
        total_words as f64 / total_results as f64
    } else {
        0.0
    };
    
    let avg_sentence_length = if sentence_count > 0 {
        total_words as f64 / sentence_count as f64
    } else {
        0.0
    };

    stats.insert("average_words_per_doc".into(), json!(avg_words_per_doc));
    stats.insert("average_unique_words_per_doc".into(), 
        json!(unique_words as f64 / total_results as f64));
    stats.insert("vocabulary_size".into(), json!(unique_words));
    stats.insert("average_sentence_length".into(), json!(avg_sentence_length));

    let mut wvec: Vec<_> = word_counts.into_iter().collect();
    wvec.par_sort_unstable_by(|a, b| b.1.cmp(&a.1));
    let word_limit = if stats_level == "All" { 50 } else { 25 };
    stats.insert(
        "most_frequent_words".into(),
        json!(wvec.into_iter().take(word_limit).collect::<Vec<_>>()),
    );
}

/// Adds n-gram statistics for detailed analysis
fn add_ngram_stats(
    stats: &mut Map<String, Value>,
    ngram_counts_2: FxHashMap<String, u64>,
    ngram_counts_3: FxHashMap<String, u64>,
) {
    if !ngram_counts_2.is_empty() {
        let mut b2: Vec<_> = ngram_counts_2.into_iter().collect();
        b2.par_sort_unstable_by(|a, b| b.1.cmp(&a.1));
        stats.insert(
            "most_frequent_bigrams".into(),
            json!(b2.into_iter().take(50).collect::<Vec<_>>()),
        );
    }

    if !ngram_counts_3.is_empty() {
        let mut b3: Vec<_> = ngram_counts_3.into_iter().collect();
        b3.par_sort_unstable_by(|a, b| b.1.cmp(&a.1));
        stats.insert(
            "most_frequent_trigrams".into(),
            json!(b3.into_iter().take(50).collect::<Vec<_>>()),
        );
    }
}