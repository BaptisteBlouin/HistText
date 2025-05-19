//! Solr database configuration management.
//! 
//! This module provides functionality to manage Solr instance configurations,
//! including connection details (URLs, ports), SSH tunneling parameters,
//! and metadata. It handles creating, reading, updating, and deleting
//! entries in the `solr_databases` table.

use actix_web::{web, HttpResponse};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::schema::solr_databases;
use crate::services::crud::{execute_db_query, CrudError};
use crate::services::database::Database;

/// Solr database configuration record
///
/// Contains connection details for a Solr instance, including
/// URL, port mappings for SSH tunneling, and metadata.
#[derive(Queryable, Serialize, ToSchema)]
pub struct SolrDatabase {
    /// Unique identifier
    #[schema(example = 1)]
    pub id: i32,
    
    /// Human-readable name for this Solr instance
    #[schema(example = "primary-solr")]
    pub name: String,
    
    /// SSH connection URL or hostname
    #[schema(example = "http://localhost:8983/solr")]
    pub url: String,
    
    /// Remote port where Solr is running
    #[schema(example = 8983)]
    pub server_port: i32,
    
    /// Local port to map the SSH tunnel
    #[schema(example = 7574)]
    pub local_port: i32,
    
    /// When this configuration was created
    #[schema(example = "2025-01-15T12:34:56")]
    pub created_at: chrono::NaiveDateTime,
    
    /// When this configuration was last updated
    #[schema(example = "2025-02-20T08:22:10")]
    pub updated_at: chrono::NaiveDateTime,
}

/// Data for creating a new Solr database configuration
#[derive(Insertable, Deserialize, ToSchema)]
#[diesel(table_name = solr_databases)]
pub struct NewSolrDatabase {
    /// Human-readable name for this Solr instance
    #[schema(example = "primary-solr")]
    pub name: String,
    
    /// SSH connection URL or hostname
    #[schema(example = "http://localhost:8983/solr")]
    pub url: String,
    
    /// Remote port where Solr is running
    #[schema(example = 8983)]
    pub server_port: i32,
    
    /// Local port to map the SSH tunnel
    #[schema(example = 7574)]
    pub local_port: i32,
}

/// Data for updating an existing Solr database configuration
///
/// All fields are optional to support partial updates.
#[derive(AsChangeset, Deserialize, ToSchema)]
#[diesel(table_name = solr_databases)]
pub struct UpdateSolrDatabase {
    /// Updated name
    #[schema(example = "primary-solr-renamed")]
    pub name: Option<String>,
    
    /// Updated URL
    #[schema(example = "http://localhost:7574/solr")]
    pub url: Option<String>,
    
    /// Updated server port
    #[schema(example = 7574)]
    pub server_port: Option<i32>,
    
    /// Updated local port
    #[schema(example = 8983)]
    pub local_port: Option<i32>,
}

/// Handler for Solr database configuration operations
///
/// Encapsulates business logic for managing Solr database connections,
/// including validation, querying, creation, and modification.
pub struct SolrDatabaseHandler {
    /// Application configuration
    #[allow(dead_code)]
    config: Arc<Config>,
}

impl SolrDatabaseHandler {
    /// Creates a new handler with the provided configuration
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new SolrDatabaseHandler instance
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Validates a new Solr database configuration
    ///
    /// Ensures that required fields meet formatting and range requirements.
    ///
    /// # Arguments
    /// * `item` - The new configuration to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details
    fn validate_new(&self, item: &NewSolrDatabase) -> Result<(), CrudError> {
        if item.name.is_empty() || item.name.len() > 100 {
            return Err(CrudError::Validation(
                "Name must be between 1 and 100 characters".into(),
            ));
        }
        if item.url.is_empty() {
            return Err(CrudError::Validation("URL cannot be empty".into()));
        }
        if item.server_port < 1 || item.server_port > 65535 {
            return Err(CrudError::Validation(
                "Server port must be between 1 and 65535".into(),
            ));
        }
        if item.local_port < 1 || item.local_port > 65535 {
            return Err(CrudError::Validation(
                "Local port must be between 1 and 65535".into(),
            ));
        }
        Ok(())
    }

