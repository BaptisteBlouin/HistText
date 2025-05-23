//! This module provides functionality to load, cache, and query word embeddings.
//!
//! Features:
//! - Thread-safe LRU cache for storing embeddings from multiple Solr database instances
//! - Disk-based storage with on-demand loading wrapped in Arc for shared access
//! - Concurrent similarity computations using Rayon's data parallelism
//! - Configurable embeddings per collection with "none", "default", or custom paths
//! - Computing top-N semantically nearest neighbors for words
//! - Enhanced cache monitoring and performance metrics

use crate::config::Config;
use crate::services::cache_monitor;
use crate::services::database::Database;
use actix_web::{web, HttpResponse, Responder};
use dashmap::DashMap;
use diesel::prelude::*;
use lazy_static::lazy_static;
use log::{debug, error, info, warn};
use rayon::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use std::cmp::Ordering;
use std::{
    collections::HashMap,
    io::BufRead,
    path::Path,
    sync::Arc,
    time::{Instant, SystemTime},
};
use tokio::fs;
use tokio::sync::Mutex;
use tokio::task;
use utoipa::{IntoParams, ToSchema};

/// Type alias for mapping words to their embedding vectors
type EmbeddingMap = HashMap<String, Embedding>;
/// Type alias for thread-safe shared embedding maps
type SharedEmbeddings = Arc<EmbeddingMap>;

/// Cache entry for tracking embedding usage for LRU eviction
struct CacheEntry {
    embeddings: SharedEmbeddings,
    last_used: SystemTime,
    size: usize, // Size in words
}

lazy_static! {
    /// Main cache keyed by collection identifier: "solr_database_id:collection_name"
    static ref EMBEDDINGS_CACHE: DashMap<String, Arc<EmbeddingMap>> = DashMap::new();

    /// Path cache keyed by normalized file path (basename)
    static ref PATH_CACHE: DashMap<String, CacheEntry> = DashMap::new();

    /// Mutex for cache operations that need to be atomic
    static ref CACHE_MUTEX: Mutex<()> = Mutex::new(());
}

// CONFIGURATION NOTE:
// Add to Config struct in config.rs:
// pub max_embeddings_files: usize,
//
// Update Config::load() to include:
// max_embeddings_files: parse_with_default::<usize>("MAX_EMBEDDINGS_FILES", 3),

/// Request parameters for finding semantically similar words
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct NeighborsRequest {
    /// Word to find neighbors for
    #[schema(example = "democracy")]
    pub word: String,
    /// ID of the Solr database configuration
    #[schema(example = 1)]
    pub solr_database_id: i32,
    /// Collection name in Solr
    #[schema(example = "my_collection")]
    pub collection_name: String,
}

/// Response containing semantically similar words
#[derive(Serialize, ToSchema)]
pub struct NeighborsResponse {
    /// List of semantically similar words, sorted by similarity
    pub top_neighbors: Vec<String>,
    /// Whether embeddings exist for the collection
    pub has_embeddings: bool,
}

/// Cache statistics for monitoring and debugging
#[derive(Debug, Serialize, Deserialize)]
pub struct CacheStats {
    /// Number of collection-specific embedding caches
    pub collection_cache_entries: usize,
    /// Number of file path-based embedding caches
    pub path_cache_entries: usize,
    /// Detailed information about each path cache entry
    pub path_cache_details: Vec<PathCacheEntry>,
    /// Total number of word embeddings loaded
    pub total_embeddings_loaded: usize,
    /// Maximum number of embedding files allowed in cache
    pub max_embeddings_files: usize,
}

/// Details about a single path cache entry
#[derive(Debug, Serialize, Deserialize)]
pub struct PathCacheEntry {
    /// Path to embedding file
    pub path: String,
    /// Number of words in the embedding file
    pub size: usize,
    /// Last access time
    pub last_used: String,
}

/// Representation of a word's embedding vector with precomputed norm
pub struct Embedding {
    /// The embedding vector components
    vector: Vec<f32>,
    /// Precomputed L2 norm for faster similarity calculations
    norm: f32,
}

/// Normalizes a file path to just the basename for cache key purposes
///
/// # Arguments
/// * `path` - The file path to normalize
///
/// # Returns
/// A string containing just the filename
fn normalize_path(path: &str) -> String {
    let path_obj = Path::new(path);
    match path_obj.file_name() {
        Some(filename) => match filename.to_str() {
            Some(name) => {
                debug!("Normalized path '{}' to filename '{}'", path, name);
                name.to_string()
            }
            None => {
                warn!("Could not convert filename to string for path: {}", path);
                path.to_string()
            }
        },
        None => {
            warn!("No filename found in path: {}", path);
            path.to_string()
        }
    }
}

