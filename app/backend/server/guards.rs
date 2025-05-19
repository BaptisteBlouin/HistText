//! Authentication and authorization guards for route handlers.
//!
//! This module provides guard functions that can be used with Actix-Web
//! to control access to routes based on JWT tokens and permissions.

use crate::auth::Auth;
use crate::auth::AccessTokenClaims;
use crate::auth::models::permission::Permission;
use crate::config::Config;
use actix_web::{guard::GuardContext, http::header, web::Data};
use jsonwebtoken;
use std::collections::HashSet;
use std::sync::Arc;

/// Guards a route to require admin permission in the JWT token.
///
/// This function validates the Authorization Bearer token, decodes the JWT,
/// and checks if the admin permission is present in the token's claims.
///
/// # Arguments
/// * `ctx` - The guard context providing access to request headers and app data
///
/// # Returns
/// `true` if a valid token with admin permission is present, `false` otherwise
pub fn has_permission(ctx: &GuardContext) -> bool {
    // Get request headers
    let req_head = ctx.head();
    
    // Get application config
    let config = match ctx.app_data::<Data<Arc<Config>>>() {
        Some(config) => config,
        None => return false,
    };
    
    // Process authorization header if present
    if let Some(auth_header) = req_head.headers().get(header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            // Extract the token part from "Bearer <token>"
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                // Decode and validate the JWT token
                if let Ok(token_data) = jsonwebtoken::decode::<AccessTokenClaims>(
                    token,
                    &jsonwebtoken::DecodingKey::from_secret(config.secret_key.as_ref()),
                    &jsonwebtoken::Validation::default(),
                ) {
                    // Check if "admin" permission is present
                    return token_data
                        .claims
                        .permissions
                        .iter()
                        .any(|p| p.permission == "admin");
                }
            }
        }
    }
    
    // Default to denying access
    false
}

/// Guards a route to require a specific permission in the JWT token.
///
/// This is an enhanced version of the has_permission guard that allows
/// checking for any specific permission, not just "admin".
///
/// # Arguments
/// * `ctx` - The guard context
/// * `required_permission` - The permission string to check for
///
/// # Returns
/// `true` if a valid token with the required permission is present, `false` otherwise
#[allow(dead_code)]
pub fn has_specific_permission(ctx: &GuardContext, required_permission: &str) -> bool {
    // Get request headers
    let req_head = ctx.head();
    
    // Get application config
    let config = match ctx.app_data::<Data<Arc<Config>>>() {
        Some(config) => config,
        None => return false,
    };
    
    // Process authorization header if present
    if let Some(auth_header) = req_head.headers().get(header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            // Extract the token part from "Bearer <token>"
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                // Decode and validate the JWT token
                if let Ok(token_data) = jsonwebtoken::decode::<AccessTokenClaims>(
                    token,
                    &jsonwebtoken::DecodingKey::from_secret(config.secret_key.as_ref()),
                    &jsonwebtoken::Validation::default(),
                ) {
                    // Extract claims data to create an Auth instance
                    let user_id = token_data.claims.sub;
                    
                    // Convert permissions to HashSet for the Auth struct
                    let permissions: HashSet<Permission> = token_data
                        .claims
                        .permissions
                        .iter()
                        .cloned()
                        .collect();
                    
                    // Convert roles to HashSet for the Auth struct
                    let roles: HashSet<String> = token_data
                        .claims
                        .roles
                        .iter()
                        .cloned()
                        .collect();
                    
                    // Create Auth instance from token data
                    let auth = Auth {
                        user_id,
                        roles,
                        permissions,
                    };
                    
                    // Use Auth's has_permission method to check for permission
                    return auth.has_permission(required_permission.to_string());
                }
            }
        }
    }
    
    // Default to denying access
    false
}

/// Guards a route to require any of the specified permissions.
///
/// This function allows checking if the user has any of multiple permissions.
///
/// # Arguments
/// * `ctx` - The guard context
/// * `required_permissions` - List of permissions to check for
///
/// # Returns
/// `true` if a valid token with any of the required permissions is present
#[allow(dead_code)]
pub fn has_any_permission(ctx: &GuardContext, required_permissions: &[&str]) -> bool {
    // Get request headers and config (same as above)
    let req_head = ctx.head();
    
    let config = match ctx.app_data::<Data<Arc<Config>>>() {
        Some(config) => config,
        None => return false,
    };
    
    // Process authorization header (same as above)
    if let Some(auth_header) = req_head.headers().get(header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                if let Ok(token_data) = jsonwebtoken::decode::<AccessTokenClaims>(
                    token,
                    &jsonwebtoken::DecodingKey::from_secret(config.secret_key.as_ref()),
                    &jsonwebtoken::Validation::default(),
                ) {
                    // Extract data to create Auth instance
                    let user_id = token_data.claims.sub;
                    let permissions: HashSet<Permission> = token_data
                        .claims
                        .permissions
                        .iter()
                        .cloned()
                        .collect();
                    let roles: HashSet<String> = token_data
                        .claims
                        .roles
                        .iter()
                        .cloned()
                        .collect();
                    
                    // Create Auth instance
                    let auth = Auth {
                        user_id,
                        roles,
                        permissions,
                    };
                    
                    // Convert &[&str] to Vec<String> for the has_any_permission method
                    let perms: Vec<String> = required_permissions
                        .iter()
                        .map(|p| p.to_string())
                        .collect();
                    
                    // Use Auth's has_any_permission method
                    return auth.has_any_permission(perms);
                }
            }
        }
    }
    
    false
}

/// Guards a route to require the user to have a specific role.
///
/// # Arguments
/// * `ctx` - The guard context
/// * `required_role` - The role to check for
///
/// # Returns
/// `true` if a valid token with the required role is present
#[allow(dead_code)]
pub fn has_role(ctx: &GuardContext, required_role: &str) -> bool {
    // Implementation follows the same pattern as above
    let req_head = ctx.head();
    
    let config = match ctx.app_data::<Data<Arc<Config>>>() {
        Some(config) => config,
        None => return false,
    };
    
    if let Some(auth_header) = req_head.headers().get(header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                if let Ok(token_data) = jsonwebtoken::decode::<AccessTokenClaims>(
                    token,
                    &jsonwebtoken::DecodingKey::from_secret(config.secret_key.as_ref()),
                    &jsonwebtoken::Validation::default(),
                ) {
                    let user_id = token_data.claims.sub;
                    let permissions: HashSet<Permission> = token_data
                        .claims
                        .permissions
                        .iter()
                        .cloned()
                        .collect();
                    let roles: HashSet<String> = token_data
                        .claims
                        .roles
                        .iter()
                        .cloned()
                        .collect();
                    
                    let auth = Auth {
                        user_id,
                        roles,
                        permissions,
                    };
                    
                    // Use Auth's has_role method
                    return auth.has_role(required_role);
                }
            }
        }
    }
    
    false
}