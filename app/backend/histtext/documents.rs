//! This module provides HTTP handlers and helper functions for querying Solr collections.
//!
//! It handles:
//! - Processing and transforming document responses
//! - Managing cache and CSV exports
//! - Enforcing per-collection permissions via JWT claims
//! - Delivering paginated, highlighted snippets
//! - Statistics and optional NER data
//! - Download-only CSV responses

use actix_web::error::ErrorInternalServerError;
use actix_web::{web, Error, HttpRequest, HttpResponse};

use crate::auth::AccessTokenClaims;
use crate::models::solr_database_permissions::SolrDatabasePermission;
use crate::schema::solr_database_permissions::dsl::*;
use jsonwebtoken::{decode, DecodingKey, Validation};

use crate::config::Config;
use crate::histtext;
use crate::schema::solr_databases::dsl::*;
use crate::server::state::DbPool;
use crate::services::solr_database::*;
use actix_files::NamedFile;
use csv::Writer;
use csv::WriterBuilder;
use diesel::prelude::*;
use log::info;
use percent_encoding::percent_decode_str;
use regex::Regex;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::time::Instant;
use tokio::fs;
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

const CONTEXT_LENGTH: usize = 150;

/// Query parameters for Solr collection requests.
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct CollectionQueryParams {
    /// Target Solr collection name
    #[schema(example = "my_collection")]
    pub collection: String,

    /// Solr query string (e.g. "title:rust")
    #[schema(example = "title:rust")]
    pub query: Option<String>,

    /// Pagination offset
    #[schema(example = 0)]
    pub start: Option<u32>,

    /// Number of rows per page
    #[schema(example = 10)]
    pub rows: Option<u32>,

    /// Statistics level (e.g. "All")
    #[schema(example = "All")]
    pub stats_level: Option<String>,

    /// Whether to include named entity recognition data
    #[schema(example = true)]
    pub get_ner: Option<bool>,

    /// ID of the Solr database configuration
    #[schema(example = 1)]
    pub solr_database_id: i32,

    /// Return only download link instead of full results
    #[schema(example = false)]
    pub download_only: Option<bool>,

    /// Return raw Solr response without highlighting
    #[schema(example = false)]
    pub is_first: Option<bool>,
}

