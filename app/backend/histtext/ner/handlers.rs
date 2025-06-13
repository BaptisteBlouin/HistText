//! HTTP request handlers for NER operations.

use actix_web::{web, HttpRequest, HttpResponse};
use jsonwebtoken::{decode, DecodingKey, Validation};
use log::{error, info};
use serde_json::{Map, Value};
use std::io;
use std::time::Instant;
use tokio::fs;

use super::cache::{cache_ner_results, generate_cache_key, get_cached_ner_results};
use super::processing::get_ner_annotation_batch;
use super::types::PathQueryParams;
use crate::config::Config;
use crate::services::auth::AccessTokenClaims;
use crate::services::{collection_intelligence, user_behavior_analytics};
use log::debug;

#[utoipa::path(
    get,
    path = "/api/solr/ner",
    tag = "Named Entity Recognition",
    params(PathQueryParams),
    responses(
        (status = 200, description = "Named entity annotations mapped by document ID", body = Object),
        (status = 500, description = "Error reading cache file, invalid JSON format, or Solr NER query failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn fetch_ner_data(
    req: HttpRequest,
    query: web::Query<PathQueryParams>,
) -> Result<HttpResponse, io::Error> {
    let start_time = Instant::now();
    let ner_path = query.path.as_deref().unwrap_or("");

    info!("Loading NER data from path: {}", ner_path);

    let ner_data = read_ner_cache_file(ner_path).await?;
    let collection = extract_collection_name(&ner_data)?;
    let collected_ids = extract_document_ids(&ner_data)?;

    debug!("Processing NER for collection: {}", collection);
    debug!(
        "Found {} document IDs for NER processing",
        collected_ids.len()
    );

    if collected_ids.is_empty() {
        info!("No document IDs found for NER processing, returning null");
        return Ok(HttpResponse::Ok().json(serde_json::Value::Null));
    }

    let cache_key = generate_cache_key(&collection, &collected_ids);

    if let Some(cached_results) = get_cached_ner_results(&cache_key) {
        let ner_data_map: Map<String, Value> = cached_results.into_iter().collect();

        // Extract user information for analytics (cached case)
        let (user_id, username) = if let Some(auth_header) = req.headers().get("Authorization") {
            if let Ok(auth_str) = auth_header.to_str() {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    let config = Config::global();
                    if let Ok(token_data) = decode::<AccessTokenClaims>(
                        token,
                        &DecodingKey::from_secret(config.secret_key.as_ref()),
                        &Validation::default(),
                    ) {
                        (
                            Some(token_data.claims.sub),
                            Some(format!("user_{}", token_data.claims.sub)),
                        )
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        // Record analytics for cached response
        let response_time_ms = start_time.elapsed().as_millis() as f64;
        let entities_count = ner_data_map.len() as u64;
        let collection_name = collection.clone();

        // Record analytics asynchronously
        tokio::spawn(async move {
            if let (Some(uid), Some(uname)) = (user_id, username) {
                // Record user behavior analytics
                user_behavior_analytics::get_user_behavior_store()
                    .record_activity(
                        uid,
                        uname,
                        "ner_processing_cached".to_string(),
                        collection_name.clone(),
                        format!("session_{}", uid), // session_id
                        None,                       // user_agent
                        true,                       // success
                    )
                    .await;
            }

            // Record collection intelligence
            collection_intelligence::get_collection_intelligence_store()
                .record_usage(
                    collection_name,
                    user_id,
                    collection_intelligence::OperationType::Query,
                    (entities_count as f64) / 1000.0, // rough estimate of data size in MB
                    response_time_ms as u64,
                    true, // success
                    vec![
                        "ner".to_string(),
                        "entity_extraction".to_string(),
                        "cached".to_string(),
                    ],
                )
                .await;
        });

        return Ok(HttpResponse::Ok().json(Some(ner_data_map)));
    }

    let ner_results = get_ner_annotation_batch(&collection, &collected_ids).await
        .map_err(|e| {
            error!("NER processing failed: {}", e);
            // Provide more specific error handling for common issues
            if e.to_string().contains("HTTP request failed") {
                error!("NER service unavailable - Solr NER collection may not exist or service is down");
                io::Error::new(
                    io::ErrorKind::Other,
                    "Named Entity Recognition service is currently unavailable. Please ensure the Solr NER service is running and the collection exists."
                )
            } else {
                e
            }
        })?;

    debug!("Retrieved NER results for {} documents", ner_results.len());

    cache_ner_results(cache_key, ner_results.clone());

    let ner_data_map: Map<String, Value> = ner_results.into_iter().collect();

    cleanup_cache_file(ner_path).await;

    // Extract user information for analytics
    let (user_id, username) = if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                let config = Config::global();
                if let Ok(token_data) = decode::<AccessTokenClaims>(
                    token,
                    &DecodingKey::from_secret(config.secret_key.as_ref()),
                    &Validation::default(),
                ) {
                    (
                        Some(token_data.claims.sub),
                        Some(format!("user_{}", token_data.claims.sub)),
                    )
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    // Record analytics
    let response_time_ms = start_time.elapsed().as_millis() as f64;
    let entities_count = ner_data_map.len() as u64;
    let collection_name = collection.clone();

    // Record analytics asynchronously
    tokio::spawn(async move {
        if let (Some(uid), Some(uname)) = (user_id, username) {
            // Record user behavior analytics
            user_behavior_analytics::get_user_behavior_store()
                .record_activity(
                    uid,
                    uname,
                    "ner_processing".to_string(),
                    collection_name.clone(),
                    format!("session_{}", uid), // session_id
                    None,                       // user_agent
                    true,                       // success
                )
                .await;
        }

        // Record collection intelligence
        collection_intelligence::get_collection_intelligence_store()
            .record_usage(
                collection_name,
                user_id,
                collection_intelligence::OperationType::Query,
                (entities_count as f64) / 1000.0, // rough estimate of data size in MB
                response_time_ms as u64,
                true, // success
                vec!["ner".to_string(), "entity_extraction".to_string()],
            )
            .await;
    });

    info!(
        "Successfully processed NER data for collection: {}",
        collection
    );
    Ok(HttpResponse::Ok().json(Some(ner_data_map)))
}

/// Reads and parses the NER cache file
async fn read_ner_cache_file(path: &str) -> Result<Value, io::Error> {
    let cached_ner_data = fs::read_to_string(path).await.map_err(|e| {
        error!("Failed to read NER cache file: {}", e);
        e
    })?;

    serde_json::from_str(&cached_ner_data).map_err(|e| {
        error!("Failed to parse NER cache JSON: {}", e);
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Failed to parse NER cache JSON: {}", e),
        )
    })
}

/// Extracts collection name from NER data
fn extract_collection_name(ner_data: &Value) -> Result<String, io::Error> {
    ner_data["collection"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| {
            error!("Missing or invalid collection name in NER cache");
            io::Error::new(
                io::ErrorKind::InvalidData,
                "Missing collection name in NER cache",
            )
        })
}

/// Extracts document IDs from NER data
fn extract_document_ids(ner_data: &Value) -> Result<Vec<String>, io::Error> {
    serde_json::from_value(ner_data["collected_ids"].clone()).map_err(|e| {
        error!("Failed to extract collected_ids from NER cache: {}", e);
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Failed to extract collected_ids: {}", e),
        )
    })
}

/// Cleans up the temporary cache file
async fn cleanup_cache_file(path: &str) {
    if let Err(e) = fs::remove_file(path).await {
        error!("Failed to remove NER cache file: {}", e);
    }
}
