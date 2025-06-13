//! Named Entity Recognition (NER) module for document analysis.
//!
//! This module provides functionality for extracting and processing named entities
//! from documents using Solr-based NER collections, with caching support for
//! improved performance on repeated requests.

pub mod cache;
pub mod handlers;
pub mod processing;
pub mod types;

// Re-export main handlers
pub use handlers::fetch_ner_data;

// Re-export types
pub use types::PathQueryParams;

// Re-export OpenAPI path structs for utoipa
pub use handlers::__path_fetch_ner_data;
