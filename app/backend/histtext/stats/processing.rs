//! Core document processing logic for statistical analysis.

use rayon::prelude::*;
use serde_json::Value;
use std::collections::HashSet;
use whatlang::detect;

use super::types::Accumulator;
use crate::histtext::tokenizer::tokenize_text_fast;

/// Processes documents with ultra-optimized parallel processing
///
/// This function analyzes documents in parallel chunks, extracting various
/// statistical features including word frequencies, n-grams, metadata
/// distributions, and linguistic features.
///
/// # Arguments
/// * `docs` - Collection of documents to process
/// * `text_general_fields` - Fields containing text content
/// * `stopwords` - Set of stopwords to filter out
/// * `stats_level` - Level of analysis detail ("All", "Partial", "None")
/// * `relevant_fields` - Fields relevant for metadata analysis
/// * `main_date_field` - Primary date field for temporal analysis
///
/// # Returns
/// Accumulator containing all extracted statistics
pub fn process_documents_ultra_optimized(
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
            process_document_chunk(
                chunk,
                text_general_fields,
                stopwords,
                stats_level,
                relevant_fields,
                main_date_field,
            )
        })
        .reduce(Accumulator::default, |mut a, b| {
            a.merge(b);
            a
        })
}

/// Processes a single chunk of documents
fn process_document_chunk(
    chunk: &[Value],
    text_general_fields: &[String],
    stopwords: &HashSet<String>,
    stats_level: &str,
    relevant_fields: &[String],
    main_date_field: &str,
) -> Accumulator {
    let mut acc = Accumulator::default();

    for doc in chunk {
        process_single_document(
            doc,
            text_general_fields,
            stopwords,
            stats_level,
            relevant_fields,
            main_date_field,
            &mut acc,
        );
    }

    acc
}

/// Processes a single document and updates the accumulator
fn process_single_document(
    doc: &Value,
    text_general_fields: &[String],
    stopwords: &HashSet<String>,
    stats_level: &str,
    relevant_fields: &[String],
    main_date_field: &str,
    acc: &mut Accumulator,
) {
    let mut doc_has_content = false;

    // Process date information
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

    // Process field completeness
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

    // Process text content
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
        process_document_text(&doc_text, stopwords, stats_level, acc);
    } else {
        acc.empty_documents += 1;
    }

    // Process metadata distributions
    if stats_level != "None" {
        process_metadata_distributions(doc, relevant_fields, acc);
    }
}

/// Processes text content of a document
fn process_document_text(
    doc_text: &str,
    stopwords: &HashSet<String>,
    stats_level: &str,
    acc: &mut Accumulator,
) {
    let doc_length = doc_text.len();
    acc.document_lengths.push(doc_length);
    acc.total_text_length += doc_length;

    let sentence_count = doc_text.matches('.').count() as u64;
    acc.sentence_count += sentence_count;
    acc.paragraph_count += doc_text.matches('\n').count() as u64 + 1;

    // Count punctuation
    for ch in doc_text.chars() {
        if ch.is_ascii_punctuation() {
            *acc.punctuation_counts.entry(ch).or_insert(0) += 1;
        }
    }

    // Language detection
    if doc_text.len() > 100 {
        let sample: String = doc_text.chars().take(200).collect();
        if let Some(info) = detect(&sample) {
            let lang_code = info.lang().code().to_string();
            *acc.languages_detected.entry(lang_code).or_insert(0) += 1;
        }
    }

    acc.aggregated_text.push_str(doc_text);

    // Tokenize and process words
    let tokens = tokenize_text_fast(doc_text, true);

    for token in &tokens {
        if !stopwords.contains(token) && token.len() > 1 && token.len() < 20 {
            *acc.word_counts.entry(token.clone()).or_insert(0) += 1;
            *acc.word_lengths.entry(token.len()).or_insert(0) += 1;

            if token.chars().next().is_some_and(|c| c.is_uppercase()) {
                acc.capitalized_words += 1;
            }

            if token.chars().any(|c| c.is_numeric()) {
                acc.numeric_values.push(token.clone());
            }
        }
    }

    // Process n-grams for detailed analysis
    if stats_level == "All" && tokens.len() > 1 {
        process_ngrams(&tokens, acc);
    }
}

/// Processes n-grams from tokenized text
fn process_ngrams(tokens: &[String], acc: &mut Accumulator) {
    // Bigrams
    for i in 0..tokens.len().saturating_sub(1) {
        let bigram = format!("{} {}", tokens[i], tokens[i + 1]);
        *acc.ngram_counts_2.entry(bigram).or_insert(0) += 1;
    }

    // Trigrams
    for i in 0..tokens.len().saturating_sub(2) {
        let trigram = format!("{} {} {}", tokens[i], tokens[i + 1], tokens[i + 2]);
        *acc.ngram_counts_3.entry(trigram).or_insert(0) += 1;
    }
}

/// Processes metadata field distributions
fn process_metadata_distributions(doc: &Value, relevant_fields: &[String], acc: &mut Accumulator) {
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
