//! Authentication and authorization middleware for Actix Web applications.
//!
//! Features:
//! - JWT token validation and extraction middleware
//! - Permission-based access control with granular checks
//! - Role-based access control for route protection
//! - Multiple permission requirement strategies (any/all)
//! - Request extension integration for downstream handlers
//! - Comprehensive error handling with descriptive messages

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error::Error,
    http::header,
    HttpMessage,
};
use futures::future::{ready, LocalBoxFuture, Ready};
use jsonwebtoken::{decode, DecodingKey, Validation};
use std::collections::HashSet;
use std::sync::Arc;

use crate::auth::models::permission::Permission;
use crate::auth::{AccessTokenClaims, Auth, AuthConfig};
use crate::config::Config;

/// JWT authentication middleware for Actix Web
///
/// Extracts and validates JWT tokens from Authorization headers,
/// adding the Auth struct to request extensions for downstream handlers.
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

/// JWT authentication middleware implementation
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
        let config_opt = req.app_data::<Arc<Config>>().cloned();
        if config_opt.is_none() {
            return Box::pin(async move {
                Err(actix_web::error::ErrorInternalServerError(
                    "Server configuration not found",
                ))
            });
        }
        let config = config_opt.unwrap();

        let auth_config = AuthConfig {
            jwt_secret: config.secret_key.clone(),
            app_url: config.app_url.clone(),
        };

        let auth_header = req.headers().get(header::AUTHORIZATION).cloned();
        let auth_result = if let Some(header_value) = auth_header {
            if let Ok(auth_str) = header_value.to_str() {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    let token_result = decode::<AccessTokenClaims>(
                        token,
                        &DecodingKey::from_secret(auth_config.jwt_secret.as_bytes()),
                        &Validation::default(),
                    );

                    match token_result {
                        Ok(token_data) => {
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

/// Middleware to require a specific permission for route access
///
/// Checks that the authenticated user has the specified permission
/// before allowing access to the protected route.
pub struct RequirePermission {
    required_permission: String,
}

impl RequirePermission {
    /// Creates a new permission requirement middleware
    ///
    /// # Arguments
    /// * `permission` - The permission string to check for
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::middleware::RequirePermission;
    /// 
    /// let middleware = RequirePermission::new("user:read");
    /// ```
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

/// Permission requirement middleware implementation
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
        let has_permission = if let Some(auth) = req.extensions().get::<Auth>() {
            auth.has_permission(self.required_permission.clone())
        } else {
            false
        };

        let required_permission = self.required_permission.clone();
        let fut = self.service.call(req);

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

/// Middleware to require any of multiple permissions for route access
///
/// Allows access if the authenticated user has at least one of the
/// specified permissions.
pub struct RequireAnyPermission {
    required_permissions: Vec<String>,
}

impl RequireAnyPermission {
    /// Creates a new middleware that requires any of the specified permissions
    ///
    /// # Arguments
    /// * `permissions` - List of permission strings, any of which grants access
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::middleware::RequireAnyPermission;
    /// 
    /// let middleware = RequireAnyPermission::new(vec!["user:read", "admin:all"]);
    /// ```
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

/// Any permission requirement middleware implementation
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
        let has_any_permission = if let Some(auth) = req.extensions().get::<Auth>() {
            auth.has_any_permission(&self.required_permissions)
        } else {
            false
        };

        let required_permissions = self.required_permissions.clone();
        let fut = self.service.call(req);

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

/// Middleware to require a specific role for route access
///
/// Checks that the authenticated user has the specified role
/// before allowing access to the protected route.
pub struct RequireRole {
    required_role: String,
}

impl RequireRole {
    /// Creates a new role requirement middleware
    ///
    /// # Arguments
    /// * `role` - The role string to check for
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::middleware::RequireRole;
    /// 
    /// let middleware = RequireRole::new("admin");
    /// ```
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

/// Role requirement middleware implementation
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
        let has_role = if let Some(auth) = req.extensions().get::<Auth>() {
            auth.has_role(&self.required_role)
        } else {
            false
        };

        let required_role = self.required_role.clone();
        let fut = self.service.call(req);

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