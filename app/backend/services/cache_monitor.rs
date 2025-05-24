// File: app/backend/services/cache_monitor.rs

//! Enhanced cache monitoring and management for word embeddings.
//!
//! This module extends the basic cache functionality in histtext/embeddings.rs
//! with advanced monitoring capabilities, more detailed statistics, and
//! configurable cache management policies.

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

/// Records cache hit/miss statistics over time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachePerformanceMetrics {
    /// Number of cache hits
    pub hits: u64,
    /// Number of cache misses
    pub misses: u64,
    /// Time when metrics collection started
    pub start_time: DateTime<Utc>,
    /// Time of last reset
    pub last_reset: DateTime<Utc>,
    /// Estimated memory usage in bytes
    pub estimated_memory_bytes: u64,
    /// Cache hit ratio (hits / (hits + misses))
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_ratio: Option<f64>,
    /// Number of evictions since start
    pub evictions: u64,
}

/// Advanced cache monitoring response
#[derive(Debug, Serialize, ToSchema)]
pub struct CacheMonitorResponse {
    /// Basic cache statistics
    pub basic_stats: crate::histtext::embeddings::stats::CacheStats,
    /// Performance metrics
    pub performance: PerformanceMetrics,
    /// System information
    pub system_info: SystemInfo,
    /// Timestamp when data was collected
    pub collected_at: chrono::DateTime<chrono::Utc>,
}

/// Performance metrics for the cache system
#[derive(Debug, Serialize, ToSchema)]
pub struct PerformanceMetrics {
    /// Average time per similarity computation in microseconds
    pub avg_similarity_time_us: f64,
    /// Average time per neighbor search in milliseconds
    pub avg_search_time_ms: f64,
    /// Total similarity computations performed
    pub total_similarity_computations: u64,
    /// Total neighbor searches performed
    pub total_searches: u64,
    /// Peak memory usage in bytes
    pub peak_memory_bytes: usize,
    /// Estimated memory per word in bytes
    pub estimated_memory_per_word: Option<f64>,
    /// Estimated memory usage
    pub estimated_memory_bytes: usize,
}

/// System information
#[derive(Debug, Serialize, ToSchema)]
pub struct SystemInfo {
    /// Number of CPU cores
    pub cpu_cores: usize,
    /// Total system memory in bytes
    pub total_memory_bytes: usize,
    /// System architecture
    pub architecture: String,
    /// Operating system
    pub operating_system: String,
}

/// Retrieves comprehensive cache statistics and performance metrics
///
/// Returns detailed information about cache performance, memory usage,
/// and system resource utilization.
///
/// # Returns
/// HTTP response with detailed cache monitoring data
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
/// Resets performance metrics and counters
///
/// Clears all accumulated performance statistics, useful for
/// benchmarking or after system changes.
///
/// # Returns
/// HTTP response confirming metrics reset
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
    /// Creates a new metrics instance with zeros
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

    /// Calculates the hit ratio
    pub fn calculate_hit_ratio(&mut self) {
        let total = self.hits + self.misses;
        self.hit_ratio = if total > 0 {
            Some(self.hits as f64 / total as f64)
        } else {
            None
        }
    }

    /// Resets all counters except evictions
    pub fn reset(&mut self) {
        self.hits = 0;
        self.misses = 0;
        self.last_reset = Utc::now();
        self.hit_ratio = None;
    }
}

/// Thread-safe cache metrics counter
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
    /// Creates a new metrics counter
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

    /// Records a cache hit
    pub fn record_hit(&self) {
        self.hits.fetch_add(1, Ordering::Relaxed);
    }

    /// Records a cache miss
    pub fn record_miss(&self) {
        self.misses.fetch_add(1, Ordering::Relaxed);
    }

    /// Records a cache eviction
    pub fn record_eviction(&self) {
        self.evictions.fetch_add(1, Ordering::Relaxed);
    }

    /// Updates estimated memory usage
    pub fn update_memory_usage(&self, bytes: u64) {
        self.estimated_memory.store(bytes, Ordering::Relaxed);
    }

    /// Gets current metrics snapshot
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

    /// Resets hit and miss counters
    pub async fn reset(&self) {
        self.hits.store(0, Ordering::Relaxed);
        self.misses.store(0, Ordering::Relaxed);
        *self.last_reset.write().await = Utc::now();
    }
}

lazy_static! {
    /// Global cache metrics counter
    static ref CACHE_METRICS: CacheMetricsCounter = CacheMetricsCounter::new();
}

/// Extended cache statistics including performance metrics
#[derive(Debug, Serialize)]
pub struct ExtendedCacheStats {
    /// Basic cache statistics from the embeddings module
    pub basic_stats: embeddings::CacheStats,
    /// Performance metrics for cache operations
    pub performance: CachePerformanceMetrics,
    /// Uptime in seconds since cache metrics were started
    pub uptime_seconds: i64,
    /// Memory usage per word embedding (average)
    pub bytes_per_word: Option<f64>,
}

/// Estimates memory usage for word embeddings
///
/// Uses a heuristic to estimate memory usage based on:
/// - Number of words loaded
/// - Typical vector size
/// - Overhead for hashmaps and other data structures
///
/// # Arguments
/// * `embedding_count` - Number of word embeddings in cache
/// * `avg_vector_dim` - Average dimension of embedding vectors (default: 300)
///
/// # Returns
/// Estimated memory usage in bytes
pub fn estimate_memory_usage(embedding_count: usize, avg_vector_dim: Option<usize>) -> u64 {
    let dim = avg_vector_dim.unwrap_or(300);
    
    // Each f32 is 4 bytes
    let vector_bytes = dim * 4;
    
    // Estimate for word string (avg 7 chars + overhead)
    let word_bytes = 32;
    
    // HashMap overhead (approximately 16 bytes per entry)
    let hashmap_overhead = 16;
    
    // Total per entry
    let bytes_per_entry = (vector_bytes + word_bytes + hashmap_overhead) as u64;
    
    // Total memory usage
    embedding_count as u64 * bytes_per_entry
}

/// Updates cache metrics after cache operation
///
/// Should be called after cache hits/misses/evictions to update statistics.
///
/// # Arguments
/// * `hit` - Whether the operation was a cache hit (true) or miss (false)
/// * `embedding_count` - Current total number of word embeddings in cache
pub fn update_cache_metrics(hit: bool, embedding_count: usize) {
    if hit {
        CACHE_METRICS.record_hit();
    } else {
        CACHE_METRICS.record_miss();
    }
    
    // Update memory usage estimate
    let memory_usage = estimate_memory_usage(embedding_count, None);
    CACHE_METRICS.update_memory_usage(memory_usage);
}

/// Records a cache eviction event
///
/// Should be called when items are removed from cache.
///
/// # Arguments
/// * `count` - Number of items evicted
pub fn record_eviction(count: usize) {
    for _ in 0..count {
        CACHE_METRICS.record_eviction();
    }
}

/// Retrieves extended cache statistics
///
/// Combines basic cache stats from the embeddings module with
/// performance metrics tracked by this module.
///
/// # Returns
/// Extended cache statistics including performance metrics
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

/// Resets cache performance metrics
///
/// This only resets the counters for hits and misses, not the actual cache content.
pub async fn reset_metrics() {
    CACHE_METRICS.reset().await;
}