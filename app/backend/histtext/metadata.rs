//! This module provides functionality for retrieving and processing Solr collection metadata.
//!
//! Features:
//! - Collection aliases retrieval with JWT-based permission checks
//! - Field metadata with faceting for possible values
//! - Date range faceting for temporal collections
//! - In-memory caching of index and annotation data

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use dashmap::DashMap;
use diesel::prelude::*;
use jsonwebtoken::{decode, DecodingKey, Validation};
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value as SerdeValue;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::collections::HashSet;
use utoipa::{IntoParams, ToSchema};

use crate::config::Config;
use crate::models::solr_database_permissions::SolrDatabasePermission;

use crate::services::auth::AccessTokenClaims;
use crate::schema::solr_database_permissions::dsl::*;
use crate::schema::solr_databases::dsl::*;

use lazy_static::lazy_static;

lazy_static! {
    /// Cache for storing index data keyed by collection identifier
    static ref INDEX_CACHE: DashMap<String, HashMap<String, Vec<SerdeValue>>> = DashMap::new();
    /// Cache for storing binary annotation data
    static ref ANNOTATION_CACHE: DashMap<String, Vec<u8>> = DashMap::new();
}

use crate::server::state::DbPool;
use crate::services::solr_database::*;

/// Query parameters for collection-specific metadata requests
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct MetadataQueryParams {
    /// Target Solr collection name
    #[schema(example = "my_collection")]
    pub collection: String,
    /// ID of the Solr database configuration
    #[schema(example = 1)]
    pub solr_database_id: i32,
}

/// Query parameters for database-level metadata requests
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct DatabaseIdQueryParams {
    /// ID of the Solr database configuration
    #[schema(example = 1)]
    pub solr_database_id: i32,
}

/// Retrieves collection aliases accessible to the authenticated user
///
/// Extracts a bearer token from the Authorization header, validates JWT claims
/// to build a permission set, and fetches Solr collection aliases via the Solr Admin API.
/// Returns either all aliases (for admin users) or only those the user is permitted to access.
///
/// # Arguments
/// * `req` - HTTP request for authorization header extraction and JWT validation
/// * `pool` - Database connection pool for permission and Solr database lookups
/// * `query` - Query parameter containing the target solr_database_id
///
/// # Returns
/// HTTP response with a JSON array of permitted collection alias names or an error status
#[utoipa::path(
    get,
    path = "/api/solr/aliases",
    tag = "Metadata",
    params(DatabaseIdQueryParams),
    responses(
        (status = 200, description = "List of collection aliases accessible to the user based on their permissions", body = Vec<String>),
        (status = 401, description = "Missing or invalid authentication token"),
        (status = 500, description = "Database connection error or Solr API request failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_aliases(
    req: HttpRequest,
    pool: web::Data<DbPool>,
    query: web::Query<DatabaseIdQueryParams>,
) -> impl Responder {
    let config = Config::global();

    let auth_header = match req.headers().get("Authorization") {
        Some(h) => h.to_str().unwrap_or(""),
        None => return HttpResponse::Unauthorized().body("Missing Authorization header"),
    };
    let token = if let Some(token) = auth_header.strip_prefix("Bearer ") {
        token
    } else {
        return HttpResponse::Unauthorized().body("Invalid Authorization header");
    };

    let token_data = match decode::<AccessTokenClaims>(
        token,
        &DecodingKey::from_secret(config.secret_key.as_ref()),
        &Validation::default(),
    ) {
        Ok(data) => data,
        Err(_) => return HttpResponse::Unauthorized().body("Invalid token"),
    };

    let user_permissions: HashSet<String> = token_data
        .claims
        .permissions
        .iter()
        .map(|p| p.permission.clone())
        .collect();

    let is_admin = user_permissions.contains("admin");

    let solr_database_id_value = query.solr_database_id;

    let mut conn = match pool.get() {
        Ok(conn) => conn,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .body(format!("Database connection error: {}", e))
        }
    };
    let solr_db = match solr_databases
        .filter(id.eq(solr_database_id_value))
        .first::<SolrDatabase>(&mut conn)
    {
        Ok(db) => db,
        Err(_) => return HttpResponse::NotFound().body("Solr database not found"),
    };

    let perms_result = solr_database_permissions
        .filter(solr_database_id.eq(solr_database_id_value))
        .load::<SolrDatabasePermission>(&mut conn);

    let allowed_collections: HashSet<String> = if is_admin {
        HashSet::new() // Empty set means no filtering for admins
    } else {
        match perms_result {
            Ok(records) => records
                .into_iter()
                .filter(|record| user_permissions.contains(&record.permission))
                .map(|record| record.collection_name)
                .collect(),
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .body("Failed to load solr database permissions");
            }
        }
    };

    let port = solr_db.local_port;
    let request_url = format!(
        "http://localhost:{}/solr/admin/collections?action=LISTALIASES&wt=json",
        port
    );

    let client = Client::new();
    let response = match client.get(&request_url).send().await {
        Ok(resp) => resp,
        Err(_) => return HttpResponse::InternalServerError().body("HTTP request failed"),
    };

    if !response.status().is_success() {
        return HttpResponse::InternalServerError().body("Failed to fetch aliases");
    }

    let json: Value = match response.json().await {
        Ok(j) => j,
        Err(_) => return HttpResponse::InternalServerError().body("Failed to parse JSON"),
    };

    if let Some(aliases_obj) = json.get("aliases").and_then(|a| a.as_object()) {
        let alias_names: Vec<&str> = if is_admin {
            aliases_obj.keys().map(|k| k.as_str()).collect()
        } else {
            aliases_obj
                .keys()
                .filter(|alias| allowed_collections.contains(&alias.to_string()))
                .map(|k| k.as_str())
                .collect()
        };
        HttpResponse::Ok().json(alias_names)
    } else {
        HttpResponse::InternalServerError().body("Failed to parse aliases")
    }
}