/// Retrieves embedding path for a given solr_database_id and collection_name
///
/// # Arguments
/// * `db` - Database connection pool
/// * `solr_database_id_val` - ID of the Solr database
/// * `collection_name_val` - Collection name
///
/// # Returns
/// * `None` if embeddings set to "none"
/// * Default path if set to "default"
/// * Specific path if a custom path is configured
async fn get_embedding_path(
    db: &web::Data<Database>,
    solr_database_id_val: i32,
    collection_name_val: &str,
) -> Option<String> {
    use crate::schema::solr_database_info::dsl::*;

    let db_clone = db.clone();
    let collection_name_str = collection_name_val.to_string();

    debug!(
        "Attempting to get embedding path for collection {} (database ID {})",
        collection_name_str, solr_database_id_val
    );

    let result = match task::spawn_blocking(move || -> Result<Option<String>, String> {
        let mut conn = db_clone
            .pool
            .get()
            .map_err(|e| format!("Failed to get DB connection: {}", e))?;

        let info = solr_database_info
            .filter(solr_database_id.eq(solr_database_id_val))
            .filter(collection_name.eq(&collection_name_str))
            .first::<crate::services::solr_database_info::SolrDatabaseInfo>(&mut conn)
            .map_err(|e| format!("Failed to query solr_database_info: {}", e))?;

        debug!(
            "Found collection info for {}: embeddings setting = {}",
            collection_name_str, info.embeddings
        );

        match info.embeddings.as_str() {
            "none" => Ok(None),
            "default" => {
                let path = Config::global().embed_path.clone();
                debug!("Using default embeddings path: {}", path);
                Ok(Some(path))
            }
            path => {
                debug!("Using custom embeddings path: {}", path);
                Ok(Some(path.to_string()))
            }
        }
    })
    .await
    {
        Ok(result) => match result {
            Ok(path) => path,
            Err(err) => {
                error!("Database error when getting embedding path: {}", err);
                None
            }
        },
        Err(err) => {
            error!("Task error when getting embedding path: {}", err);
            None
        }
    };

    if result.is_none() {
        debug!(
            "No embedding path found for collection {} (database ID {})",
            collection_name_val, solr_database_id_val
        );
    }

    result
}

/// Evicts the least recently used embedding file if needed
///
/// This is called before loading a new embedding file to ensure
/// we don't exceed the configured maximum number of files in cache
async fn evict_lru_if_needed() {
    let max_embeddings_files = Config::global().max_embeddings_files;

    if PATH_CACHE.len() < max_embeddings_files {
        return;
    }

    let _lock = CACHE_MUTEX.lock().await;

    if PATH_CACHE.len() <= max_embeddings_files {
        return;
    }

    let lru_path = PATH_CACHE
        .iter()
        .min_by_key(|entry| entry.last_used)
        .map(|entry| entry.key().clone());

    if let Some(path) = lru_path {
        let size = PATH_CACHE.get(&path).map(|entry| entry.size).unwrap_or(0);
        PATH_CACHE.remove(&path);

        let to_remove: Vec<String> = EMBEDDINGS_CACHE
            .iter()
            .filter_map(|_entry| {
                // We'd need a way to know which collections use which path
                // This information is not stored currently, so we'll skip this for now
                None
            })
            .collect();

        for key in to_remove {
            EMBEDDINGS_CACHE.remove(&key);
        }

        // Record the eviction in our cache monitoring
        cache_monitor::record_eviction(size);

        info!(
            "Evicted embeddings for path {} from cache (size: {} words)",
            path, size
        );
    }
}

