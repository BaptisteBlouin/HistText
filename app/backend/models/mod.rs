pub mod solr_database_permissions;
pub mod solr_databases;

use serde::Deserialize;

#[derive(Deserialize)]
pub struct PaginationParams {
    pub page: i64,
    pub page_size: i64,
}

impl PaginationParams {
    pub const MAX_PAGE_SIZE: u16 = 100;
}