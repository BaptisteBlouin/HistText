//! Application entry point and module structure.
//!
//! This is the main entry point for the application, which initializes
//! all components and starts the server. The codebase is organized into
//! several modules for different functionality areas.

extern crate diesel;

mod config;
mod graphql;
mod mail;
mod models;
mod openapi;
mod schema;
mod server;
mod services;

/// Core text processing modules
mod histtext {
    /// Document retrieval and transformation
    pub mod documents;
    
    /// Word embedding and semantic similarity
    pub mod embeddings;
    
    /// Collection metadata and schema information
    pub mod metadata;
    
    /// Named Entity Recognition processing
    pub mod ner;
    
    /// Statistical analysis of document collections
    pub mod stats;
    
    /// Text tokenization and processing
    pub mod tokenizer;
}

/// Application entry point
///
/// This function performs the following steps:
/// 1. Loads application configuration from environment variables
/// 2. Sets up the development environment if in debug mode
/// 3. Initializes database connections and connection pools
/// 4. Preloads word embeddings in a background task
/// 5. Establishes SSH tunnels to Solr instances
/// 6. Configures the Actix Web application with middleware and routes
/// 7. Starts the HTTP server on port 3000
/// 8. Sets up signal handlers for graceful shutdown
/// 9. Cleans up resources during shutdown
///
/// # Returns
/// IO Result indicating successful execution or an error
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Run the server using the server module's implementation
    server::run_server().await
}