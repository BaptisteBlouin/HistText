//! Word embedding system with multi-format support and optimized caching.
//!
//! This module provides a comprehensive embedding system that supports multiple
//! file formats, efficient caching strategies, and fast similarity computations.
//! The system is organized into several submodules for better maintainability.

pub mod cache;
pub mod formats;
pub mod handlers;
pub mod similarity;
pub mod stats;
pub mod types;

// Re-export commonly used types and functions for backward compatibility
pub use cache::clear_caches;
pub use handlers::compute_neighbors;
pub use stats::{get_cache_stats, CacheStats};
pub use types::{Embedding, NeighborsRequest, NeighborsResponse};

use actix_web::web;
use log::info;

/// Configure embedding routes
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/compute-neighbors")
            .route(web::post().to(handlers::compute_neighbors_handler))
    );
}

/// Initialize the embedding system
pub async fn initialize() -> Result<(), Box<dyn std::error::Error>> {
    info!("Initializing embedding system...");
    
    // Pre-warm cache if needed
    cache::initialize_cache().await?;
    
    info!("Embedding system initialized successfully");
    Ok(())
}

/// Shutdown the embedding system gracefully
pub async fn shutdown() {
    info!("Shutting down embedding system...");
    clear_caches().await;
    info!("Embedding system shutdown complete");
}

/// Legacy function for loading embeddings (kept for compatibility)
/// 
/// This function is deprecated. Use `crate::histtext::embedding::formats::load_embeddings` instead.
#[deprecated(
    since = "0.2.0",
    note = "Use crate::histtext::embedding::formats::load_embeddings instead"
)]
pub fn load_embeddings_t(filename: &str) -> std::collections::HashMap<String, Embedding> {
    use log::warn;
    use crate::histtext::embeddings::{formats, types::EmbeddingConfig};
    
    warn!("Using deprecated load_embeddings_t function. Please migrate to the new embedding module.");
    
    let config = EmbeddingConfig {
        normalize_on_load: false,
        parallel_workers: num_cpus::get(),
        ..EmbeddingConfig::default()
    };
    
    // Use the async runtime to call the new async function
    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| {
            tokio::runtime::Runtime::new()
                .expect("Failed to create tokio runtime")
                .handle()
                .clone()
        });
    
    match rt.block_on(formats::load_embeddings(filename, &config)) {
        Ok((embeddings, stats)) => {
            info!("Loaded {} embeddings from {} using legacy function", 
                  embeddings.len(), filename);
            info!("File stats: {} words, {} bytes, {}ms load time", 
                  stats.word_count, stats.file_size, stats.load_time_ms);
            embeddings
        }
        Err(e) => {
            warn!("Failed to load embeddings from {}: {}", filename, e);
            std::collections::HashMap::new()
        }
    }
}

/// Initialize the embedding system
/// 
/// This should be called during application startup.
pub async fn initialize_embedding_system() -> Result<(), Box<dyn std::error::Error>> {
    info!("Initializing embedding system...");
    initialize().await
}

/// Shutdown the embedding system
/// 
/// This should be called during application shutdown.
pub async fn shutdown_embedding_system() {
    info!("Shutting down embedding system...");
    shutdown().await;
}