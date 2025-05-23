//! Backward compatibility wrapper for the embedding system.
//!
//! This file maintains the original API while delegating to the new modular system.
//! It should eventually be deprecated in favor of using the embedding module directly.

// Re-export everything from the new embedding module for backward compatibility
pub use crate::histtext::embedding::{
    cache::{clear_caches, get_cached_embeddings},
    handlers::compute_neighbors,
    stats::{get_cache_stats, CacheStats, PathCacheEntry},
    types::{Embedding, EmbeddingMap, NeighborsRequest, NeighborsResponse},
};

use crate::config::Config;
use crate::histtext::embedding::{
    formats,
    types::{EmbeddingConfig, EmbeddingFormat},
};
use log::{info, warn};
use std::collections::HashMap;

/// Legacy function for loading embeddings (kept for compatibility)
/// 
/// This function is deprecated. Use `crate::histtext::embedding::formats::load_embeddings` instead.
#[deprecated(
    since = "0.2.0",
    note = "Use crate::histtext::embedding::formats::load_embeddings instead"
)]
pub fn load_embeddings_t(filename: &str) -> HashMap<String, Embedding> {
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
            HashMap::new()
        }
    }
}

/// Legacy cache statistics structure (kept for compatibility)
/// 
/// This structure is deprecated. Use `crate::histtext::embedding::stats::CacheStats` instead.
#[deprecated(
    since = "0.2.0", 
    note = "Use crate::histtext::embedding::stats::CacheStats instead"
)]
pub type LegacyCacheStats = CacheStats;

/// Initialize the embedding system
/// 
/// This should be called during application startup.
pub async fn initialize_embedding_system() -> Result<(), Box<dyn std::error::Error>> {
    info!("Initializing embedding system...");
    crate::histtext::embedding::initialize().await
}

/// Shutdown the embedding system
/// 
/// This should be called during application shutdown.
pub async fn shutdown_embedding_system() {
    info!("Shutting down embedding system...");
    crate::histtext::embedding::shutdown().await;
}