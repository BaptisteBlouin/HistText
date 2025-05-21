//! Application error handling and conversion to HTTP responses.
//!
//! This module defines custom error types for the application that can be
//! properly converted to HTTP responses with appropriate status codes.
//! It also implements conversion from common error types to the application
//! error type for convenient error handling.

use actix_web::http::header;
use actix_web::{HttpResponse, ResponseError};
use std::fmt;

/// Application-specific error types that can be converted to HTTP responses
#[derive(Debug)]
#[allow(dead_code)]
pub enum AppError {
    /// Database-related errors
    Database(diesel::result::Error),
    /// Configuration errors
    Config(crate::config::ConfigError),
    /// SSH connection and command errors
    Ssh(String),
    /// External service or dependency errors
    External(anyhow::Error),
    /// Resource not found errors
    NotFound(String),
    /// Authentication and authorization errors
    Unauthorized(String),
    /// Invalid request errors
    BadRequest(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Database(e) => write!(f, "Database error: {}", e),
            Self::Config(e) => write!(f, "Configuration error: {}", e),
            Self::Ssh(e) => write!(f, "SSH error: {}", e),
            Self::External(e) => write!(f, "External error: {}", e),
            Self::NotFound(e) => write!(f, "Not found: {}", e),
            Self::Unauthorized(e) => write!(f, "Unauthorized: {}", e),
            Self::BadRequest(e) => write!(f, "Bad request: {}", e),
        }
    }
}

impl std::error::Error for AppError {}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        match self {
            Self::Database(_) => {
                HttpResponse::InternalServerError().body("Database error occurred")
            }
            Self::Config(_) => {
                HttpResponse::InternalServerError().body("Configuration error occurred")
            }
            Self::Ssh(_) => HttpResponse::InternalServerError().body("SSH connection error"),
            Self::External(_) => {
                HttpResponse::InternalServerError().body("An external service error occurred")
            }
            Self::NotFound(msg) => HttpResponse::NotFound().body(msg.clone()),
            Self::Unauthorized(msg) => {
                let mut resp = HttpResponse::Unauthorized().body(msg.clone());
                resp.headers_mut().insert(
                    header::WWW_AUTHENTICATE,
                    header::HeaderValue::from_static("Bearer"),
                );
                resp
            }
            Self::BadRequest(msg) => HttpResponse::BadRequest().body(msg.clone()),
        }
    }
}

/// Conversion from diesel database errors
impl From<diesel::result::Error> for AppError {
    fn from(err: diesel::result::Error) -> Self {
        Self::Database(err)
    }
}

/// Conversion from configuration errors
impl From<crate::config::ConfigError> for AppError {
    fn from(err: crate::config::ConfigError) -> Self {
        Self::Config(err)
    }
}

/// Conversion from anyhow errors (generic external errors)
impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        Self::External(err)
    }
}
