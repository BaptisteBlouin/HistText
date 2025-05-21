use std::sync::Arc;
use crate::services::database::Database;
use crate::services::mailer::Mailer;

#[derive(Clone)]
pub struct AppData {
    /// Mailer for sending emails
    pub mailer: Mailer,
    
    /// Database connection pool
    pub database: Database,
    
    /// Application configuration
    pub config: Arc<crate::config::Config>,
    
}

impl AppData {
    pub fn new(config: Arc<crate::config::Config>) -> Self {
        Self {
            mailer: Mailer::from_config(&config), 
            database: Database::new(),
            config,
        }
    }
}

/// Simple app URL configuration used by some components
#[derive(Clone)]
pub struct AppConfig {
    /// Base URL where the application is hosted
    pub app_url: String,
}

impl From<&crate::config::Config> for AppConfig {
    fn from(config: &crate::config::Config) -> Self {
        Self {
            app_url: config.app_url.clone(),
        }
    }
}