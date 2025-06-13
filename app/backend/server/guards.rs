//! Authentication and authorization guards for route handlers.
//!
//! This module provides guard functions that can be used with Actix-Web
//! to control access to routes based on JWT tokens and permissions.

use crate::config::Config;
use crate::services::auth::{AccessTokenClaims, Auth, Permission};
use actix_web::{guard::GuardContext, http::header, web::Data};
use jsonwebtoken;
use std::collections::HashSet;
use std::sync::Arc;

/// Guards a route to require admin permission in the JWT token.
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

/// Guards a route to allow access if user is admin OR if user is accessing their own resource
pub fn has_permission_or_own_resource(ctx: &GuardContext, user_id_param: &str) -> bool {
    let _ = user_id_param;
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
                    // Check if user has admin permission
                    let is_admin = token_data
                        .claims
                        .permissions
                        .iter()
                        .any(|p| p.permission == "admin");

                    if is_admin {
                        return true;
                    }

                    // Check if user is accessing their own resource
                    let auth_user_id = token_data.claims.sub;

                    // Extract user ID from path
                    if let Some(path_segments) = req_head.uri.path().split('/').nth_back(0) {
                        if let Ok(resource_user_id) = path_segments.parse::<i32>() {
                            return auth_user_id == resource_user_id;
                        }
                    }
                }
            }
        }
    }

    false
}

/// Specific guard for user routes that extracts user ID from URL path
pub fn can_access_user_resource(ctx: &GuardContext) -> bool {
    // This is a more robust way to extract user ID from the path
    let path = ctx.head().uri.path();

    // For paths like /api/users/123, extract the user ID
    let path_segments: Vec<&str> = path.split('/').collect();

    // Look for the user ID in the path (should be after "users")
    if let Some(users_index) = path_segments.iter().position(|&segment| segment == "users") {
        if users_index + 1 < path_segments.len() {
            if let Ok(_user_id) = path_segments[users_index + 1].parse::<i32>() {
                return has_permission_or_own_resource(ctx, path_segments[users_index + 1]);
            }
        }
    }

    false
}

/// Guards a route to require a specific permission in the JWT token.
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
                    let permissions: HashSet<Permission> =
                        token_data.claims.permissions.iter().cloned().collect();

                    // Convert roles to HashSet for the Auth struct
                    let roles: HashSet<String> = token_data.claims.roles.iter().cloned().collect();

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
                    let permissions: HashSet<Permission> =
                        token_data.claims.permissions.iter().cloned().collect();
                    let roles: HashSet<String> = token_data.claims.roles.iter().cloned().collect();

                    // Create Auth instance
                    let auth = Auth {
                        user_id,
                        roles,
                        permissions,
                    };

                    // Convert &[&str] to Vec<String> for the has_any_permission method
                    let perms: Vec<String> =
                        required_permissions.iter().map(|p| p.to_string()).collect();

                    // Use Auth's has_any_permission method
                    return auth.has_any_permission(perms);
                }
            }
        }
    }

    false
}

/// Guards a route to require the user to have a specific role.
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
                    let permissions: HashSet<Permission> =
                        token_data.claims.permissions.iter().cloned().collect();
                    let roles: HashSet<String> = token_data.claims.roles.iter().cloned().collect();

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
