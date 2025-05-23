//! Common CRUD operation helpers with centralized error handling.
//!
//! This module provides reusable functions for Create, Read, Update, and Delete
//! operations with consistent error handling throughout the application.

use actix_web::web;
use diesel::result::Error as DieselError;

use crate::services::database::{Connection, Database};
use crate::services::error::{AppError, AppResult};

/// Execute a database query with proper error handling
///
/// This helper function:
/// 1. Obtains a database connection from the pool
/// 2. Runs the provided operation on Actix's blocking thread pool
/// 3. Automatically converts any errors to the centralized AppError type
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
/// Result containing the operation result or an AppError
pub async fn execute_db_query<T, F>(db: web::Data<Database>, operation: F) -> AppResult<T>
where
    F: FnOnce(&mut Connection) -> Result<T, DieselError> + Send + 'static,
    T: Send + 'static,
{
    // Get a database connection
    let mut conn = db.get_connection()
        .map_err(|e| AppError::database(format!("Failed to get database connection: {}", e)))?;

    // Run the operation on a blocking thread pool
    let result = web::block(move || operation(&mut conn))
        .await
        .map_err(|e| AppError::database(format!("Database operation failed: {}", e)))?;

    // Convert diesel errors to AppError automatically
    result.map_err(AppError::from)
}

/// Execute a database transaction with proper error handling
///
/// This function wraps database operations in a transaction and automatically
/// handles rollbacks on error.
///
/// # Arguments
/// * `db` - Database connection wrapped in actix_web::Data
/// * `operation` - Closure containing the transactional operations
///
/// # Returns
/// Result containing the operation result or an AppError
pub async fn execute_db_transaction<T, F>(db: web::Data<Database>, operation: F) -> AppResult<T>
where
    F: FnOnce(&mut Connection) -> Result<T, DieselError> + Send + 'static,
    T: Send + 'static,
{
    use diesel::Connection as DieselConnection;

    let mut conn = db.get_connection()
        .map_err(|e| AppError::database(format!("Failed to get database connection: {}", e)))?;

    let result = web::block(move || {
        conn.transaction(|conn| operation(conn))
    })
    .await
    .map_err(|e| AppError::database(format!("Database transaction failed: {}", e)))?;

    result.map_err(AppError::from)
}
