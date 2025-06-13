//! Enhanced CRUD operation helpers with detailed error handling and transaction support.
//!
//! This module provides reusable functions for Create, Read, Update, and Delete
//! operations with consistent error handling throughout the application. It includes
//! transaction support, detailed error tracking, and query timing metrics.

use actix_web::web;
use diesel::result::Error as DieselError;
use diesel::Connection as DieselConnection;

use log::{debug, error, warn};
use std::time::{Duration, Instant};

use crate::services::database::{Connection, Database};
use crate::services::error::{AppError, AppResult};

/// Execution statistics for database operations
#[derive(Debug, Clone)]
pub struct QueryStats {
    /// Time taken to execute the database operation
    pub duration: Duration,
    /// Name of the operation (if provided)
    pub operation_name: Option<String>,
    /// Whether the operation was executed in a transaction
    pub in_transaction: bool,
}

/// Execute a database query with detailed error handling and timing
///
/// This helper function:
/// 1. Obtains a database connection from the pool
/// 2. Measures query execution time
/// 3. Runs the provided operation on Actix's blocking thread pool
/// 4. Automatically converts any errors to the centralized AppError type
/// 5. Provides detailed logging for debugging and monitoring
///
/// # Arguments
/// * `db` - Database connection wrapped in actix_web::Data
/// * `operation` - Closure containing the database operation to execute
/// * `operation_name` - Optional name for the operation (for logging)
///
/// # Type Parameters
/// * `T` - Return type of the database operation
/// * `F` - Function/closure type for the database operation
///
/// # Returns
/// Result containing the operation result or an AppError
///
/// # Example
/// ```
/// use crate::schema::users::dsl::*;
///
/// let user = execute_db_query_named(
///     db.clone(),
///     |conn| users.find(user_id).first::<User>(conn),
///     Some("get_user_by_id")
/// ).await?;
/// ```
pub async fn execute_db_query_named<T, F>(
    db: web::Data<Database>,
    operation: F,
    operation_name: Option<&str>,
) -> AppResult<T>
where
    F: FnOnce(&mut Connection) -> Result<T, DieselError> + Send + 'static,
    T: Send + 'static,
{
    let op_name = operation_name.map(String::from);

    // Log operation start
    if let Some(ref name) = op_name {
        debug!("Starting database operation: {}", name);
    } else {
        debug!("Starting unnamed database operation");
    }

    // Get a database connection
    let mut conn = db.get_connection().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        error!("{}", msg);
        AppError::database(msg)
    })?;

    // Start timing
    let start_time = Instant::now();

    // Run the operation on a blocking thread pool
    let result = web::block(move || {
        // Catch panics to prevent connection pool poisoning
        let result =
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| operation(&mut conn)));

        match result {
            Ok(db_result) => db_result,
            Err(panic) => {
                let panic_msg = match panic.downcast::<String>() {
                    Ok(panic_string) => *panic_string,
                    Err(panic_any) => match panic_any.downcast::<&str>() {
                        Ok(panic_str) => String::from(*panic_str),
                        Err(_) => String::from("Unknown panic in database operation"),
                    },
                };

                error!("Panic in database operation: {}", panic_msg);
                Err(DieselError::RollbackTransaction)
            }
        }
    })
    .await
    .map_err(|e| {
        let msg = format!("Database operation failed in worker thread: {}", e);
        error!("{}", msg);
        AppError::database(msg)
    })?;

    // Measure execution time
    let duration = start_time.elapsed();

    // Log execution stats
    if let Some(ref name) = op_name {
        if duration > Duration::from_millis(100) {
            // Log slow queries with warning level
            warn!("Slow database operation '{}' took {:?}", name, duration);
        } else {
            debug!("Database operation '{}' completed in {:?}", name, duration);
        }
    } else if duration > Duration::from_millis(100) {
        warn!("Slow unnamed database operation took {:?}", duration);
    } else {
        debug!("Unnamed database operation completed in {:?}", duration);
    }

    // Convert diesel errors to AppError with context
    match result {
        Ok(data) => Ok(data),
        Err(e) => {
            let context = op_name.unwrap_or_else(|| "database operation".to_string());
            Err(handle_diesel_error(e, &context))
        }
    }
}

