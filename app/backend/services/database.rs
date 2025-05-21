//! Database connection pool management.
//!
//! This module provides a singleton database connection pool implementation
//! using Diesel's R2D2 connection pool with PostgreSQL. It includes:
//! - Thread-safe initialization via OnceCell
//! - Connection logging
//! - Configurable connection parameters
//! - Convenient access to pooled connections

use diesel::r2d2::{self, ConnectionManager, PooledConnection};
use diesel_logger::LoggingConnection;
use once_cell::sync::OnceCell;
use std::sync::Arc;

use crate::config::Config;

/// Raw PostgreSQL connection type from Diesel
type DbCon = diesel::PgConnection;

/// Diesel backend type for PostgreSQL
#[allow(dead_code)]
pub type DieselBackend = diesel::pg::Pg;

/// Connection pool type for PostgreSQL
pub type Pool = r2d2::Pool<ConnectionManager<DbCon>>;

/// Logged connection type returned to application code
pub type Connection = LoggingConnection<PooledConnection<ConnectionManager<DbCon>>>;

/// Database access wrapper
///
/// This struct provides access to the database connection pool
/// and ensures the pool is properly initialized exactly once.
#[derive(Clone)]
pub struct Database {
    /// Reference to the global connection pool
    pub pool: &'static Pool,

    /// Optional reference to application configuration
    #[allow(dead_code)]
    config: Option<Arc<Config>>,
}

impl Default for Database {
    fn default() -> Self {
        Self::new()
    }
}

impl Database {
    /// Creates a new `Database` instance with the default configuration
    ///
    /// This initializes the global connection pool if it hasn't been
    /// initialized yet, or returns a reference to the existing pool.
    ///
    /// # Returns
    /// A new Database instance
    #[must_use]
    pub fn new() -> Self {
        Self {
            pool: Self::get_or_init_pool(),
            config: None,
        }
    }

    /// Creates a new `Database` instance with a specific configuration
    ///
    /// This allows passing a custom configuration to the database,
    /// which can be useful in testing or specialized scenarios.
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new Database instance with the provided configuration
    #[must_use]
    #[allow(dead_code)]
    pub fn with_config(config: Arc<Config>) -> Self {
        Self {
            pool: Self::get_or_init_pool_with_config(config.clone()),
            config: Some(config),
        }
    }

    /// Gets a logged connection from the pool
    ///
    /// This method retrieves a connection from the pool and wraps it
    /// with logging functionality for better debugging and monitoring.
    ///
    /// # Returns
    /// A logged connection or an error if a connection cannot be obtained
    pub fn get_connection(&self) -> Result<Connection, anyhow::Error> {
        Ok(LoggingConnection::new(self.pool.get()?))
    }

    /// Initializes or returns the global connection pool
    ///
    /// This internal helper ensures the pool is initialized exactly once
    /// using the default DATABASE_URL environment variable.
    ///
    /// # Returns
    /// Reference to the static connection pool
    fn get_or_init_pool() -> &'static Pool {
        static POOL: OnceCell<Pool> = OnceCell::new();

        // Load environment variables in debug mode
        #[cfg(debug_assertions)]
        {
            dotenvy::dotenv().ok();
        }

        POOL.get_or_init(|| {
            Pool::builder()
                .connection_timeout(std::time::Duration::from_secs(5))
                .max_size(10) // Set a reasonable maximum pool size
                .build(ConnectionManager::<DbCon>::new(Self::connection_url()))
                .unwrap()
        })
    }

    /// Initializes or returns the global connection pool with a specific configuration
    ///
    /// This internal helper ensures the pool is initialized exactly once
    /// using the provided configuration's database URL.
    ///
    /// # Arguments
    /// * `config` - Application configuration containing the database URL
    ///
    /// # Returns
    /// Reference to the static connection pool
    #[allow(dead_code)]
    fn get_or_init_pool_with_config(config: Arc<Config>) -> &'static Pool {
        static POOL: OnceCell<Pool> = OnceCell::new();

        POOL.get_or_init(|| {
            Pool::builder()
                .connection_timeout(std::time::Duration::from_secs(5))
                .max_size(10) // Set a reasonable maximum pool size
                .build(ConnectionManager::<DbCon>::new(config.database_url.clone()))
                .unwrap()
        })
    }

    /// Gets the database connection URL from environment variables
    ///
    /// # Returns
    /// The DATABASE_URL string
    ///
    /// # Panics
    /// If the DATABASE_URL environment variable is not set
    #[must_use]
    pub fn connection_url() -> String {
        std::env::var("DATABASE_URL").expect("DATABASE_URL environment variable expected.")
    }
}
