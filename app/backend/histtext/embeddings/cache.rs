use crate::config::Config;
use crate::histtext::embeddings::formats;
use crate::histtext::embeddings::types::{
    CacheKey, EmbeddingConfig, EmbeddingMap, EmbeddingResult, SharedEmbeddings,
};
use crate::services::solr_database_info::SolrDatabaseInfo;
use diesel::prelude::*;
use crate::diesel::ExpressionMethods;
use crate::services::database::Database;
use actix_web::web;
use dashmap::DashMap;
use log::{debug, error, info, warn};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use tokio::task;

#[derive(Debug)]
struct CacheEntry {
    embeddings: SharedEmbeddings,
    last_accessed: RwLock<SystemTime>,
    memory_size: usize,
}

impl CacheEntry {
    fn new(embeddings: SharedEmbeddings, memory_size: usize) -> Self {
        Self {
            embeddings,
            last_accessed: RwLock::new(SystemTime::now()),
            memory_size,
        }
    }

    async fn touch(&self) {
        *self.last_accessed.write().await = SystemTime::now();
    }

    async fn last_accessed(&self) -> SystemTime {
        *self.last_accessed.read().await
    }
}

static CACHE: std::sync::LazyLock<DashMap<String, Arc<CacheEntry>>> = 
    std::sync::LazyLock::new(DashMap::new);

static CACHE_STATS: std::sync::LazyLock<Arc<tokio::sync::Mutex<CacheStatistics>>> = 
    std::sync::LazyLock::new(|| Arc::new(tokio::sync::Mutex::new(CacheStatistics::new())));

static EVICTION_MUTEX: std::sync::LazyLock<tokio::sync::Mutex<()>> = 
    std::sync::LazyLock::new(|| tokio::sync::Mutex::new(()));

#[derive(Debug, Clone, serde::Serialize)]
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
            max_memory: Config::global().max_embeddings_files * 512 * 1024 * 1024,
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

