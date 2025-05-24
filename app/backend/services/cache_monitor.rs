use crate::histtext::embeddings;
use actix_web::{web, HttpResponse, Responder};
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use utoipa::ToSchema;
use crate::histtext::embeddings::stats::reset_performance_metrics;
use crate::histtext::embeddings::{cache, stats};
use serde_json::json;
use log::info;

#[derive(Debug, Serialize, ToSchema)]
pub struct AdvancedCacheResponse {
    pub cache: CacheInfo,
    pub performance: PerformanceInfo,
    pub system_info: SystemInfo,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CacheInfo {
    pub entries_count: usize,
    pub memory_usage: usize,
    pub max_memory: usize,
    pub hit_ratio: f64,
    pub total_hits: u64,
    pub total_misses: u64,
    pub total_evictions: u64,
    pub total_embeddings_loaded: usize,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PerformanceInfo {
    pub avg_similarity_time_us: f64,
    pub avg_search_time_ms: f64,
    pub total_similarity_computations: u64,
    pub total_searches: u64,
    pub peak_memory_bytes: usize,
    pub samples_collected: usize,
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
        (status = 200, description = "Comprehensive cache statistics and performance metrics", body = AdvancedCacheResponse)
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_cache_stats_advanced() -> impl Responder {
    let cache_stats = cache::get_cache_statistics().await;
    let performance_metrics = stats::get_performance_metrics();
    let system_info = stats::get_system_info();
    
    let response = AdvancedCacheResponse {
        cache: CacheInfo {
            entries_count: cache_stats.entries_count,
            memory_usage: cache_stats.memory_usage,
            max_memory: cache_stats.max_memory,
            hit_ratio: cache_stats.hit_ratio(),
            total_hits: cache_stats.hits,
            total_misses: cache_stats.misses,
            total_evictions: cache_stats.evictions,
            total_embeddings_loaded: cache_stats.total_embeddings_loaded,
        },
        performance: PerformanceInfo {
            avg_similarity_time_us: performance_metrics.avg_similarity_time_us,
            avg_search_time_ms: performance_metrics.avg_search_time_ms,
            total_similarity_computations: performance_metrics.total_similarity_computations,
            total_searches: performance_metrics.total_searches,
            peak_memory_bytes: performance_metrics.peak_memory_bytes,
            samples_collected: performance_metrics.samples_collected,
        },
        system_info: SystemInfo {
            cpu_cores: system_info.cpu_cores,
            total_memory_bytes: system_info.total_memory_bytes,
            architecture: system_info.architecture,
            operating_system: system_info.operating_system,
        },
        timestamp: Utc::now(),
    };
    
    HttpResponse::Ok().json(response)
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