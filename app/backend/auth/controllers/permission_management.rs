//! Permission management controllers for role-based access control.
//!
//! Features:
//! - Role-based permission management with grant and revoke operations
//! - User-specific permission overrides
//! - Batch permission operations for efficiency
//! - Admin-only access control for all operations
//! - Comprehensive error handling and validation
//! - HTTP endpoints for permission CRUD operations

use crate::auth::models::permission::Permission;
use crate::auth::{Auth, ID};
use crate::services::database::Database;
use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};

/// Request to grant permission to a role
#[derive(Deserialize, Serialize)]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
pub struct GrantRolePermissionRequest {
    /// Role name
    #[cfg_attr(feature = "utoipa", schema(example = "admin"))]
    pub role: String,
    /// Permission name
    #[cfg_attr(feature = "utoipa", schema(example = "user:read"))]
    pub permission: String,
}

/// Request to grant permission to a user
#[derive(Deserialize, Serialize)]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
pub struct GrantUserPermissionRequest {
    /// User ID
    #[cfg_attr(feature = "utoipa", schema(example = 1))]
    pub user_id: ID,
    /// Permission name
    #[cfg_attr(feature = "utoipa", schema(example = "user:read"))]
    pub permission: String,
}

/// Request to revoke permission from a role
#[derive(Deserialize, Serialize)]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
pub struct RevokeRolePermissionRequest {
    /// Role name
    #[cfg_attr(feature = "utoipa", schema(example = "admin"))]
    pub role: String,
    /// Permission name
    #[cfg_attr(feature = "utoipa", schema(example = "user:read"))]
    pub permission: String,
}

/// Request to revoke permission from a user
#[derive(Deserialize, Serialize)]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
pub struct RevokeUserPermissionRequest {
    /// User ID
    #[cfg_attr(feature = "utoipa", schema(example = 1))]
    pub user_id: ID,
    /// Permission name
    #[cfg_attr(feature = "utoipa", schema(example = "user:read"))]
    pub permission: String,
}

/// Request to perform batch permission operations on a role
#[derive(Deserialize, Serialize)]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
pub struct BatchPermissionRequest {
    /// Role name
    #[cfg_attr(feature = "utoipa", schema(example = "admin"))]
    pub role: String,
    /// List of permission names
    #[cfg_attr(feature = "utoipa", schema(example = vec!["user:read", "user:write"]))]
    pub permissions: Vec<String>,
}

/// Request to perform batch permission operations on a user
#[derive(Deserialize, Serialize)]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
pub struct BatchUserPermissionRequest {
    /// User ID
    #[cfg_attr(feature = "utoipa", schema(example = 1))]
    pub user_id: ID,
    /// List of permission names
    #[cfg_attr(feature = "utoipa", schema(example = vec!["user:read", "user:write"]))]
    pub permissions: Vec<String>,
}

/// Grants a permission to a role
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - Grant role permission request
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn grant_role_permission(
    db: web::Data<Database>,
    req: web::Json<GrantRolePermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::grant_to_role(&mut conn, &req.role, &req.permission)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "Permission granted to role successfully"})))
}

/// Grants a permission to a specific user
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - Grant user permission request
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn grant_user_permission(
    db: web::Data<Database>,
    req: web::Json<GrantUserPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::grant_to_user(&mut conn, req.user_id, &req.permission)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "Permission granted to user successfully"})))
}

/// Grants multiple permissions to a role in batch
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - Batch permission request for role
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn grant_role_permissions(
    db: web::Data<Database>,
    req: web::Json<BatchPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::grant_many_to_role(&mut conn, req.role.clone(), req.permissions.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "Permissions granted to role successfully"})))
}

/// Grants multiple permissions to a user in batch
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - Batch permission request for user
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn grant_user_permissions(
    db: web::Data<Database>,
    req: web::Json<BatchUserPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::grant_many_to_user(&mut conn, req.user_id, req.permissions.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "Permissions granted to user successfully"})))
}

/// Revokes a permission from a role
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - Revoke role permission request
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn revoke_role_permission(
    db: web::Data<Database>,
    req: web::Json<RevokeRolePermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::revoke_from_role(&mut conn, req.role.clone(), req.permission.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "Permission revoked from role successfully"})))
}

/// Revokes a permission from a specific user
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - Revoke user permission request
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn revoke_user_permission(
    db: web::Data<Database>,
    req: web::Json<RevokeUserPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::revoke_from_user(&mut conn, req.user_id, &req.permission)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "Permission revoked from user successfully"})))
}

/// Revokes multiple permissions from a role in batch
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - Batch permission request for role
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn revoke_role_permissions(
    db: web::Data<Database>,
    req: web::Json<BatchPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::revoke_many_from_role(&mut conn, req.role.clone(), req.permissions.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "Permissions revoked from role successfully"})))
}

/// Revokes multiple permissions from a user in batch
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - Batch permission request for user
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn revoke_user_permissions(
    db: web::Data<Database>,
    req: web::Json<BatchUserPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::revoke_many_from_user(&mut conn, req.user_id, req.permissions.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "Permissions revoked from user successfully"})))
}

/// Revokes all permissions from a role
///
/// # Arguments
/// * `db` - Database connection pool
/// * `role` - Role name from URL path
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn revoke_all_role_permissions(
    db: web::Data<Database>,
    role: web::Path<String>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::revoke_all_from_role(&mut conn, role.as_ref())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "All permissions revoked from role successfully"})))
}

/// Revokes all permissions from a user
///
/// # Arguments
/// * `db` - Database connection pool
/// * `user_id` - User ID from URL path
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
pub async fn revoke_all_user_permissions(
    db: web::Data<Database>,
    user_id: web::Path<ID>,
    auth: Auth,
) -> Result<HttpResponse> {
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "Admin permission required"})));
    }

    let mut conn = db
        .get_connection()
        .map_err(|_| actix_web::error::ErrorInternalServerError("Database connection error"))?;

    Permission::revoke_all_from_user(&mut conn, *user_id)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;

    Ok(HttpResponse::Ok()
        .json(serde_json::json!({"message": "All permissions revoked from user successfully"})))
}