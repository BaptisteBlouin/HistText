//! User role assignment management.
//!
//! This module provides functionality to manage role assignments for users
//! in the system. Roles serve as collections of permissions that can be
//! assigned to users, allowing for easier permission management through
//! role-based access control.

use actix_web::{web, HttpResponse};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::schema::user_roles;
use crate::services::crud::execute_db_query;
use crate::services::database::Database;
use crate::services::error::{AppError, AppResult};

/// User role assignment record
///
/// Represents the assignment of a role to a specific user,
/// granting them all permissions associated with that role.
#[derive(Queryable, Serialize, ToSchema)]
pub struct UserRole {
    /// ID of the user receiving the role
    #[schema(example = 1)]
    pub user_id: i32,

    /// Role being assigned
    #[schema(example = "admin")]
    pub role: String,

    /// When this role was assigned
    pub created_at: chrono::NaiveDateTime,
}

/// Data for creating a new user role assignment
#[derive(Insertable, Deserialize, ToSchema)]
#[diesel(table_name = user_roles)]
pub struct NewUserRole {
    /// ID of the user to assign the role to
    #[schema(example = 1)]
    pub user_id: i32,

    /// Role to assign
    #[schema(example = "admin")]
    pub role: String,
}

/// Handler for user role operations
///
/// Encapsulates business logic for managing user role assignments,
/// including validation, querying, and modification.
pub struct UserRoleHandler {
    /// Application configuration
    #[allow(dead_code)]
    config: Arc<Config>,
}

impl UserRoleHandler {
    /// Creates a new handler with the provided configuration
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new UserRoleHandler instance
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Validates a new user role assignment
    ///
    /// Ensures that required fields meet formatting and range requirements.
    ///
    /// # Arguments
    /// * `item` - The new role assignment to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details
    fn validate_new(&self, item: &NewUserRole) -> AppResult<()> {
        if item.user_id <= 0 {
            return Err(AppError::validation("Invalid user_id", Some("user_id")));
        }
        if item.role.is_empty() || item.role.len() > 50 {
            return Err(AppError::validation(
                "Role must be between 1 and 50 characters",
                Some("role"),
            ));
        }
        Ok(())
    }

    /// Lists all user role assignments
    ///
    /// # Arguments
    /// * `db` - Database connection
    ///
    /// # Returns
    /// HTTP response with all user role assignments as JSON
    pub async fn list(&self, db: web::Data<Database>) -> AppResult<HttpResponse> {
        use crate::schema::user_roles::dsl::*;
        let results = execute_db_query(db, |conn| user_roles.load::<UserRole>(conn)).await?;
        Ok(HttpResponse::Ok().json(results))
    }

    /// Gets a specific user role assignment
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing user ID and role
    ///
    /// # Returns
    /// HTTP response with the requested role assignment as JSON
    pub async fn get_by_user_id_and_role(
        &self,
        db: web::Data<Database>,
        path: web::Path<(i32, String)>,
    ) -> AppResult<HttpResponse> {
        use crate::schema::user_roles::dsl::*;
        let (user_id_param, role_param) = path.into_inner();
        let result = execute_db_query(db, move |conn| {
            user_roles
                .filter(user_id.eq(user_id_param))
                .filter(role.eq(role_param))
                .first::<UserRole>(conn)
        })
        .await?;
        Ok(HttpResponse::Ok().json(result))
    }

    /// Creates a new user role assignment
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - New role assignment to create
    ///
    /// # Returns
    /// HTTP response with the created role assignment as JSON
    pub async fn create(
        &self,
        db: web::Data<Database>,
        item: web::Json<NewUserRole>,
    ) -> AppResult<HttpResponse> {
        self.validate_new(&item)?;
        let new_role = item.into_inner();
        let result = execute_db_query(db, move |conn| {
            diesel::insert_into(user_roles::table)
                .values(&new_role)
                .get_result::<UserRole>(conn)
        })
        .await?;
        Ok(HttpResponse::Created().json(result))
    }

    /// Deletes a user role assignment
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameters containing user ID and role
    ///
    /// # Returns
    /// HTTP response indicating success or not found
    pub async fn delete(
        &self,
        db: web::Data<Database>,
        path: web::Path<(i32, String)>,
    ) -> AppResult<HttpResponse> {
        use crate::schema::user_roles::dsl::*;
        let (user_id_param, role_param) = path.into_inner();
        let deleted_count = execute_db_query(db, move |conn| {
            diesel::delete(
                user_roles
                    .filter(user_id.eq(user_id_param))
                    .filter(role.eq(role_param)),
            )
            .execute(conn)
        })
        .await?;
        if deleted_count == 0 {
            return Err(AppError::not_found("UserRole", Option::<String>::None));
        }
        Ok(HttpResponse::Ok().body("UserRole deleted"))
    }
}

/// Retrieves all user role assignments
///
/// Lists all roles assigned to users in the system. This information
/// is useful for role auditing and user permission management.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with all user role assignments as JSON
#[utoipa::path(
    get,
    path = "/api/user_roles",
    tag = "UserRoles",
    responses(
        (status = 200, description = "List of all user-role assignments in the system", body = [UserRole]),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user_roles(
    db: web::Data<Database>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = UserRoleHandler::new(config.get_ref().clone());
    handler.list(db).await
}

/// Retrieves a specific user role assignment
///
/// Checks if a specific user has been assigned a particular role.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing user ID and role
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the user role assignment or not-found error
#[utoipa::path(
    get,
    path = "/api/user_roles/{user_id}/{role}",
    tag = "UserRoles",
    params(
        ("user_id" = i32, Path, example = 1),
        ("role" = String, Path, example = "admin")
    ),
    responses(
        (status = 200, description = "User-role assignment found", body = UserRole),
        (status = 404, description = "No assignment found for this user and role"),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user_role_by_user_id_and_role(
    db: web::Data<Database>,
    path: web::Path<(i32, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = UserRoleHandler::new(config.get_ref().clone());
    handler.get_by_user_id_and_role(db, path).await
}

/// Creates a new user role assignment
///
/// Assigns a specific role to a user, granting them all permissions
/// associated with that role. This is the primary way to give users
/// access to system functionality through role-based access control.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - JSON payload with user ID and role to assign
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the created role assignment or validation error
#[utoipa::path(
    post,
    path = "/api/user_roles",
    tag = "UserRoles",
    request_body = NewUserRole,
    responses(
        (status = 201, description = "User-role assignment created successfully", body = UserRole),
        (status = 400, description = "Validation error: invalid user_id or role format"),
        (status = 500, description = "Database connection error, constraint violation, or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_user_role(
    db: web::Data<Database>,
    item: web::Json<NewUserRole>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = UserRoleHandler::new(config.get_ref().clone());
    handler.create(db, item).await
}

/// Deletes a user role assignment
///
/// Removes a role from a user, revoking all permissions granted
/// through that role (unless the user has those permissions through
/// other roles or direct permission assignments).
///
/// # Arguments
/// * `db` - Database connection pool
/// * `path` - Path parameters containing user ID and role
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with success message or not-found error
#[utoipa::path(
    delete,
    path = "/api/user_roles/{user_id}/{role}",
    tag = "UserRoles",
    params(
        ("user_id" = i32, Path, example = 1),
        ("role" = String, Path, example = "admin")
    ),
    responses(
        (status = 200, description = "User-role assignment deleted successfully"),
        (status = 404, description = "No assignment found for this user and role"),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_user_role(
    db: web::Data<Database>,
    path: web::Path<(i32, String)>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, AppError> {
    let handler = UserRoleHandler::new(config.get_ref().clone());
    handler.delete(db, path).await
}
