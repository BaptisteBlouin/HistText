//! Document management and search functionality for the histtext application.
//!
//! This module provides comprehensive document search, processing, and export capabilities
//! including Solr integration, text highlighting, CSV generation, and file downloads.

pub mod handlers;
pub mod processing;
pub mod search;
pub mod types;
pub mod utils;

// Re-export main handlers
pub use handlers::{download_csv, query_collection};

// Re-export types
pub use types::CollectionQueryParams;

// Re-export OpenAPI path structs for utoipa
pub use handlers::{__path_download_csv, __path_query_collection};