/// Retrieves field metadata for a specific Solr collection
///
/// Fetches Solr schema field definitions, filters out system fields,
/// excludes fields by type/name/pattern based on configuration,
/// and optionally facets each remaining field to collect possible values.
///
/// # Arguments
/// * `pool` - Database connection pool for Solr database configuration lookup
/// * `query` - Query parameters containing collection name and solr_database_id
///
/// # Returns
/// HTTP response with a JSON array of field metadata objects or an error status
#[utoipa::path(
    get,
    path = "/api/solr/collection_metadata",
    tag = "Metadata",
    params(MetadataQueryParams),
    responses(
        (status = 200, description = "Collection field metadata with field types, properties, and possible values via faceting", body = Vec<Value>),
        (status = 404, description = "Specified Solr database not found"),
        (status = 500, description = "Database connection error, Solr schema access failure, or faceting error")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_collection_metadata(
    pool: web::Data<DbPool>,
    query: web::Query<MetadataQueryParams>,
) -> impl Responder {
    let config = Config::global();

    let solr_database_ids = query.solr_database_id;
    let collection = &query.collection;

    let max_metadata_select = config.max_metadata_select;

    let mut conn = match pool.get() {
        Ok(conn) => conn,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .body(format!("Database connection error: {}", e))
        }
    };
    let solr_db = match solr_databases
        .filter(id.eq(solr_database_ids))
        .first::<SolrDatabase>(&mut conn)
    {
        Ok(db) => db,
        Err(_) => return HttpResponse::NotFound().body("Solr database not found"),
    };

    let port = solr_db.local_port;

    let request_url = format!(
        "http://localhost:{}/solr/{}/schema/fields?wt=json",
        port, collection
    );

    let exclude_field_types = &config.exclude_field_types;
    let exclude_field_names = &config.exclude_field_names;
    let exclude_field_name_patterns = &config.exclude_field_name_patterns;

    let client = Client::new();
    match client.get(&request_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Value>().await {
                    Ok(metadata) => {
                        let empty_vec = vec![];
                        let fields_array = metadata["fields"].as_array();
                        let fields = fields_array.unwrap_or(&empty_vec);

                        let mut metadata_with_values = Vec::new();

                        for field in fields {
                            let field_name = field["name"].as_str().unwrap_or("");
                            let field_type = field["type"].as_str().unwrap_or("");

                            let is_required = field
                                .get("required")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false);

                            // Filter out system fields
                            if is_required
                                || (field_name.starts_with('_') && field_name.ends_with('_'))
                                || field_name == "highlights"
                            {
                                continue;
                            }

                            let mut field_obj = field.clone();

                            // Skip faceting for excluded field types/names
                            if exclude_field_types.contains(&field_type.to_string())
                                || exclude_field_names.contains(&field_name.to_string())
                                || exclude_field_name_patterns
                                    .iter()
                                    .any(|pattern| field_name.contains(pattern))
                            {
                                metadata_with_values.push(field_obj);
                                continue;
                            }

                            // Facet the field to get possible values
                            let values_url = format!(
                                "http://localhost:{}/solr/{}/select?q=*:*&facet=true&facet.field={}&facet.limit=-1&rows=0&wt=json",
                                port, collection, field_name
                            );

                            if let Ok(values_response) = client.get(&values_url).send().await {
                                if let Ok(values_json) = values_response.json::<Value>().await {
                                    if let Some(facet_fields) = values_json["facet_counts"]
                                        ["facet_fields"][field_name]
                                        .as_array()
                                    {
                                        let mut possible_values = Vec::new();
                                        for i in (0..facet_fields.len()).step_by(2) {
                                            if let Some(value) = facet_fields[i].as_str() {
                                                possible_values.push(value.to_string());
                                            }
                                        }
                                        if possible_values.len() < max_metadata_select {
                                            field_obj["possible_values"] = json!(possible_values);
                                        }
                                    }
                                }
                            }

                            metadata_with_values.push(field_obj);
                        }

                        HttpResponse::Ok().json(metadata_with_values)
                    }
                    Err(_) => HttpResponse::InternalServerError().body("Failed to parse JSON"),
                }
            } else {
                HttpResponse::InternalServerError().body("Failed to fetch collection metadata")
            }
        }
        Err(_) => HttpResponse::InternalServerError().body("HTTP request failed"),
    }
}

