//! Advanced caching system for embeddings with LRU eviction and memory management.

use crate::config::Config;
use crate::histtext::embedding::formats;
use crate::histtext::embedding::types::{
    CacheKey, EmbeddingConfig, EmbeddingMap, EmbeddingResult, SharedEmbeddings,
};
use crate::services::database::Database;
use actix_web::web;
use dashmap::DashMap;
use log::{debug, error, info, warn};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::{Mutex, RwLock};
use tokio::task;

/// Cache entry with metadata for LRU eviction
#[derive(Debug)]
struct CacheEntry {
    /// The cached embeddings
    embeddings: SharedEmbeddings,
    /// Last access time for LRU eviction
    last_accessed: RwLock<SystemTime>,
    /// Size in memory (approximate)
    memory_size: usize,
    /// Reference count for safe eviction
    ref_count: Arc<std::sync::atomic::AtomicUsize>,
}

impl CacheEntry {
    fn new(embeddings: SharedEmbeddings, memory_size: usize) -> Self {
        Self {
            embeddings,
            last_accessed: RwLock::new(SystemTime::now()),
            memory_size,
            ref_count: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        }
    }

    async fn touch(&self) {
        *self.last_accessed.write().await = SystemTime::now();
    }

    async fn last_accessed(&self) -> SystemTime {
        *self.last_accessed.read().await
    }

    fn increment_ref(&self) {
        self.ref_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn decrement_ref(&self) {
        self.ref_count.fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn ref_count(&self) -> usize {
        self.ref_count.load(std::sync::atomic::Ordering::Relaxed)
    }
}

/// Path-based cache for sharing embeddings across collections
static PATH_CACHE: std::sync::LazyLock<DashMap<String, Arc<CacheEntry>>> = 
    std::sync::LazyLock::new(|| DashMap::new());

/// Collection-based cache for fast lookup
static COLLECTION_CACHE: std::sync::LazyLock<DashMap<String, Arc<CacheEntry>>> = 
    std::sync::LazyLock::new(|| DashMap::new());

/// Global cache statistics
static CACHE_STATS: std::sync::LazyLock<Arc<Mutex<CacheStatistics>>> = 
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(CacheStatistics::new())));

/// Cache eviction mutex to prevent concurrent evictions
static EVICTION_MUTEX: std::sync::LazyLock<Mutex<()>> = 
    std::sync::LazyLock::new(|| Mutex::new(()));

/// Detailed cache statistics
#[derive(Debug, Clone)]
pub struct CacheStatistics {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub memory_usage: usize,
    pub max_memory: usize,
    pub entries_count: usize,
    pub last_eviction: Option<SystemTime>,
}

impl CacheStatistics {
    fn new() -> Self {
        Self {
            hits: 0,
            misses: 0,
            evictions: 0,
            memory_usage: 0,
            max_memory: Config::global().max_embeddings_files * 1024 * 1024 * 1024, // GB to bytes
            entries_count: 0,
            last_eviction: None,
        }
    }

    fn record_hit(&mut self) {
        self.hits += 1;
    }

    fn record_miss(&mut self) {
        self.misses += 1;
    }

    fn record_eviction(&mut self, memory_freed: usize) {
        self.evictions += 1;
        self.memory_usage = self.memory_usage.saturating_sub(memory_freed);
        self.entries_count = self.entries_count.saturating_sub(1);
        self.last_eviction = Some(SystemTime::now());
    }

    fn record_addition(&mut self, memory_added: usize) {
        self.memory_usage += memory_added;
        self.entries_count += 1;
    }

    pub fn hit_ratio(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 {
            0.0
        } else {
            self.hits as f64 / total as f64
        }
    }

    pub fn memory_usage_ratio(&self) -> f64 {
        if self.max_memory == 0 {
            0.0
        } else {
            self.memory_usage as f64 / self.max_memory as f64
        }
    }
}

/// Initialize the cache system
pub async fn initialize_cache() -> EmbeddingResult<()> {
    info!("Initializing embedding cache system");
    
    // Start background cleanup task
    tokio::spawn(async {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
        loop {
            interval.tick().await;
            if let Err(e) = cleanup_expired_entries().await {
                error!("Cache cleanup failed: {}", e);
            }
        }
    });

    // Start memory monitoring task
    tokio::spawn(async {
        let mut interval = tokio::time::interval(Duration::from_secs(60)); // 1 minute
        loop {
            interval.tick().await;
            if let Err(e) = check_memory_pressure().await {
                error!("Memory pressure check failed: {}", e);
            }
        }
    });

    info!("Embedding cache system initialized");
    Ok(())
}

