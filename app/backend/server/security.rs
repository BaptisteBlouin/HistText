//! Security headers middleware for Actix Web with development mode awareness.
//!
//! This module provides middleware that adds important security headers to HTTP responses,
//! with special configurations for development environments.

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    http::header,
    Error,
};
use futures::future::{ready, LocalBoxFuture, Ready};

/// Middleware for adding security headers to all responses
///
/// Adds the following headers by default:
/// - X-Content-Type-Options: nosniff
/// - X-Frame-Options: SAMEORIGIN
/// - X-XSS-Protection: 1; mode=block
/// - Referrer-Policy: strict-origin-when-cross-origin
/// - Content-Security-Policy: A reasonably strict policy
/// - Permissions-Policy: Restricts powerful features
///
/// Can be configured to include additional headers or modify defaults.
#[derive(Clone)]
pub struct SecurityHeaders {
    /// Whether to include Content-Security-Policy header
    include_csp: bool,
    /// Whether to include X-Frame-Options header
    include_frame_options: bool,
    /// Whether to include X-XSS-Protection header
    include_xss_protection: bool,
    /// Whether to include Referrer-Policy header
    include_referrer_policy: bool,
    /// Whether to include Permissions-Policy header
    include_permissions_policy: bool,
    /// Whether to include Strict-Transport-Security header
    include_hsts: bool,
    /// Custom value for Content-Security-Policy header (if not using default)
    custom_csp: Option<String>,
}

impl Default for SecurityHeaders {
    fn default() -> Self {
        Self {
            include_csp: true,
            include_frame_options: true,
            include_xss_protection: true,
            include_referrer_policy: true,
            include_permissions_policy: true,
            include_hsts: true,
            custom_csp: None,
        }
    }
}

impl SecurityHeaders {
    /// Creates a new SecurityHeaders middleware with default settings
    pub fn new() -> Self {
        Self::default()
    }

    /// Creates a new SecurityHeaders middleware configured for development
    pub fn for_development() -> Self {
        Self {
            include_csp: true,
            include_frame_options: true,
            include_xss_protection: true,
            include_referrer_policy: true,
            include_permissions_policy: true,
            include_hsts: false, // No HSTS in development
            custom_csp: Some(Self::development_csp().to_string()),
        }
    }

    /// Configures whether to include the Content-Security-Policy header
    pub fn include_csp(mut self, include: bool) -> Self {
        self.include_csp = include;
        self
    }

    /// Configures whether to include the X-Frame-Options header
    pub fn include_frame_options(mut self, include: bool) -> Self {
        self.include_frame_options = include;
        self
    }

    /// Configures whether to include the X-XSS-Protection header
    pub fn include_xss_protection(mut self, include: bool) -> Self {
        self.include_xss_protection = include;
        self
    }

    /// Configures whether to include the Referrer-Policy header
    pub fn include_referrer_policy(mut self, include: bool) -> Self {
        self.include_referrer_policy = include;
        self
    }

    /// Configures whether to include the Permissions-Policy header
    pub fn include_permissions_policy(mut self, include: bool) -> Self {
        self.include_permissions_policy = include;
        self
    }

    /// Configures whether to include the Strict-Transport-Security header
    pub fn include_hsts(mut self, include: bool) -> Self {
        self.include_hsts = include;
        self
    }

    /// Sets a custom Content-Security-Policy value
    pub fn with_custom_csp(mut self, csp: impl Into<String>) -> Self {
        self.custom_csp = Some(csp.into());
        self
    }

    /// Gets the default Content-Security-Policy value for production
    fn default_csp() -> &'static str {
        "default-src 'self'; \
         script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; \
         style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; \
         img-src 'self' data: https:; \
         font-src 'self' https://cdnjs.cloudflare.com; \
         connect-src 'self'; \
         worker-src 'self'; \
         frame-ancestors 'self'; \
         form-action 'self'; \
         base-uri 'self'; \
         object-src 'none'"
    }

    /// Gets the Content-Security-Policy value for development environments
    fn development_csp() -> &'static str {
        "default-src 'self'; \
         script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:21012 https://cdnjs.cloudflare.com; \
         style-src 'self' 'unsafe-inline' http://localhost:21012 https://cdnjs.cloudflare.com; \
         img-src 'self' data: https:; \
         font-src 'self' https://cdnjs.cloudflare.com; \
         connect-src 'self' http://localhost:21012 ws://localhost:21012; \
         worker-src 'self'; \
         frame-ancestors 'self'; \
         form-action 'self'; \
         base-uri 'self'; \
         object-src 'none'"
    }

    /// Gets the default Permissions-Policy value
    fn default_permissions_policy() -> &'static str {
        "camera=(), microphone=(), geolocation=(self), \
         payment=(), xr-spatial-tracking=(), \
         accelerometer=(), gyroscope=(), magnetometer=()"
    }
}

impl<S, B> Transform<S, ServiceRequest> for SecurityHeaders
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = SecurityHeadersMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(SecurityHeadersMiddleware {
            service,
            config: self.clone(),
        }))
    }
}

/// Middleware service that adds security headers to responses
pub struct SecurityHeadersMiddleware<S> {
    service: S,
    config: SecurityHeaders,
}

impl<S, B> Service<ServiceRequest> for SecurityHeadersMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let fut = self.service.call(req);
        let config = self.config.clone();

        Box::pin(async move {
            let mut res = fut.await?;

            // Always add X-Content-Type-Options
            res.headers_mut().insert(
                header::HeaderName::from_static("x-content-type-options"),
                header::HeaderValue::from_static("nosniff"),
            );

            // Add X-Frame-Options if enabled
            if config.include_frame_options {
                res.headers_mut().insert(
                    header::HeaderName::from_static("x-frame-options"),
                    header::HeaderValue::from_static("SAMEORIGIN"),
                );
            }

            // Add X-XSS-Protection if enabled
            if config.include_xss_protection {
                res.headers_mut().insert(
                    header::HeaderName::from_static("x-xss-protection"),
                    header::HeaderValue::from_static("1; mode=block"),
                );
            }

            // Add Referrer-Policy if enabled
            if config.include_referrer_policy {
                res.headers_mut().insert(
                    header::REFERRER_POLICY,
                    header::HeaderValue::from_static("strict-origin-when-cross-origin"),
                );
            }

            // Add Content-Security-Policy if enabled
            if config.include_csp {
                let csp_value = match &config.custom_csp {
                    Some(custom) => header::HeaderValue::from_str(custom).unwrap_or_else(|_| {
                        header::HeaderValue::from_static(SecurityHeaders::default_csp())
                    }),
                    None => header::HeaderValue::from_static(SecurityHeaders::default_csp()),
                };

                res.headers_mut().insert(
                    header::HeaderName::from_static("content-security-policy"),
                    csp_value,
                );
            }

            // Add Permissions-Policy if enabled
            if config.include_permissions_policy {
                res.headers_mut().insert(
                    header::HeaderName::from_static("permissions-policy"),
                    header::HeaderValue::from_static(SecurityHeaders::default_permissions_policy()),
                );
            }

            // Add Strict-Transport-Security if enabled
            if config.include_hsts {
                res.headers_mut().insert(
                    header::HeaderName::from_static("strict-transport-security"),
                    header::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
                );
            }

            Ok(res)
        })
    }
}
