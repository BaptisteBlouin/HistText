pub mod controllers;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod schema;
pub mod mail;

// Use this public export for the Auth struct
pub use controllers::auth::Auth;
pub use models::permission::Permission;

// Common types and structures
pub type ID = i32;

#[cfg(not(feature = "database_sqlite"))]
pub type Utc = chrono::DateTime<chrono::Utc>;
#[cfg(feature = "database_sqlite")]
pub type Utc = chrono::NaiveDateTime;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AccessTokenClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
    pub roles: Vec<String>,
    pub permissions: Vec<Permission>,
}

#[derive(Deserialize)]
pub struct PaginationParams {
    pub page: i64,
    pub page_size: i64,
}

impl PaginationParams {
    pub const MAX_PAGE_SIZE: u16 = 100;
}

// Auth config
#[derive(Clone)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub app_url: String,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            jwt_secret: std::env::var("SECRET_KEY")
                .expect("SECRET_KEY environment variable is required"),
            app_url: std::env::var("APP_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()),
        }
    }
}