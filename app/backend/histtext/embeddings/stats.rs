//! Statistics and monitoring for the embedding system.

use crate::histtext::embeddings::cache::get_cache_statistics;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Cache statistics for monitoring and debugging
#[derive(Debug, Serialize, Deserialize, ToSchema)]
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
    /// Current memory usage in bytes
    pub memory_usage_bytes: usize,
    /// Maximum memory limit in bytes
    pub memory_limit_bytes: usize,
    /// Memory usage as a percentage
    pub memory_usage_percent: f64,
    /// Cache hit ratio
    pub hit_ratio: f64,
    /// Total cache hits
    pub total_hits: u64,
    /// Total cache misses
    pub total_misses: u64,
    /// Total evictions performed
    pub total_evictions: u64,
    /// Last eviction timestamp
    pub last_eviction: Option<DateTime<Utc>>,
    /// Cache uptime in seconds
    pub uptime_seconds: i64,
}

/// Details about a single path cache entry
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PathCacheEntry {
    /// Path to embedding file
    pub path: String,
    /// Number of words in the embedding file
    pub size: usize,
    /// Last access time
    pub last_used: DateTime<Utc>,
    /// Memory usage in bytes
    pub memory_bytes: usize,
    /// Current reference count
    pub ref_count: usize,
    /// File format detected
    pub format: String,
    /// Loading time in milliseconds
    pub load_time_ms: Option<u64>,
}

/// Performance metrics for embedding operations
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PerformanceMetrics {
    /// Average similarity computation time in microseconds
    pub avg_similarity_time_us: f64,
    /// Average neighbor search time in milliseconds
    pub avg_search_time_ms: f64,
    /// Total similarity computations performed
    pub total_similarity_computations: u64,
    /// Total neighbor searches performed
    pub total_searches: u64,
    /// Peak memory usage recorded
    pub peak_memory_bytes: usize,
    /// Performance samples collected
    pub samples_collected: usize,
    /// Last performance reset
    pub last_reset: DateTime<Utc>,
}

/// System resource usage
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ResourceUsage {
    /// CPU usage percentage for embedding operations
    pub cpu_usage_percent: f64,
    /// Memory used by embedding system
    pub memory_used_bytes: usize,
    /// Memory available for embeddings
    pub memory_available_bytes: usize,
    /// Disk space used for embedding files
    pub disk_used_bytes: u64,
    /// Number of active threads
    pub active_threads: usize,
    /// Load average (1 minute)
    pub load_average: f64,
}

/// Comprehensive embedding system statistics
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct EmbeddingSystemStats {
    /// Cache-related statistics
    pub cache: CacheStats,
    /// Performance metrics
    pub performance: PerformanceMetrics,
    /// Resource usage
    pub resources: ResourceUsage,
    /// Timestamp when statistics were collected
    pub collected_at: DateTime<Utc>,
    /// System information
    pub system_info: SystemInfo,
}

/// System information
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SystemInfo {
    /// Number of CPU cores
    pub cpu_cores: usize,
    /// Total system memory in bytes
    pub total_memory_bytes: usize,
    /// Architecture (x86_64, aarch64, etc.)
    pub architecture: String,
    /// Operating system
    pub operating_system: String,
    /// Rust version used to build
    pub rust_version: String,
    /// Build timestamp
    pub build_timestamp: String,
}

/// Performance tracking for individual operations
static PERFORMANCE_TRACKER: std::sync::LazyLock<std::sync::Mutex<PerformanceTracker>> = 
    std::sync::LazyLock::new(|| std::sync::Mutex::new(PerformanceTracker::new()));

/// Internal performance tracking
struct PerformanceTracker {
    similarity_times: Vec<u64>, // in microseconds
    search_times: Vec<u64>,     // in milliseconds
    total_similarities: u64,
    total_searches: u64,
    peak_memory: usize,
    start_time: DateTime<Utc>,
}

impl PerformanceTracker {
    fn new() -> Self {
        Self {
            similarity_times: Vec::with_capacity(1000),
            search_times: Vec::with_capacity(1000),
            total_similarities: 0,
            total_searches: 0,
            peak_memory: 0,
            start_time: Utc::now(),
        }
    }

    fn record_similarity_time(&mut self, time_us: u64) {
        self.total_similarities += 1;
        
        // Keep only recent samples to avoid unbounded growth
        if self.similarity_times.len() >= 1000 {
            self.similarity_times.remove(0);
        }
        self.similarity_times.push(time_us);
    }

    fn record_search_time(&mut self, time_ms: u64) {
        self.total_searches += 1;
        
        if self.search_times.len() >= 1000 {
            self.search_times.remove(0);
        }
        self.search_times.push(time_ms);
    }

    fn update_peak_memory(&mut self, current_memory: usize) {
        if current_memory > self.peak_memory {
            self.peak_memory = current_memory;
        }
    }

