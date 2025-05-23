//! Application entry point and module structure.
//!
//! This is the main entry point for the application, which initializes
//! all components and starts the server. The codebase is organized into
//! several modules for different functionality areas.
#![allow(dead_code)]

extern crate diesel;

mod app_data;
mod config;
mod graphql;
mod models;
mod openapi;
mod schema;
mod server;
mod services;
mod template;
mod mail;

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
    // Initialize the embedding system early
    if let Err(e) = histtext::embeddings::initialize_embedding_system().await {
        eprintln!("Failed to initialize embedding system: {}", e);
        std::process::exit(1);
    }

    // Set up graceful shutdown handler for embeddings
    let embedding_shutdown_handle = tokio::spawn(async {
        // Wait for shutdown signal
        tokio::signal::ctrl_c().await.ok();
        
        // Shutdown embedding system
        histtext::embeddings::shutdown_embedding_system().await;
    });

    // Run the server using the server module's implementation
    let server_result = server::run_server().await;

    // Ensure embedding system is properly shut down
    embedding_shutdown_handle.abort();
    histtext::embeddings::shutdown_embedding_system().await;

    server_result
}