use crate::histtext::embeddings;
use actix_web::{web, HttpResponse, Responder};
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use utoipa::ToSchema;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::RwLock;
use lazy_static::lazy_static;
use crate::histtext::embeddings::stats::reset_performance_metrics;
use crate::histtext::embeddings::{cache, stats};
use serde_json::json;
use log::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachePerformanceMetrics {
    pub hits: u64,
    pub misses: u64,
    pub start_time: DateTime<Utc>,
    pub last_reset: DateTime<Utc>,
    pub estimated_memory_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_ratio: Option<f64>,
    pub evictions: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CacheMonitorResponse {
    pub basic_stats: crate::histtext::embeddings::stats::CacheStats,
    pub performance: PerformanceMetrics,
    pub system_info: SystemInfo,
    pub collected_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PerformanceMetrics {
    pub avg_similarity_time_us: f64,
    pub avg_search_time_ms: f64,
    pub total_similarity_computations: u64,
    pub total_searches: u64,
    pub peak_memory_bytes: usize,
    pub estimated_memory_per_word: Option<f64>,
    pub estimated_memory_bytes: usize,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SystemInfo {
    pub cpu_cores: usize,
    pub total_memory_bytes: usize,
    pub architecture: String,
    pub operating_system: String,
}

#[utoipa::path(
    get,
    path = "/api/embeddings/advanced-stats",
    tag = "Embeddings",
    responses(
        (status = 200, description = "Comprehensive cache statistics and performance metrics", body = CacheMonitorResponse)
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_cache_stats_advanced() -> impl Responder {
    let cache_stats = cache::get_cache_statistics().await;
    let system_stats = stats::get_system_stats().await;
    
    HttpResponse::Ok().json(json!({
        "cache": cache_stats,
        "system": system_stats,
        "timestamp": chrono::Utc::now()
    }))
}

#[utoipa::path(
    post,
    path = "/api/embeddings/reset-metrics",
    tag = "Embeddings",
    responses(
        (status = 200, description = "Performance metrics reset successfully")
    ),
    security(("bearer_auth" = []))
)]
pub async fn reset_cache_metrics() -> impl Responder {
    stats::reset_performance_metrics();
    info!("Cache performance metrics reset");
    
    HttpResponse::Ok().json(json!({
        "message": "Cache metrics reset successfully",
        "timestamp": chrono::Utc::now()
    }))
}

impl CachePerformanceMetrics {
    pub fn new() -> Self {
        let now = Utc::now();
        Self {
            hits: 0,
            misses: 0,
            start_time: now,
            last_reset: now,
            estimated_memory_bytes: 0,
            hit_ratio: None,
            evictions: 0,
        }
    }

    pub fn calculate_hit_ratio(&mut self) {
        let total = self.hits + self.misses;
        self.hit_ratio = if total > 0 {
            Some(self.hits as f64 / total as f64)
        } else {
            None
        }
    }

    pub fn reset(&mut self) {
        self.hits = 0;
        self.misses = 0;
        self.last_reset = Utc::now();
        self.hit_ratio = None;
    }
}

#[derive(Debug)]
pub struct CacheMetricsCounter {
    hits: AtomicU64,
    misses: AtomicU64,
    evictions: AtomicU64,
    estimated_memory: AtomicU64,
    start_time: DateTime<Utc>,
    last_reset: RwLock<DateTime<Utc>>,
}

impl CacheMetricsCounter {
    pub fn new() -> Self {
        let now = Utc::now();
        Self {
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
            evictions: AtomicU64::new(0),
            estimated_memory: AtomicU64::new(0),
            start_time: now,
            last_reset: RwLock::new(now),
        }
    }

    pub fn record_hit(&self) {
        self.hits.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_miss(&self) {
        self.misses.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_eviction(&self) {
        self.evictions.fetch_add(1, Ordering::Relaxed);
    }

    pub fn update_memory_usage(&self, bytes: u64) {
        self.estimated_memory.store(bytes, Ordering::Relaxed);
    }

    pub async fn get_metrics(&self) -> CachePerformanceMetrics {
        let mut metrics = CachePerformanceMetrics {
            hits: self.hits.load(Ordering::Relaxed),
            misses: self.misses.load(Ordering::Relaxed),
            evictions: self.evictions.load(Ordering::Relaxed),
            estimated_memory_bytes: self.estimated_memory.load(Ordering::Relaxed),
            start_time: self.start_time,
            last_reset: *self.last_reset.read().await,
            hit_ratio: None,
        };
        
        metrics.calculate_hit_ratio();
        metrics
    }

    pub async fn reset(&self) {
        self.hits.store(0, Ordering::Relaxed);
        self.misses.store(0, Ordering::Relaxed);
        *self.last_reset.write().await = Utc::now();
    }
}

lazy_static! {
    static ref CACHE_METRICS: CacheMetricsCounter = CacheMetricsCounter::new();
}

#[derive(Debug, Serialize)]
pub struct ExtendedCacheStats {
    pub basic_stats: embeddings::CacheStats,
    pub performance: CachePerformanceMetrics,
    pub uptime_seconds: i64,
    pub bytes_per_word: Option<f64>,
}

pub fn estimate_memory_usage(embedding_count: usize, avg_vector_dim: Option<usize>) -> u64 {
    let dim = avg_vector_dim.unwrap_or(300);
    let vector_bytes = dim * 4;
    let word_bytes = 32;
    let hashmap_overhead = 16;
    let bytes_per_entry = (vector_bytes + word_bytes + hashmap_overhead) as u64;
    embedding_count as u64 * bytes_per_entry
}

pub fn update_cache_metrics(hit: bool, embedding_count: usize) {
    if hit {
        CACHE_METRICS.record_hit();
    } else {
        CACHE_METRICS.record_miss();
    }
    
    let memory_usage = estimate_memory_usage(embedding_count, None);
    CACHE_METRICS.update_memory_usage(memory_usage);
}

pub fn record_eviction(count: usize) {
    for _ in 0..count {
        CACHE_METRICS.record_eviction();
    }
}

pub async fn get_extended_stats() -> ExtendedCacheStats {
    let basic_stats = crate::histtext::embeddings::get_cache_stats().await;
    let performance = CACHE_METRICS.get_metrics().await;
    
    let now = Utc::now();
    let uptime_seconds = (now - performance.start_time).num_seconds();
    
    let bytes_per_word = if basic_stats.total_embeddings_loaded > 0 {
        Some(performance.estimated_memory_bytes as f64 / basic_stats.total_embeddings_loaded as f64)
    } else {
        None
    };
    
    ExtendedCacheStats {
        basic_stats,
        performance,
        uptime_seconds,
        bytes_per_word,
    }
}

pub async fn reset_metrics() {
    CACHE_METRICS.reset().await;
}