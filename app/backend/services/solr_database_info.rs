//! Solr collection metadata management.
//!
//! This module provides functionality to manage metadata about Solr collections,
//! including descriptions, embedding paths, language settings, tokenizers, and display
//! configurations. It handles CRUD operations on the `solr_database_info` table.

use actix_web::{web, HttpResponse};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::schema::solr_database_info;
use crate::services::crud::execute_db_query;
use crate::services::error::{AppError, AppResult};
use crate::services::database::Database;

/// Solr collection metadata record
///
/// Contains configuration and display information for a Solr collection,
/// identified by the combination of solr_database_id and collection_name.
#[derive(Queryable, Serialize, ToSchema)]
pub struct SolrDatabaseInfo {
    /// ID of the parent Solr database
    #[schema(example = 1)]
    pub solr_database_id: i32,

    /// Name of the Solr collection
    #[schema(example = "users")]
    pub collection_name: String,

    /// Human-readable description of the collection
    #[schema(example = "User profiles index")]
    pub description: String,

    /// Path to word embedding file or "default"/"none"
    #[schema(example = "/data/embeddings/users.vec")]
    pub embeddings: String,

    /// Language code for the collection (e.g. "en", "fr")
    #[schema(example = "en")]
    pub lang: Option<String>,

    /// Primary text field for searching and analysis
    #[schema(example = "text_content")]
    pub text_field: Option<String>,

    /// Tokenizer to use (e.g. "standard", "whitespace")
    #[schema(example = "standard")]
    pub tokenizer: Option<String>,

    /// Fields to exclude from display in UI
    #[schema(example = json!( ["internal_notes", null] ))]
    pub to_not_display: Option<Vec<Option<String>>>,
}

/// Data for creating a new Solr collection metadata record
#[derive(Insertable, Deserialize, ToSchema)]
#[diesel(table_name = solr_database_info)]
pub struct NewSolrDatabaseInfo {
    /// ID of the parent Solr database
    #[schema(example = 1)]
    pub solr_database_id: i32,

    /// Name of the Solr collection
    #[schema(example = "users")]
    pub collection_name: String,

    /// Human-readable description of the collection
    #[schema(example = "User profiles index")]
    pub description: String,

    /// Path to word embedding file or "default"/"none"
    #[schema(example = "/data/embeddings/users.vec")]
    pub embeddings: String,

    /// Language code for the collection
    #[schema(example = "en")]
    pub lang: Option<String>,

    /// Primary text field for searching and analysis
    #[schema(example = "text_content")]
    pub text_field: Option<String>,

    /// Tokenizer to use
    #[schema(example = "standard")]
    pub tokenizer: Option<String>,

    /// Fields to exclude from display in UI
    #[schema(example = json!( ["internal_notes", null] ))]
    pub to_not_display: Option<Vec<Option<String>>>,
}

/// Data for updating an existing Solr collection metadata record
///
/// All fields are optional to support partial updates.
#[derive(AsChangeset, Deserialize, ToSchema)]
#[diesel(table_name = solr_database_info)]
pub struct UpdateSolrDatabaseInfo {
    /// Updated description
    #[schema(example = "Updated description")]
    pub description: Option<String>,

    /// Updated embedding path
    #[schema(example = "/data/embeddings/updated.vec")]
    pub embeddings: Option<String>,

    /// Updated language code
    #[schema(example = "fr")]
    pub lang: Option<String>,

    /// Updated text field
    #[schema(example = "content_field")]
    pub text_field: Option<String>,

    /// Updated tokenizer setting
    #[schema(example = "whitespace")]
    pub tokenizer: Option<String>,

    /// Updated list of fields to exclude from display
    #[schema(example = json!( ["secret", null] ))]
    pub to_not_display: Option<Vec<Option<String>>>,
}

/// Handler for Solr collection metadata operations
///
/// Encapsulates business logic for managing collection metadata,
/// including validation, querying, creation, and modification.
pub struct SolrDatabaseInfoHandler {
    /// Application configuration
    #[allow(dead_code)]
    config: Arc<Config>,
}

impl SolrDatabaseInfoHandler {
    /// Creates a new handler with the provided configuration
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new SolrDatabaseInfoHandler instance
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Validates a new collection metadata record
    ///
    /// Ensures that required fields are present and valid.
    ///
    /// # Arguments
    /// * `item` - The new metadata record to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details
    fn validate_new(&self, item: &NewSolrDatabaseInfo) -> AppResult<()> {
        if item.solr_database_id <= 0 {
            return Err(AppError::validation("Invalid solr_database_id", Some("solr_database_id")));
        }
        if item.collection_name.is_empty() || item.collection_name.len() > 100 {
            return Err(AppError::validation(
                "Collection name must be between 1 and 100 characters",
                Some("collection_name"),
            ));
        }
        if item.description.is_empty() || item.description.len() > 500 {
            return Err(AppError::validation(
                "Description must be between 1 and 500 characters",
                Some("description"),
            ));
        }
        if item.embeddings.is_empty() {
            return Err(AppError::validation(
                "Embeddings path cannot be empty",
                Some("embeddings"),
            ));
        }
        Ok(())
    }

