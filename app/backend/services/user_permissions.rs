//! Direct user permission management.
//!
//! This module provides functionality to manage direct permission assignments
//! to individual users, bypassing the role-based permission system. These
//! direct assignments grant users specific permissions regardless of their roles.

use actix_web::{web, HttpResponse};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::schema::user_permissions;
use crate::services::crud::execute_db_query;
use crate::services::error::{AppError, AppResult};
use crate::services::database::Database;

/// User permission assignment record
///
/// Represents a direct permission assignment to a specific user,
/// granting them access independent of their role assignments.
#[derive(Queryable, Serialize, ToSchema)]
pub struct UserPermission {
    /// ID of the user receiving the permission
    #[schema(example = 1)]
    pub user_id: i32,

    /// Permission being granted
    #[schema(example = "read")]
    pub permission: String,

    /// When this permission was granted
    pub created_at: chrono::NaiveDateTime,
}

/// Data for creating a new user permission assignment
#[derive(Insertable, Deserialize, ToSchema)]
#[diesel(table_name = user_permissions)]
pub struct NewUserPermission {
    /// ID of the user to grant permission to
    #[schema(example = 1)]
    pub user_id: i32,

    /// Permission to grant
    #[schema(example = "read")]
    pub permission: String,
}

/// Handler for user permission operations
///
/// Encapsulates business logic for managing direct user permission
/// assignments, including validation, querying, and modification.
pub struct UserPermissionHandler {
    /// Application configuration
    #[allow(dead_code)]
    config: Arc<Config>,
}

impl UserPermissionHandler {
    /// Creates a new handler with the provided configuration
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new UserPermissionHandler instance
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Validates a new user permission assignment
    ///
    /// Ensures that required fields meet formatting and range requirements.
    ///
    /// # Arguments
    /// * `item` - The new permission assignment to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details
    fn validate_new(&self, item: &NewUserPermission) -> AppResult<()> {
        if item.user_id <= 0 {
            return Err(AppError::validation("Invalid user_id",Some("user_id")));
        }
        if item.permission.is_empty() || item.permission.len() > 50 {
            return Err(AppError::validation("Permission must be between 1 and 50 characters",Some("permission")));
        }
        Ok(())
    }

    /// Lists all user permission assignments
    ///
    /// # Arguments
    /// * `db` - Database connection
    ///
    /// # Returns
    /// HTTP response with all user permission assignments as JSON
    pub async fn list(&self, db: web::Data<Database>) -> AppResult<HttpResponse> {
        use crate::schema::user_permissions::dsl::*;
        let results =
            execute_db_query(db, |conn| user_permissions.load::<UserPermission>(conn)).await?;
        Ok(HttpResponse::Ok().json(results))
    }

    /// Gets a specific user permission assignment
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing user ID and permission
    ///
    /// # Returns
    /// HTTP response with the requested permission assignment as JSON
    pub async fn get_by_user_id_and_permission(
        &self,
        db: web::Data<Database>,
        path: web::Path<(i32, String)>,
    ) -> AppResult<HttpResponse> {
        use crate::schema::user_permissions::dsl::*;
        let (user_id_param, permission_param) = path.into_inner();
        let result = execute_db_query(db, move |conn| {
            user_permissions
                .filter(user_id.eq(user_id_param))
                .filter(permission.eq(permission_param))
                .first::<UserPermission>(conn)
        })
        .await?;
        Ok(HttpResponse::Ok().json(result))
    }

    /// Creates a new user permission assignment
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - New permission assignment to create
    ///
    /// # Returns
    /// HTTP response with the created permission assignment as JSON
    pub async fn create(
        &self,
        db: web::Data<Database>,
        item: web::Json<NewUserPermission>,
    ) -> AppResult<HttpResponse> {
        self.validate_new(&item)?;
        let new_perm = item.into_inner();
        let result = execute_db_query(db, move |conn| {
            diesel::insert_into(user_permissions::table)
                .values(&new_perm)
                .get_result::<UserPermission>(conn)
        })
        .await?;
        Ok(HttpResponse::Created().json(result))
    }

