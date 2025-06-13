//! Type definitions for metadata operations.

use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

/// Query parameters for metadata operations requiring collection specification
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct MetadataQueryParams {
    /// Collection name to retrieve metadata for
    #[schema(example = "my_collection")]
    pub collection: String,

    /// Solr database identifier
    #[schema(example = 1)]
    pub solr_database_id: i32,
}

/// Query parameters for database-level operations
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct DatabaseIdQueryParams {
    /// Solr database identifier
    #[schema(example = 1)]
    pub solr_database_id: i32,
}