/// Loads embeddings from a file path if not already in the path cache
///
/// # Arguments
/// * `path` - Path to the embedding file
///
/// # Returns
/// Shared reference to the loaded embeddings or None if loading failed
async fn load_embeddings_from_path(path: &str) -> Option<SharedEmbeddings> {
    let normalized_path = normalize_path(path);

    if let Some(entry) = PATH_CACHE.get(&normalized_path) {
        let embeddings_clone = entry.embeddings.clone();
        drop(entry);

        if let Some(mut entry) = PATH_CACHE.get_mut(&normalized_path) {
            entry.last_used = SystemTime::now();
            info!(
                "Using path-cached embeddings from {} (normalized to {}, size: {} words)",
                path, normalized_path, entry.size
            );
        }

        // Record cache hit in monitoring
        cache_monitor::update_cache_metrics(true, embeddings_clone.len());
        
        return Some(embeddings_clone);
    }

    // Record cache miss in monitoring
    cache_monitor::update_cache_metrics(false, 0);

    debug!(
        "Path not in cache: '{}' (normalized to basename: '{}')",
        path, normalized_path
    );
    debug!("Current entries in path cache:");
    for entry in PATH_CACHE.iter() {
        debug!("  Cache key: '{}'", entry.key());
    }

    evict_lru_if_needed().await;

    match fs::metadata(path).await {
        Ok(_) => {
            debug!("Embeddings file exists at {}", path);
        }
        Err(e) => {
            error!("Embeddings file does not exist at {}: {}", path, e);
            return None;
        }
    }

    let path_clone = path.to_string();
    let start_time = Instant::now();
    let embeddings = match task::spawn_blocking(move || load_embeddings_t(&path_clone)).await {
        Ok(e) => e,
        Err(e) => {
            error!("Failed to load embeddings from {}: {}", path, e);
            return None;
        }
    };

    if embeddings.is_empty() {
        error!("Loaded embeddings from {} but they are empty", path);
        return None;
    }

    let size = embeddings.len();
    let embeddings_arc = Arc::new(embeddings);

    let entry = CacheEntry {
        embeddings: embeddings_arc.clone(),
        last_used: SystemTime::now(),
        size,
    };

    PATH_CACHE.insert(normalized_path.clone(), entry);
    
    // Update memory usage metrics after loading
    cache_monitor::update_cache_metrics(false, size);
    
    info!(
        "Successfully loaded embeddings from {} (normalized to {}, {} words) in {:?}",
        path,
        normalized_path,
        size,
        start_time.elapsed()
    );

    Some(embeddings_arc)
}
/// Retrieves the cached embeddings for a given collection
///
/// Embeddings are loaded from disk if not already present. Results are
/// stored in a two-level cache system with LRU eviction. Multiple collections
/// pointing to the same embedding file share the same memory.
///
/// # Arguments
/// * `db` - Database connection for fetching embedding path
/// * `solr_database_id` - Identifier for the Solr database
/// * `collection_name` - Name of the collection
///
/// # Returns
/// Shared reference to word-to-embedding mappings, or None if embeddings are disabled
pub async fn get_cached_embeddings(
    db: &web::Data<Database>,
    solr_database_id: i32,
    collection_name: &str,
) -> Option<Arc<EmbeddingMap>> {
    let cache_key = format!("{}:{}", solr_database_id, collection_name);

    if let Some(embeddings) = EMBEDDINGS_CACHE.get(&cache_key) {
        debug!("Using collection-cached embeddings for {}", cache_key);
        
        // Record cache hit
        cache_monitor::update_cache_metrics(true, embeddings.len());
        
        return Some(embeddings.clone());
    }

    // Record cache miss
    cache_monitor::update_cache_metrics(false, 0);

    debug!("Embeddings not in collection cache, fetching path from database");
    let embeddings_path = match get_embedding_path(db, solr_database_id, collection_name).await {
        Some(path) => path,
        None => {
            warn!(
                "No embedding path configured for collection {} (database ID {})",
                collection_name, solr_database_id
            );
            return None;
        }
    };

    let normalized_path = normalize_path(&embeddings_path);
    info!(
        "Loading embeddings for {} from path: {} (normalized to basename: {})",
        cache_key, embeddings_path, normalized_path
    );

    let embeddings = match load_embeddings_from_path(&embeddings_path).await {
        Some(e) => e,
        None => {
            error!(
                "Failed to load embeddings for collection {} from path {}",
                cache_key, embeddings_path
            );
            return None;
        }
    };

    EMBEDDINGS_CACHE.insert(cache_key.clone(), embeddings.clone());
    info!("Cached embeddings for collection {} (database ID {}) - sharing with other collections using path: {}", 
          collection_name, solr_database_id, normalized_path);

    Some(embeddings)
}