/// Backwards compatibility wrapper for execute_db_query_named
///
/// This function maintains compatibility with existing code while
/// providing the benefits of the enhanced error handling.
///
/// # Arguments
/// * `db` - Database connection wrapped in actix_web::Data
/// * `operation` - Closure containing the database operation to execute
///
/// # Returns
/// Result containing the operation result or an AppError
pub async fn execute_db_query<T, F>(db: web::Data<Database>, operation: F) -> AppResult<T>
where
    F: FnOnce(&mut Connection) -> Result<T, DieselError> + Send + 'static,
    T: Send + 'static,
{
    execute_db_query_named(db, operation, None).await
}

/// Execute a database transaction with enhanced error handling
///
/// This function wraps database operations in a transaction and automatically
/// handles rollbacks on error. It provides detailed logging and error context.
///
/// # Arguments
/// * `db` - Database connection wrapped in actix_web::Data
/// * `operations` - Closure containing the transactional operations
/// * `transaction_name` - Optional name for the transaction (for logging)
///
/// # Returns
/// Result containing the operation result or an AppError
///
/// # Example
/// ```
/// let result = execute_db_transaction_named(
///     db.clone(),
///     |conn| {
///         // Multiple operations in a single transaction
///         let user = users.find(user_id).first::<User>(conn)?;
///         diesel::update(users.find(user_id))
///             .set(login_count.eq(login_count + 1))
///             .execute(conn)?;
///         Ok(user)
///     },
///     Some("user_login_flow")
/// ).await?;
/// ```
pub async fn execute_db_transaction_named<T, F>(
    db: web::Data<Database>,
    operations: F,
    transaction_name: Option<&str>,
) -> AppResult<T>
where
    F: FnOnce(&mut Connection) -> Result<T, DieselError> + Send + 'static,
    T: Send + 'static,
{
    let tx_name = transaction_name.map(String::from);

    // Log transaction start
    if let Some(ref name) = tx_name {
        debug!("Starting database transaction: {}", name);
    } else {
        debug!("Starting unnamed database transaction");
    }

    let mut conn = db.get_connection().map_err(|e| {
        let msg = format!("Failed to get database connection for transaction: {}", e);
        error!("{}", msg);
        AppError::database(msg)
    })?;

    // Start timing
    let start_time = Instant::now();

    // Run the transaction on a blocking thread pool
    let result = web::block(move || {
        // Catch panics to prevent connection pool poisoning
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            conn.transaction(|conn| operations(conn))
        }));

        match result {
            Ok(tx_result) => tx_result,
            Err(panic) => {
                let panic_msg = match panic.downcast::<String>() {
                    Ok(panic_string) => *panic_string,
                    Err(panic_any) => match panic_any.downcast::<&str>() {
                        Ok(panic_str) => String::from(*panic_str),
                        Err(_) => String::from("Unknown panic in database transaction"),
                    },
                };

                error!("Panic in database transaction: {}", panic_msg);
                Err(DieselError::RollbackTransaction)
            }
        }
    })
    .await
    .map_err(|e| {
        let msg = format!("Database transaction failed in worker thread: {}", e);
        error!("{}", msg);
        AppError::database(msg)
    })?;

    // Measure execution time
    let duration = start_time.elapsed();

    // Log execution stats
    if let Some(ref name) = tx_name {
        if duration > Duration::from_millis(200) {
            // Transactions might take longer, so we use a higher threshold
            warn!("Slow database transaction '{}' took {:?}", name, duration);
        } else {
            debug!(
                "Database transaction '{}' completed in {:?}",
                name, duration
            );
        }
    } else if duration > Duration::from_millis(200) {
        warn!("Slow unnamed database transaction took {:?}", duration);
    } else {
        debug!("Unnamed database transaction completed in {:?}", duration);
    }

    // Convert diesel errors to AppError with context
    match result {
        Ok(data) => Ok(data),
        Err(e) => {
            let context = tx_name.unwrap_or_else(|| "database transaction".to_string());
            Err(handle_diesel_error(e, &context))
        }
    }
}

/// Backwards compatibility wrapper for execute_db_transaction_named
///
/// This function maintains compatibility with existing code while
/// providing the benefits of the enhanced error handling.
///
/// # Arguments
/// * `db` - Database connection wrapped in actix_web::Data
/// * `operations` - Closure containing the transactional operations
///
/// # Returns
/// Result containing the operation result or an AppError
pub async fn execute_db_transaction<T, F>(db: web::Data<Database>, operations: F) -> AppResult<T>
where
    F: FnOnce(&mut Connection) -> Result<T, DieselError> + Send + 'static,
    T: Send + 'static,
{
    execute_db_transaction_named(db, operations, None).await
}