    fn get_metrics(&self) -> PerformanceMetrics {
        let avg_similarity_time = if self.similarity_times.is_empty() {
            0.0
        } else {
            self.similarity_times.iter().sum::<u64>() as f64 / self.similarity_times.len() as f64
        };

        let avg_search_time = if self.search_times.is_empty() {
            0.0
        } else {
            self.search_times.iter().sum::<u64>() as f64 / self.search_times.len() as f64
        };

        PerformanceMetrics {
            avg_similarity_time_us: avg_similarity_time,
            avg_search_time_ms: avg_search_time,
            total_similarity_computations: self.total_similarities,
            total_searches: self.total_searches,
            peak_memory_bytes: self.peak_memory,
            samples_collected: self.similarity_times.len() + self.search_times.len(),
            last_reset: self.start_time,
        }
    }

    fn reset(&mut self) {
        self.similarity_times.clear();
        self.search_times.clear();
        self.total_similarities = 0;
        self.total_searches = 0;
        self.peak_memory = 0;
        self.start_time = Utc::now();
    }
}

/// Record performance metrics for similarity computation
pub fn record_similarity_time(duration: std::time::Duration) {
    if let Ok(mut tracker) = PERFORMANCE_TRACKER.lock() {
        tracker.record_similarity_time(duration.as_micros() as u64);
    }
}

/// Record performance metrics for neighbor search
pub fn record_search_time(duration: std::time::Duration) {
    if let Ok(mut tracker) = PERFORMANCE_TRACKER.lock() {
        tracker.record_search_time(duration.as_millis() as u64);
    }
}

/// Update peak memory usage
pub fn update_peak_memory(memory_bytes: usize) {
    if let Ok(mut tracker) = PERFORMANCE_TRACKER.lock() {
        tracker.update_peak_memory(memory_bytes);
    }
}

/// Reset performance metrics
pub fn reset_performance_metrics() {
    if let Ok(mut tracker) = PERFORMANCE_TRACKER.lock() {
        tracker.reset();
    }
}

/// Get current cache statistics
pub async fn get_cache_stats() -> CacheStats {
    let cache_stats = get_cache_statistics().await;
    let now = Utc::now();
    
    // Convert internal cache statistics to public format
    CacheStats {
        collection_cache_entries: 0, // This would need to be implemented in cache module
        path_cache_entries: cache_stats.entries_count,
        path_cache_details: vec![], // This would need detailed cache inspection
        total_embeddings_loaded: 0, // This would need to be tracked
        max_embeddings_files: (cache_stats.max_memory / (1024 * 1024 * 1024)).max(1), // Convert bytes to GB estimate
        memory_usage_bytes: cache_stats.memory_usage,
        memory_limit_bytes: cache_stats.max_memory,
        memory_usage_percent: cache_stats.memory_usage_ratio() * 100.0,
        hit_ratio: cache_stats.hit_ratio(),
        total_hits: cache_stats.hits,
        total_misses: cache_stats.misses,
        total_evictions: cache_stats.evictions,
        last_eviction: cache_stats.last_eviction.map(DateTime::from),
        uptime_seconds: now.timestamp() - now.timestamp(), // Placeholder - would need actual start time
    }
}

/// Get performance metrics
pub fn get_performance_metrics() -> PerformanceMetrics {
    PERFORMANCE_TRACKER
        .lock()
        .map(|tracker| tracker.get_metrics())
        .unwrap_or_else(|_| PerformanceMetrics {
            avg_similarity_time_us: 0.0,
            avg_search_time_ms: 0.0,
            total_similarity_computations: 0,
            total_searches: 0,
            peak_memory_bytes: 0,
            samples_collected: 0,
            last_reset: Utc::now(),
        })
}

/// Get system resource usage
pub fn get_resource_usage() -> ResourceUsage {
    // This would typically integrate with system monitoring libraries
    // For now, providing reasonable defaults
    let memory_info = get_memory_info();
    
    ResourceUsage {
        cpu_usage_percent: get_cpu_usage(),
        memory_used_bytes: memory_info.0,
        memory_available_bytes: memory_info.1,
        disk_used_bytes: get_disk_usage(),
        active_threads: get_thread_count(),
        load_average: get_load_average(),
    }
}

/// Get comprehensive system statistics
pub async fn get_system_stats() -> EmbeddingSystemStats {
    EmbeddingSystemStats {
        cache: get_cache_stats().await,
        performance: get_performance_metrics(),
        resources: get_resource_usage(),
        collected_at: Utc::now(),
        system_info: get_system_info(),
    }
}

/// Get system information
fn get_system_info() -> SystemInfo {
    SystemInfo {
        cpu_cores: num_cpus::get(),
        total_memory_bytes: get_total_memory(),
        architecture: std::env::consts::ARCH.to_string(),
        operating_system: std::env::consts::OS.to_string(),
        rust_version: env!("CARGO_PKG_RUST_VERSION").to_string(),
        build_timestamp: std::env::var("VERGEN_BUILD_TIMESTAMP").unwrap_or("unknown".to_string()),
    }
}