    /// Validates updates to a Solr database configuration
    ///
    /// Ensures that any fields being updated meet requirements.
    ///
    /// # Arguments
    /// * `item` - The update data to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details
    fn validate_update(&self, item: &UpdateSolrDatabase) -> Result<(), CrudError> {
        if let Some(ref name) = item.name {
            if name.is_empty() || name.len() > 100 {
                return Err(CrudError::Validation(
                    "Name must be between 1 and 100 characters".into(),
                ));
            }
        }
        if let Some(ref url) = item.url {
            if url.is_empty() {
                return Err(CrudError::Validation("URL cannot be empty".into()));
            }
        }
        if let Some(port) = item.server_port {
            if !(1..=65535).contains(&port) {
                return Err(CrudError::Validation(
                    "Server port must be between 1 and 65535".into(),
                ));
            }
        }
        if let Some(port) = item.local_port {
            if !(1..=65535).contains(&port) {
                return Err(CrudError::Validation(
                    "Local port must be between 1 and 65535".into(),
                ));
            }
        }
        Ok(())
    }

    /// Lists all Solr database configurations
    ///
    /// # Arguments
    /// * `db` - Database connection
    ///
    /// # Returns
    /// HTTP response with all configurations as JSON
    pub async fn list(&self, db: web::Data<Database>) -> Result<HttpResponse, CrudError> {
        use crate::schema::solr_databases::dsl::*;
        let results =
            execute_db_query(db, |conn| solr_databases.load::<SolrDatabase>(conn)).await?;
        Ok(HttpResponse::Ok().json(results))
    }

    /// Gets a specific Solr database configuration by ID
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameter containing the database ID
    ///
    /// # Returns
    /// HTTP response with the requested configuration as JSON
    pub async fn get_by_id(
        &self,
        db: web::Data<Database>,
        path: web::Path<i32>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::solr_databases::dsl::*;
        let solr_db_id = path.into_inner();
        let result = execute_db_query(db, move |conn| {
            solr_databases.find(solr_db_id).first::<SolrDatabase>(conn)
        })
        .await?;
        Ok(HttpResponse::Ok().json(result))
    }

    /// Creates a new Solr database configuration
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - New configuration to create
    ///
    /// # Returns
    /// HTTP response with the created configuration as JSON
    pub async fn create(
        &self,
        db: web::Data<Database>,
        item: web::Json<NewSolrDatabase>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::solr_databases::dsl::*;
        self.validate_new(&item)?;
        let new_solr_db = item.into_inner();
        let result = execute_db_query(db, move |conn| {
            diesel::insert_into(solr_databases)
                .values(&new_solr_db)
                .get_result::<SolrDatabase>(conn)
        })
        .await?;
        Ok(HttpResponse::Created().json(result))
    }

    /// Updates an existing Solr database configuration
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameter containing the database ID
    /// * `item` - Update data
    ///
    /// # Returns
    /// HTTP response with the updated configuration as JSON
    pub async fn update(
        &self,
        db: web::Data<Database>,
        path: web::Path<i32>,
        item: web::Json<UpdateSolrDatabase>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::solr_databases::dsl::*;
        self.validate_update(&item)?;
        let solr_db_id = path.into_inner();
        let update_data = item.into_inner();
        let result = execute_db_query(db, move |conn| {
            diesel::update(solr_databases.find(solr_db_id))
                .set(&update_data)
                .get_result::<SolrDatabase>(conn)
        })
        .await?;
        Ok(HttpResponse::Ok().json(result))
    }

    /// Deletes a Solr database configuration
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameter containing the database ID
    ///
    /// # Returns
    /// HTTP response indicating success or not found
    pub async fn delete(
        &self,
        db: web::Data<Database>,
        path: web::Path<i32>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::solr_databases::dsl::*;
        let solr_db_id = path.into_inner();
        let deleted_count = execute_db_query(db, move |conn| {
            diesel::delete(solr_databases.find(solr_db_id)).execute(conn)
        })
        .await?;
        if deleted_count == 0 {
            return Err(CrudError::NotFound("SolrDatabase not found".into()));
        }
        Ok(HttpResponse::Ok().body("SolrDatabase deleted"))
    }
}

