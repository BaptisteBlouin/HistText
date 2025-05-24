//! Application configuration management.
//!
//! This module provides centralized configuration loading and validation,
//! converting environment variables into a strongly-typed `Config` struct.
//! It ensures consistent settings across the application and eliminates
//! the need for scattered `std::env::var` calls throughout the codebase.

// Updated config.rs with mail settings

//! Application configuration management.
//!
//! This module provides centralized configuration loading and validation,
//! converting environment variables into a strongly-typed `Config` struct.
//! It ensures consistent settings across the application and eliminates
//! the need for scattered `std::env::var` calls throughout the codebase.

use actix_web::web;
use lazy_static::lazy_static;
use serde::Deserialize;
use std::sync::Arc;
use std::{env, fmt};

lazy_static! {
    /// Global static configuration loaded at application startup
    static ref CONFIG: Arc<Config> =
        Arc::new(Config::load().expect("Failed to load configuration"));
}

/// Application configuration loaded from environment variables
///
/// Contains all runtime settings for the application, organized by category.
/// Values are loaded from environment variables, with some having default values.
#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    // Database and authentication
    /// Database connection string
    #[allow(dead_code)]
    pub database_url: String,

    /// Secret key for token signing and password hashing
    pub secret_key: String,

    // Solr connection settings
    /// Default path to word embedding files
    pub embed_path: String,

    /// Port for the named entity recognition Solr service
    pub solr_ner_port: u16,

    // Size limits
    /// Maximum number of documents to return in queries
    pub max_size_query: u32,

    /// Maximum document size in bytes
    pub max_size_document: usize,

    /// Maximum number of document IDs to process for NER
    pub max_id_ner: usize,

    // JSON payload and request size limits (in MB)
    /// Maximum size for query JSON payloads in megabytes
    pub max_query_size_mb: usize,

    /// Maximum size for document uploads in megabytes
    pub max_document_size_mb: usize,

    // Cache paths
    /// File path for statistics cache
    pub stats_cache_path: String,

    /// File path for NER cache
    pub ner_cache_path: String,

    /// Directory path for storing temporary files
    pub path_store_files: String,

    // Metadata and field configuration
    /// Maximum number of values to display in metadata selection
    pub max_metadata_select: usize,

    /// List of field types to exclude from display
    pub exclude_field_types: Vec<String>,

    /// List of field names to exclude from display
    pub exclude_field_names: Vec<String>,

    /// List of field name patterns to exclude from display
    pub exclude_field_name_patterns: Vec<String>,

    /// Prefix to exclude for request names
    pub exclude_request_name_starts_with: String,

    /// Suffix to exclude for request names
    pub exclude_request_name_ends_with: String,

    /// Prefix for ID fields
    pub id_starts_with: String,

    /// Suffix for ID fields
    pub id_ends_with: String,

    /// Field name for main date value
    pub main_date_value: String,

    // OAuth settings
    /// Base URL for the application
    pub app_url: String,

    // /// Google OAuth client ID
    // pub google_oauth2_client_id: String,

    // /// Google OAuth client secret
    // pub google_oauth2_client_secret: String,

    // OpenAPI settings
    /// Whether to enable OpenAPI documentation
    pub do_openapi: bool,

    /// Username for OpenAPI basic auth
    pub openapi_login: String,

    /// Password for OpenAPI basic auth
    pub openapi_pwd: String,

    // Embeddings cache settings
    /// Maximum number of embedding files to keep in cache
    pub max_embeddings_files: usize,

    // Email settings (SMTP)
    /// SMTP server address
    pub smtp_server: String,

    /// SMTP username
    pub smtp_username: String,

    /// SMTP password
    pub smtp_password: String,

    /// Email address to use as sender
    pub smtp_from_address: String,

    /// Whether to actually send emails or just log them
    pub send_mail: bool,

    pub cache_ttl_seconds: u64,
    pub max_cache_size: usize,
    pub enable_query_cache: bool,
    pub enable_response_streaming: bool,
}

/// Errors that can occur during configuration loading
#[derive(Debug)]
pub enum ConfigError {
    /// Required environment variable is missing
    MissingKey(&'static str),

    /// Failed to parse environment variable value
    ParseError(&'static str, String),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::MissingKey(key) => write!(f, "Missing environment variable: {}", key),
            ConfigError::ParseError(key, err) => write!(f, "Failed to parse {}: {}", key, err),
        }
    }
}

impl std::error::Error for ConfigError {}