/// Fetches documents from a Solr instance with optional term highlighting.
///
/// # Arguments
/// * `client` - HTTP client for Solr requests
/// * `port` - Solr HTTP port
/// * `collection` - Target Solr collection name
/// * `query` - URL-encoded Solr query string
/// * `start` - Pagination offset
/// * `rows` - Number of rows to return
/// * `is_first` - If true, returns raw Solr JSON without snippet transformation
///
/// # Returns
/// A `serde_json::Value` containing the Solr response, with document snippets if highlighting applied
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
            let mut transformed_docs = Vec::new();

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
                return json!({
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

/// Returns a minimal Solr-style JSON response with no documents.
///
/// # Returns
/// A `serde_json::Value` representing an empty Solr response.
fn empty_solr_response() -> Value {
    json!({
        "response": {
            "docs": [],
            "numFound": 0
        }
    })
}

/// Scans a haystack string for all occurrences of a needle, case-insensitive.
///
/// # Arguments
/// * `haystack` - The text to search within
/// * `needle` - The substring to find
///
/// # Returns
/// A vector of `(start_byte, end_byte)` indices for each match
fn find_all_occurrences_case_insensitive(haystack: &str, needle: &str) -> Vec<(usize, usize)> {
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

/// Extracts a substring of length `context_len` around a match, clamped to valid UTF-8 boundaries.
///
/// # Arguments
/// * `full_text` - Original text
/// * `start_idx` - Starting byte index of the match
/// * `end_idx` - Ending byte index of the match
/// * `context_len` - Number of bytes to include before and after
///
/// # Returns
/// A `String` snippet safely bounded by character boundaries
fn extract_context(
    full_text: &str,
    start_idx: usize,
    end_idx: usize,
    context_len: usize,
) -> String {
    let text_len = full_text.len();

    // Preliminary bounds in bytes
    let raw_start = start_idx.saturating_sub(context_len);
    let raw_end = (end_idx + context_len).min(text_len);

    // Clamp them to actual char boundaries
    let cstart = clamp_to_char_boundary(full_text, raw_start);
    let cend = clamp_to_char_boundary(full_text, raw_end);

    // Slice safely
    full_text[cstart..cend].to_string()
}

/// Adjusts a byte index downwards to the nearest valid UTF-8 character boundary.
///
/// # Arguments
/// * `s` - The full UTF-8 string
/// * `byte_index` - Proposed byte offset
///
/// # Returns
/// A valid byte index ≤ `byte_index` aligned on a character boundary
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

/// Retrieves a `SolrDatabase` record by its ID from the Diesel connection pool.
///
/// # Arguments
/// * `pool` - Actix-Web database pool
/// * `other_solr_database_id` - Primary key of the Solr database config
///
/// # Returns
/// `Result<SolrDatabase, String>` indicating success or a not-found/connection error
async fn get_solr_database(
    pool: &web::Data<DbPool>,
    other_solr_database_id: i32,
) -> Result<SolrDatabase, String> {
    let mut conn = pool
        .get()
        .map_err(|e| format!("Database connection error: {}", e))?;
    solr_databases
        .filter(id.eq(other_solr_database_id))
        .first::<SolrDatabase>(&mut conn)
        .map_err(|_| "Solr database not found".to_string())
}

/// Delegates to the `histtext::metadata` service to obtain field lists and document IDs for a collection.
///
/// # Arguments
/// * `client` - HTTP client
/// * `pool` - Database pool
/// * `other_solr_database_id` - Solr DB config ID
/// * `collection` - Collection name
/// * `ids` - Mutable vector to populate with ID fields
///
/// # Returns
/// A tuple `(relevant_fields, general_text_fields)`
async fn fetch_metadata(
    client: &Client,
    pool: &web::Data<DbPool>,
    other_solr_database_id: i32,
    collection: &str,
    ids: &mut Vec<String>,
) -> (Vec<String>, Vec<String>) {
    histtext::metadata::fetch_metadata(client, pool, other_solr_database_id, collection, ids).await
}

/// Logs the elapsed time since a given `Instant` with a custom message.
///
/// # Arguments
/// * `start` - The start time
/// * `message` - Descriptive label for the timing
fn log_elapsed(start: Instant, message: &str) {
    info!("{} in: {:?}", message, start.elapsed());
}

/// Asynchronously writes JSON data to a file path for caching statistics or NER results.
///
/// # Arguments
/// * `path` - Filesystem path
/// * `data` - JSON data to serialize
///
/// # Returns
/// `Result<(), Error>` indicating I/O success or failure
async fn write_cache_file(path: &str, data: &Value) -> Result<(), Error> {
    fs::write(path, serde_json::to_string(data).unwrap()).await?;
    Ok(())
}

/// Initializes a CSV writer, determines headers from a batch of JSON documents, and constructs a unique file path.
///
/// # Arguments
/// * `all_docs` - Slice of JSON document values
///
/// # Returns
/// `Result<(Writer<File>, Vec<String>, String), Error>` containing the writer, sorted headers, and file path
fn prepare_csv_data(
    all_docs: &[Value],
) -> Result<(Writer<std::fs::File>, Vec<String>, String), Error> {
    let config = Config::global();

    let csv_filename = format!("data_{}.csv", Uuid::new_v4());
    let csv_filepath = format!("{}/{}", config.path_store_files, csv_filename);

    let mut wtr = WriterBuilder::new()
        .has_headers(true)
        .from_path(&csv_filepath)
        .map_err(|e| ErrorInternalServerError(format!("CSV file error: {}", e)))?;

    let mut field_names = HashSet::new();
    for doc in all_docs {
        if let Some(obj) = doc.as_object() {
            for key in obj.keys() {
                if !key.starts_with('_') && !key.ends_with('_') {
                    field_names.insert(key.clone());
                }
            }
        }
    }

    let mut headers: Vec<String> = field_names.into_iter().collect();
    headers.sort();

    wtr.write_record(&headers)
        .map_err(|e| ErrorInternalServerError(format!("CSV write error: {}", e)))?;

    Ok((wtr, headers, csv_filepath))
}

/// Streams document values into the CSV writer under the given headers, handling different JSON value types.
///
/// # Arguments
/// * `wtr` - Mutable CSV writer
/// * `all_docs` - Slice of JSON documents
/// * `headers` - Ordered list of CSV column names
///
/// # Returns
/// `Result<(), Error>` indicating write/flush success or failure
fn write_csv_records(
    wtr: &mut Writer<std::fs::File>,
    all_docs: &[Value],
    headers: &[String],
) -> Result<(), Error> {
    for doc in all_docs {
        let mut record = Vec::new();
        for field in headers {
            let value = match doc.get(field) {
                Some(val) => {
                    if let Some(s) = val.as_str() {
                        s.to_string()
                    } else if val.is_number() {
                        val.to_string()
                    } else if val.is_array() {
                        let arr = if let Some(array) = val.as_array() {
                            array
                        } else {
                            &Vec::new()
                        };
                        arr.iter()
                            .map(|v| v.as_str().unwrap_or("").to_string())
                            .collect::<Vec<String>>()
                            .join(", ")
                    } else {
                        eprintln!("Unexpected value for field {}: {:?}", field, val);
                        val.to_string()
                    }
                }
                None => "".to_string(),
            };
            record.push(value);
        }
        wtr.write_record(&record)
            .map_err(|e| ErrorInternalServerError(format!("CSV write error: {}", e)))?;
    }
    wtr.flush()
        .map_err(|e| ErrorInternalServerError(format!("CSV flush error: {}", e)))?;
    Ok(())
}

/// Orchestrates `fetch_documents`, measures response size, and determines if CSV download is required.
///
/// # Arguments
/// * `client` - HTTP client
/// * `port` - Solr server port
/// * `collection` - Collection name
/// * `query` - Search query
/// * `start` - Pagination offset
/// * `rows` - Number of rows to return
/// * `max_bytes` - Maximum allowed response size in MB
/// * `is_first` - Whether to bypass transformation
///
/// # Returns
/// `(serde_json::Value, total_results_count, download_only_flag)`
#[allow(clippy::too_many_arguments)]
async fn handle_solr_response(
    client: &Client,
    port: i32,
    collection: &str,
    query: &str,
    start: u32,
    rows: u32,
    max_bytes: usize,
    is_first: bool,
) -> (Value, u64, bool) {
    let solr_response =
        fetch_documents(client, port, collection, query, start, rows, is_first).await;
    let total_results = solr_response["response"]["numFound"].as_u64().unwrap_or(0);
    let response_json = &solr_response["response"];
    let response_size_bytes = serde_json::to_string(response_json)
        .map(|s| s.len())
        .unwrap_or(0);
    let download_only = response_size_bytes > max_bytes * 1024 * 1024;
    (solr_response, total_results, download_only)
}

/// Gathers document IDs for NER processing if requested, respecting a maximum ID count.
///
/// # Arguments
/// * `all_docs` - Documents array
/// * `ids` - Candidate ID field names
/// * `get_ner` - Flag to enable NER
/// * `max_id_ner` - Truncate limit
/// * `collection` - Collection name
///
/// # Returns
/// `Option<Value>` with NER payload or `None`
async fn handle_ner_data(
    all_docs: &[Value],
    ids: &[String],
    get_ner: bool,
    max_id_ner: usize,
    collection: &str,
) -> Option<Value> {
    if get_ner {
        let mut collected_ids: Vec<String> = all_docs
            .iter()
            .filter_map(|doc| {
                ids.iter().find_map(|id_field| {
                    doc.get(id_field)
                        .and_then(|id_value| id_value.as_str().map(String::from))
                })
            })
            .collect();

        if collected_ids.len() > max_id_ner {
            collected_ids.truncate(max_id_ner);
        }

        Some(json!({
            "collection": collection,
            "collected_ids": collected_ids,
        }))
    } else {
        None
    }
}

/// Actix-Web handler that enforces JWT-based permission checks, orchestrates Solr querying,
/// stats & NER caching, and returns either JSON response or a CSV download stub based on size limits.
///
/// # Arguments
/// * `req` - HTTP request for authorization header extraction and token validation
/// * `pool` - Database connection pool for permission and Solr database lookups
/// * `query` - Parsed query parameters containing collection, solr_database_id, and search criteria
///
/// # Returns
/// `Result<HttpResponse, Error>` with either document JSON, CSV stub with paths for statistics,
/// or appropriate error status
#[utoipa::path(
    get,
    path = "/api/solr/query",
    tag = "SolrDocuments",
    params(CollectionQueryParams),
    responses(
        (status = 200, description = "Returns paginated document search results with optional highlighting and statistics", body = Value),
        (status = 401, description = "Missing or invalid JWT token in Authorization header"),
        (status = 403, description = "User lacks permission for the requested collection"),
        (status = 500, description = "Failed to connect to Solr instance, parse response, or write cache files")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn query_collection(
    req: HttpRequest,
    pool: web::Data<DbPool>,
    query: web::Query<CollectionQueryParams>,
) -> Result<HttpResponse, Error> {
    let config = Config::global();

    // Extract and validate token
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let token = if let Some(auth_str) = auth_header {
        auth_str
            .strip_prefix("Bearer ")
            .ok_or_else(|| ErrorInternalServerError("Invalid Authorization header format"))?
    } else {
        return Ok(HttpResponse::Unauthorized().body("Missing Authorization header"));
    };

    let token_data = match decode::<AccessTokenClaims>(
        token,
        &DecodingKey::from_secret(config.secret_key.as_ref()),
        &Validation::default(),
    ) {
        Ok(data) => data,
        Err(_) => return Ok(HttpResponse::Unauthorized().body("Invalid token")),
    };

    // Check permissions
    let user_permissions: HashSet<String> = token_data
        .claims
        .permissions
        .iter()
        .map(|p| p.permission.clone())
        .collect();

    let solr_database_id_value = query.solr_database_id;
    let collection_requested = &query.collection;

    let mut conn = pool.get().map_err(ErrorInternalServerError)?;

    let permission_record: Option<SolrDatabasePermission> = solr_database_permissions
        .filter(solr_database_id.eq(solr_database_id_value))
        .filter(collection_name.eq(collection_requested))
        .first::<SolrDatabasePermission>(&mut conn)
        .optional()
        .map_err(ErrorInternalServerError)?;

    if let Some(permission_rec) = permission_record {
        if !user_permissions.contains(&permission_rec.permission) {
            return Ok(HttpResponse::Forbidden().body("No permission for this collection"));
        }
    } else {
        return Ok(HttpResponse::Forbidden().body("No permission for this collection"));
    }

    // Setup query parameters and start timing
    let start_time = Instant::now();

    let start = query.start.unwrap_or(0);
    let rows = query.rows.unwrap_or(config.max_size_query);
    let stats_level = query
        .stats_level
        .clone()
        .unwrap_or_else(|| "All".to_string());

    info!("Starting query_collection processing");

    let client = Client::new();
    let mut ids = Vec::new();

    let get_ner = query.get_ner.unwrap_or(false);
    let mut download_only = query.download_only.unwrap_or(false);
    let mut is_first = query.is_first.unwrap_or(false);

    info!("get_ner is: {}", get_ner);
    info!("download_only is: {}", download_only);

    // Get Solr database configuration
    let other_solr_database_id = query.solr_database_id;
    let solr_db = get_solr_database(&pool, other_solr_database_id)
        .await
        .map_err(ErrorInternalServerError)?;
    let port = solr_db.local_port;

    // Fetch metadata
    let (relevant_fields, text_general_fields) = fetch_metadata(
        &client,
        &pool,
        other_solr_database_id,
        &query.collection,
        &mut ids,
    )
    .await;

    info!("Fetched ids: {:?}", ids);

    if relevant_fields.is_empty() {
        return Ok(HttpResponse::InternalServerError().body("No relevant fields found"));
    }

    let fetch_metadata_start = Instant::now();
    log_elapsed(fetch_metadata_start, "Fetched metadata");

    // Fetch documents
    let fetch_documents_start = Instant::now();

    if download_only {
        is_first = true;
    }

    let (solr_response, total_results, should_download_only) = handle_solr_response(
        &client,
        port,
        &query.collection,
        query.query.as_deref().unwrap_or("*:*"),
        start,
        rows,
        config.max_size_document,
        is_first,
    )
    .await;

    log_elapsed(fetch_documents_start, "Fetched documents");
    download_only = download_only || should_download_only;

    let response_data_start = Instant::now();

    // Process response data
    let all_docs = solr_response["response"]["docs"]
        .as_array()
        .unwrap_or(&vec![])
        .clone();

    let stats_data = json!({
        "concatenated_docs": all_docs.clone(),
        "stats_level": stats_level,
        "total_results": total_results,
        "relevant_fields": relevant_fields,
        "text_general_fields": text_general_fields
    });

    let ner_data = handle_ner_data(
        &all_docs,
        &ids,
        get_ner,
        config.max_id_ner,
        &query.collection,
    )
    .await;

    info!("ner_data: {:?}", ner_data);

    // Write cache files
    write_cache_file(&config.stats_cache_path, &stats_data).await?;
    if let Some(ref ner_data) = ner_data {
        write_cache_file(&config.ner_cache_path, ner_data).await?;
    }

    // Prepare CSV download if needed
    if download_only {
        let (mut wtr, headers, csv_filepath) = prepare_csv_data(&all_docs)?;
        write_csv_records(&mut wtr, &all_docs, &headers)?;

        let response_data = json!({
            "solr_response": {
                "response": {
                    "docs": [],
                    "numFound": total_results
                },
                "stats_path": config.stats_cache_path,
                "ner_path": config.ner_cache_path,
                "csv_path": csv_filepath,
                "total_results": total_results
            }
        });

        log_elapsed(response_data_start, "Prepared response data");
        info!("Total time taken: {:?}", start_time.elapsed());

        return Ok(HttpResponse::Ok().json(response_data));
    }

    // Return standard response
    let response_data = json!({
        "solr_response": {
            "response": solr_response["response"].clone(),
            "stats_path": config.stats_cache_path,
            "ner_path": config.ner_cache_path,
            "total_results": total_results
        }
    });

    log_elapsed(response_data_start, "Prepared response data");
    info!("Total time taken: {:?}", start_time.elapsed());

    Ok(HttpResponse::Ok().json(response_data))
}

/// Actix-Web handler serving a generated CSV file from disk and scheduling its asynchronous deletion after download.
///
/// # Arguments
/// * `file_path` - Path parameter containing the CSV filename (UUID-based) to retrieve
///
/// # Returns
/// `Result<NamedFile, Error>` streaming the CSV file back to the client with appropriate MIME type
#[utoipa::path(
    get,
    path = "/api/solr/download_csv/{filename}",
    tag = "SolrDocuments",
    params(
        ("filename" = String, Path, example = "data_f8a7c4d2.csv")
    ),
    responses(
        (status = 200, description = "Binary CSV file download stream", content_type = "application/octet-stream"),
        (status = 404, description = "CSV file not found - may have expired or been deleted"),
        (status = 500, description = "Error reading or processing the CSV file")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn download_csv(file_path: web::Path<String>) -> Result<NamedFile, Error> {
    let config = Config::global();
    let path = format!("{}/{}", config.path_store_files, file_path.into_inner());

    let named_file = NamedFile::open(&path)?;

    let file_to_delete = path.clone();
    tokio::spawn(async move {
        match fs::remove_file(file_to_delete).await {
            Ok(_) => println!("File deleted successfully"),
            Err(e) => eprintln!("Failed to delete file: {:?}", e),
        }
    });

    Ok(named_file)
}