/// Retrieves all Solr database configurations
///
/// Lists all Solr instance configurations, including server details
/// and port mappings, for administration and display purposes.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with all configurations as JSON
#[utoipa::path(
    get,
    path = "/api/solr_databases",
    tag = "SolrDatabases",
    responses(
        (status = 200, description = "List of all Solr database configurations with connection details", body = [SolrDatabase]),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_solr_databases(
    db: web::Data<Database>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = SolrDatabaseHandler::new(config.get_ref().clone());
    handler
        .list(db)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))
}

/// Retrieves a specific Solr database configuration
///
/// Gets detailed connection information for a single Solr instance
/// identified by its unique ID.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameter containing the database ID
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the requested configuration or not-found error
#[utoipa::path(
    get,
    path = "/api/solr_databases/{id}",
    tag = "SolrDatabases",
    params(
        ("id" = i32, Path, example = 1)
    ),
    responses(
        (status = 200, description = "Solr database configuration found", body = SolrDatabase),
        (status = 404, description = "No Solr database configuration found with the specified ID"),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_solr_database_by_id(
    db: web::Data<Database>,
    path: web::Path<i32>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = SolrDatabaseHandler::new(config.get_ref().clone());
    handler.get_by_id(db, path).await.map_err(|e| match e {
        CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}

/// Creates a new Solr database configuration
///
/// Stores connection details for a Solr instance, including URL,
/// server port (where Solr is running), and local port (for SSH tunneling).
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - JSON payload with new configuration details
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the created configuration or validation error
#[utoipa::path(
    post,
    path = "/api/solr_databases",
    tag = "SolrDatabases",
    request_body = NewSolrDatabase,
    responses(
        (status = 201, description = "Solr database configuration created successfully", body = SolrDatabase),
        (status = 400, description = "Bad request, validation failed: invalid name length, empty URL, or port numbers outside valid range (1-65535)"),
        (status = 500, description = "Internal server error: database connection failure or constraint violation")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_solr_database(
    db: web::Data<Database>,
    item: web::Json<NewSolrDatabase>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = SolrDatabaseHandler::new(config.get_ref().clone());
    handler.create(db, item).await.map_err(|e| match e {
        CrudError::Validation(_) => actix_web::error::ErrorBadRequest(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}

/// Updates an existing Solr database configuration
///
/// Modifies connection details for a Solr instance. All fields
/// are optional to support partial updates.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameter containing the database ID
/// * `item` - JSON payload with fields to update
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the updated configuration or appropriate error
#[utoipa::path(
    put,
    path = "/api/solr_databases/{id}",
    tag = "SolrDatabases",
    params(
        ("id" = i32, Path, example = 1)
    ),
    request_body = UpdateSolrDatabase,
    responses(
        (status = 200, description = "Solr database configuration updated successfully", body = SolrDatabase),
        (status = 400, description = "Bad request, validation failed: invalid name length, empty URL, or invalid port range"),
        (status = 404, description = "Solr database configuration not found"),
        (status = 500, description = "Internal server error: database connection failure or constraint violation")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_solr_database(
    db: web::Data<Database>,
    path: web::Path<i32>,
    item: web::Json<UpdateSolrDatabase>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = SolrDatabaseHandler::new(config.get_ref().clone());
    handler.update(db, path, item).await.map_err(|e| match e {
        CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
        CrudError::Validation(_) => actix_web::error::ErrorBadRequest(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}

/// Deletes a Solr database configuration
///
/// Removes connection details for a Solr instance identified by its ID.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameter containing the database ID
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with success message or not-found error
#[utoipa::path(
    delete,
    path = "/api/solr_databases/{id}",
    tag = "SolrDatabases",
    params(
        ("id" = i32, Path, example = 1)
    ),
    responses(
        (status = 200, description = "Solr database configuration deleted successfully"),
        (status = 404, description = "Solr database configuration not found"),
        (status = 500, description = "Internal server error: database connection failure or constraint violation")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_solr_database(
    db: web::Data<Database>,
    path: web::Path<i32>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = SolrDatabaseHandler::new(config.get_ref().clone());
    handler.delete(db, path).await.map_err(|e| match e {
        CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}