impl Config {
    /// Gets the global configuration instance
    ///
    /// This provides a reference to the lazily-initialized global configuration
    /// that's shared across the application.
    ///
    /// # Returns
    /// A reference to the global configuration
    pub fn global() -> &'static Arc<Config> {
        &CONFIG
    }

    /// Creates an Actix-Web compatible Data wrapper for the configuration
    ///
    /// This is useful for dependency injection in Actix-Web handlers.
    ///
    /// # Returns
    /// Web Data wrapper containing the configuration
    #[allow(dead_code)]
    pub fn as_data() -> web::Data<Arc<Config>> {
        web::Data::new(CONFIG.clone())
    }

    /// Loads application configuration from environment variables
    ///
    /// This function:
    /// 1. Attempts to load variables from .env file
    /// 2. Reads required variables from environment
    /// 3. Applies defaults for optional variables
    /// 4. Parses and validates all values
    ///
    /// # Returns
    /// A fully initialized Config struct or an error
    ///
    /// # Errors
    /// Returns `ConfigError` if any required variable is missing or fails to parse
    pub fn load() -> Result<Self, ConfigError> {
        // Load environment variables from .env, ignoring errors
        dotenvy::dotenv().ok();

        // Helper to get a String or error if missing
        fn get(key: &'static str) -> Result<String, ConfigError> {
            env::var(key).map_err(|_| ConfigError::MissingKey(key))
        }

        // Helper to parse a value from String
        fn parse<T: std::str::FromStr>(key: &'static str) -> Result<T, ConfigError> {
            let s = get(key)?;
            s.parse::<T>()
                .map_err(|_| ConfigError::ParseError(key, format!("invalid value: {}", s)))
        }

        // Helper to get a String with a default value if missing
        fn get_with_default(key: &'static str, default: &str) -> String {
            env::var(key).unwrap_or_else(|_| default.to_string())
        }

        // Helper to parse a value with a default
        fn parse_with_default<T: std::str::FromStr>(key: &'static str, default: T) -> T {
            env::var(key)
                .ok()
                .and_then(|s| s.parse::<T>().ok())
                .unwrap_or(default)
        }

        // Helper to parse comma-separated list
        fn parse_csv(key: &'static str) -> Result<Vec<String>, ConfigError> {
            Ok(get_with_default(key, "")
                .split(',')
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect())
        }

        Ok(Config {
            // Database and authentication
            database_url: get("DATABASE_URL")?,
            secret_key: get("SECRET_KEY")?,

            // Solr connection settings
            embed_path: get("EMBED_PATH")?,
            solr_ner_port: parse::<u16>("SOLR_NER_PORT")?,

            // Size limits
            max_size_query: parse::<u32>("MAX_SIZE_QUERY")?,
            max_size_document: parse::<usize>("MAX_SIZE_DOCUMENT")?,
            max_id_ner: parse::<usize>("MAX_ID_NER")?,

            // JSON payload and request size limits
            max_query_size_mb: parse_with_default::<usize>("MAX_QUERY_SIZE_MB", 10),
            max_document_size_mb: parse_with_default::<usize>("MAX_DOCUMENT_SIZE_MB", 128),

            // Cache paths
            stats_cache_path: get("STATS_CACHE_PATH")?,
            ner_cache_path: get("NER_CACHE_PATH")?,
            path_store_files: get("PATH_STORE_FILES")?,

            // Metadata and field configuration
            max_metadata_select: parse::<usize>("MAX_METADATA_SELECT")?,
            exclude_field_types: parse_csv("EXCLUDE_FIELD_TYPES")?,
            exclude_field_names: parse_csv("EXCLUDE_FIELD_NAMES")?,
            exclude_field_name_patterns: parse_csv("EXCLUDE_FIELD_NAME_PATTERNS")?,
            exclude_request_name_starts_with: get_with_default(
                "EXCLUDE_REQUEST_NAME_STARTS_WITH",
                "",
            ),
            exclude_request_name_ends_with: get_with_default("EXCLUDE_REQUEST_NAME_ENDS_WITH", ""),
            id_starts_with: get_with_default("ID_STARTS_WITH", ""),
            id_ends_with: get_with_default("ID_ENDS_WITH", ""),
            main_date_value: get("MAIN_DATE_VALUE")?,

            // OAuth settings
            app_url: get("APP_URL")?,
            //google_oauth2_client_id: get("GOOGLE_OAUTH2_CLIENT_ID")?,
            //google_oauth2_client_secret: get("GOOGLE_OAUTH2_CLIENT_SECRET")?,

            // OpenApi settings
            do_openapi: parse::<bool>("DO_OPENAPI")?,
            openapi_login: get("OPENAPI_LOGIN")?,
            openapi_pwd: get("OPENAPI_PWD")?,

            // Embeddings cache settings - with a default of 3 if not specified
            max_embeddings_files: parse_with_default::<usize>("MAX_EMBEDDINGS_FILES", 3),

            // Email settings
            smtp_server: get_with_default("SMTP_SERVER", "localhost"),
            smtp_username: get_with_default("SMTP_USERNAME", ""),
            smtp_password: get_with_default("SMTP_PASSWORD", ""),
            smtp_from_address: get_with_default("SMTP_FROM_ADDRESS", "no-reply@example.com"),
            send_mail: parse_with_default::<bool>("SEND_MAIL", false),

            cache_ttl_seconds: parse_with_default::<u64>("CACHE_TTL_SECONDS", 3600),
            max_cache_size: parse_with_default::<usize>("MAX_CACHE_SIZE", 1000),
            enable_query_cache: parse_with_default::<bool>("ENABLE_QUERY_CACHE", true),
            enable_response_streaming: parse_with_default::<bool>("ENABLE_RESPONSE_STREAMING", false),
        })
    }
}