/// Get cached embeddings for a collection
pub async fn get_cached_embeddings(
    db: &web::Data<Database>,
    solr_database_id: i32,
    collection_name: &str,
) -> Option<Arc<EmbeddingMap>> {
    let cache_key = CacheKey::new(solr_database_id, collection_name.to_string());
    let cache_key_str = cache_key.to_string();

    // Check collection cache first
    if let Some(entry) = COLLECTION_CACHE.get(&cache_key_str) {
        entry.touch().await;
        entry.increment_ref();
        
        let embeddings = entry.embeddings.clone();
        entry.decrement_ref();
        
        // Record cache hit
        {
            let mut stats = CACHE_STATS.lock().await;
            stats.record_hit();
        }
        
        debug!("Collection cache hit for {}", cache_key_str);
        return Some(embeddings);
    }

    // Record cache miss
    {
        let mut stats = CACHE_STATS.lock().await;
        stats.record_miss();
    }

    // Get embedding path from database
    let embedding_path = match get_embedding_path(db, solr_database_id, collection_name).await {
        Some(path) => path,
        None => {
            warn!("No embedding path configured for {}", cache_key_str);
            return None;
        }
    };

    // Check path cache
    let normalized_path = normalize_path(&embedding_path);
    if let Some(entry) = PATH_CACHE.get(&normalized_path) {
        entry.touch().await;
        entry.increment_ref();
        
        let embeddings = entry.embeddings.clone();
        
        // Add to collection cache for faster future access
        COLLECTION_CACHE.insert(cache_key_str.clone(), entry.clone());
        
        entry.decrement_ref();
        
        debug!("Path cache hit for {} -> {}", cache_key_str, normalized_path);
        return Some(embeddings);
    }

    // Load embeddings from disk
    debug!("Loading embeddings from disk: {}", embedding_path);
    match load_embeddings_from_disk(&embedding_path, &normalized_path, &cache_key_str).await {
        Ok(embeddings) => Some(embeddings),
        Err(e) => {
            error!("Failed to load embeddings from {}: {}", embedding_path, e);
            None
        }
    }
}

/// Load embeddings from disk and cache them
async fn load_embeddings_from_disk(
    path: &str,
    normalized_path: &str,
    cache_key: &str,
) -> EmbeddingResult<Arc<EmbeddingMap>> {
    // Check if we need to evict before loading
    evict_if_needed().await?;

    let config = EmbeddingConfig {
        normalize_on_load: true,
        parallel_workers: num_cpus::get(),
        ..EmbeddingConfig::default()
    };

    let (embeddings, stats) = formats::load_embeddings(path, &config).await?;
    let embeddings = Arc::new(embeddings);
    let memory_size = stats.memory_usage;

    // Create cache entry
    let entry = Arc::new(CacheEntry::new(embeddings.clone(), memory_size));

    // Add to both caches
    PATH_CACHE.insert(normalized_path.to_string(), entry.clone());
    COLLECTION_CACHE.insert(cache_key.to_string(), entry);

    // Update statistics
    {
        let mut stats = CACHE_STATS.lock().await;
        stats.record_addition(memory_size);
    }

    info!(
        "Loaded and cached embeddings: {} words, {} bytes, path: {}",
        embeddings.len(),
        memory_size,
        normalized_path
    );

    Ok(embeddings)
}

/// Evict entries if memory pressure is too high
async fn evict_if_needed() -> EmbeddingResult<()> {
    let _lock = EVICTION_MUTEX.lock().await;
    
    let (current_memory, max_memory) = {
        let stats = CACHE_STATS.lock().await;
        (stats.memory_usage, stats.max_memory)
    };

    // Evict if we're using more than 80% of available memory
    if current_memory > max_memory * 80 / 100 {
        info!("Memory pressure detected, starting eviction process");
        
        // Gather candidates for eviction (LRU + not currently in use)
        let mut candidates = Vec::new();
        
        for entry in PATH_CACHE.iter() {
            let (path, cache_entry) = entry.pair();
            if cache_entry.ref_count() == 0 {
                let last_accessed = cache_entry.last_accessed().await;
                candidates.push((path.clone(), last_accessed, cache_entry.memory_size));
            }
        }
        
        // Sort by last access time (oldest first)
        candidates.sort_by_key(|(_, last_accessed, _)| *last_accessed);
        
        // Evict until we're under 60% memory usage
        let target_memory = max_memory * 60 / 100;
        let mut memory_freed = 0;
        
        for (path, _, size) in candidates {
            if current_memory - memory_freed <= target_memory {
                break;
            }
            
            evict_path(&path).await;
            memory_freed += size;
        }
        
        info!("Eviction complete: freed {} bytes", memory_freed);
    }
    
    Ok(())
}

