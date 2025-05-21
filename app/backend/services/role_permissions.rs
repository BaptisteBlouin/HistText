//! Role and permission mapping management.
//!
//! This module provides functionality to manage role-permission associations,
//! allowing administrators to define which permissions are granted to specific roles.
//! It includes data structures, validation logic, and HTTP endpoints for CRUD operations.

use actix_web::{web, HttpResponse};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::schema::role_permissions;
use crate::services::crud::{execute_db_query, CrudError};
use crate::services::database::Database;

/// Role permission record from the database
///
/// Represents a mapping between a role and a permission in the system.
/// Each record grants a specific permission to a specific role.
#[derive(Queryable, Serialize, ToSchema)]
pub struct RolePermission {
    /// Role identifier (e.g., "admin", "editor")
    #[schema(example = "admin")]
    pub role: String,

    /// Permission identifier (e.g., "read", "write")
    #[schema(example = "read")]
    pub permission: String,

    /// When this role-permission mapping was created
    pub created_at: chrono::NaiveDateTime,
}

/// Data needed to create a new role permission mapping
///
/// Used for inserting new role-permission associations into the database.
#[derive(Insertable, Deserialize, ToSchema)]
#[diesel(table_name = role_permissions)]
pub struct NewRolePermission {
    /// Role identifier to be granted a permission
    #[schema(example = "admin")]
    pub role: String,

    /// Permission to be granted to the role
    #[schema(example = "read")]
    pub permission: String,
}

/// Handler for role permission operations
///
/// Encapsulates business logic for managing role-permission mappings,
/// including validation, querying, and modification operations.
pub struct RolePermissionHandler {
    /// Application configuration
    #[allow(dead_code)]
    config: Arc<Config>,
}

impl RolePermissionHandler {
    /// Creates a new handler with the provided configuration
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new RolePermissionHandler instance
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Validates a new role permission record
    ///
    /// Ensures that role and permission identifiers meet length requirements.
    ///
    /// # Arguments
    /// * `item` - The new role permission to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details if invalid
    fn validate_new(&self, item: &NewRolePermission) -> Result<(), CrudError> {
        if item.role.is_empty() || item.role.len() > 50 {
            return Err(CrudError::Validation(
                "Role must be between 1 and 50 characters".into(),
            ));
        }
        if item.permission.is_empty() || item.permission.len() > 50 {
            return Err(CrudError::Validation(
                "Permission must be between 1 and 50 characters".into(),
            ));
        }
        Ok(())
    }

    /// Retrieves all role permissions from the database
    ///
    /// # Arguments
    /// * `db` - Database connection
    ///
    /// # Returns
    /// HTTP response with JSON array of all role-permission mappings
    pub async fn list(&self, db: web::Data<Database>) -> Result<HttpResponse, CrudError> {
        use crate::schema::role_permissions::dsl::*;
        let results =
            execute_db_query(db, |conn| role_permissions.load::<RolePermission>(conn)).await?;
        Ok(HttpResponse::Ok().json(results))
    }

    /// Retrieves a specific role permission by its composite key
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing role and permission
    ///
    /// # Returns
    /// HTTP response with the requested role-permission mapping
    pub async fn get_by_role_and_permission(
        &self,
        db: web::Data<Database>,
        path: web::Path<(String, String)>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::role_permissions::dsl::*;
        let (role_param, permission_param) = path.into_inner();
        let result = execute_db_query(db, move |conn| {
            role_permissions
                .filter(role.eq(role_param))
                .filter(permission.eq(permission_param))
                .first::<RolePermission>(conn)
        })
        .await?;
        Ok(HttpResponse::Ok().json(result))
    }

    /// Creates a new role permission mapping
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - New role permission data
    ///
    /// # Returns
    /// HTTP response with the created role-permission mapping
    pub async fn create(
        &self,
        db: web::Data<Database>,
        item: web::Json<NewRolePermission>,
    ) -> Result<HttpResponse, CrudError> {
        self.validate_new(&item)?;
        let new_role_permission = item.into_inner();
        let result = execute_db_query(db, move |conn| {
            diesel::insert_into(role_permissions::table)
                .values(&new_role_permission)
                .get_result::<RolePermission>(conn)
        })
        .await?;
        Ok(HttpResponse::Created().json(result))
    }

