//! HTTP request handlers for metadata operations.

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use diesel::prelude::*;
use jsonwebtoken::{decode, DecodingKey, Validation};
use log::error;
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashSet;

use crate::config::Config;
use crate::models::solr_database_permissions::SolrDatabasePermission;
use crate::schema::solr_database_permissions::dsl::*;
use crate::services::auth::AccessTokenClaims;
use crate::services::database::DbPool;

use super::database::get_solr_database;
use super::types::{DatabaseIdQueryParams, MetadataQueryParams};

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
    let database_id = query.solr_database_id;

    let mut conn = match pool.get() {
        Ok(conn) => conn,
        Err(e) => {
            error!("Database connection error: {}", e);
            return HttpResponse::InternalServerError().body("Database connection error");
        }
    };

    let solr_db = match get_solr_database(&pool, database_id).await {
        Ok(db) => db,
        Err(_) => return HttpResponse::NotFound().body("Solr database not found"),
    };

    let allowed_collections: HashSet<String> = if is_admin {
        HashSet::new()
    } else {
        match solr_database_permissions
            .filter(solr_database_id.eq(database_id))
            .load::<SolrDatabasePermission>(&mut conn)
        {
            Ok(records) => records
                .into_iter()
                .filter(|record| user_permissions.contains(&record.permission))
                .map(|record| record.collection_name)
                .collect(),
            Err(e) => {
                error!("Failed to load permissions: {}", e);
                return HttpResponse::InternalServerError().body("Failed to load permissions");
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
        Err(e) => {
            error!("HTTP request failed: {}", e);
            return HttpResponse::InternalServerError().body("HTTP request failed");
        }
    };

    if !response.status().is_success() {
        return HttpResponse::InternalServerError().body("Failed to fetch aliases");
    }

    let json: Value = match response.json().await {
        Ok(j) => j,
        Err(e) => {
            error!("Failed to parse JSON: {}", e);
            return HttpResponse::InternalServerError().body("Failed to parse JSON");
        }
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
    let database_id = query.solr_database_id;
    let collection = &query.collection;

    // Get metadata select limit from database configuration
    let max_metadata_select = {
        use crate::models::app_configurations::AppConfigurations;
        use crate::services::database::Database;

        let db = Database::new();
        let db_data = web::Data::new(db);

        crate::services::crud::execute_db_query(db_data, |conn| {
            Ok(AppConfigurations::get_number_value(
                conn,
                "MAX_METADATA_SELECT",
                config.max_metadata_select as i64,
            ) as usize)
        })
        .await
        .unwrap_or(config.max_metadata_select)
    };

    let solr_db = match get_solr_database(&pool, database_id).await {
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
                        let fields = metadata["fields"].as_array().unwrap_or(&empty_vec);
                        let mut metadata_with_values = Vec::with_capacity(fields.len());

                        for field in fields {
                            let field_name = field["name"].as_str().unwrap_or("");
                            let field_type = field["type"].as_str().unwrap_or("");

                            let is_required = field
                                .get("required")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false);

                            if is_required
                                || (field_name.starts_with('_') && field_name.ends_with('_'))
                                || field_name == "highlights"
                            {
                                continue;
                            }

                            let mut field_obj = field.clone();

                            if exclude_field_types.contains(&field_type.to_string())
                                || exclude_field_names.contains(&field_name.to_string())
                                || exclude_field_name_patterns
                                    .iter()
                                    .any(|pattern| field_name.contains(pattern))
                            {
                                metadata_with_values.push(field_obj);
                                continue;
                            }

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
                    Err(e) => {
                        error!("Failed to parse JSON: {}", e);
                        HttpResponse::InternalServerError().body("Failed to parse JSON")
                    }
                }
            } else {
                HttpResponse::InternalServerError().body("Failed to fetch collection metadata")
            }
        }
        Err(e) => {
            error!("HTTP request failed: {}", e);
            HttpResponse::InternalServerError().body("HTTP request failed")
        }
    }
}

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
    let database_id = query.solr_database_id;
    let collection = &query.collection;

    let solr_db = match get_solr_database(&pool, database_id).await {
        Ok(db) => db,
        Err(e) => {
            error!("Solr database not found: {}", e);
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
                                    error!("Failed to determine date range");
                                    HttpResponse::InternalServerError()
                                        .body("Failed to determine date range")
                                }
                            }
                        } else {
                            error!("No date counts found");
                            HttpResponse::InternalServerError().body("No date counts found")
                        }
                    }
                    Err(err) => {
                        error!("Failed to parse JSON: {}", err);
                        HttpResponse::InternalServerError().body("Failed to parse JSON")
                    }
                }
            } else {
                error!(
                    "Failed to fetch date range, HTTP status: {}",
                    response.status()
                );
                HttpResponse::InternalServerError().body("Failed to fetch date range")
            }
        }
        Err(err) => {
            error!("HTTP request failed: {}", err);
            HttpResponse::InternalServerError().body("HTTP request failed")
        }
    }
}
