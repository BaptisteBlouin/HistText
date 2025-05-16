//! Authentication and authorization guards for route handlers.
//!
//! This module provides guard functions that can be used with Actix-Web
//! to control access to routes based on JWT tokens and permissions.

use crate::config::Config;
use actix_web::{guard::GuardContext, http::header, web::Data};
use create_rust_app::auth::AccessTokenClaims;
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