/// Actix-Web handler for computing nearest neighbors for a word
///
/// Accepts a JSON payload with word, database ID, and collection name,
/// then finds the top-10 semantically similar words using cosine similarity.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `query` - JSON payload with word, solr_database_id, and collection_name
///
/// # Returns
/// HTTP JSON response with top neighbors and a flag indicating if embeddings are available
#[utoipa::path(
    post,
    path = "/api/compute-neighbors",
    tag = "Embeddings",
    request_body = NeighborsRequest,
    responses(
        (status = 200, description = "Successfully computed word neighbors using cosine similarity or returned empty if no embeddings", body = NeighborsResponse),
        (status = 500, description = "Failed to load embeddings file or compute neighbors")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn compute_neighbors(
    db: web::Data<Database>,
    query: web::Json<NeighborsRequest>,
) -> impl Responder {
    info!(
        "Received request to compute neighbors for word: {} in collection: {} (database ID: {})",
        query.word, query.collection_name, query.solr_database_id
    );

    let lowercase_word = query.word.to_lowercase();

    let embeddings_opt =
        get_cached_embeddings(&db, query.solr_database_id, &query.collection_name).await;

    let embeddings = match embeddings_opt {
        Some(emb) => emb,
        None => {
            warn!(
                "No embeddings available for collection {}",
                query.collection_name
            );
            return HttpResponse::Ok().json(NeighborsResponse {
                top_neighbors: vec![],
                has_embeddings: false,
            });
        }
    };

    let neighbors = compute_top_neighbors(&lowercase_word, &embeddings);

    if neighbors.is_empty() {
        warn!("No neighbors found for word: {}", query.word);
    } else {
        info!(
            "Found {} neighbors for word {}",
            neighbors.len(),
            query.word
        );
        debug!("Neighbors: {:?}", neighbors);
    }

    HttpResponse::Ok().json(NeighborsResponse {
        top_neighbors: neighbors,
        has_embeddings: true,
    })
}

/// Computes the cosine similarity between two vectors
///
/// # Arguments
/// * `vec1` - First vector
/// * `norm1` - Precomputed L2 norm of first vector
/// * `vec2` - Second vector
/// * `norm2` - Precomputed L2 norm of second vector
///
/// # Returns
/// Similarity score in range [-1.0, 1.0]
fn cosine_similarity(vec1: &[f32], norm1: f32, vec2: &[f32], norm2: f32) -> f32 {
    let dot_product: f32 = vec1.iter().zip(vec2.iter()).map(|(a, b)| a * b).sum();
    dot_product / (norm1 * norm2)
}

/// Computes the top-N most similar words by cosine similarity
///
/// Uses a fixed-size min-heap to track the top-10 neighbors and leverages
/// Rayon's parallel iterators to speed up similarity calculations.
///
/// # Arguments
/// * `word` - The lowercase query word
/// * `embeddings` - Reference to a word-to-embedding map
///
/// # Returns
/// Vector of the top-10 neighbor words, sorted by descending similarity
fn compute_top_neighbors(word: &str, embeddings: &EmbeddingMap) -> Vec<String> {
    let word_embedding = match embeddings.get(word) {
        Some(embedding) => embedding,
        None => {
            warn!("Word '{}' not found in the embeddings!", word);
            return vec![];
        }
    };

    let word_vector = &word_embedding.vector;
    let word_norm = word_embedding.norm;
    let top_n = 10;

    use std::collections::BinaryHeap;

    #[derive(PartialEq)]
    struct Neighbor {
        similarity: f32,
        word: String,
    }

    impl Eq for Neighbor {}

    impl PartialOrd for Neighbor {
        fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
            Some(self.cmp(other))
        }
    }

    impl Ord for Neighbor {
        fn cmp(&self, other: &Self) -> Ordering {
            other
                .similarity
                .partial_cmp(&self.similarity)
                .unwrap_or(Ordering::Equal)
        }
    }

    let heap = embeddings
        .par_iter()
        .filter(|&(other_word, _)| other_word != word)
        .map(|(other_word, other_embedding)| {
            let similarity = cosine_similarity(
                word_vector,
                word_norm,
                &other_embedding.vector,
                other_embedding.norm,
            );
            Neighbor {
                similarity,
                word: other_word.clone(),
            }
        })
        .fold(
            || BinaryHeap::with_capacity(top_n),
            |mut heap, neighbor| {
                if heap.len() < top_n {
                    heap.push(neighbor);
                } else if neighbor.similarity > heap.peek().unwrap().similarity {
                    heap.pop();
                    heap.push(neighbor);
                }
                heap
            },
        )
        .reduce(
            || BinaryHeap::with_capacity(top_n),
            |mut heap1, mut heap2| {
                while let Some(neighbor) = heap2.pop() {
                    if heap1.len() < top_n {
                        heap1.push(neighbor);
                    } else if neighbor.similarity > heap1.peek().unwrap().similarity {
                        heap1.pop();
                        heap1.push(neighbor);
                    }
                }
                heap1
            },
        );

    let mut top_neighbors = heap.into_sorted_vec();
    top_neighbors.reverse();
    top_neighbors
        .into_iter()
        .map(|neighbor| neighbor.word)
        .collect()
}

