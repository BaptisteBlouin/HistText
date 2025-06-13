pub mod cache;
pub mod formats;
pub mod handlers;
pub mod similarity;
pub mod stats;
pub mod types;

pub use cache::clear_caches;
pub use handlers::compute_neighbors;
pub use types::{Embedding, NeighborsRequest, NeighborsResponse};

use actix_web::web;
use log::info;

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/compute-neighbors")
            .route(web::post().to(handlers::compute_neighbors_handler)),
    );
}

pub async fn initialize() -> Result<(), Box<dyn std::error::Error>> {
    info!("Initializing embedding system...");
    cache::initialize_cache().await?;
    info!("Embedding system initialized successfully");
    Ok(())
}

pub async fn shutdown() {
    info!("Shutting down embedding system...");
    clear_caches().await;
    info!("Embedding system shutdown complete");
}

#[deprecated(
    since = "1.0.0",
    note = "Use crate::histtext::embedding::formats::load_embeddings instead"
)]
pub fn load_embeddings_t(filename: &str) -> std::collections::HashMap<String, Embedding> {
    use crate::histtext::embeddings::{formats, types::EmbeddingConfig};
    use log::warn;

    warn!(
        "Using deprecated load_embeddings_t function. Please migrate to the new embedding module."
    );

    let config = EmbeddingConfig {
        normalize_on_load: false,
        parallel_workers: num_cpus::get(),
        ..EmbeddingConfig::default()
    };

    let rt = tokio::runtime::Handle::try_current().unwrap_or_else(|_| {
        tokio::runtime::Runtime::new()
            .expect("Failed to create tokio runtime")
            .handle()
            .clone()
    });

    match rt.block_on(formats::load_embeddings(filename, &config)) {
        Ok((embeddings, stats)) => {
            info!(
                "Loaded {} embeddings from {} using legacy function",
                embeddings.len(),
                filename
            );
            info!(
                "File stats: {} words, {} bytes, {}ms load time",
                stats.word_count, stats.file_size, stats.load_time_ms
            );
            embeddings
        }
        Err(e) => {
            warn!("Failed to load embeddings from {}: {}", filename, e);
            std::collections::HashMap::new()
        }
    }
}

pub async fn initialize_embedding_system() -> Result<(), Box<dyn std::error::Error>> {
    info!("Initializing embedding system...");
    initialize().await
}

pub async fn shutdown_embedding_system() {
    info!("Shutting down embedding system...");
    shutdown().await;
}