    /// Validates updates to a collection metadata record
    ///
    /// Ensures that any fields being updated meet requirements.
    ///
    /// # Arguments
    /// * `item` - The update data to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details
    fn validate_update(&self, item: &UpdateSolrDatabaseInfo) -> AppResult<()> {
        if let Some(ref description) = item.description {
            if description.is_empty() || description.len() > 500 {
                return Err(AppError::validation(
                    "Description must be between 1 and 500 characters",
                    Some("description"),
                ));
            }
        }
        if let Some(ref embeddings) = item.embeddings {
            if embeddings.is_empty() {
                return Err(AppError::validation(
                    "Embeddings path cannot be empty",
                    Some("embeddings"),
                ));
            }
        }
        Ok(())
    }

    /// Lists all collection metadata records
    ///
    /// # Arguments
    /// * `db` - Database connection
    ///
    /// # Returns
    /// HTTP response with all records as JSON
    pub async fn list(&self, db: web::Data<Database>) -> AppResult<HttpResponse> {
        use crate::schema::solr_database_info::dsl::*;
        let results =
            execute_db_query(db, |conn| solr_database_info.load::<SolrDatabaseInfo>(conn)).await?;
        Ok(HttpResponse::Ok().json(results))
    }

    /// Gets a specific collection metadata record by its composite key
    ///
    /// If no record exists, returns default values instead of a 404 error.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing database ID and collection name
    ///
    /// # Returns
    /// HTTP response with the requested record or default values as JSON
    pub async fn get_by_id_and_collection(
        &self,
        db: web::Data<Database>,
        path: web::Path<(i32, String)>,
        ) -> AppResult<HttpResponse> {
        use crate::schema::solr_database_info::dsl::*;
        let (solr_db_id, coll) = path.into_inner();
        let coll_clone = coll.clone(); // Clone before moving into closure
        
        let result = execute_db_query(db, move |conn| {
            solr_database_info
                .filter(solr_database_id.eq(solr_db_id))
                .filter(collection_name.eq(coll_clone))
                .first::<SolrDatabaseInfo>(conn)
        })
        .await;

        match result {
            Ok(info) => Ok(HttpResponse::Ok().json(info)),
            Err(AppError::NotFound { .. }) => {
                // Return default values when no record exists
                let default_info = SolrDatabaseInfo {
                    solr_database_id: solr_db_id,
                    collection_name: coll,
                    description: "".to_string(),
                    embeddings: "none".to_string(),
                    lang: None,
                    text_field: Some("text".to_string()),
                    tokenizer: None,
                    to_not_display: Some(vec![]),
                };
                Ok(HttpResponse::Ok().json(default_info))
            }
            Err(e) => Err(e),
        }
    }

    /// Creates a new collection metadata record
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - New metadata record to create
    ///
    /// # Returns
    /// HTTP response with the created record as JSON
    pub async fn create(
        &self,
        db: web::Data<Database>,
        item: web::Json<NewSolrDatabaseInfo>,
    ) -> AppResult<HttpResponse> {
        self.validate_new(&item)?;
        let new_info = item.into_inner();
        let result = execute_db_query(db, move |conn| {
            diesel::insert_into(solr_database_info::table)
                .values(&new_info)
                .get_result::<SolrDatabaseInfo>(conn)
        })
        .await?;
        Ok(HttpResponse::Created().json(result))
    }

    /// Updates an existing collection metadata record
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing database ID and collection name
    /// * `item` - Update data
    ///
    /// # Returns
    /// HTTP response with the updated record as JSON
    pub async fn update(
        &self,
        db: web::Data<Database>,
        path: web::Path<(i32, String)>,
        item: web::Json<UpdateSolrDatabaseInfo>,
    ) -> AppResult<HttpResponse> {
        use crate::schema::solr_database_info::dsl::*;
        self.validate_update(&item)?;
        let (solr_db_id, coll) = path.into_inner();
        let update_data = item.into_inner();
        let result = execute_db_query(db, move |conn| {
            diesel::update(
                solr_database_info
                    .filter(solr_database_id.eq(solr_db_id))
                    .filter(collection_name.eq(coll)),
            )
            .set(&update_data)
            .get_result::<SolrDatabaseInfo>(conn)
        })
        .await?;
        Ok(HttpResponse::Ok().json(result))
    }