/// Loads embeddings from a text file
///
/// Parses a whitespace-delimited file where each line starts with a word
/// followed by its vector components. Computes the vector's L2 norm.
///
/// # Arguments
/// * `filename` - Path to the embeddings file
///
/// # Returns
/// HashMap mapping words to their embedding vectors and precomputed norms
fn load_embeddings_t(filename: &str) -> EmbeddingMap {
    info!("Starting to load embeddings from {}", filename);

    let file = match std::fs::File::open(filename) {
        Ok(f) => f,
        Err(e) => {
            error!("Failed to open embeddings file {}: {}", filename, e);
            return HashMap::new();
        }
    };

    let reader = std::io::BufReader::new(file);
    let mut embeddings = HashMap::new();
    let mut line_count = 0;
    let mut error_count = 0;

    for (idx, line_result) in reader.lines().enumerate() {
        if let Ok(line) = line_result {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() > 1 {
                let word = parts[0].to_string();

                let vector_result: Result<Vec<f32>, _> =
                    parts[1..].iter().map(|x| x.parse::<f32>()).collect();

                match vector_result {
                    Ok(vector) => {
                        let norm = vector.iter().map(|a| a * a).sum::<f32>().sqrt();
                        embeddings.insert(word, Embedding { vector, norm });
                        line_count += 1;

                        if line_count % 100000 == 0 {
                            info!("Loaded {} embeddings so far...", line_count);
                        }
                    }
                    Err(e) => {
                        error_count += 1;
                        if error_count < 10 {
                            error!("Failed to parse vector at line {}: {}", idx + 1, e);
                        }
                    }
                }
            }
        } else if let Err(e) = line_result {
            error!("Failed to read line: {}", e);
        }
    }

    info!(
        "Finished loading {} embeddings from {} (with {} errors)",
        line_count, filename, error_count
    );

    embeddings
}

/// Returns detailed cache statistics
///
/// # Returns
/// A CacheStats struct with information about the cache state
pub fn get_cache_stats() -> CacheStats {
    let config = Config::global();

    let total_embeddings = PATH_CACHE.iter().map(|entry| entry.size).sum();

    let path_details = PATH_CACHE
        .iter()
        .map(|entry| {
            let time_str = match entry.last_used.duration_since(SystemTime::UNIX_EPOCH) {
                Ok(n) => format!("{} seconds since epoch", n.as_secs()),
                Err(_) => "unknown time".to_string(),
            };

            PathCacheEntry {
                path: entry.key().clone(),
                size: entry.size,
                last_used: time_str,
            }
        })
        .collect();

    CacheStats {
        collection_cache_entries: EMBEDDINGS_CACHE.len(),
        path_cache_entries: PATH_CACHE.len(),
        path_cache_details: path_details,
        total_embeddings_loaded: total_embeddings,
        max_embeddings_files: config.max_embeddings_files,
    }
}

/// Clears all embedding caches
///
/// This function is called during server shutdown or on-demand via API
/// to release memory used by embeddings. It acquires a lock to ensure
/// thread safety during cache clearing operations.
///
/// # Returns
/// A future that completes when cache clearing is done
pub async fn clear_caches() {
    let _lock = CACHE_MUTEX.lock().await;
    
    // Get counts before clearing for metrics
    let path_entries = PATH_CACHE.len();
    let collection_entries = EMBEDDINGS_CACHE.len();
    let total_words: usize = PATH_CACHE.iter().map(|entry| entry.size).sum();
    
    // Clear the caches
    EMBEDDINGS_CACHE.clear();
    PATH_CACHE.clear();
    
    // Record the large eviction in our metrics
    cache_monitor::record_eviction(total_words);
    
    info!("All embedding caches cleared: {} paths, {} collections, {} words", 
          path_entries, collection_entries, total_words);
}