/// Evict a specific path from cache
async fn evict_path(path: &str) {
    if let Some((_, entry)) = PATH_CACHE.remove(path) {
        // Remove from collection cache as well
        let mut to_remove = Vec::new();
        for item in COLLECTION_CACHE.iter() {
            if Arc::ptr_eq(&item.value().embeddings, &entry.embeddings) {
                to_remove.push(item.key().clone());
            }
        }
        
        for key in to_remove {
            COLLECTION_CACHE.remove(&key);
        }
        
        // Update statistics
        {
            let mut stats = CACHE_STATS.lock().await;
            stats.record_eviction(entry.memory_size);
        }
        
        debug!("Evicted embeddings from path: {}", path);
    }
}

/// Clean up expired entries (not accessed for 24 hours)
async fn cleanup_expired_entries() -> EmbeddingResult<()> {
    let cutoff_time = SystemTime::now() - Duration::from_secs(24 * 60 * 60);
    let mut expired_paths = Vec::new();
    
    for entry in PATH_CACHE.iter() {
        let (path, cache_entry) = entry.pair();
        if cache_entry.ref_count() == 0 && cache_entry.last_accessed().await < cutoff_time {
            expired_paths.push(path.clone());
        }
    }
    
    for path in expired_paths {
        evict_path(&path).await;
    }
    
    if !expired_paths.is_empty() {
        info!("Cleaned up {} expired cache entries", expired_paths.len());
    }
    
    Ok(())
}

/// Check memory pressure and log warnings
async fn check_memory_pressure() -> EmbeddingResult<()> {
    let stats = CACHE_STATS.lock().await;
    let usage_ratio = stats.memory_usage_ratio();
    
    if usage_ratio > 0.9 {
        warn!("High memory usage: {:.1}% of cache limit", usage_ratio * 100.0);
    } else if usage_ratio > 0.8 {
        info!("Moderate memory usage: {:.1}% of cache limit", usage_ratio * 100.0);
    }
    
    Ok(())
}

/// Clear all caches
pub async fn clear_caches() {
    info!("Clearing all embedding caches");
    
    let path_count = PATH_CACHE.len();
    let collection_count = COLLECTION_CACHE.len();
    
    PATH_CACHE.clear();
    COLLECTION_CACHE.clear();
    
    // Reset statistics
    {
        let mut stats = CACHE_STATS.lock().await;
        *stats = CacheStatistics::new();
    }
    
    info!("Cleared {} path entries and {} collection entries", path_count, collection_count);
}

/// Get cache statistics
pub async fn get_cache_statistics() -> CacheStatistics {
    let mut stats = CACHE_STATS.lock().await;
    stats.entries_count = PATH_CACHE.len();
    stats.clone()
}

/// Get embedding path from database
async fn get_embedding_path(
    db: &web::Data<Database>,
    solr_database_id: i32,
    collection_name: &str,
) -> Option<String> {
    use crate::schema::solr_database_info::dsl::*;
    
    let db_clone = db.clone();
    let collection_name_str = collection_name.to_string();
    
    let result = task::spawn_blocking(move || -> Result<Option<String>, diesel::result::Error> {
        let mut conn = db_clone.pool.get().map_err(|_| diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UnableToSendCommand,
            Box::new("Failed to get connection".to_string())
        ))?;
        
        let info = solr_database_info
            .filter(solr_database_id.eq(solr_database_id))
            .filter(collection_name.eq(&collection_name_str))
            .first::<crate::services::solr_database_info::SolrDatabaseInfo>(&mut conn)?;
        
        match info.embeddings.as_str() {
            "none" => Ok(None),
            "default" => Ok(Some(Config::global().embed_path.clone())),
            path => Ok(Some(path.to_string())),
        }
    }).await;
    
    match result {
        Ok(Ok(path)) => path,
        Ok(Err(e)) => {
            error!("Database error getting embedding path: {}", e);
            None
        }
        Err(e) => {
            error!("Task error getting embedding path: {}", e);
            None
        }
    }
}

/// Normalize path to use as cache key
fn normalize_path(path: &str) -> String {
    std::path::Path::new(path)
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_cache_statistics() {
        let mut stats = CacheStatistics::new();
        
        stats.record_hit();
        stats.record_hit();
        stats.record_miss();
        
        assert_eq!(stats.hits, 2);
        assert_eq!(stats.misses, 1);
        assert_eq!(stats.hit_ratio(), 2.0 / 3.0);
    }

    #[test]
    fn test_path_normalization() {
        let path = "/path/to/embeddings.vec";
        let normalized = normalize_path(path);
        assert!(!normalized.is_empty());
    }

    #[tokio::test]
    async fn test_cache_entry_ref_counting() {
        let embeddings = Arc::new(HashMap::new());
        let entry = CacheEntry::new(embeddings, 1000);
        
        assert_eq!(entry.ref_count(), 0);
        
        entry.increment_ref();
        assert_eq!(entry.ref_count(), 1);
        
        entry.decrement_ref();
        assert_eq!(entry.ref_count(), 0);
    }
}