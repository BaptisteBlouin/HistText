//! Centralized error handling for the application.
//!
//! This module provides a unified error type that can represent all possible
//! errors in the application, along with automatic conversions from common
//! error types and proper HTTP response formatting.

use actix_web::{HttpResponse, ResponseError};
use serde_json::json;
use std::fmt;

/// Centralized application error type
///
/// This enum represents all possible error conditions in the application
/// and provides automatic conversion to appropriate HTTP responses.
#[derive(Debug)]
pub enum AppError {
    /// Database-related errors (queries, connections, transactions)
    Database {
        message: String,
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
    
    /// Authentication and authorization errors
    Auth {
        message: String,
        reason: AuthErrorReason,
    },
    
    /// Input validation errors (malformed data, constraint violations)
    Validation {
        message: String,
        field: Option<String>,
    },
    
    /// Resource not found errors
    NotFound {
        resource: String,
        identifier: Option<String>,
    },
    
    /// External service errors (Solr, SMTP, etc.)
    External {
        service: String,
        message: String,
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
    
    /// Configuration errors (missing env vars, invalid settings)
    Config {
        setting: String,
        message: String,
    },
    
    /// File system and I/O errors
    Io {
        operation: String,
        message: String,
    },
    
    /// JSON serialization/deserialization errors
    Serialization {
        message: String,
    },
    
    /// Rate limiting errors
    RateLimit {
        message: String,
        retry_after: Option<u64>,
    },
    
    /// Internal server errors (unexpected conditions)
    Internal {
        message: String,
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
}

/// Specific authentication error reasons
#[derive(Debug, Clone)]
pub enum AuthErrorReason {
    /// Missing or malformed token
    InvalidToken,
    /// Token has expired
    ExpiredToken,
    /// Missing authentication
    MissingAuth,
    /// Insufficient permissions
    InsufficientPermissions,
    /// Invalid credentials
    InvalidCredentials,
    /// Account not activated
    AccountNotActivated,
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Database { message, .. } => write!(f, "Database error: {}", message),
            AppError::Auth { message, reason } => write!(f, "Authentication error ({}): {}", reason, message),
            AppError::Validation { message, field } => {
                if let Some(field) = field {
                    write!(f, "Validation error in '{}': {}", field, message)
                } else {
                    write!(f, "Validation error: {}", message)
                }
            }
            AppError::NotFound { resource, identifier } => {
                if let Some(id) = identifier {
                    write!(f, "{} '{}' not found", resource, id)
                } else {
                    write!(f, "{} not found", resource)
                }
            }
            AppError::External { service, message, .. } => write!(f, "{} service error: {}", service, message),
            AppError::Config { setting, message } => write!(f, "Configuration error in '{}': {}", setting, message),
            AppError::Io { operation, message } => write!(f, "I/O error during '{}': {}", operation, message),
            AppError::Serialization { message } => write!(f, "Serialization error: {}", message),
            AppError::RateLimit { message, .. } => write!(f, "Rate limit exceeded: {}", message),
            AppError::Internal { message, .. } => write!(f, "Internal error: {}", message),
        }
    }
}

impl fmt::Display for AuthErrorReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuthErrorReason::InvalidToken => write!(f, "invalid_token"),
            AuthErrorReason::ExpiredToken => write!(f, "expired_token"),
            AuthErrorReason::MissingAuth => write!(f, "missing_auth"),
            AuthErrorReason::InsufficientPermissions => write!(f, "insufficient_permissions"),
            AuthErrorReason::InvalidCredentials => write!(f, "invalid_credentials"),
            AuthErrorReason::AccountNotActivated => write!(f, "account_not_activated"),
        }
    }
}

impl std::error::Error for AppError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            AppError::Database { source, .. } => source.as_ref().map(|e| e.as_ref() as &dyn std::error::Error),
            AppError::External { source, .. } => source.as_ref().map(|e| e.as_ref() as &dyn std::error::Error),
            AppError::Internal { source, .. } => source.as_ref().map(|e| e.as_ref() as &dyn std::error::Error),
            _ => None,
        }
    }
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_code, message, details) = match self {
            AppError::Database { message, .. } => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                "database_error".to_string(),
                "A database error occurred".to_string(),
                Some(json!({ "details": message }))
            ),
            
            AppError::Auth { message, reason } => {
                let status = match reason {
                    AuthErrorReason::MissingAuth | AuthErrorReason::InvalidToken | AuthErrorReason::ExpiredToken => {
                        actix_web::http::StatusCode::UNAUTHORIZED
                    }
                    AuthErrorReason::InsufficientPermissions => {
                        actix_web::http::StatusCode::FORBIDDEN
                    }
                    AuthErrorReason::InvalidCredentials | AuthErrorReason::AccountNotActivated => {
                        actix_web::http::StatusCode::UNAUTHORIZED
                    }
                };
                let error_code = format!("auth_{}", reason);
                (status, error_code, message.clone(), None)
            }
            
            AppError::Validation { message, field } => (
                actix_web::http::StatusCode::BAD_REQUEST,
                "validation_error".to_string(),
                message.clone(),
                field.as_ref().map(|f| json!({ "field": f }))
            ),
            
            AppError::NotFound { resource, identifier } => (
                actix_web::http::StatusCode::NOT_FOUND,
                "not_found".to_string(),
                format!("{} not found", resource),
                identifier.as_ref().map(|id| json!({ "identifier": id }))
            ),
            
            AppError::External { service, message, .. } => (
                actix_web::http::StatusCode::SERVICE_UNAVAILABLE,
                "external_service_error".to_string(),
                format!("{} service is currently unavailable", service),
                Some(json!({ "service": service, "details": message }))
            ),
            
            AppError::Config { setting, message } => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                "configuration_error".to_string(),
                "Server configuration error".to_string(),
                Some(json!({ "setting": setting, "details": message }))
            ),
            
            AppError::Io { operation, message } => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                "io_error".to_string(),
                "File system error occurred".to_string(),
                Some(json!({ "operation": operation, "details": message }))
            ),
            
            AppError::Serialization { message } => (
                actix_web::http::StatusCode::BAD_REQUEST,
                "serialization_error".to_string(),
                "Invalid data format".to_string(),
                Some(json!({ "details": message }))
            ),
            
            AppError::RateLimit { message, retry_after } => (
                actix_web::http::StatusCode::TOO_MANY_REQUESTS,
                "rate_limit_exceeded".to_string(),
                message.clone(),
                retry_after.map(|seconds| json!({ "retry_after": seconds }))
            ),
            
            AppError::Internal { message, .. } => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error".to_string(),
                "An internal server error occurred".to_string(),
                Some(json!({ "details": message }))
            ),
        };

        let mut response_body = json!({
            "error": {
                "code": error_code,
                "message": message
            }
        });

        if let Some(details) = details {
            response_body["error"]["details"] = details;
        }

        let mut response = HttpResponse::build(status).json(response_body);

        // Add retry-after header for rate limiting
        if let AppError::RateLimit { retry_after: Some(seconds), .. } = self {
            response.headers_mut().insert(
                actix_web::http::header::RETRY_AFTER,
                actix_web::http::header::HeaderValue::from_str(&seconds.to_string()).unwrap()
            );
        }

        response
    }
}