/// Retrieves minimum and maximum dates containing documents in the collection
///
/// Facets a Solr date field (MAIN_DATE_VALUE) across a wide range (1500–2030)
/// in 1-year gaps, parses the facet counts to determine the date boundaries.
///
/// # Arguments
/// * `pool` - Database connection pool for Solr database configuration lookup
/// * `query` - Query parameters containing collection name and solr_database_id
///
/// # Returns
/// HTTP response with a JSON object containing min and max date strings or an error status
#[utoipa::path(
    get,
    path = "/api/solr/date_range",
    tag = "Metadata",
    params(MetadataQueryParams),
    responses(
        (status = 200, description = "Minimum and maximum dates containing documents in the collection", body = Object),
        (status = 404, description = "Specified Solr database not found"),
        (status = 500, description = "Database connection error, Solr faceting failure, or empty date results")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_date_range(
    pool: web::Data<DbPool>,
    query: web::Query<MetadataQueryParams>,
) -> impl Responder {
    let config = Config::global();

    let solr_database_ids = query.solr_database_id;
    let collection = &query.collection;

    let mut conn = match pool.get() {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("Database connection error: {}", e);
            return HttpResponse::InternalServerError().body("Database connection error");
        }
    };
    let solr_db = match solr_databases
        .filter(id.eq(solr_database_ids))
        .first::<SolrDatabase>(&mut conn)
    {
        Ok(db) => db,
        Err(_) => {
            eprintln!("Solr database not found");
            return HttpResponse::NotFound().body("Solr database not found");
        }
    };

    let port = solr_db.local_port;
    let date_field = &config.main_date_value;

    let request_url = format!(
        "http://localhost:{}/solr/{}/select?q=*:*&rows=0&facet=true&facet.range={}&facet.range.start=1500-01-01T00:00:00Z&facet.range.end=2030-01-01T00:00:00Z&facet.range.gap=%2B1YEAR&wt=json",
        port, collection, date_field
    );

    let client = Client::new();
    match client.get(&request_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Value>().await {
                    Ok(facets) => {
                        let counts = &facets["facet_counts"]["facet_ranges"][date_field]["counts"];
                        if let Some(counts_array) = counts.as_array() {
                            let mut min_date: Option<String> = None;
                            let mut max_date: Option<String> = None;

                            for i in (0..counts_array.len()).step_by(2) {
                                let date_str = counts_array.get(i).and_then(|v| v.as_str());
                                let count = counts_array
                                    .get(i + 1)
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                if count > 0 {
                                    if min_date.is_none() {
                                        min_date = date_str.map(String::from);
                                    }
                                    max_date = date_str.map(String::from);
                                }
                            }

                            match (min_date, max_date) {
                                (Some(min), Some(max)) => {
                                    let date_range = json!({
                                        "min": min,
                                        "max": max
                                    });
                                    HttpResponse::Ok().json(date_range)
                                }
                                _ => {
                                    eprintln!("Failed to determine date range");
                                    HttpResponse::InternalServerError()
                                        .body("Failed to determine date range")
                                }
                            }
                        } else {
                            eprintln!("No date counts found");
                            HttpResponse::InternalServerError().body("No date counts found")
                        }
                    }
                    Err(err) => {
                        eprintln!("Failed to parse JSON: {}", err);
                        HttpResponse::InternalServerError().body("Failed to parse JSON")
                    }
                }
            } else {
                eprintln!(
                    "Failed to fetch date range, HTTP status: {}",
                    response.status()
                );
                HttpResponse::InternalServerError().body("Failed to fetch date range")
            }
        }
        Err(err) => {
            eprintln!("HTTP request failed: {}", err);
            HttpResponse::InternalServerError().body("HTTP request failed")
        }
    }
}

