//! Type definitions for NER operations.

use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

/// Query parameters for NER data retrieval
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct PathQueryParams {
    /// Path to the NER cache file containing document IDs and collection information
    #[schema(example = "/tmp/ner_cache.json")]
    pub path: Option<String>,
}
