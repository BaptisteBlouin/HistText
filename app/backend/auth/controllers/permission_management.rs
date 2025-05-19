// New file: auth/controllers/permission_management.rs

use crate::auth::models::permission::Permission;
use crate::auth::ID;
use crate::services::database::Database;
use crate::auth::Auth;
use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;

// Request bodies for our endpoints
#[derive(Deserialize)]
pub struct GrantRolePermissionRequest {
    pub role: String,
    pub permission: String,
}

#[derive(Deserialize)]
pub struct GrantUserPermissionRequest {
    pub user_id: ID,
    pub permission: String,
}

#[derive(Deserialize)]
pub struct RevokeRolePermissionRequest {
    pub role: String,
    pub permission: String,
}

#[derive(Deserialize)]
pub struct RevokeUserPermissionRequest {
    pub user_id: ID,
    pub permission: String,
}

#[derive(Deserialize)]
pub struct BatchPermissionRequest {
    pub role: String,
    pub permissions: Vec<String>,
}

#[derive(Deserialize)]
pub struct BatchUserPermissionRequest {
    pub user_id: ID,
    pub permissions: Vec<String>,
}

// API handlers

// Grant a permission to a role
pub async fn grant_role_permission(
    db: web::Data<Database>, 
    req: web::Json<GrantRolePermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }

    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::grant_to_role(&mut conn, &req.role, &req.permission)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "Permission granted to role successfully"})
    ))
}

// Grant a permission to a user
pub async fn grant_user_permission(
    db: web::Data<Database>, 
    req: web::Json<GrantUserPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }
    
    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::grant_to_user(&mut conn, req.user_id, &req.permission)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "Permission granted to user successfully"})
    ))
}

// Grant multiple permissions to a role
pub async fn grant_role_permissions(
    db: web::Data<Database>, 
    req: web::Json<BatchPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }
    
    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::grant_many_to_role(&mut conn, req.role.clone(), req.permissions.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "Permissions granted to role successfully"})
    ))
}

// Grant multiple permissions to a user
pub async fn grant_user_permissions(
    db: web::Data<Database>, 
    req: web::Json<BatchUserPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }
    
    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::grant_many_to_user(&mut conn, req.user_id, req.permissions.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "Permissions granted to user successfully"})
    ))
}

// Revoke a permission from a role
pub async fn revoke_role_permission(
    db: web::Data<Database>, 
    req: web::Json<RevokeRolePermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }
    
    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::revoke_from_role(&mut conn, req.role.clone(), req.permission.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "Permission revoked from role successfully"})
    ))
}

// Revoke a permission from a user
pub async fn revoke_user_permission(
    db: web::Data<Database>, 
    req: web::Json<RevokeUserPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }
    
    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::revoke_from_user(&mut conn, req.user_id, &req.permission)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "Permission revoked from user successfully"})
    ))
}

// Revoke multiple permissions from a role
pub async fn revoke_role_permissions(
    db: web::Data<Database>, 
    req: web::Json<BatchPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }
    
    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::revoke_many_from_role(&mut conn, req.role.clone(), req.permissions.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "Permissions revoked from role successfully"})
    ))
}

// Revoke multiple permissions from a user
pub async fn revoke_user_permissions(
    db: web::Data<Database>, 
    req: web::Json<BatchUserPermissionRequest>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }
    
    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::revoke_many_from_user(&mut conn, req.user_id, req.permissions.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "Permissions revoked from user successfully"})
    ))
}

// Revoke all permissions from a role
pub async fn revoke_all_role_permissions(
    db: web::Data<Database>, 
    role: web::Path<String>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }
    
    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::revoke_all_from_role(&mut conn, role.as_ref())
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "All permissions revoked from role successfully"})
    ))
}

// Revoke all permissions from a user
pub async fn revoke_all_user_permissions(
    db: web::Data<Database>, 
    user_id: web::Path<ID>,
    auth: Auth,
) -> Result<HttpResponse> {
    // Check if user has admin permission
    if !auth.has_permission("admin".to_string()) {
        return Ok(HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Admin permission required"})
        ));
    }
    
    let mut conn = db.get_connection().map_err(|_| {
        actix_web::error::ErrorInternalServerError("Database connection error")
    })?;
    
    Permission::revoke_all_from_user(&mut conn, *user_id)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(
        serde_json::json!({"message": "All permissions revoked from user successfully"})
    ))
}