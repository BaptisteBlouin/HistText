use actix_web::web;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::models::app_configurations::AppConfigurations;
use crate::services::crud::execute_db_query;
use crate::services::database::Database;

#[derive(Debug, Deserialize, ToSchema)]
pub struct PaginationQuery {
    /// Page number (0-based)
    #[serde(default)]
    pub page: Option<i64>,

    /// Number of items per page
    #[serde(default)]
    pub page_size: Option<i64>,
}

impl PaginationQuery {
    /// Get the effective page size, using database configuration default if not provided
    pub async fn get_page_size(&self) -> i64 {
        if let Some(size) = self.page_size {
            return size.max(1).min(1000); // Clamp between 1 and 1000
        }

        // Get default pagination size from database configuration
        let default_size = {
            let db = Database::new();
            let db_data = web::Data::new(db);

            execute_db_query(db_data, |conn| {
                Ok(AppConfigurations::get_number_value(
                    conn,
                    "limits_pagination_default_size",
                    10i64,
                ))
            })
            .await
            .unwrap_or(10i64)
        };

        default_size.max(1).min(1000)
    }

    /// Get the effective page number (0-based)
    pub fn get_page(&self) -> i64 {
        self.page.unwrap_or(0).max(0)
    }

    /// Calculate offset for database queries
    pub async fn get_offset(&self) -> i64 {
        self.get_page() * self.get_page_size().await
    }

    /// Calculate limit for database queries
    pub async fn get_limit(&self) -> i64 {
        self.get_page_size().await
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total_items: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
}

impl<T> PaginatedResponse<T> {
    pub fn new(items: Vec<T>, total_items: i64, page: i64, page_size: i64) -> Self {
        let total_pages = if page_size > 0 {
            (total_items + page_size - 1) / page_size
        } else {
            0
        };

        Self {
            items,
            total_items,
            page,
            page_size,
            total_pages,
        }
    }
}
