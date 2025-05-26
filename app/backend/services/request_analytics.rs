//! Request analytics and monitoring service.
//!
//! This module provides functionality to track API usage patterns,
//! response times, and error rates for operational monitoring.

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures::future::{ready, LocalBoxFuture, Ready};
use log::{debug, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use utoipa::ToSchema;

/// Request analytics data structure
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RequestAnalytics {
    pub endpoint_stats: HashMap<String, EndpointStats>,
    pub error_stats: HashMap<u16, u64>,
    pub hourly_requests: Vec<HourlyRequestCount>,
    pub top_slow_endpoints: Vec<SlowEndpoint>,
    pub total_requests_24h: u64,
    pub average_response_time_ms: f64,
    pub error_rate_percent: f64,
    pub last_updated: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EndpointStats {
    pub path_pattern: String,
    pub method: String,
    pub request_count: u64,
    pub total_response_time_ms: u64,
    pub average_response_time_ms: f64,
    pub error_count: u64,
    pub last_accessed: u64,
    pub success_rate_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HourlyRequestCount {
    pub hour: u64,
    pub request_count: u64,
    pub error_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SlowEndpoint {
    pub path: String,
    pub method: String,
    pub average_response_time_ms: f64,
    pub request_count: u64,
}

/// Internal tracking structure
#[derive(Debug)]
struct RequestRecord {
    path: String,
    method: String,
    status_code: u16,
    response_time: Duration,
    timestamp: SystemTime,
}

/// Global analytics store
pub struct AnalyticsStore {
    records: Arc<RwLock<Vec<RequestRecord>>>,
    max_records: usize,
}

impl AnalyticsStore {
    pub fn new(max_records: usize) -> Self {
        Self {
            records: Arc::new(RwLock::new(Vec::with_capacity(max_records))),
            max_records,
        }
    }

    pub async fn record_request(
        &self,
        path: String,
        method: String,
        status_code: u16,
        response_time: Duration,
    ) {
        let mut records = self.records.write().await;
        
        let record = RequestRecord {
            path,
            method,
            status_code,
            response_time,
            timestamp: SystemTime::now(),
        };

        records.push(record);

        // Keep only recent records to prevent memory growth
        if records.len() > self.max_records {
            let remove_count = records.len() - self.max_records;
            records.drain(0..remove_count);
        }
    }

    pub async fn get_analytics(&self) -> RequestAnalytics {
        let records = self.records.read().await;
        let now = SystemTime::now();
        let twenty_four_hours_ago = now - Duration::from_secs(24 * 60 * 60);

        // Filter to last 24 hours
        let recent_records: Vec<_> = records
            .iter()
            .filter(|r| r.timestamp > twenty_four_hours_ago)
            .collect();

        let total_requests = recent_records.len() as u64;
        if total_requests == 0 {
            return RequestAnalytics {
                endpoint_stats: HashMap::new(),
                error_stats: HashMap::new(),
                hourly_requests: Vec::new(),
                top_slow_endpoints: Vec::new(),
                total_requests_24h: 0,
                average_response_time_ms: 0.0,
                error_rate_percent: 0.0,
                last_updated: now.duration_since(UNIX_EPOCH).unwrap().as_secs(),
            };
        }

        // Calculate endpoint statistics
        let mut endpoint_map: HashMap<String, Vec<&RequestRecord>> = HashMap::new();
        for record in &recent_records {
            let key = format!("{} {}", record.method, self.normalize_path(&record.path));
            endpoint_map.entry(key).or_default().push(record);
        }

        let mut endpoint_stats = HashMap::new();
        for (key, records) in endpoint_map {
            let parts: Vec<&str> = key.splitn(2, ' ').collect();
            let method = parts[0].to_string();
            let path = parts.get(1).unwrap_or(&"unknown").to_string();

            let request_count = records.len() as u64;
            let error_count = records.iter().filter(|r| r.status_code >= 400).count() as u64;
            let total_time: u64 = records.iter().map(|r| r.response_time.as_millis() as u64).sum();
            let average_time = total_time as f64 / request_count as f64;
            let success_rate = ((request_count - error_count) as f64 / request_count as f64) * 100.0;
            let last_accessed = records
                .iter()
                .map(|r| r.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs())
                .max()
                .unwrap_or(0);

            endpoint_stats.insert(key.clone(), EndpointStats {
                path_pattern: path,
                method,
                request_count,
                total_response_time_ms: total_time,
                average_response_time_ms: average_time,
                error_count,
                last_accessed,
                success_rate_percent: success_rate,
            });
        }

        // Calculate error statistics
        let mut error_stats = HashMap::new();
        for record in &recent_records {
            if record.status_code >= 400 {
                *error_stats.entry(record.status_code).or_insert(0) += 1;
            }
        }

        // Calculate hourly request counts
        let mut hourly_requests = Vec::new();
        for hour_offset in 0..24 {
            let hour_start = now - Duration::from_secs((hour_offset + 1) * 60 * 60);
            let hour_end = now - Duration::from_secs(hour_offset * 60 * 60);
            
            let hour_records: Vec<_> = recent_records
                .iter()
                .filter(|r| r.timestamp >= hour_start && r.timestamp < hour_end)
                .collect();

            let request_count = hour_records.len() as u64;
            let error_count = hour_records.iter().filter(|r| r.status_code >= 400).count() as u64;
            
            hourly_requests.push(HourlyRequestCount {
                hour: hour_start.duration_since(UNIX_EPOCH).unwrap().as_secs() / 3600,
                request_count,
                error_count,
            });
        }
        hourly_requests.reverse(); // Show oldest to newest

        // Calculate top slow endpoints
        let mut slow_endpoints: Vec<_> = endpoint_stats
            .values()
            .filter(|stats| stats.request_count >= 5) // Only consider endpoints with enough data
            .map(|stats| SlowEndpoint {
                path: stats.path_pattern.clone(),
                method: stats.method.clone(),
                average_response_time_ms: stats.average_response_time_ms,
                request_count: stats.request_count,
            })
            .collect();
        
        slow_endpoints.sort_by(|a, b| b.average_response_time_ms.partial_cmp(&a.average_response_time_ms).unwrap());
        slow_endpoints.truncate(10); // Top 10 slowest

        // Calculate overall metrics
        let total_response_time: u64 = recent_records.iter().map(|r| r.response_time.as_millis() as u64).sum();
        let average_response_time = total_response_time as f64 / total_requests as f64;
        let error_count = recent_records.iter().filter(|r| r.status_code >= 400).count() as u64;
        let error_rate = (error_count as f64 / total_requests as f64) * 100.0;

        RequestAnalytics {
            endpoint_stats,
            error_stats,
            hourly_requests,
            top_slow_endpoints: slow_endpoints,
            total_requests_24h: total_requests,
            average_response_time_ms: average_response_time,
            error_rate_percent: error_rate,
            last_updated: now.duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    fn normalize_path(&self, path: &str) -> String {
        // Normalize dynamic path segments to reduce noise
        let path = path.to_string();
        
        // Replace common ID patterns
        let patterns = [
            (r"/\d+", "/{id}"),
            (r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "/{uuid}"),
        ];
        
        let mut normalized = path;
        for (pattern, replacement) in patterns {
            if let Ok(re) = regex::Regex::new(pattern) {
                normalized = re.replace_all(&normalized, replacement).to_string();
            }
        }
        
        normalized
    }
}

// Global analytics store instance
use std::sync::OnceLock;
static ANALYTICS_STORE: OnceLock<AnalyticsStore> = OnceLock::new();

pub fn get_analytics_store() -> &'static AnalyticsStore {
    ANALYTICS_STORE.get_or_init(|| AnalyticsStore::new(10000)) // Keep last 10k requests
}

/// Middleware to track request analytics
pub struct RequestAnalyticsMiddleware;

impl<S, B> Transform<S, ServiceRequest> for RequestAnalyticsMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RequestAnalyticsService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequestAnalyticsService { service }))
    }
}

pub struct RequestAnalyticsService<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for RequestAnalyticsService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let start_time = Instant::now();
        let path = req.path().to_string();
        let method = req.method().to_string();
        
        let fut = self.service.call(req);

        Box::pin(async move {
            let result = fut.await;
            let response_time = start_time.elapsed();
            
            match &result {
                Ok(response) => {
                    let status_code = response.status().as_u16();
                    
                    // Clone path and method before moving into async closure
                    let path_clone = path.clone();
                    let method_clone = method.clone();
                    
                    // Record the request asynchronously
                    tokio::spawn(async move {
                        get_analytics_store()
                            .record_request(path_clone, method_clone, status_code, response_time)
                            .await;
                    });
                    
                    // Log slow requests (use original path and method here)
                    if response_time > Duration::from_millis(1000) {
                        warn!("Slow request: {} {} took {:?}", method, path, response_time);
                    } else {
                        debug!("Request: {} {} took {:?}", method, path, response_time);
                    }
                }
                Err(_) => {
                    // Record error
                    let path_clone = path.clone();
                    let method_clone = method.clone();
                    tokio::spawn(async move {
                        get_analytics_store()
                            .record_request(path_clone, method_clone, 500, response_time)
                            .await;
                    });
                }
            }
            
            result
        })
    }
}