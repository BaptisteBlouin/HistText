//! Application state and shared resources.
//!
//! This module defines the core state structures that are shared across
//! the application, including database connection pools and process
//! management for SSH tunnels.

use diesel::r2d2::{self, ConnectionManager};
use diesel::PgConnection;
use std::sync::Arc;
use tokio::process::Child;
use tokio::sync::Mutex;

/// Database connection pool type for PostgreSQL connections
///
/// This type alias provides a convenient way to reference the database
/// connection pool throughout the application without repeating the
/// full generic type signature.
pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

/// Application shared state structure
///
/// This structure contains all shared resources that need to be
/// accessible across multiple parts of the application, including:
/// - SSH child processes for database tunnels
/// - Application configuration
///
/// The state is wrapped in thread-safe containers (Arc, Mutex) to allow
/// concurrent access from multiple threads and tasks.
#[derive(Clone)]
pub struct AppState {
    /// SSH child processes for database tunnels
    ///
    /// These processes need to be tracked so they can be properly
    /// terminated when the application shuts down.
    pub ssh_children: Arc<Mutex<Vec<Child>>>,
    
    /// Application configuration
    ///
    /// Shared reference to the global configuration settings.
    pub config: Arc<crate::config::Config>,
}