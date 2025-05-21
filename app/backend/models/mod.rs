pub mod solr_database_permissions;
pub mod solr_databases;

#[allow(dead_code)]
pub struct PaginationParams {
    pub page: i64,
    pub page_size: i64,
}

impl PaginationParams {
    #[allow(dead_code)]
    pub const MAX_PAGE_SIZE: u16 = 100;
}
