//! Authentication and authorization module for the backend system.
//!
//! This module provides comprehensive authentication and authorization functionality
//! including user management, role-based access control, JWT token handling,
//! email notifications, and middleware for request protection.
//!
//! Features:
//! - JWT-based authentication with access and refresh tokens
//! - Role-based access control with granular permissions
//! - User registration, activation, and password management
//! - Email notifications for authentication events
//! - Middleware for route protection and authorization
//! - Database models for users, roles, permissions, and sessions
//! - Cross-database compatibility (SQLite and PostgreSQL)

pub mod controllers;
pub mod mail;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod schema;

// Public exports for external module usage
pub use controllers::auth::AccessTokenClaims;
pub use controllers::auth::Auth;
#[allow(unused_imports)]
pub use models::permission::Permission;

/// User and entity identifier type
pub type ID = i32;

/// Timestamp type for PostgreSQL databases
#[cfg(not(feature = "database_sqlite"))]
pub type Utc = chrono::DateTime<chrono::Utc>;

/// Timestamp type for SQLite databases
#[cfg(feature = "database_sqlite")]
pub type Utc = chrono::NaiveDateTime;

use serde::{Deserialize, Serialize};
use utoipa::IntoParams;

/// Pagination parameters for database queries
///
/// Provides standardized pagination across all list endpoints
/// with configurable page size limits for performance control.
#[derive(Deserialize, Serialize, IntoParams)]
pub struct PaginationParams {
    /// Page number (0-based)
    pub page: i64,
    /// Number of items per page
    pub page_size: i64,
}

impl PaginationParams {
    /// Maximum allowed page size to prevent resource exhaustion
    pub const MAX_PAGE_SIZE: u16 = 100;
}

impl Default for PaginationParams {
    /// Default pagination with reasonable limits
    fn default() -> Self {
        Self {
            page: 0,
            page_size: 10,
        }
    }
}

/// Authentication configuration settings
///
/// Contains JWT secret key and application URL settings
/// loaded from environment variables with sensible defaults.
#[derive(Clone)]
pub struct AuthConfig {
    /// JWT secret key for token signing and verification
    pub jwt_secret: String,
    /// Application base URL for email links
    #[allow(dead_code)]
    pub app_url: String,
}

impl Default for AuthConfig {
    /// Creates default configuration from environment variables
    ///
    /// # Panics
    /// Panics if SECRET_KEY environment variable is not set
    ///
    /// # Environment Variables
    /// - `SECRET_KEY`: Required JWT secret key
    /// - `APP_URL`: Optional application URL (defaults to localhost:3000)
    fn default() -> Self {
        Self {
            jwt_secret: std::env::var("SECRET_KEY")
                .expect("SECRET_KEY environment variable is required"),
            app_url: std::env::var("APP_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
        }
    }
}

impl AuthConfig {
    /// Creates a new AuthConfig with custom values
    ///
    /// # Arguments
    /// * `jwt_secret` - JWT secret key for token operations
    /// * `app_url` - Base URL for the application
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::AuthConfig;
    /// 
    /// let config = AuthConfig::new(
    ///     "super_secret_key".to_string(),
    ///     "https://myapp.com".to_string()
    /// );
    /// ```
    #[allow(dead_code)]
    pub fn new(jwt_secret: String, app_url: String) -> Self {
        Self {
            jwt_secret,
            app_url,
        }
    }

    /// Validates the configuration
    ///
    /// # Returns
    /// `true` if configuration is valid, `false` otherwise
    ///
    /// # Example
    /// ```rust
    /// let config = AuthConfig::default();
    /// assert!(config.is_valid());
    /// ```
    #[allow(dead_code)]
    pub fn is_valid(&self) -> bool {
        !self.jwt_secret.is_empty() && !self.app_url.is_empty()
    }
}