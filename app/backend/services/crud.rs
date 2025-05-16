//! Common CRUD operation helpers and error handling utilities.
//! 
//! This module provides reusable functions and error types to handle
//! Create, Read, Update, and Delete operations consistently across
//! the application, reducing code duplication and standardizing error responses.

use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use diesel::result::Error as DieselError;
use std::fmt;

use crate::services::database::{Connection, Database};

/// Custom error type for CRUD operations
///
/// Represents various error conditions that can occur during database
/// operations, providing appropriate HTTP status codes and error messages.
#[derive(Debug)]
pub enum CrudError {
    /// Database-related errors from Diesel ORM
    Database(DieselError),
    /// Connection pool or transaction errors
    Connection(String),
    /// Input validation errors
    Validation(String),
    /// Resource not found errors
    NotFound(String),
}

impl fmt::Display for CrudError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Database(e) => write!(f, "Database error: {}", e),
            Self::Connection(e) => write!(f, "Connection error: {}", e),
            Self::Validation(e) => write!(f, "Validation error: {}", e),
            Self::NotFound(e) => write!(f, "Not found: {}", e),
        }
    }
}

impl std::error::Error for CrudError {}

impl ResponseError for CrudError {
    fn status_code(&self) -> StatusCode {
        match self {
            CrudError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            CrudError::Connection(_) => StatusCode::INTERNAL_SERVER_ERROR,
            CrudError::Validation(_) => StatusCode::BAD_REQUEST,
            CrudError::NotFound(_) => StatusCode::NOT_FOUND,
        }
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).body(self.to_string())
    }
}

impl From<DieselError> for CrudError {
    fn from(err: DieselError) -> Self {
        match err {
            DieselError::NotFound => CrudError::NotFound("Record not found".into()),
            other => CrudError::Database(other),
        }
    }
}

impl From<anyhow::Error> for CrudError {
    fn from(err: anyhow::Error) -> Self {
        CrudError::Connection(format!("Database connection error: {}", err))
    }
}

/// Executes a database query with proper logging and error handling
///
/// This helper function:
/// 1. Obtains a database connection from the pool
/// 2. Runs the provided operation on Actix's blocking thread pool
/// 3. Translates any Diesel errors into appropriate CrudError types
///
/// # Arguments
/// * `db` - Database connection wrapped in actix_web::Data
/// * `operation` - Closure containing the database operation to execute
///
/// # Type Parameters
/// * `T` - Return type of the database operation
/// * `F` - Function/closure type for the database operation
///
/// # Returns
/// Result containing the operation result or a CrudError
pub async fn execute_db_query<T, F>(db: web::Data<Database>, operation: F) -> Result<T, CrudError>
where
    F: FnOnce(&mut Connection) -> Result<T, DieselError> + Send + 'static,
    T: Send + 'static,
{
    // Get a database connection
    let mut conn: Connection = db.get_connection()?;

    // Run the operation on a blocking thread pool
    let result: Result<T, DieselError> = web::block(move || operation(&mut conn))
        .await
        .map_err(|e| CrudError::Connection(format!("Database operation failed: {}", e)))?;

    // Translate any Diesel errors to CrudError
    result.map_err(CrudError::from)
}