pub async fn initialize_cache() -> EmbeddingResult<()> {
    info!("Initializing embedding cache system");
    
    tokio::spawn(async {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            if let Err(e) = cleanup_expired_entries().await {
                error!("Cache cleanup failed: {}", e);
            }
        }
    });

    tokio::spawn(async {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
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

pub async fn get_cached_embeddings(
    db: &web::Data<Database>,
    solr_database_id: i32,
    collection_name: &str,
) -> Option<Arc<EmbeddingMap>> {
    let cache_key = CacheKey::new(solr_database_id, collection_name.to_string());
    let cache_key_str = cache_key.to_string();

    if let Some(entry) = CACHE.get(&cache_key_str) {
        entry.touch().await;
        
        {
            let mut stats = CACHE_STATS.lock().await;
            stats.record_hit();
        }
        
        debug!("Cache hit for {}", cache_key_str);
        return Some(entry.embeddings.clone());
    }

    {
        let mut stats = CACHE_STATS.lock().await;
        stats.record_miss();
    }

    let embedding_path = match get_embedding_path(db, solr_database_id, collection_name).await {
        Some(path) => path,
        None => {
            warn!("No embedding path configured for {}:{}", solr_database_id, collection_name);
            return None;
        }
    };

    debug!("Loading embeddings from disk: {}", embedding_path);
    match load_embeddings_from_disk(&embedding_path, &cache_key_str).await {
        Ok(embeddings) => Some(embeddings),
        Err(e) => {
            error!("Failed to load embeddings from {}: {}", embedding_path, e);
            None
        }
    }
}

async fn load_embeddings_from_disk(
    path: &str,
    cache_key: &str,
) -> EmbeddingResult<Arc<EmbeddingMap>> {
    evict_if_needed().await?;

    let config = EmbeddingConfig {
        normalize_on_load: true,
        parallel_workers: num_cpus::get().min(4),
        max_words: 200_000,
        text_encoding: Some("utf-8".to_string()),
        auto_decompress: true,
        ..EmbeddingConfig::default()
    };

    let (embeddings, stats) = formats::load_embeddings(path, &config).await?;
    let embeddings = Arc::new(embeddings);
    let memory_size = stats.memory_usage;

    let entry = Arc::new(CacheEntry::new(embeddings.clone(), memory_size));
    CACHE.insert(cache_key.to_string(), entry);

    {
        let mut cache_stats = CACHE_STATS.lock().await;
        cache_stats.record_addition(memory_size);
    }

    info!(
        "Loaded and cached embeddings: {} words, {} bytes, key: {}",
        embeddings.len(),
        memory_size,
        cache_key
    );

    Ok(embeddings)
}

async fn evict_if_needed() -> EmbeddingResult<()> {
    let _lock = EVICTION_MUTEX.lock().await;
    
    let (current_memory, max_memory) = {
        let stats = CACHE_STATS.lock().await;
        (stats.memory_usage, stats.max_memory)
    };

    if current_memory > max_memory * 80 / 100 {
        info!("Memory pressure detected, starting eviction process");
        
        let mut candidates = Vec::new();
        
        for entry in CACHE.iter() {
            let (key, cache_entry) = entry.pair();
            let last_accessed = cache_entry.last_accessed().await;
            candidates.push((key.clone(), last_accessed, cache_entry.memory_size));
        }
        
        candidates.sort_by_key(|(_, last_accessed, _)| *last_accessed);
        
        let target_memory = max_memory * 60 / 100;
        let mut memory_freed = 0;
        
        for (key, _, size) in candidates {
            if current_memory - memory_freed <= target_memory {
                break;
            }
            
            evict_entry(&key).await;
            memory_freed += size;
        }
        
        info!("Eviction complete: freed {} bytes", memory_freed);
    }
    
    Ok(())
}

async fn evict_entry(key: &str) {
    if let Some((_, entry)) = CACHE.remove(key) {
        let mut stats = CACHE_STATS.lock().await;
        stats.record_eviction(entry.memory_size);
        debug!("Evicted embeddings from cache: {}", key);
    }
}

async fn cleanup_expired_entries() -> EmbeddingResult<()> {
    let cutoff_time = SystemTime::now() - Duration::from_secs(24 * 60 * 60);
    let mut expired_keys = Vec::new();
    
    for entry in CACHE.iter() {
        let (key, cache_entry) = entry.pair();
        if cache_entry.last_accessed().await < cutoff_time {
            expired_keys.push(key.clone());
        }
    }
    
    for key in expired_keys.clone() {
        evict_entry(&key).await;
    }
    
    if !expired_keys.is_empty() {
        info!("Cleaned up {} expired cache entries", expired_keys.len());
    }
        
    Ok(())
}

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

pub async fn clear_caches() {
    info!("Clearing all embedding caches");
    
    let cache_count = CACHE.len();
    CACHE.clear();
    
    {
        let mut stats = CACHE_STATS.lock().await;
        *stats = CacheStatistics::new();
    }
    
    info!("Cleared {} cache entries", cache_count);
}

pub async fn get_cache_statistics() -> CacheStatistics {
    let mut stats = CACHE_STATS.lock().await;
    stats.entries_count = CACHE.len();
    stats.clone()
}

async fn get_embedding_path(
    db: &web::Data<Database>,
    solr_database_id_param: i32,
    collection_name_param: &str,
) -> Option<String> {
    use crate::schema::solr_database_info::dsl::*;
    
    let db_clone = db.clone();
    let collection_name_str = collection_name_param.to_string();
    
    let result = task::spawn_blocking(move || -> Result<Option<String>, diesel::result::Error> {
        let mut conn = db_clone.pool.get().map_err(|_| diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UnableToSendCommand,
            Box::new("Failed to get connection".to_string())
        ))?;
        
        let info = solr_database_info
            .filter(solr_database_id.eq(solr_database_id_param))
            .filter(collection_name.eq(&collection_name_str))
            .first::<SolrDatabaseInfo>(&mut conn)?;
        
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