// Platform-specific system information functions
// These would be implemented using appropriate system libraries

#[cfg(target_os = "linux")]
fn get_memory_info() -> (usize, usize) {
    // Parse /proc/meminfo for accurate memory information
    if let Ok(meminfo) = std::fs::read_to_string("/proc/meminfo") {
        let mut total = 0;
        let mut available = 0;
        
        for line in meminfo.lines() {
            if line.starts_with("MemTotal:") {
                if let Some(kb) = line.split_whitespace().nth(1) {
                    total = kb.parse::<usize>().unwrap_or(0) * 1024; // Convert KB to bytes
                }
            } else if line.starts_with("MemAvailable:") {
                if let Some(kb) = line.split_whitespace().nth(1) {
                    available = kb.parse::<usize>().unwrap_or(0) * 1024;
                }
            }
        }
        
        (total - available, available)
    } else {
        (0, 0)
    }
}

#[cfg(not(target_os = "linux"))]
fn get_memory_info() -> (usize, usize) {
    // Fallback for non-Linux systems
    (0, 0)
}

fn get_cpu_usage() -> f64 {
    // This would require system-specific implementation
    0.0
}

fn get_disk_usage() -> u64 {
    // This would scan embedding directories for total size
    0
}

fn get_thread_count() -> usize {
    // This would count active threads in the thread pool
    num_cpus::get()
}

fn get_load_average() -> f64 {
    // This would read system load average
    0.0
}

fn get_total_memory() -> usize {
    // This would get total system memory
    0
}

/// Export cache statistics to a file for external monitoring
pub async fn export_cache_stats(file_path: &str) -> Result<(), std::io::Error> {
    let stats = get_system_stats().await;
    let json = serde_json::to_string_pretty(&stats)?;
    tokio::fs::write(file_path, json).await
}

/// Health check for the embedding system
#[derive(Debug, Serialize, ToSchema)]
pub struct HealthStatus {
    /// Overall system health
    pub status: String,
    /// Individual component statuses
    pub components: Vec<ComponentHealth>,
    /// Last health check
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ComponentHealth {
    /// Component name
    pub name: String,
    /// Health status (healthy, degraded, unhealthy)
    pub status: String,
    /// Optional message
    pub message: Option<String>,
}

/// Perform health check on the embedding system
pub async fn health_check() -> HealthStatus {
    let mut components = Vec::new();
    let mut overall_healthy = true;
    
    // Check cache health
    let cache_stats = get_cache_stats().await;
    let cache_status = if cache_stats.memory_usage_percent > 95.0 {
        overall_healthy = false;
        ComponentHealth {
            name: "cache".to_string(),
            status: "unhealthy".to_string(),
            message: Some("Memory usage too high".to_string()),
        }
    } else if cache_stats.memory_usage_percent > 80.0 {
        ComponentHealth {
            name: "cache".to_string(),
            status: "degraded".to_string(),
            message: Some("High memory usage".to_string()),
        }
    } else {
        ComponentHealth {
            name: "cache".to_string(),
            status: "healthy".to_string(),
            message: None,
        }
    };
    components.push(cache_status);
    
    // Check performance
    let perf_metrics = get_performance_metrics();
    let perf_status = if perf_metrics.avg_search_time_ms > 1000.0 {
        overall_healthy = false;
        ComponentHealth {
            name: "performance".to_string(),
            status: "unhealthy".to_string(),
            message: Some("Search times too slow".to_string()),
        }
    } else if perf_metrics.avg_search_time_ms > 500.0 {
        ComponentHealth {
            name: "performance".to_string(),
            status: "degraded".to_string(),
            message: Some("Slow search times".to_string()),
        }
    } else {
        ComponentHealth {
            name: "performance".to_string(),
            status: "healthy".to_string(),
            message: None,
        }
    };
    components.push(perf_status);
    
    HealthStatus {
        status: if overall_healthy { "healthy" } else { "unhealthy" }.to_string(),
        components,
        checked_at: Utc::now(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_performance_tracking() {
        record_similarity_time(Duration::from_micros(100));
        record_search_time(Duration::from_millis(50));
        
        let metrics = get_performance_metrics();
        assert!(metrics.total_similarity_computations > 0);
        assert!(metrics.total_searches > 0);
    }

    #[test]
    fn test_memory_update() {
        update_peak_memory(1024 * 1024); // 1MB
        let metrics = get_performance_metrics();
        assert!(metrics.peak_memory_bytes >= 1024 * 1024);
    }

    #[tokio::test]
    async fn test_health_check() {
        let health = health_check().await;
        assert!(!health.status.is_empty());
        assert!(!health.components.is_empty());
    }
}