    /// Deletes a role permission mapping
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing role and permission
    ///
    /// # Returns
    /// HTTP response with success message
    pub async fn delete(
        &self,
        db: web::Data<Database>,
        path: web::Path<(String, String)>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::role_permissions::dsl::*;
        let (role_param, permission_param) = path.into_inner();
        let deleted_count = execute_db_query(db, move |conn| {
            diesel::delete(
                role_permissions
                    .filter(role.eq(role_param))
                    .filter(permission.eq(permission_param)),
            )
            .execute(conn)
        })
        .await?;
        if deleted_count == 0 {
            return Err(CrudError::NotFound("RolePermission not found".into()));
        }
        Ok(HttpResponse::Ok().body("RolePermission deleted"))
    }
}

/// Retrieves all role-permission mappings
///
/// Returns a list of all mappings that define which permissions
/// are granted to specific roles. These mappings determine what
/// rights users will automatically receive when assigned a role.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with JSON array of role-permission entries
#[utoipa::path(
    get,
    path = "/api/role_permissions",
    tag = "RolePermissions",
    responses(
        (status = 200, description = "List of all role-permission mappings in the system", body = [RolePermission]),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_role_permissions(
    db: web::Data<Database>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = RolePermissionHandler::new(config.get_ref().clone());
    handler
        .list(db)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))
}

/// Retrieves a specific role-permission mapping
///
/// Looks up a role-permission mapping by its composite primary key.
/// Used to verify whether a particular permission is assigned to a role.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing role and permission identifiers
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the matching role-permission record or not-found error
#[utoipa::path(
    get,
    path = "/api/role_permissions/{role}/{permission}",
    tag = "RolePermissions",
    params(
        ("role" = String, Path, example = "admin"),
        ("permission" = String, Path, example = "read")
    ),
    responses(
        (status = 200, description = "Role-permission mapping found", body = RolePermission),
        (status = 404, description = "No mapping exists for the specified role and permission combination"),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_role_permission_by_role_and_permission(
    db: web::Data<Database>,
    path: web::Path<(String, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = RolePermissionHandler::new(config.get_ref().clone());
    handler
        .get_by_role_and_permission(db, path)
        .await
        .map_err(|e| match e {
            CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
            _ => actix_web::error::ErrorInternalServerError(e.to_string()),
        })
}

/// Creates a new role-permission mapping
///
/// Grants the specified permission to all users who have the given role.
/// Validates that identifiers are properly formatted before insertion.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - JSON payload containing new role and permission
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the created mapping or validation error
#[utoipa::path(
    post,
    path = "/api/role_permissions",
    tag = "RolePermissions",
    request_body = NewRolePermission,
    responses(
        (status = 201, description = "Role-permission mapping created successfully", body = RolePermission),
        (status = 400, description = "Validation error: role or permission identifiers invalid or exceed length limits"),
        (status = 500, description = "Database connection error, constraint violation, or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_role_permission(
    db: web::Data<Database>,
    item: web::Json<NewRolePermission>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = RolePermissionHandler::new(config.get_ref().clone());
    handler.create(db, item).await.map_err(|e| match e {
        CrudError::Validation(_) => actix_web::error::ErrorBadRequest(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}

/// Deletes a role-permission mapping
///
/// Revokes the specified permission from the given role.
/// This affects all users who have the role, unless they have
/// the permission assigned directly or through another role.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing role and permission identifiers
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with success message or not-found error
#[utoipa::path(
    delete,
    path = "/api/role_permissions/{role}/{permission}",
    tag = "RolePermissions",
    params(
        ("role" = String, Path, example = "admin"),
        ("permission" = String, Path, example = "read")
    ),
    responses(
        (status = 200, description = "Role-permission mapping successfully deleted"),
        (status = 404, description = "No mapping exists for the specified role and permission combination"),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_role_permission(
    db: web::Data<Database>,
    path: web::Path<(String, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = RolePermissionHandler::new(config.get_ref().clone());
    handler.delete(db, path).await.map_err(|e| match e {
        CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}
