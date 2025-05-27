//! Type definitions for document operations.

use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

/// Query parameters for collection search operations
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct CollectionQueryParams {
    /// Collection name to search in
    #[schema(example = "my_collection")]
    pub collection: String,
    
    /// Solr query string (uses Lucene syntax)
    #[schema(example = "title:rust")]
    pub query: Option<String>,
    
    /// Starting offset for pagination
    #[schema(example = 0)]
    pub start: Option<u32>,
    
    /// Number of results to return
    #[schema(example = 10)]
    pub rows: Option<u32>,
    
    /// Statistics computation level
    #[schema(example = "All")]
    pub stats_level: Option<String>,
    
    /// Whether to include named entity recognition
    #[schema(example = true)]
    pub get_ner: Option<bool>,
    
    /// Solr database identifier
    #[schema(example = 1)]
    pub solr_database_id: i32,
    
    /// Force download as CSV file
    #[schema(example = false)]
    pub download_only: Option<bool>,
    
    /// Whether this is the first request in a session
    #[schema(example = false)]
    pub is_first: Option<bool>,
}