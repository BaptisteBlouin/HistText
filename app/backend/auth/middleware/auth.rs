// backend/auth/middleware/auth.rs (Updated)

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error::Error,
    http::header,
    HttpMessage,
};
use futures::future::{ready, LocalBoxFuture, Ready};
use jsonwebtoken::{decode, DecodingKey, Validation};
use std::sync::Arc;

use crate::auth::models::permission::Permission;
use crate::auth::{AccessTokenClaims, Auth, AuthConfig};
use crate::config::Config;
use std::collections::HashSet;

/// JwtAuth middleware for Actix Web
///
/// Extracts and validates JWT tokens from requests, adding the Auth
/// struct to request extensions for other handlers to use.
pub struct JwtAuth;

impl<S, B> Transform<S, ServiceRequest> for JwtAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = JwtAuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(JwtAuthMiddleware { service }))
    }
}

pub struct JwtAuthMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for JwtAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        // Get app configuration which contains JWT secret
        let config_opt = req.app_data::<Arc<Config>>().cloned();
        if config_opt.is_none() {
            return Box::pin(async move {
                Err(actix_web::error::ErrorInternalServerError(
                    "Server configuration not found",
                ))
            });
        }
        let config = config_opt.unwrap();

        // Use AuthConfig with the secret from Config
        let auth_config = AuthConfig {
            jwt_secret: config.secret_key.clone(),
            app_url: config.app_url.clone(),
        };

        // Check for auth header
        let auth_header = req.headers().get(header::AUTHORIZATION).cloned();
        let auth_result = if let Some(header_value) = auth_header {
            if let Ok(auth_str) = header_value.to_str() {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    // Use AuthConfig's jwt_secret for token verification
                    let token_result = decode::<AccessTokenClaims>(
                        token,
                        &DecodingKey::from_secret(auth_config.jwt_secret.as_bytes()),
                        &Validation::default(),
                    );

                    match token_result {
                        Ok(token_data) => {
                            // Build Auth struct from token claims
                            let user_id = token_data.claims.sub;
                            let permissions: HashSet<Permission> =
                                token_data.claims.permissions.iter().cloned().collect();
                            let roles: HashSet<String> =
                                token_data.claims.roles.iter().cloned().collect();

                            let auth = Auth {
                                user_id,
                                roles,
                                permissions,
                            };

                            // Insert Auth into request extensions
                            req.extensions_mut().insert(auth);
                            Ok(())
                        }
                        Err(_) => Err(actix_web::error::ErrorUnauthorized("Invalid token")),
                    }
                } else {
                    Err(actix_web::error::ErrorUnauthorized(
                        "Invalid Authorization header format",
                    ))
                }
            } else {
                Err(actix_web::error::ErrorUnauthorized(
                    "Invalid Authorization header",
                ))
            }
        } else {
            Err(actix_web::error::ErrorUnauthorized(
                "Authorization required",
            ))
        };

        // Continue with service call or return error
        let fut = self.service.call(req);
        Box::pin(async move {
            match auth_result {
                Ok(()) => {
                    let res = fut.await?;
                    Ok(res)
                }
                Err(err) => Err(err),
            }
        })
    }
}

/// Middleware to check for specific permissions
///
/// Requires that a user has a specific permission to access a route.
pub struct RequirePermission {
    required_permission: String,
}

impl RequirePermission {
    /// Create a new permission requirement middleware
    ///
    /// # Arguments
    /// * `permission` - The permission string to check for
    pub fn new(permission: &str) -> Self {
        Self {
            required_permission: permission.to_string(),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RequirePermission
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RequirePermissionMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequirePermissionMiddleware {
            service,
            required_permission: self.required_permission.clone(),
        }))
    }
}

pub struct RequirePermissionMiddleware<S> {
    service: S,
    required_permission: String,
}

impl<S, B> Service<ServiceRequest> for RequirePermissionMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        // Extract Auth from request extensions - should be set by JwtAuth middleware
        let has_permission = if let Some(auth) = req.extensions().get::<Auth>() {
            // Use Auth's has_permission method to check for the required permission
            auth.has_permission(self.required_permission.clone())
        } else {
            false
        };

        // Clone the required data for the async block
        let required_permission = self.required_permission.clone();
        let fut = self.service.call(req);

        // Return a future that resolves to the response or an error
        Box::pin(async move {
            if has_permission {
                let res = fut.await?;
                Ok(res)
            } else {
                Err(actix_web::error::ErrorForbidden(format!(
                    "Permission denied: {} required",
                    required_permission
                )))
            }
        })
    }
}

/// Middleware to check for multiple permissions (any of them)
///
/// Requires that a user has at least one of the specified permissions to access a route.
pub struct RequireAnyPermission {
    required_permissions: Vec<String>,
}

impl RequireAnyPermission {
    /// Create a new middleware that requires any of the specified permissions
    ///
    /// # Arguments
    /// * `permissions` - List of permission strings, any of which grants access
    #[allow(dead_code)]
    pub fn new(permissions: Vec<&str>) -> Self {
        Self {
            required_permissions: permissions.iter().map(|p| p.to_string()).collect(),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RequireAnyPermission
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RequireAnyPermissionMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequireAnyPermissionMiddleware {
            service,
            required_permissions: self.required_permissions.clone(),
        }))
    }
}

pub struct RequireAnyPermissionMiddleware<S> {
    service: S,
    required_permissions: Vec<String>,
}

impl<S, B> Service<ServiceRequest> for RequireAnyPermissionMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        // Extract Auth from request extensions
        let has_any_permission = if let Some(auth) = req.extensions().get::<Auth>() {
            // Check if the user has any of the required permissions
            auth.has_any_permission(&self.required_permissions)
        } else {
            false
        };

        // Clone the required data for the async block
        let required_permissions = self.required_permissions.clone();
        let fut = self.service.call(req);

        // Return a future that resolves to the response or an error
        Box::pin(async move {
            if has_any_permission {
                let res = fut.await?;
                Ok(res)
            } else {
                Err(actix_web::error::ErrorForbidden(format!(
                    "Permission denied: one of {:?} required",
                    required_permissions
                )))
            }
        })
    }
}

/// Middleware to check for a specific role
///
/// Requires that a user has a specific role to access a route.
pub struct RequireRole {
    required_role: String,
}

impl RequireRole {
    /// Create a new role requirement middleware
    ///
    /// # Arguments
    /// * `role` - The role string to check for
    pub fn new(role: &str) -> Self {
        Self {
            required_role: role.to_string(),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RequireRole
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RequireRoleMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequireRoleMiddleware {
            service,
            required_role: self.required_role.clone(),
        }))
    }
}

pub struct RequireRoleMiddleware<S> {
    service: S,
    required_role: String,
}

impl<S, B> Service<ServiceRequest> for RequireRoleMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        // Extract Auth from request extensions
        let has_role = if let Some(auth) = req.extensions().get::<Auth>() {
            // Check if the user has the required role
            auth.has_role(&self.required_role)
        } else {
            false
        };

        // Clone the required data for the async block
        let required_role = self.required_role.clone();
        let fut = self.service.call(req);

        // Return a future that resolves to the response or an error
        Box::pin(async move {
            if has_role {
                let res = fut.await?;
                Ok(res)
            } else {
                Err(actix_web::error::ErrorForbidden(format!(
                    "Role '{}' required",
                    required_role
                )))
            }
        })
    }
}
