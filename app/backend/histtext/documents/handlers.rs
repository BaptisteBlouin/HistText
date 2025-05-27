//! HTTP request handlers for document operations.

use actix_web::error::ErrorInternalServerError;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_files::NamedFile;
use diesel::prelude::*;
use jsonwebtoken::{decode, DecodingKey, Validation};
use log::info;
use reqwest::Client;
use serde_json::json;
use std::collections::HashSet;
use std::time::Instant;
use tokio::fs;

use crate::config::Config;
use crate::models::solr_database_permissions::SolrDatabasePermission;
use crate::schema::solr_database_permissions::dsl::*;
use crate::services::auth::AccessTokenClaims;
use crate::services::database::DbPool;
use crate::histtext;

use super::types::CollectionQueryParams;
use super::search::fetch_documents;
use super::processing::{prepare_csv_writer, write_csv_records};
use super::utils::{get_solr_database, log_elapsed, write_cache_file};
use log::warn;

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

    // Extract user permissions from token
    let user_permissions: HashSet<String> = token_data
        .claims
        .permissions
        .iter()
        .map(|p| p.permission.clone())
        .collect();

    let solr_database_id_value = query.solr_database_id;
    let collection_requested = &query.collection;

    // DEBUG: Log user information
    info!("DEBUG: User ID: {}", token_data.claims.sub);
    info!("DEBUG: User permissions: {:?}", user_permissions);
    info!("DEBUG: Requested collection: '{}', database_id: {}", collection_requested, solr_database_id_value);

    let mut conn = pool.get().map_err(ErrorInternalServerError)?;

    // FIXED: Get ALL permission records for this collection (not just the first one)
    let permission_records: Vec<SolrDatabasePermission> = solr_database_permissions
        .filter(solr_database_id.eq(solr_database_id_value))
        .filter(collection_name.eq(collection_requested))
        .load::<SolrDatabasePermission>(&mut conn)
        .map_err(ErrorInternalServerError)?;

    // DEBUG: Log what permission records were found
    info!("DEBUG: Found {} permission records for collection '{}'", 
        permission_records.len(), collection_requested);
    
    for (i, perm_rec) in permission_records.iter().enumerate() {
        info!("DEBUG: Permission record {}: requires '{}' permission", i + 1, perm_rec.permission);
    }

    // Check if any permission records exist for this collection
    if permission_records.is_empty() {
        warn!("DEBUG: No permission records found for collection '{}' in database {}", 
            collection_requested, solr_database_id_value);
        return Ok(HttpResponse::Forbidden().body("No permission for this collection"));
    }

    // FIXED: Check if user has ANY of the required permissions (not just the first one)
    let mut has_required_permission = false;
    let mut required_permissions: Vec<String> = Vec::new();
    
    for perm_rec in &permission_records {
        required_permissions.push(perm_rec.permission.clone());
        if user_permissions.contains(&perm_rec.permission) {
            info!("DEBUG: ✅ User HAS required permission: '{}'", perm_rec.permission);
            has_required_permission = true;
            break; // Found a matching permission, no need to check others
        } else {
            info!("DEBUG: ❌ User does NOT have required permission: '{}'", perm_rec.permission);
        }
    }

    // DEBUG: Final permission check result
    info!("DEBUG: Required permissions for collection '{}': {:?}", collection_requested, required_permissions);
    info!("DEBUG: User permissions: {:?}", user_permissions);
    info!("DEBUG: Permission check result: {}", if has_required_permission { "ALLOWED" } else { "DENIED" });

    if !has_required_permission {
        warn!("User {} denied access to collection '{}'. Required: {:?}, User has: {:?}", 
            token_data.claims.sub, collection_requested, required_permissions, user_permissions);
        return Ok(HttpResponse::Forbidden().body("No permission for this collection"));
    }

    // Permission check passed, continue with the rest of the function...
    info!("DEBUG: ✅ Permission check PASSED for user {} on collection '{}'", 
        token_data.claims.sub, collection_requested);

    let start_time = Instant::now();
    let start = query.start.unwrap_or(0);
    let rows = query.rows.unwrap_or(config.max_size_query);
    let stats_level = query.stats_level.clone().unwrap_or_else(|| "All".to_string());

    info!("Starting query_collection processing");

    let client = Client::new();
    let mut ids = Vec::new();

    let get_ner = query.get_ner.unwrap_or(false);
    let mut download_only = query.download_only.unwrap_or(false);
    let mut is_first = query.is_first.unwrap_or(false);

    info!("get_ner is: {}", get_ner);
    info!("download_only is: {}", download_only);

    let other_solr_database_id = query.solr_database_id;
    let solr_db = get_solr_database(&pool, other_solr_database_id)
        .await
        .map_err(ErrorInternalServerError)?;
    let port = solr_db.local_port;

    let (relevant_fields, text_general_fields) = histtext::metadata::fetch_metadata(
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

    let fetch_documents_start = Instant::now();

    if download_only {
        is_first = true;
    }

    let solr_response = fetch_documents(
        &client,
        port,
        &query.collection,
        query.query.as_deref().unwrap_or("*:*"),
        start,
        rows,
        is_first,
    )
    .await;

    let total_results = solr_response["response"]["numFound"].as_u64().unwrap_or(0);
    
    let empty_docs = vec![];
    let all_docs = solr_response["response"]["docs"]
        .as_array()
        .unwrap_or(&empty_docs);

    let response_size_bytes = serde_json::to_string(all_docs)
        .map(|s| s.len())
        .unwrap_or(0);
    
    download_only = download_only || response_size_bytes > config.max_size_document * 1024 * 1024;

    log_elapsed(fetch_documents_start, "Fetched documents");

    let response_data_start = Instant::now();

    let stats_data = json!({
        "concatenated_docs": all_docs,
        "stats_level": stats_level,
        "total_results": total_results,
        "relevant_fields": relevant_fields,
        "text_general_fields": text_general_fields
    });

    let ner_data = if get_ner {
        let mut collected_ids: Vec<String> = all_docs
            .iter()
            .filter_map(|doc| {
                ids.iter().find_map(|id_field| {
                    doc.get(id_field)
                        .and_then(|id_value| id_value.as_str().map(String::from))
                })
            })
            .collect();

        if collected_ids.len() > config.max_id_ner {
            collected_ids.truncate(config.max_id_ner);
        }

        Some(json!({
            "collection": query.collection,
            "collected_ids": collected_ids,
        }))
    } else {
        None
    };

    info!("ner_data: {:?}", ner_data);

    write_cache_file(&config.stats_cache_path, &stats_data).await?;
    if let Some(ref ner_data) = ner_data {
        write_cache_file(&config.ner_cache_path, ner_data).await?;
    }

    if download_only {
        let (mut wtr, headers, csv_filepath) = prepare_csv_writer(all_docs)?;
        write_csv_records(&mut wtr, all_docs, &headers)?;

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

    let response_data = json!({
        "solr_response": {
            "response": solr_response["response"],
            "stats_path": config.stats_cache_path,
            "ner_path": config.ner_cache_path,
            "total_results": total_results
        }
    });

    log_elapsed(response_data_start, "Prepared response data");
    info!("Total time taken: {:?}", start_time.elapsed());

    Ok(HttpResponse::Ok().json(response_data))
}

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
        if let Err(e) = fs::remove_file(file_to_delete).await {
            eprintln!("Failed to delete file: {:?}", e);
        }
    });

    Ok(named_file)
}
