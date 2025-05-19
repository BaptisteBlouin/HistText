//! Solr collection permission management.
//! 
//! This module provides functionality to manage permission requirements for
//! accessing Solr collections. It defines which permissions users must have
//! to access specific collections, implementing access control through
//! a mapping between collections and required permissions.

use actix_web::{web, HttpResponse};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::schema::solr_database_permissions;
use crate::services::crud::{execute_db_query, CrudError};
use crate::services::database::Database;

/// Solr database permission record
///
/// Represents a permission requirement for accessing a specific Solr collection.
/// Each record creates an access control rule requiring users to have the specified
/// permission to access the collection.
#[derive(Queryable, Serialize, ToSchema)]
pub struct SolrDatabasePermission {
    /// ID of the parent Solr database
    #[schema(example = 1)]
    pub solr_database_id: i32,
    
    /// Name of the Solr collection
    #[schema(example = "users")]
    pub collection_name: String,
    
    /// Permission required to access this collection
    #[schema(example = "read")]
    pub permission: String,
}

/// Data for creating a new Solr database permission
#[derive(Insertable, Deserialize, ToSchema)]
#[diesel(table_name = solr_database_permissions)]
pub struct NewSolrDatabasePermission {
    /// ID of the parent Solr database
    #[schema(example = 1)]
    pub solr_database_id: i32,
    
    /// Name of the Solr collection
    #[schema(example = "users")]
    pub collection_name: String,
    
    /// Permission required to access this collection
    #[schema(example = "read")]
    pub permission: String,
}

/// Handler for Solr database permission operations
///
/// Encapsulates business logic for managing Solr collection permissions,
/// including validation, querying, creation, and deletion.
pub struct SolrDatabasePermissionHandler {
    /// Application configuration
    #[allow(dead_code)]
    config: Arc<Config>,
}

impl SolrDatabasePermissionHandler {
    /// Creates a new handler with the provided configuration
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new SolrDatabasePermissionHandler instance
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Validates a new Solr database permission record
    ///
    /// Ensures that required fields are present and valid.
    ///
    /// # Arguments
    /// * `item` - The new permission record to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details
    fn validate_new(&self, item: &NewSolrDatabasePermission) -> Result<(), CrudError> {
        if item.solr_database_id <= 0 {
            return Err(CrudError::Validation("Invalid solr_database_id".into()));
        }
        if item.collection_name.is_empty() || item.collection_name.len() > 100 {
            return Err(CrudError::Validation(
                "Collection name must be between 1 and 100 characters".into(),
            ));
        }
        if item.permission.is_empty() || item.permission.len() > 50 {
            return Err(CrudError::Validation(
                "Permission must be between 1 and 50 characters".into(),
            ));
        }
        Ok(())
    }

    /// Lists all Solr database permission records
    ///
    /// # Arguments
    /// * `db` - Database connection
    ///
    /// # Returns
    /// HTTP response with all permission records as JSON
    pub async fn list(&self, db: web::Data<Database>) -> Result<HttpResponse, CrudError> {
        use crate::schema::solr_database_permissions::dsl::*;
        let results = execute_db_query(db, |conn| {
            solr_database_permissions.load::<SolrDatabasePermission>(conn)
        })
        .await?;
        Ok(HttpResponse::Ok().json(results))
    }

    /// Gets a specific Solr database permission record by its composite key
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing database ID, collection name, and permission
    ///
    /// # Returns
    /// HTTP response with the requested permission record as JSON
    pub async fn get_by_composite_key(
        &self,
        db: web::Data<Database>,
        path: web::Path<(i32, String, String)>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::solr_database_permissions::dsl::*;
        let (solr_db_id, coll, perm) = path.into_inner();
        let result = execute_db_query(db, move |conn| {
            solr_database_permissions
                .filter(solr_database_id.eq(solr_db_id))
                .filter(collection_name.eq(coll))
                .filter(permission.eq(perm))
                .first::<SolrDatabasePermission>(conn)
        })
        .await?;
        Ok(HttpResponse::Ok().json(result))
    }

    /// Creates a new Solr database permission record
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - New permission record to create
    ///
    /// # Returns
    /// HTTP response with the created permission record as JSON
    pub async fn create(
        &self,
        db: web::Data<Database>,
        item: web::Json<NewSolrDatabasePermission>,
    ) -> Result<HttpResponse, CrudError> {
        self.validate_new(&item)?;
        let new_perm = item.into_inner();
        let result = execute_db_query(db, move |conn| {
            diesel::insert_into(solr_database_permissions::table)
                .values(&new_perm)
                .get_result::<SolrDatabasePermission>(conn)
        })
        .await?;
        Ok(HttpResponse::Created().json(result))
    }

