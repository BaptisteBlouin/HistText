// Update backend/server/connection.rs
use diesel::r2d2::{self, ConnectionManager, PooledConnection};
use diesel_logger::LoggingConnection;
use once_cell::sync::OnceCell;

// Define DbCon type directly here - using PostgreSQL since that seems to be what you're using
type DbCon = diesel::pg::PgConnection;

pub type Pool = r2d2::Pool<ConnectionManager<DbCon>>;
pub type Connection = LoggingConnection<PooledConnection<ConnectionManager<DbCon>>>;

#[derive(Clone)]
/// Wrapper for a database pool
pub struct Database {
    #[allow(dead_code)]
    pub pool: &'static Pool,
}

impl Default for Database {
    fn default() -> Self {
        Self::new()
    }
}

impl Database {
    /// Create a new Database
    pub fn new() -> Self {
        Self {
            pool: Self::get_or_init_pool(),
        }
    }

    /// Get a connection to the database
    #[allow(dead_code)]
    pub fn get_connection(&self) -> Result<Connection, anyhow::Error> {
        Ok(LoggingConnection::new(self.pool.get()?))
    }

    fn get_or_init_pool() -> &'static Pool {
        static POOL: OnceCell<Pool> = OnceCell::new();

        POOL.get_or_init(|| {
            Pool::builder()
                .connection_timeout(std::time::Duration::from_secs(5))
                .build(ConnectionManager::<DbCon>::new(Self::connection_url()))
                .unwrap()
        })
    }

    /// Get the connection URL for the database
    pub fn connection_url() -> String {
        std::env::var("DATABASE_URL").expect("DATABASE_URL environment variable expected.")
    }
}