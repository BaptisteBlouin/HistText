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
use crate::histtext::tokenizer::tokenize_text_fast;
use rustc_hash::FxHashMap;

#[derive(Deserialize, ToSchema, IntoParams)]
pub struct PathQueryParams {
    #[schema(example = "/tmp/stats_cache.json")]
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DashboardStats {
    #[schema(example = "41254")]
    total_docs: i64,
    #[schema(example = "18")]
    total_collections: i64,
    #[schema(example = "3")]
    total_users: i64,
    #[schema(example = "5")]
    active_collections: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheConfig {
    stats_level: String,
    total_results: u64,
    concatenated_docs: Vec<Value>,
    relevant_fields: Vec<String>,
    text_general_fields: Vec<String>,
}

#[derive(Debug, Default)]
struct Accumulator {
    date_counts: FxHashMap<String, u64>,
    metadata_distributions: FxHashMap<String, FxHashMap<String, u64>>,
    aggregated_text: String,
    word_counts: FxHashMap<String, u64>,
    ngram_counts_2: FxHashMap<String, u64>,
    ngram_counts_3: FxHashMap<String, u64>,
    total_text_length: usize,
    sentence_count: u64,
    document_lengths: Vec<usize>,
    word_lengths: FxHashMap<usize, u64>,
    capitalized_words: u64,
    numeric_values: Vec<String>,
    languages_detected: FxHashMap<String, u64>,
    punctuation_counts: FxHashMap<char, u64>,
    paragraph_count: u64,
    empty_documents: u64,
    date_decades: FxHashMap<String, u64>,
    field_completeness: FxHashMap<String, u64>,
}

impl Accumulator {
    fn merge(&mut self, other: Accumulator) {
        for (key, value) in other.date_counts {
            *self.date_counts.entry(key).or_insert(0) += value;
        }

        for (key, field_distribution) in other.metadata_distributions {
            let self_distribution = self.metadata_distributions.entry(key).or_default();
            for (field_key, field_value) in field_distribution {
                *self_distribution.entry(field_key).or_insert(0) += field_value;
            }
        }

        self.aggregated_text.push_str(&other.aggregated_text);

        for (key, value) in other.word_counts {
            *self.word_counts.entry(key).or_insert(0) += value;
        }

        for (key, value) in other.ngram_counts_2 {
            *self.ngram_counts_2.entry(key).or_insert(0) += value;
        }

        for (key, value) in other.ngram_counts_3 {
            *self.ngram_counts_3.entry(key).or_insert(0) += value;
        }

        self.total_text_length += other.total_text_length;
        self.sentence_count += other.sentence_count;

        self.document_lengths.extend(other.document_lengths);
        for (len, count) in other.word_lengths {
            *self.word_lengths.entry(len).or_insert(0) += count;
        }
        self.capitalized_words += other.capitalized_words;
        self.numeric_values.extend(other.numeric_values);
        for (lang, count) in other.languages_detected {
            *self.languages_detected.entry(lang).or_insert(0) += count;
        }
        for (punct, count) in other.punctuation_counts {
            *self.punctuation_counts.entry(punct).or_insert(0) += count;
        }
        self.paragraph_count += other.paragraph_count;
        self.empty_documents += other.empty_documents;
        for (decade, count) in other.date_decades {
            *self.date_decades.entry(decade).or_insert(0) += count;
        }
        for (field, count) in other.field_completeness {
            *self.field_completeness.entry(field).or_insert(0) += count;
        }
    }
}

async fn read_cache_file(path: &str) -> Result<CacheConfig> {
    let file_contents = tokio::fs::read_to_string(path)
        .await
        .context("Failed to read cache file")?;
    let cache_config: CacheConfig =
        serde_json::from_str(&file_contents).context("Failed to parse JSON from cache file")?;
    Ok(cache_config)
}

fn detect_language_fast(docs: &[Value], text_fields: &[String]) -> bool {
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

fn process_documents_ultra_optimized(
    docs: &[Value],
    text_general_fields: &[String],
    stopwords: &HashSet<String>,
    stats_level: &str,
    relevant_fields: &[String],
    main_date_field: &str,
) -> Accumulator {
    let chunk_size = if docs.len() > 10000 { 1000 } else { 500 };
    
    docs.par_chunks(chunk_size)
        .map(|chunk| {
            let mut acc = Accumulator::default();
            
            for doc in chunk {
                let mut doc_has_content = false;
                
                if let Some(Value::String(date_str)) = doc.get(main_date_field) {
                    if date_str.len() >= 4 {
                        if let Some(year) = date_str.get(0..4) {
                            *acc.date_counts.entry(year.to_string()).or_insert(0) += 1;
                            
                            if let Ok(year_num) = year.parse::<u32>() {
                                let decade = (year_num / 10) * 10;
                                *acc.date_decades.entry(format!("{}s", decade)).or_insert(0) += 1;
                            }
                        }
                    }
                }

                if let Some(obj) = doc.as_object() {
                    for field in relevant_fields {
                        if let Some(value) = obj.get(field) {
                            match value {
                                Value::String(s) if !s.is_empty() => {
                                    *acc.field_completeness.entry(field.clone()).or_insert(0) += 1;
                                }
                                Value::Array(arr) if !arr.is_empty() => {
                                    *acc.field_completeness.entry(field.clone()).or_insert(0) += 1;
                                }
                                Value::Number(_) | Value::Bool(_) => {
                                    *acc.field_completeness.entry(field.clone()).or_insert(0) += 1;
                                }
                                _ => {}
                            }
                        }
                    }
                }

                let mut doc_text = String::new();
                if let Some(obj) = doc.as_object() {
                    for key in text_general_fields.iter().take(5) {
                        if let Some(Value::String(txt)) = obj.get(key) {
                            if !txt.is_empty() && txt.len() < 50000 {
                                doc_text.push_str(txt);
                                doc_text.push(' ');
                                doc_has_content = true;
                            }
                        }
                    }
                }

                if doc_has_content {
                    let doc_length = doc_text.len();
                    acc.document_lengths.push(doc_length);
                    acc.total_text_length += doc_length;
                    
                    let sentence_count = doc_text.matches('.').count() as u64;
                    acc.sentence_count += sentence_count;
                    acc.paragraph_count += doc_text.matches('\n').count() as u64 + 1;
                    
                    for ch in doc_text.chars() {
                        if ch.is_ascii_punctuation() {
                            *acc.punctuation_counts.entry(ch).or_insert(0) += 1;
                        }
                    }
                    
                    if doc_text.len() > 100 {
                        let sample: String = doc_text.chars().take(200).collect();
                        if let Some(info) = detect(&sample) {
                            let lang_code = info.lang().code().to_string();
                            *acc.languages_detected.entry(lang_code).or_insert(0) += 1;
                        }
                    }
                    
                    acc.aggregated_text.push_str(&doc_text);
                    
                    let tokens = tokenize_text_fast(&doc_text, true);
                    
                    for token in &tokens {
                        if !stopwords.contains(token) && token.len() > 1 && token.len() < 20 {
                            *acc.word_counts.entry(token.clone()).or_insert(0) += 1;
                            
                            *acc.word_lengths.entry(token.len()).or_insert(0) += 1;
                            
                            if token.chars().next().map_or(false, |c| c.is_uppercase()) {
                                acc.capitalized_words += 1;
                            }
                            
                            if token.chars().any(|c| c.is_numeric()) {
                                acc.numeric_values.push(token.clone());
                            }
                        }
                    }
                    
                    if stats_level == "All" && tokens.len() > 1 {
                        for i in 0..tokens.len().saturating_sub(1) {
                            let bigram = format!("{} {}", tokens[i], tokens[i + 1]);
                            *acc.ngram_counts_2.entry(bigram).or_insert(0) += 1;
                        }

                        for i in 0..tokens.len().saturating_sub(2) {
                            let trigram = format!("{} {} {}", tokens[i], tokens[i + 1], tokens[i + 2]);
                            *acc.ngram_counts_3.entry(trigram).or_insert(0) += 1;
                        }
                    }
                } else {
                    acc.empty_documents += 1;
                }

                if stats_level != "None" {
                    if let Some(obj) = doc.as_object() {
                        for (key, value) in obj.iter().take(15) {
                            if !relevant_fields.contains(key) {
                                continue;
                            }
                            
                            let key_lc = key.to_lowercase();
                            if key_lc.contains("date") {
                                continue;
                            }

                            let dist = acc.metadata_distributions.entry(key.clone()).or_default();

                            match value {
                                Value::String(s) if !s.is_empty() && s.len() < 500 => {
                                    *dist.entry(s.clone()).or_insert(0) += 1;
                                }
                                Value::Array(arr) if !arr.is_empty() => {
                                    for v in arr.iter().take(10) {
                                        if let Value::String(s) = v {
                                            if !s.is_empty() && s.len() < 200 {
                                                *dist.entry(s.clone()).or_insert(0) += 1;
                                            }
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
        aggregated_text,
        word_counts,
        ngram_counts_2,
        ngram_counts_3,
        total_text_length,
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

    for (field, dist) in metadata_distributions {
        if !dist.is_empty() {
            stats.insert(format!("distribution_over_{}", field), json!(dist));
        }
    }

    if !date_counts.is_empty() {
        stats.insert("distribution_over_time".into(), json!(date_counts));
    }

    if !document_lengths.is_empty() {
        let min_doc_length = *document_lengths.iter().min().unwrap_or(&0);
        let max_doc_length = *document_lengths.iter().max().unwrap_or(&0);
        let avg_doc_length = document_lengths.iter().sum::<usize>() as f64 / document_lengths.len() as f64;
        
        let mut sorted_lengths = document_lengths.clone();
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

    if !word_lengths.is_empty() {
        let mut wl_vec: Vec<_> = word_lengths.into_iter().collect();
        wl_vec.sort_by_key(|&(len, _)| len);
        stats.insert("word_length_distribution".into(), json!(wl_vec));
    }

    if !languages_detected.is_empty() {
        stats.insert("languages_detected".into(), json!(languages_detected));
    }

    if !date_decades.is_empty() {
        stats.insert("distribution_over_decades".into(), json!(date_decades));
    }

    if !field_completeness.is_empty() {
        let total_docs = total_results as f64;
        let completeness_percentages: FxHashMap<String, f64> = field_completeness
            .iter()
            .map(|(field, count)| (field.clone(), (*count as f64 / total_docs) * 100.0))
            .collect();
        stats.insert("field_completeness_percentage".into(), json!(completeness_percentages));
    }

    if !punctuation_counts.is_empty() {
        let mut punct_vec: Vec<_> = punctuation_counts.into_iter().collect();
        punct_vec.sort_by(|a, b| b.1.cmp(&a.1));
        stats.insert("most_common_punctuation".into(), json!(punct_vec.into_iter().take(10).collect::<Vec<_>>()));
    }

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

    if (stats_level == "All" || stats_level == "Partial") && !word_counts.is_empty() {
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
        stats.insert(
            "average_unique_words_per_doc".into(),
            json!(unique_words as f64 / total_results as f64),
        );
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

    if stats_level == "All" {
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

    stats.insert("total_results".into(), json!(total_results));
    Ok(stats)
}

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

    let stopwords: HashSet<String> = if is_chinese_like {
        get(SwLang::Chinese).into_iter().collect()
    } else {
        get(SwLang::English)
            .into_iter()
            .map(|w| w.to_lowercase())
            .collect()
    };

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