    /// Deletes a Solr database permission record by its composite key
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing database ID, collection name, and permission
    ///
    /// # Returns
    /// HTTP response indicating success or not found
    pub async fn delete(
        &self,
        db: web::Data<Database>,
        path: web::Path<(i32, String, String)>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::solr_database_permissions::dsl::*;
        let (solr_db_id, coll, perm) = path.into_inner();
        let deleted = execute_db_query(db, move |conn| {
            diesel::delete(
                solr_database_permissions
                    .filter(solr_database_id.eq(solr_db_id))
                    .filter(collection_name.eq(coll))
                    .filter(permission.eq(perm)),
            )
            .execute(conn)
        })
        .await?;
        if deleted == 0 {
            return Err(CrudError::NotFound(
                "SolrDatabasePermission not found".into(),
            ));
        }
        Ok(HttpResponse::Ok().body("SolrDatabasePermission deleted"))
    }
}

/// Retrieves all Solr collection permission requirements
///
/// Lists all permission requirements defining which permissions
/// are needed to access specific Solr collections. This endpoint
/// is useful for security auditing and permission management.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with all permission records as JSON
#[utoipa::path(
    get,
    path = "/api/solr_database_permissions",
    tag = "SolrDatabasePermissions",
    responses(
        (status = 200, description = "List of all Solr collection permission requirements", body = [SolrDatabasePermission]),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_solr_database_permissions(
    db: web::Data<Database>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = SolrDatabasePermissionHandler::new(config.get_ref().clone());
    handler
        .list(db)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))
}

/// Retrieves a specific Solr collection permission requirement
///
/// Looks up a permission requirement by its composite key of
/// solr_database_id, collection_name, and permission.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing the composite key components
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the matching permission record or not-found error
#[utoipa::path(
    get,
    path = "/api/solr_database_permissions/{solr_database_id}/{collection_name}/{permission}",
    tag = "SolrDatabasePermissions",
    params(
        ("solr_database_id" = i32, Path, example = 1),
        ("collection_name" = String, Path, example = "users"),
        ("permission" = String, Path, example = "read")
    ),
    responses(
        (status = 200, description = "Solr collection permission record found", body = SolrDatabasePermission),
        (status = 404, description = "No permission record found with the specified composite key"),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_solr_database_permission(
    db: web::Data<Database>,
    path: web::Path<(i32, String, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = SolrDatabasePermissionHandler::new(config.get_ref().clone());
    handler
        .get_by_composite_key(db, path)
        .await
        .map_err(|e| match e {
            CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
            _ => actix_web::error::ErrorInternalServerError(e.to_string()),
        })
}

/// Creates a new Solr collection permission requirement
///
/// Defines a new permission requirement for accessing a specific
/// Solr collection. This creates an access control rule requiring
/// users to have the specified permission to access the collection.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - JSON payload with the new permission requirement
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the created permission record or validation error
#[utoipa::path(
    post,
    path = "/api/solr_database_permissions",
    tag = "SolrDatabasePermissions",
    request_body = NewSolrDatabasePermission,
    responses(
        (status = 201, description = "Solr collection permission requirement created successfully", body = SolrDatabasePermission),
        (status = 400, description = "Validation error: invalid solr_database_id, collection name too long, or permission format invalid"),
        (status = 500, description = "Database connection error, constraint violation, or execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_solr_database_permission(
    db: web::Data<Database>,
    item: web::Json<NewSolrDatabasePermission>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = SolrDatabasePermissionHandler::new(config.get_ref().clone());
    handler.create(db, item).await.map_err(|e| match e {
        CrudError::Validation(_) => actix_web::error::ErrorBadRequest(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}

/// Deletes a Solr collection permission requirement
///
/// Removes a permission requirement for accessing a specific collection,
/// effectively making that collection accessible without the specified
/// permission (unless other permission requirements exist).
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing the composite key components
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with success message or not-found error
#[utoipa::path(
    delete,
    path = "/api/solr_database_permissions/{solr_database_id}/{collection_name}/{permission}",
    tag = "SolrDatabasePermissions",
    params(
        ("solr_database_id" = i32, Path, example = 1),
        ("collection_name" = String, Path, example = "users"),
        ("permission" = String, Path, example = "read")
    ),
    responses(
        (status = 200, description = "Solr collection permission requirement deleted successfully"),
        (status = 404, description = "No permission record found with the specified composite key"),
        (status = 500, description = "Database connection error or execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_solr_database_permission(
    db: web::Data<Database>,
    path: web::Path<(i32, String, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = SolrDatabasePermissionHandler::new(config.get_ref().clone());
    handler.delete(db, path).await.map_err(|e| match e {
        CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}