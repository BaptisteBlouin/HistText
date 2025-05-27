//! Metadata management for Solr collections and databases.
//! 
//! This module provides functionality for retrieving collection metadata,
//! field information, date ranges, and collection aliases with proper
//! permission handling and caching.

pub mod types;
pub mod handlers;
pub mod cache;
pub mod database;

// Re-export main handlers
pub use handlers::{get_aliases, get_collection_metadata, get_date_range};

// Re-export types
pub use types::{MetadataQueryParams, DatabaseIdQueryParams};

// Re-export utility functions
pub use database::fetch_metadata;

// Re-export OpenAPI path structs for utoipa
pub use handlers::{__path_get_aliases, __path_get_collection_metadata, __path_get_date_range};