//! Document search and retrieval functionality.

use percent_encoding::percent_decode_str;
use regex::Regex;
use reqwest::Client;
use serde_json::Value;

use super::utils::{empty_solr_response, extract_context, find_all_occurrences_case_insensitive};

const CONTEXT_LENGTH: usize = 150;

/// Fetches documents from Solr with optional text highlighting
///
/// # Arguments
/// * `client` - HTTP client for Solr requests
/// * `port` - Solr instance port
/// * `collection` - Target collection name
/// * `query` - Search query string
/// * `start` - Result offset for pagination
/// * `rows` - Number of results to return
/// * `is_first` - Skip text processing for initial requests
///
/// # Returns
/// JSON response containing documents and metadata
pub async fn fetch_documents(
    client: &Client,
    port: i32,
    collection: &str,
    query: &str,
    start: u32,
    rows: u32,
    is_first: bool,
) -> Value {
    let occurrence_mode = "first";
    let decoded_query = percent_decode_str(query).decode_utf8_lossy();
    let re_field_term = Regex::new(r#"(\w+):"([^"]+)""#).unwrap();
    let caps_opt = re_field_term.captures(&decoded_query);

    let (field_to_highlight, term_to_highlight) = if let Some(caps) = caps_opt {
        (
            Some(caps.get(1).unwrap().as_str().to_string()),
            Some(caps.get(2).unwrap().as_str().to_string()),
        )
    } else {
        (None, None)
    };

    let request_url = format!(
        "http://localhost:{}/solr/{}/select?q={}&start={}&rows={}&fl=*,score&wt=json",
        port, collection, query, start, rows
    );

    let solr_response = match client.get(&request_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Value>().await {
                    Ok(solr_json) => solr_json,
                    Err(_) => empty_solr_response(),
                }
            } else {
                empty_solr_response()
            }
        }
        Err(_) => empty_solr_response(),
    };

    if is_first {
        return solr_response;
    }

    let original_num_found = solr_response["response"]["numFound"].as_u64().unwrap_or(0);

    if let (Some(field), Some(term)) = (field_to_highlight, term_to_highlight) {
        if let Some(docs_arr) = solr_response["response"]["docs"].as_array() {
            let field_lower = field.to_lowercase();
            let mut transformed_docs = Vec::with_capacity(docs_arr.len());

            for doc in docs_arr.iter() {
                if let Some(obj) = doc.as_object() {
                    let matching_key_opt = obj.keys().find(|k| k.to_lowercase() == field_lower);

                    if let Some(matching_key) = matching_key_opt {
                        if let Some(full_text_value) = obj[matching_key].as_str() {
                            let matches =
                                find_all_occurrences_case_insensitive(full_text_value, &term);

                            if !matches.is_empty() {
                                if occurrence_mode == "first" {
                                    if let Some((start_idx, end_idx)) = matches.first() {
                                        let snippet = extract_context(
                                            full_text_value,
                                            *start_idx,
                                            *end_idx,
                                            CONTEXT_LENGTH,
                                        );

                                        let mut doc_clone = doc.clone();
                                        if let Some(obj_mut) = doc_clone.as_object_mut() {
                                            obj_mut.insert(
                                                matching_key.to_string(),
                                                Value::String(snippet),
                                            );
                                        }
                                        transformed_docs.push(doc_clone);
                                    }
                                } else {
                                    for (start_idx, end_idx) in matches {
                                        let snippet = extract_context(
                                            full_text_value,
                                            start_idx,
                                            end_idx,
                                            CONTEXT_LENGTH,
                                        );

                                        let mut doc_clone = doc.clone();
                                        if let Some(obj_mut) = doc_clone.as_object_mut() {
                                            obj_mut.insert(
                                                matching_key.to_string(),
                                                Value::String(snippet),
                                            );
                                        }
                                        transformed_docs.push(doc_clone);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if !transformed_docs.is_empty() {
                return serde_json::json!({
                    "response": {
                        "docs": transformed_docs,
                        "numFound": original_num_found
                    }
                });
            }
        }
    }

    solr_response
}