// Automatic conversions from common error types
impl From<diesel::result::Error> for AppError {
    fn from(err: diesel::result::Error) -> Self {
        match err {
            diesel::result::Error::NotFound => AppError::NotFound {
                resource: "Record".to_string(),
                identifier: None,
            },
            diesel::result::Error::DatabaseError(kind, ref info) => AppError::Database {
                message: format!("Database error ({:?}): {}", kind, info.message()),
                source: Some(Box::new(err)),
            },
            _ => AppError::Database {
                message: err.to_string(),
                source: Some(Box::new(err)),
            },
        }
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        let reason = match err.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthErrorReason::ExpiredToken,
            jsonwebtoken::errors::ErrorKind::InvalidToken => AuthErrorReason::InvalidToken,
            _ => AuthErrorReason::InvalidToken,
        };
        
        AppError::Auth {
            message: "JWT token validation failed".to_string(),
            reason,
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io {
            operation: "file_operation".to_string(),
            message: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization {
            message: err.to_string(),
        }
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::External {
            service: "HTTP".to_string(),
            message: err.to_string(),
            source: Some(Box::new(err)),
        }
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal {
            message: err.to_string(),
            source: None, // anyhow::Error doesn't implement std::error::Error in all contexts
        }
    }
}

impl From<crate::config::ConfigError> for AppError {
    fn from(err: crate::config::ConfigError) -> Self {
        match err {
            crate::config::ConfigError::MissingKey(key) => AppError::Config {
                setting: key.to_string(),
                message: "Required environment variable is missing".to_string(),
            },
            crate::config::ConfigError::ParseError(key, msg) => AppError::Config {
                setting: key.to_string(),
                message: format!("Failed to parse configuration: {}", msg),
            },
        }
    }
}

/// Result type alias for convenience
pub type AppResult<T> = Result<T, AppError>;

/// Trait for adding context to errors
pub trait ErrorContext<T> {
    /// Add context to an error
    fn with_context(self, context: &str) -> AppResult<T>;
    /// Add context with a specific service name for external errors
    fn with_service_context(self, service: &str, context: &str) -> AppResult<T>;
    /// Add validation context with field information
    fn with_validation_context(self, field: &str, context: &str) -> AppResult<T>;
}

impl<T, E> ErrorContext<T> for Result<T, E>
where
    E: std::error::Error + Send + Sync + 'static,
{
    fn with_context(self, context: &str) -> AppResult<T> {
        self.map_err(|e| AppError::Internal {
            message: format!("{}: {}", context, e),
            source: Some(Box::new(e)),
        })
    }

    fn with_service_context(self, service: &str, context: &str) -> AppResult<T> {
        self.map_err(|e| AppError::External {
            service: service.to_string(),
            message: format!("{}: {}", context, e),
            source: Some(Box::new(e)),
        })
    }

    fn with_validation_context(self, field: &str, context: &str) -> AppResult<T> {
        self.map_err(|e| AppError::Validation {
            message: format!("{}: {}", context, e),
            field: Some(field.to_string()),
        })
    }
}

/// Helper functions for creating specific error types
impl AppError {
    /// Create a validation error with field information
    pub fn validation(message: impl Into<String>, field: Option<impl Into<String>>) -> Self {
        AppError::Validation {
            message: message.into(),
            field: field.map(|f| f.into()),
        }
    }

    /// Create a not found error
    pub fn not_found(resource: impl Into<String>, identifier: Option<impl Into<String>>) -> Self {
        AppError::NotFound {
            resource: resource.into(),
            identifier: identifier.map(|i| i.into()),
        }
    }

    /// Create an authentication error
    pub fn auth(reason: AuthErrorReason, message: impl Into<String>) -> Self {
        AppError::Auth {
            message: message.into(),
            reason,
        }
    }

    /// Create a database error
    pub fn database(message: impl Into<String>) -> Self {
        AppError::Database {
            message: message.into(),
            source: None,
        }
    }

    /// Create an external service error
    pub fn external_service(service: impl Into<String>, message: impl Into<String>) -> Self {
        AppError::External {
            service: service.into(),
            message: message.into(),
            source: None,
        }
    }
}