    /// Deletes a user permission assignment
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing user ID and permission
    ///
    /// # Returns
    /// HTTP response indicating success or not found
    pub async fn delete(
        &self,
        db: web::Data<Database>,
        path: web::Path<(i32, String)>,
    ) -> AppResult<HttpResponse> {
        use crate::schema::user_permissions::dsl::*;
        let (user_id_param, permission_param) = path.into_inner();
        let deleted_count = execute_db_query(db, move |conn| {
            diesel::delete(
                user_permissions
                    .filter(user_id.eq(user_id_param))
                    .filter(permission.eq(permission_param)),
            )
            .execute(conn)
        })
        .await?;
        if deleted_count == 0 {
            return Err(AppError::not_found("UserPermission", Option::<String>::None));
        }
        Ok(HttpResponse::Ok().body("UserPermission deleted"))
    }
}

/// Retrieves all direct user permission assignments
///
/// Lists all permissions directly assigned to users, bypassing
/// the role-based permission system. This endpoint is useful for
/// auditing special permission grants.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with all user permission assignments as JSON
#[utoipa::path(
    get,
    path = "/api/user_permissions",
    tag = "UserPermissions",
    responses(
        (status = 200, description = "List of direct user-to-permission assignments", body = [UserPermission]),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user_permissions(
    db: web::Data<Database>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = UserPermissionHandler::new(config.get_ref().clone());
    handler
        .list(db)
        .await
}

/// Retrieves a specific user permission assignment
///
/// Checks if a user has been directly granted a specific permission,
/// independent of their role assignments.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing user ID and permission
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the user permission assignment or not-found error
#[utoipa::path(
    get,
    path = "/api/user_permissions/{user_id}/{permission}",
    tag = "UserPermissions",
    params(
        ("user_id" = i32, Path, example = 1),
        ("permission" = String, Path, example = "read")
    ),
    responses(
        (status = 200, description = "Direct user permission assignment found", body = UserPermission),
        (status = 404, description = "No direct permission assignment found for this user and permission"),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user_permission_by_user_id_and_permission(
    db: web::Data<Database>,
    path: web::Path<(i32, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = UserPermissionHandler::new(config.get_ref().clone());
    handler
        .get_by_user_id_and_permission(db, path)
        .await
}

/// Creates a new direct user permission assignment
///
/// Grants a specific permission directly to a user, bypassing the
/// role-based permission system. This allows for fine-grained access
/// control and special exceptions to normal role assignments.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - JSON payload with user ID and permission to grant
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the created permission assignment or validation error
#[utoipa::path(
    post,
    path = "/api/user_permissions",
    tag = "UserPermissions",
    request_body = NewUserPermission,
    responses(
        (status = 201, description = "Direct user permission assignment created successfully", body = UserPermission),
        (status = 400, description = "Validation error: invalid user_id or permission format"),
        (status = 500, description = "Database connection error, constraint violation, or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_user_permission(
    db: web::Data<Database>,
    item: web::Json<NewUserPermission>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = UserPermissionHandler::new(config.get_ref().clone());
    handler.create(db, item).await
}

/// Deletes a direct user permission assignment
///
/// Removes a specific permission that was directly granted to a user.
/// This does not affect permissions the user may have through roles.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing user ID and permission
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with success message or not-found error
#[utoipa::path(
    delete,
    path = "/api/user_permissions/{user_id}/{permission}",
    tag = "UserPermissions",
    params(
        ("user_id" = i32, Path, example = 1),
        ("permission" = String, Path, example = "read")
    ),
    responses(
        (status = 200, description = "Direct user permission assignment deleted successfully"),
        (status = 404, description = "No direct permission assignment found for this user and permission"),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_user_permission(
    db: web::Data<Database>,
    path: web::Path<(i32, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = UserPermissionHandler::new(config.get_ref().clone());
    handler.delete(db, path).await
}
