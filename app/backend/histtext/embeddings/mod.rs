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
pub use cache::{clear_caches, get_cached_embeddings};
pub use handlers::compute_neighbors;
pub use stats::{get_cache_stats, CacheStats, PathCacheEntry};
pub use types::{Embedding, EmbeddingMap, NeighborsRequest, NeighborsResponse};

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