/// Handles Diesel errors with detailed context for better debugging
///
/// Converts Diesel database errors to application-specific error types
/// with appropriate HTTP status codes and messages.
///
/// # Arguments
/// * `error` - The Diesel error to handle
/// * `context` - A string providing context for the error
///
/// # Returns
/// An AppError with appropriate type and details
fn handle_diesel_error(error: DieselError, context: &str) -> AppError {
    match error {
        DieselError::NotFound => {
            debug!("Database record not found in operation: {}", context);
            AppError::not_found("Record", Some(context.to_string()))
        }

        DieselError::DatabaseError(kind, info) => {
            // Extract constraint name for better error messages
            let constraint = info.constraint_name().map(|c| c.to_string());

            match kind {
                diesel::result::DatabaseErrorKind::UniqueViolation => {
                    let field = constraint
                        .map(|c| extract_field_from_constraint(&c))
                        .unwrap_or_else(|| "field".to_string());

                    warn!(
                        "Unique constraint violation on field '{}' in operation: {}",
                        field, context
                    );
                    AppError::validation(
                        format!("A record with this {} already exists", field),
                        Some(field),
                    )
                }

                diesel::result::DatabaseErrorKind::ForeignKeyViolation => {
                    let relation = constraint
                        .map(|c| extract_relation_from_constraint(&c))
                        .unwrap_or_else(|| "relation".to_string());

                    warn!(
                        "Foreign key violation on relation '{}' in operation: {}",
                        relation, context
                    );
                    AppError::validation(
                        format!("Referenced {} does not exist", relation),
                        Some(relation),
                    )
                }

                diesel::result::DatabaseErrorKind::CheckViolation => {
                    let check_name = constraint.unwrap_or_else(|| "unknown".to_string());
                    warn!(
                        "Check constraint violation '{}' in operation: {}",
                        check_name, context
                    );
                    AppError::validation(
                        format!("Data validation failed: {}", info.message()),
                        Some("field".to_string()),
                    )
                }

                diesel::result::DatabaseErrorKind::NotNullViolation => {
                    let column = info.column_name().unwrap_or("unknown column");
                    warn!(
                        "Not null violation on column '{}' in operation: {}",
                        column, context
                    );
                    AppError::validation(
                        format!("Field '{}' cannot be empty", column),
                        Some(column.to_string()),
                    )
                }

                _ => {
                    error!(
                        "Database error ({:?}) in operation {}: {}",
                        kind,
                        context,
                        info.message()
                    );
                    AppError::database(format!("Database error in {}: {}", context, info.message()))
                }
            }
        }

        DieselError::RollbackTransaction => {
            error!(
                "Transaction explicitly rolled back in operation: {}",
                context
            );
            AppError::database(format!("Transaction rolled back in {}", context))
        }

        DieselError::AlreadyInTransaction => {
            warn!(
                "Attempted to start a transaction while already in one: {}",
                context
            );
            AppError::database("Nested transactions are not supported".to_string())
        }

        // Handle other Diesel errors
        _ => {
            error!(
                "Unhandled database error in operation {}: {:?}",
                context, error
            );
            AppError::database(format!("Database error in {}: {}", context, error))
        }
    }
}

/// Extracts a field name from a constraint name
///
/// Attempts to parse common PostgreSQL constraint naming patterns
/// to extract meaningful field names for error messages.
///
/// # Arguments
/// * `constraint` - PostgreSQL constraint name
///
/// # Returns
/// A user-friendly field name
fn extract_field_from_constraint(constraint: &str) -> String {
    // Common patterns:
    // - users_email_key -> email
    // - users_email_unique -> email
    // - idx_users_email -> email

    let parts: Vec<&str> = constraint.split('_').collect();

    if parts.len() < 2 {
        return "field".to_string();
    }

    // Skip the table name (usually first part)
    // and the constraint type (usually last part)
    if parts.len() >= 3 {
        // Try to extract the field name
        return parts[1].to_string();
    }

    "field".to_string()
}

/// Extracts a relation name from a constraint name
///
/// Attempts to parse common PostgreSQL foreign key constraint naming patterns
/// to extract meaningful relation names for error messages.
///
/// # Arguments
/// * `constraint` - PostgreSQL constraint name
///
/// # Returns
/// A user-friendly relation name
fn extract_relation_from_constraint(constraint: &str) -> String {
    // Common patterns:
    // - fk_user_roles_user_id -> user
    // - user_roles_user_id_fkey -> user

    let parts: Vec<&str> = constraint.split('_').collect();

    if parts.len() < 2 {
        return "record".to_string();
    }

    // Check for fk_ prefix pattern
    if parts[0] == "fk" && parts.len() >= 3 {
        return parts[2].to_string();
    }

    // Check for _fkey suffix pattern
    if parts.len() >= 3 && parts.last() == Some(&"fkey") {
        return parts[parts.len() - 2].to_string();
    }

    "related record".to_string()
}

