use crate::histtext::embeddings::cache::get_cache_statistics;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CacheStats {
    pub collection_cache_entries: usize,
    pub path_cache_entries: usize,
    pub path_cache_details: Vec<PathCacheEntry>,
    pub total_embeddings_loaded: usize,
    pub max_embeddings_files: usize,
    pub memory_usage_bytes: usize,
    pub memory_limit_bytes: usize,
    pub memory_usage_percent: f64,
    pub hit_ratio: f64,
    pub total_hits: u64,
    pub total_misses: u64,
    pub total_evictions: u64,
    pub last_eviction: Option<DateTime<Utc>>,
    pub uptime_seconds: i64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PathCacheEntry {
    pub path: String,
    pub size: usize,
    pub last_used: DateTime<Utc>,
    pub memory_bytes: usize,
    pub ref_count: usize,
    pub format: String,
    pub load_time_ms: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PerformanceMetrics {
    pub avg_similarity_time_us: f64,
    pub avg_search_time_ms: f64,
    pub total_similarity_computations: u64,
    pub total_searches: u64,
    pub peak_memory_bytes: usize,
    pub samples_collected: usize,
    pub last_reset: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ResourceUsage {
    pub cpu_usage_percent: f64,
    pub memory_used_bytes: usize,
    pub memory_available_bytes: usize,
    pub disk_used_bytes: u64,
    pub active_threads: usize,
    pub load_average: f64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct EmbeddingSystemStats {
    pub cache: CacheStats,
    pub performance: PerformanceMetrics,
    pub resources: ResourceUsage,
    pub collected_at: DateTime<Utc>,
    pub system_info: SystemInfo,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SystemInfo {
    pub cpu_cores: usize,
    pub total_memory_bytes: usize,
    pub architecture: String,
    pub operating_system: String,
    pub rust_version: String,
    pub build_timestamp: String,
}

static PERFORMANCE_TRACKER: std::sync::LazyLock<std::sync::Mutex<PerformanceTracker>> = 
    std::sync::LazyLock::new(|| std::sync::Mutex::new(PerformanceTracker::new()));

struct PerformanceTracker {
    similarity_times: Vec<u64>,
    search_times: Vec<u64>,
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

pub fn record_similarity_time(duration: std::time::Duration) {
    if let Ok(mut tracker) = PERFORMANCE_TRACKER.lock() {
        tracker.record_similarity_time(duration.as_micros() as u64);
    }
}

pub fn record_search_time(duration: std::time::Duration) {
    if let Ok(mut tracker) = PERFORMANCE_TRACKER.lock() {
        tracker.record_search_time(duration.as_millis() as u64);
    }
}

pub fn update_peak_memory(memory_bytes: usize) {
    if let Ok(mut tracker) = PERFORMANCE_TRACKER.lock() {
        tracker.update_peak_memory(memory_bytes);
    }
}

pub fn reset_performance_metrics() {
    if let Ok(mut tracker) = PERFORMANCE_TRACKER.lock() {
        tracker.reset();
    }
}

pub async fn get_cache_stats() -> CacheStats {
    let cache_stats = get_cache_statistics().await;
    let now = Utc::now();
    
    CacheStats {
        collection_cache_entries: 0,
        path_cache_entries: cache_stats.entries_count,
        path_cache_details: vec![],
        total_embeddings_loaded: 0,
        max_embeddings_files: (cache_stats.max_memory / (1024 * 1024 * 1024)).max(1),
        memory_usage_bytes: cache_stats.memory_usage,
        memory_limit_bytes: cache_stats.max_memory,
        memory_usage_percent: cache_stats.memory_usage_ratio() * 100.0,
        hit_ratio: cache_stats.hit_ratio(),
        total_hits: cache_stats.hits,
        total_misses: cache_stats.misses,
        total_evictions: cache_stats.evictions,
        last_eviction: cache_stats.last_eviction.map(DateTime::from),
        uptime_seconds: now.timestamp() - now.timestamp(),
    }
}

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

pub fn get_resource_usage() -> ResourceUsage {
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

pub async fn get_system_stats() -> EmbeddingSystemStats {
    EmbeddingSystemStats {
        cache: get_cache_stats().await,
        performance: get_performance_metrics(),
        resources: get_resource_usage(),
        collected_at: Utc::now(),
        system_info: get_system_info(),
    }
}

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

#[cfg(target_os = "linux")]
fn get_memory_info() -> (usize, usize) {
    if let Ok(meminfo) = std::fs::read_to_string("/proc/meminfo") {
        let mut total = 0;
        let mut available = 0;
        
        for line in meminfo.lines() {
            if line.starts_with("MemTotal:") {
                if let Some(kb) = line.split_whitespace().nth(1) {
                    total = kb.parse::<usize>().unwrap_or(0) * 1024;
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
    (0, 0)
}

fn get_cpu_usage() -> f64 {
    0.0
}

fn get_disk_usage() -> u64 {
    0
}

fn get_thread_count() -> usize {
    num_cpus::get()
}

fn get_load_average() -> f64 {
    0.0
}

fn get_total_memory() -> usize {
    0
}

pub async fn export_cache_stats(file_path: &str) -> Result<(), std::io::Error> {
    let stats = get_system_stats().await;
    let json = serde_json::to_string_pretty(&stats)?;
    tokio::fs::write(file_path, json).await
}

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthStatus {
    pub status: String,
    pub components: Vec<ComponentHealth>,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ComponentHealth {
    pub name: String,
    pub status: String,
    pub message: Option<String>,
}

pub async fn health_check() -> HealthStatus {
    let mut components = Vec::new();
    let mut overall_healthy = true;
    
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