    /// Deletes a collection metadata record
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing database ID and collection name
    ///
    /// # Returns
    /// HTTP response indicating success or not found
    pub async fn delete(
        &self,
        db: web::Data<Database>,
        path: web::Path<(i32, String)>,
    ) -> AppResult<HttpResponse> {
        use crate::schema::solr_database_info::dsl::*;
        let (solr_db_id, coll) = path.into_inner();
        let deleted = execute_db_query(db, move |conn| {
            diesel::delete(
                solr_database_info
                    .filter(solr_database_id.eq(solr_db_id))
                    .filter(collection_name.eq(coll)),
            )
            .execute(conn)
        })
        .await?;
        if deleted == 0 {
            return Err(AppError::not_found("SolrDatabaseInfo", Option::<String>::None));
        }
        Ok(HttpResponse::Ok().body("SolrDatabaseInfo deleted"))
    }
}

/// Retrieves all Solr collection metadata records
///
/// Returns configuration information about Solr collections, including
/// descriptions, embedding paths, language settings, and display options.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with all metadata records as JSON
#[utoipa::path(
    get,
    path = "/api/solr_database_infos",
    tag = "SolrDatabaseInfo",
    responses(
        (status = 200, description = "List of SolrDatabaseInfo records with collection metadata", body = [SolrDatabaseInfo]),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_solr_database_infos(
   db: web::Data<Database>,
   config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
   let handler = SolrDatabaseInfoHandler::new(config.get_ref().clone());
   handler.list(db).await
}

/// Retrieves a specific Solr collection metadata record
///
/// Looks up collection metadata by the composite key of
/// solr_database_id and collection_name. If no metadata exists,
/// returns default values instead of a 404 error.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing database ID and collection name
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the matching metadata record or default values
#[utoipa::path(
    get,
    path = "/api/solr_database_infos/{solr_database_id}/{collection_name}",
    tag = "SolrDatabaseInfo",
    params(
        ("solr_database_id" = i32, Path, example = 1),
        ("collection_name" = String, Path, example = "users")
    ),
    responses(
        (status = 200, description = "SolrDatabaseInfo metadata record found or default values returned", body = SolrDatabaseInfo),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_solr_database_info(
    db: web::Data<Database>,
    path: web::Path<(i32, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = SolrDatabaseInfoHandler::new(config.get_ref().clone());
    handler
        .get_by_id_and_collection(db, path).await
}

/// Creates a new Solr collection metadata record
///
/// Validates and stores metadata for a Solr collection, including
/// description, embedding path, language settings, and display options.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - JSON payload with new metadata
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the created record or validation error
#[utoipa::path(
    post,
    path = "/api/solr_database_infos",
    tag = "SolrDatabaseInfo",
    request_body = NewSolrDatabaseInfo,
    responses(
        (status = 201, description = "Collection metadata record created successfully", body = SolrDatabaseInfo),
        (status = 400, description = "Validation error: invalid solr_database_id, collection name too long, or missing required fields"),
        (status = 500, description = "Database connection error, constraint violation, or execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_solr_database_info(
    db: web::Data<Database>,
    item: web::Json<NewSolrDatabaseInfo>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = SolrDatabaseInfoHandler::new(config.get_ref().clone());
    handler.create(db, item).await
}

/// Updates an existing Solr collection metadata record
///
/// Allows partial updates to collection metadata with
/// validation of the provided fields.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing database ID and collection name
/// * `item` - JSON payload with fields to update
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the updated record or appropriate error
#[utoipa::path(
    put,
    path = "/api/solr_database_infos/{solr_database_id}/{collection_name}",
    tag = "SolrDatabaseInfo",
    params(
        ("solr_database_id" = i32, Path, example = 1),
        ("collection_name" = String, Path, example = "users")
    ),
    request_body = UpdateSolrDatabaseInfo,
    responses(
        (status = 200, description = "Collection metadata updated successfully", body = SolrDatabaseInfo),
        (status = 400, description = "Validation error: invalid field lengths or formats"),
        (status = 404, description = "No metadata found for the specified database ID and collection"),
        (status = 500, description = "Database connection error or execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_solr_database_info(
    db: web::Data<Database>,
    path: web::Path<(i32, String)>,
    item: web::Json<UpdateSolrDatabaseInfo>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = SolrDatabaseInfoHandler::new(config.get_ref().clone());
    handler.update(db, path, item).await
}

/// Deletes a Solr collection metadata record
///
/// Removes metadata for a specific collection if it exists.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing database ID and collection name
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with success message or not-found error
#[utoipa::path(
    delete,
    path = "/api/solr_database_infos/{solr_database_id}/{collection_name}",
    tag = "SolrDatabaseInfo",
    params(
        ("solr_database_id" = i32, Path, example = 1),
        ("collection_name" = String, Path, example = "users")
    ),
    responses(
        (status = 200, description = "Collection metadata record deleted successfully"),
        (status = 404, description = "No metadata found for the specified database ID and collection"),
        (status = 500, description = "Database connection error or execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_solr_database_info(
    db: web::Data<Database>,
    path: web::Path<(i32, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = SolrDatabaseInfoHandler::new(config.get_ref().clone());
    handler.delete(db, path).await
}