/// Execute multiple operations in parallel and collect results
///
/// This helper function executes multiple database operations concurrently
/// and collects their results. It's useful for fetching related data in parallel.
///
/// # Arguments
/// * `db` - Database connection wrapped in actix_web::Data
/// * `operations` - Vector of closures containing database operations
///
/// # Returns
/// Vector of results or an error if any operation fails
///
/// # Example
/// ```
/// let results = execute_parallel_queries(
///     db.clone(),
///     vec![
///         |conn| users.find(user_id).first::<User>(conn),
///         |conn| posts.filter(author_id.eq(user_id)).load::<Post>(conn)
///     ]
/// ).await?;
///
/// let user = results[0].downcast_ref::<User>().unwrap();
/// let posts = results[1].downcast_ref::<Vec<Post>>().unwrap();
/// ```
pub async fn execute_parallel_queries<F>(
    db: web::Data<Database>,
    operations: Vec<F>,
) -> AppResult<Vec<Box<dyn std::any::Any + Send>>>
where
    F: FnOnce(&mut Connection) -> Result<Box<dyn std::any::Any + Send>, DieselError>
        + Send
        + 'static,
{
    use futures::future::join_all;

    let op_count = operations.len();
    debug!("Starting {} parallel database operations", op_count);

    let mut futures = Vec::with_capacity(op_count);

    for (i, operation) in operations.into_iter().enumerate() {
        let db_clone = db.clone();
        let op_name = format!("parallel_op_{}", i);

        let future = async move {
            execute_db_query_named(db_clone, move |conn| operation(conn), Some(&op_name)).await
        };

        futures.push(future);
    }

    let results = join_all(futures).await;

    // Check if any operation failed
    for (i, result) in results.iter().enumerate() {
        if let Err(e) = result {
            error!("Parallel operation {} failed: {}", i, e);
            return Err(AppError::database(format!(
                "Parallel query {} failed: {}",
                i, e
            )));
        }
    }

    // Unwrap all successful results
    let unwrapped: Vec<_> = results.into_iter().map(|r| r.unwrap()).collect();

    debug!(
        "Successfully completed {} parallel database operations",
        op_count
    );
    Ok(unwrapped)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use crate::services::database::Database;
    use actix_web::web::Data;
    use diesel::sql_types::Integer;
    use diesel::RunQueryDsl;
    use std::sync::Arc;

    #[derive(diesel::QueryableByName)]
    struct TestRow {
        #[diesel(sql_type = Integer)]
        id: i32,
    }

    // Test utility to create a database connection for tests
    fn test_db() -> Data<Database> {
        // This assumes DATABASE_URL environment variable is set for tests
        let config = Arc::new(Config::load().expect("Failed to load config"));
        Data::new(Database::with_config(config))
    }

    #[actix_rt::test]
    async fn test_execute_db_query() {
        let db = test_db();

        // A simple query that should succeed
        let result = execute_db_query(db.clone(), |conn| {
            // Simple SELECT 1 query
            diesel::sql_query("SELECT 1 as id").load::<TestRow>(conn)
        })
        .await;

        assert!(result.is_ok());
    }

    #[actix_rt::test]
    async fn test_execute_db_transaction() {
        let db = test_db();

        // A transaction that should succeed
        let result = execute_db_transaction(db.clone(), |conn| {
            // Simple SELECT 1 query inside a transaction
            diesel::sql_query("SELECT 1 as id").load::<TestRow>(conn)
        })
        .await;

        assert!(result.is_ok());
    }

    #[actix_rt::test]
    async fn test_transaction_rollback() {
        let db = test_db();

        // A transaction that should fail and roll back
        let result = execute_db_transaction(db.clone(), |conn| {
            // This should succeed
            diesel::sql_query("SELECT 1 as id").load::<TestRow>(conn)?;

            // This should fail and roll back the transaction
            diesel::sql_query("SELECT invalid_column").load::<TestRow>(conn)
        })
        .await;

        assert!(result.is_err());
    }
}