/// Retrieves and filters Solr schema fields for a collection
///
/// Fetches Solr schema fields, filters based on configuration-driven inclusion/exclusion rules
/// (field types, name patterns, ID patterns), and populates two vectors: relevant fields
/// and general text fields. Also collects ID field names.
///
/// # Arguments
/// * `client` - HTTP client for Solr requests
/// * `pool` - Database pool for SolrDatabase lookup
/// * `solr_database_ids` - ID of the SolrDatabase record
/// * `collection` - Target Solr collection name
/// * `ids` - Mutable vector to append discovered ID field names
///
/// # Returns
/// A tuple (relevant_fields, text_general_fields) containing filtered field lists
pub async fn fetch_metadata(
    client: &Client,
    pool: &DbPool,
    solr_database_ids: i32,
    collection: &str,
    ids: &mut Vec<String>,
) -> (Vec<String>, Vec<String>) {
    let config = Config::global();

    let mut conn = match pool.get() {
        Ok(conn) => conn,
        Err(_) => return (Vec::new(), Vec::new()),
    };
    let solr_db = match solr_databases
        .filter(id.eq(solr_database_ids))
        .first::<SolrDatabase>(&mut conn)
    {
        Ok(db) => db,
        Err(_) => return (Vec::new(), Vec::new()),
    };

    let port = solr_db.local_port;

    let metadata_url = format!(
        "http://localhost:{}/solr/{}/schema/fields?wt=json",
        port, collection
    );

    let exclude_field_types = &config.exclude_field_types;
    let exclude_request_name_starts_with = &config.exclude_request_name_starts_with;
    let exclude_request_name_ends_with = &config.exclude_request_name_ends_with;
    let id_starts_with = &config.id_starts_with;
    let id_ends_with = &config.id_ends_with;

    if let Ok(response) = client.get(&metadata_url).send().await {
        if response.status().is_success() {
            if let Ok(metadata) = response.json::<Value>().await {
                if let Some(fields) = metadata["fields"].as_array() {
                    return fields.iter().fold(
                        (Vec::new(), Vec::new()),
                        |(mut relevant, mut text_general), field| {
                            if let Some(request_name) = field["name"].as_str() {
                                let lower_name = request_name.to_lowercase();

                                // Check if this is a field we should process
                                if !request_name.starts_with(exclude_request_name_starts_with)
                                    && !request_name.ends_with(exclude_request_name_ends_with)
                                    && !lower_name.starts_with(id_starts_with)
                                    && !lower_name.ends_with(id_ends_with)
                                {
                                    // Categorize as relevant or text_general based on field type
                                    if let Some(field_type) = field["type"].as_str() {
                                        if !exclude_field_types.contains(&field_type.to_string()) {
                                            relevant.push(request_name.to_string());
                                        } else {
                                            text_general.push(request_name.to_string());
                                        }
                                    }
                                }

                                // Check if this is an ID field
                                if lower_name.starts_with(id_starts_with)
                                    || lower_name.ends_with(id_ends_with)
                                {
                                    ids.push(request_name.to_string());
                                }
                            }
                            (relevant, text_general)
                        },
                    );
                }
            }
        }
    }
    (Vec::new(), Vec::new())
}
