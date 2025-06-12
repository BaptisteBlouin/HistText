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
use crate::services::database::Database;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq, Hash)]
pub enum ErrorType {
    #[serde(rename = "timeout")]
    Timeout,
    #[serde(rename = "validation")]
    Validation,
    #[serde(rename = "database")]
    Database,
    #[serde(rename = "external")]
    External,
    #[serde(rename = "authentication")]
    Authentication,
    #[serde(rename = "authorization")]
    Authorization,
    #[serde(rename = "rate_limit")]
    RateLimit,
    #[serde(rename = "server_error")]
    ServerError,
    #[serde(rename = "client_error")]
    ClientError,
    #[serde(rename = "unknown")]
    Unknown,
}

/// Error context for detailed tracking
#[derive(Debug, Clone)]
pub struct ErrorContext {
    pub error_type: ErrorType,
    pub error_message: Option<String>,
    pub user_agent: Option<String>,
    pub user_id: Option<i32>,
    pub username: Option<String>,
}

/// Request analytics data structure
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RequestAnalytics {
    pub endpoint_stats: HashMap<String, EndpointStats>,
    pub error_stats: HashMap<u16, u64>,
    pub enhanced_error_tracking: EnhancedErrorTracking,
    pub hourly_requests: Vec<HourlyRequestCount>,
    pub top_slow_endpoints: Vec<SlowEndpoint>,
    pub total_requests_24h: u64,
    pub average_response_time_ms: f64,
    pub error_rate_percent: f64,
    pub last_updated: u64,
}

/// Enhanced error tracking with detailed categorization
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EnhancedErrorTracking {
    pub error_details: Vec<ErrorDetail>,
    pub error_patterns: ErrorPatterns,
    pub top_failing_endpoints: Vec<FailingEndpoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ErrorDetail {
    pub endpoint: String,
    pub error_type: ErrorType,
    pub error_message: String,
    pub frequency: u64,
    pub first_occurrence: u64,
    pub last_occurrence: u64,
    pub affected_users: u64,
    pub affected_user_list: Vec<AffectedUser>,
    pub status_code: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AffectedUser {
    pub user_id: i32,
    pub username: String,
    pub error_count: u64,
    pub last_error: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ErrorPatterns {
    pub time_of_day_correlation: HashMap<u8, u64>,
    pub user_agent_correlation: HashMap<String, u64>,
    pub endpoint_correlation: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FailingEndpoint {
    pub endpoint: String,
    pub method: String,
    pub error_count: u64,
    pub total_requests: u64,
    pub failure_rate_percent: f64,
    pub most_common_error: String,
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
    error_type: Option<ErrorType>,
    error_message: Option<String>,
    user_agent: Option<String>,
    user_id: Option<i32>,
    username: Option<String>,
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
        error_context: Option<ErrorContext>,
    ) {
        let mut records = self.records.write().await;
        
        let record = RequestRecord {
            path,
            method,
            status_code,
            response_time,
            timestamp: SystemTime::now(),
            error_type: error_context.as_ref().map(|ctx| ctx.error_type.clone()),
            error_message: error_context.as_ref().and_then(|ctx| ctx.error_message.clone()),
            user_agent: error_context.as_ref().and_then(|ctx| ctx.user_agent.clone()),
            user_id: error_context.as_ref().and_then(|ctx| ctx.user_id),
            username: error_context.as_ref().and_then(|ctx| ctx.username.clone()),
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
                enhanced_error_tracking: EnhancedErrorTracking {
                    error_details: Vec::new(),
                    error_patterns: ErrorPatterns {
                        time_of_day_correlation: HashMap::new(),
                        user_agent_correlation: HashMap::new(),
                        endpoint_correlation: HashMap::new(),
                    },
                    top_failing_endpoints: Vec::new(),
                },
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

        // Calculate enhanced error tracking
        let enhanced_error_tracking = self.calculate_enhanced_error_tracking(&recent_records).await;

        RequestAnalytics {
            endpoint_stats,
            error_stats,
            enhanced_error_tracking,
            hourly_requests,
            top_slow_endpoints: slow_endpoints,
            total_requests_24h: total_requests,
            average_response_time_ms: average_response_time,
            error_rate_percent: error_rate,
            last_updated: now.duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    async fn calculate_enhanced_error_tracking(&self, recent_records: &[&RequestRecord]) -> EnhancedErrorTracking {
        let error_records: Vec<_> = recent_records
            .iter()
            .filter(|r| r.status_code >= 400)
            .collect();

        // Calculate error details grouped by endpoint and error type
        let mut error_groups: HashMap<(String, ErrorType), Vec<&RequestRecord>> = HashMap::new();
        for record in error_records.iter() {
            let normalized_path = self.normalize_path(&record.path);
            let endpoint = format!("{} {}", record.method, normalized_path);
            let error_type = record.error_type.clone().unwrap_or(self.classify_error_type(record.status_code));
            error_groups.entry((endpoint, error_type)).or_default().push(record);
        }

        let mut error_details = Vec::new();
        for ((endpoint, error_type), records) in error_groups {
            let frequency = records.len() as u64;
            let first_occurrence = records
                .iter()
                .map(|r| r.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs())
                .min()
                .unwrap_or(0);
            let last_occurrence = records
                .iter()
                .map(|r| r.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs())
                .max()
                .unwrap_or(0);
            // Calculate affected users with detailed information
            let mut user_error_counts: HashMap<i32, (String, u64, u64)> = HashMap::new(); // user_id -> (username, error_count, last_error)
            for record in &records {
                if let (Some(user_id), Some(username)) = (record.user_id, &record.username) {
                    let last_error = record.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs();
                    let entry = user_error_counts.entry(user_id).or_insert((username.clone(), 0, last_error));
                    entry.1 += 1; // increment error count
                    if last_error > entry.2 {
                        entry.2 = last_error; // update last error time
                    }
                }
            }
            
            let affected_users = user_error_counts.len() as u64;
            // Get real user display names
            let user_ids: Vec<i32> = user_error_counts.keys().cloned().collect();
            let mut user_display_names = HashMap::new();
            for user_id in user_ids {
                if let Ok(display_name) = get_user_display_name(user_id).await {
                    user_display_names.insert(user_id, display_name);
                } else {
                    user_display_names.insert(user_id, format!("User {}", user_id));
                }
            }
            
            let affected_user_list: Vec<AffectedUser> = user_error_counts
                .into_iter()
                .map(|(user_id, (_username, error_count, last_error))| AffectedUser {
                    user_id,
                    username: user_display_names.get(&user_id).cloned().unwrap_or_else(|| format!("User {}", user_id)),
                    error_count,
                    last_error,
                })
                .collect();
            let status_code = records[0].status_code;
            let error_message = records
                .iter()
                .find_map(|r| r.error_message.as_ref())
                .unwrap_or(&format!("HTTP {}", status_code))
                .clone();

            error_details.push(ErrorDetail {
                endpoint,
                error_type,
                error_message,
                frequency,
                first_occurrence,
                last_occurrence,
                affected_users,
                affected_user_list,
                status_code,
            });
        }

        // Calculate error patterns
        let mut time_of_day_correlation = HashMap::new();
        let mut user_agent_correlation = HashMap::new();
        let mut endpoint_correlation = HashMap::new();

        for record in error_records.iter() {
            // Time of day correlation (hour of day)
            let hour = (record.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs() / 3600) % 24;
            *time_of_day_correlation.entry(hour as u8).or_insert(0) += 1;

            // User agent correlation
            if let Some(user_agent) = &record.user_agent {
                *user_agent_correlation.entry(user_agent.clone()).or_insert(0) += 1;
            }

            // Endpoint correlation
            let normalized_endpoint = format!("{} {}", record.method, self.normalize_path(&record.path));
            *endpoint_correlation.entry(normalized_endpoint).or_insert(0) += 1;
        }

        // Calculate top failing endpoints
        let mut endpoint_failure_stats: HashMap<String, (u64, u64)> = HashMap::new(); // (errors, total)
        for record in recent_records.iter() {
            let normalized_endpoint = format!("{} {}", record.method, self.normalize_path(&record.path));
            let (errors, total) = endpoint_failure_stats.entry(normalized_endpoint).or_insert((0, 0));
            *total += 1;
            if record.status_code >= 400 {
                *errors += 1;
            }
        }

        let mut top_failing_endpoints: Vec<_> = endpoint_failure_stats
            .into_iter()
            .filter(|(_, (errors, total))| *errors > 0 && *total >= 5) // Min 5 requests and at least 1 error
            .map(|(endpoint, (error_count, total_requests))| {
                let failure_rate = (error_count as f64 / total_requests as f64) * 100.0;
                let most_common_error = error_details
                    .iter()
                    .find(|ed| ed.endpoint == endpoint)
                    .map(|ed| ed.error_message.clone())
                    .unwrap_or_else(|| "Unknown error".to_string());

                let parts: Vec<&str> = endpoint.splitn(2, ' ').collect();
                let method = parts[0].to_string();
                let endpoint_path = parts.get(1).unwrap_or(&"unknown").to_string();

                FailingEndpoint {
                    endpoint: endpoint_path,
                    method,
                    error_count,
                    total_requests,
                    failure_rate_percent: failure_rate,
                    most_common_error,
                }
            })
            .collect();

        top_failing_endpoints.sort_by(|a, b| b.failure_rate_percent.partial_cmp(&a.failure_rate_percent).unwrap());
        top_failing_endpoints.truncate(10); // Top 10 failing endpoints

        EnhancedErrorTracking {
            error_details,
            error_patterns: ErrorPatterns {
                time_of_day_correlation,
                user_agent_correlation,
                endpoint_correlation,
            },
            top_failing_endpoints,
        }
    }

    fn classify_error_type(&self, status_code: u16) -> ErrorType {
        match status_code {
            401 => ErrorType::Authentication,
            403 => ErrorType::Authorization,
            429 => ErrorType::RateLimit,
            400..=499 => ErrorType::ClientError,
            500..=599 => ErrorType::ServerError,
            _ => ErrorType::Unknown,
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
pub struct RequestAnalyticsMiddleware {
    pub db: Option<Arc<Database>>,
}

impl Default for RequestAnalyticsMiddleware {
    fn default() -> Self {
        Self { db: None }
    }
}

impl RequestAnalyticsMiddleware {
    pub fn new() -> Self {
        Self { db: None }
    }
    
    pub fn with_db(db: Arc<Database>) -> Self {
        Self { db: Some(db) }
    }
}

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
        
        // Extract user information from request
        let user_agent = req.headers()
            .get("user-agent")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string());
            
        // Try to extract user information from JWT token
        let (user_id, username) = req.headers()
            .get("authorization")
            .and_then(|h| h.to_str().ok())
            .and_then(|auth_header| {
                if let Some(token) = auth_header.strip_prefix("Bearer ") {
                    // Try to decode JWT token to get real user ID
                    use jsonwebtoken::{decode, DecodingKey, Validation};
                    use crate::services::auth::AccessTokenClaims;
                    use crate::config::Config;
                    
                    let config = Config::global();
                    // Use a more lenient validation for analytics purposes (ignore expiration)
                    let mut validation = Validation::default();
                    validation.validate_exp = false; // Don't validate expiration for analytics
                    
                    if let Ok(token_data) = decode::<AccessTokenClaims>(
                        token,
                        &DecodingKey::from_secret(config.secret_key.as_ref()),
                        &validation,
                    ) {
                        let user_id = token_data.claims.sub;
                        debug!("Extracted user_id {} from JWT for analytics", user_id);
                        // We'll look up the real name during analytics recording
                        let username = format!("User {}", user_id);
                        Some((user_id, username))
                    } else {
                        debug!("Failed to decode JWT token for analytics");
                        None
                    }
                } else {
                    None
                }
            })
            .or_else(|| {
                // If no Authorization header, try to extract from refresh token cookie (for /api/auth/refresh)
                if path == "/api/auth/refresh" {
                    use crate::services::auth::COOKIE_NAME;
                    use jsonwebtoken::{decode, DecodingKey, Validation};
                    use crate::services::auth::RefreshTokenClaims;
                    use crate::config::Config;
                    
                    req.cookie(COOKIE_NAME)
                        .and_then(|cookie| {
                            let config = Config::global();
                            let mut validation = Validation::default();
                            validation.validate_exp = false; // Don't validate expiration for analytics
                            
                            if let Ok(token_data) = decode::<RefreshTokenClaims>(
                                cookie.value(),
                                &DecodingKey::from_secret(config.secret_key.as_ref()),
                                &validation,
                            ) {
                                let user_id = token_data.claims.sub;
                                debug!("Extracted user_id {} from refresh token cookie for analytics", user_id);
                                let username = format!("User {}", user_id);
                                Some((user_id, username))
                            } else {
                                debug!("Failed to decode refresh token cookie for analytics");
                                None
                            }
                        })
                } else {
                    None
                }
            })
            .unwrap_or((0, "Anonymous".to_string()));
        
        let user_id = if user_id > 0 { Some(user_id) } else { None };

        // Extract session ID from cookies
        let session_id = req.headers()
            .get("cookie")
            .and_then(|h| h.to_str().ok())
            .and_then(|cookies| {
                for cookie in cookies.split(';') {
                    let cookie = cookie.trim();
                    if cookie.starts_with("session_id=") {
                        return Some(cookie[11..].to_string());
                    }
                }
                None
            })
            .unwrap_or_else(|| format!("anonymous_{}", start_time.elapsed().as_nanos()));
        
        let fut = self.service.call(req);

        Box::pin(async move {
            let result = fut.await;
            let response_time = start_time.elapsed();
            
            match &result {
                Ok(response) => {
                    let status_code = response.status().as_u16();
                    let _success = status_code < 400;
                    
                    // Clone data before moving into async closure
                    let path_clone = path.clone();
                    let method_clone = method.clone();
                    let user_agent_clone = user_agent.clone();
                    let username_clone = if user_id.is_some() { Some(username.clone()) } else { None };
                    let _session_id_clone = session_id.clone();
                    
                    // Record the request asynchronously
                    tokio::spawn(async move {
                        // Record request analytics
                        let error_context = if status_code >= 400 {
                            Some(ErrorContext {
                                error_type: match status_code {
                                    401 => ErrorType::Authentication,
                                    403 => ErrorType::Authorization,
                                    429 => ErrorType::RateLimit,
                                    400..=499 => ErrorType::ClientError,
                                    500..=599 => ErrorType::ServerError,
                                    _ => ErrorType::Unknown,
                                },
                                error_message: Some(format!("HTTP {}", status_code)),
                                user_agent: user_agent_clone.clone(),
                                user_id,
                                username: username_clone.clone(),
                            })
                        } else {
                            None
                        };

                        get_analytics_store()
                            .record_request(path_clone.clone(), method_clone.clone(), status_code, response_time, error_context)
                            .await;

                        // TODO: Integrate with other analytics services
                        // For now, only collect basic request analytics
                        // Full integration will be added in separate commits
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
                    let user_agent_clone = user_agent.clone();
                    let username_clone = if user_id.is_some() { Some(username.clone()) } else { None };
                    tokio::spawn(async move {
                        get_analytics_store()
                            .record_request(path_clone, method_clone, 500, response_time, Some(ErrorContext {
                                error_type: ErrorType::ServerError,
                                error_message: Some("Request processing failed".to_string()),
                                user_agent: user_agent_clone,
                                user_id,
                                username: username_clone,
                            }))
                            .await;
                    });
                }
            }
            
            result
        })
    }
}

/// User display info cache with TTL
static USER_CACHE: OnceLock<Arc<RwLock<HashMap<i32, (String, SystemTime)>>>> = OnceLock::new();
const CACHE_TTL_SECONDS: u64 = 300; // 5 minutes

fn get_user_cache() -> &'static Arc<RwLock<HashMap<i32, (String, SystemTime)>>> {
    USER_CACHE.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

/// Get user display name from database with caching
pub async fn get_user_display_name(user_id: i32) -> Result<String, String> {
    // Check cache first
    {
        let cache = get_user_cache().read().await;
        if let Some((display_name, cached_at)) = cache.get(&user_id) {
            let now = SystemTime::now();
            if now.duration_since(*cached_at).unwrap_or(Duration::from_secs(CACHE_TTL_SECONDS + 1)).as_secs() < CACHE_TTL_SECONDS {
                return Ok(display_name.clone());
            }
        }
    }
    
    // Fetch from database
    let display_name = fetch_user_from_db(user_id).await;
    
    // Check if fetch was successful (doesn't start with "User ")
    if display_name.starts_with("User ") && display_name != format!("User {}", user_id) {
        return Err(format!("Failed to fetch user {}", user_id));
    }
    
    // Update cache
    {
        let mut cache = get_user_cache().write().await;
        cache.insert(user_id, (display_name.clone(), SystemTime::now()));
        
        // Clean old entries (simple cleanup)
        if cache.len() > 1000 {
            let now = SystemTime::now();
            cache.retain(|_, (_, cached_at)| {
                now.duration_since(*cached_at).unwrap_or(Duration::from_secs(CACHE_TTL_SECONDS + 1)).as_secs() < CACHE_TTL_SECONDS
            });
        }
    }
    
    Ok(display_name)
}

async fn fetch_user_from_db(user_id: i32) -> String {
    use diesel::prelude::*;
    use crate::schema::users::dsl::*;
    
    // Get database URL from environment
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost/historicaltext".to_string());
    
    // Spawn blocking task for database operation
    let result = tokio::task::spawn_blocking(move || {
        match PgConnection::establish(&db_url) {
            Ok(mut conn) => {
                let user_result: Result<(String, String, String), diesel::result::Error> = users
                    .select((email, firstname, lastname))
                    .filter(id.eq(user_id))
                    .first(&mut conn);
                    
                match user_result {
                    Ok((user_email, first_name, last_name)) => {
                        if !first_name.trim().is_empty() && !last_name.trim().is_empty() {
                            format!("{} {} <{}>", first_name.trim(), last_name.trim(), user_email)
                        } else if !first_name.trim().is_empty() {
                            format!("{} <{}>", first_name.trim(), user_email)
                        } else {
                            user_email
                        }
                    }
                    Err(_) => format!("User {}", user_id),
                }
            }
            Err(_) => format!("User {}", user_id),
        }
    }).await;
    
    result.unwrap_or_else(|_| format!("User {}", user_id))
}

/// Extract collection name from request path
fn extract_collection_from_path(path: &str) -> Option<String> {
    // Extract collection name from various path patterns
    if let Some(collection_param) = path.split("collection=").nth(1) {
        // From query parameter: ?collection=name
        if let Some(collection_name) = collection_param.split('&').next() {
            return Some(collection_name.to_string());
        }
    }
    
    if path.contains("/solr/") {
        // From path: /api/solr/collection_name/...
        let parts: Vec<&str> = path.split('/').collect();
        if let Some(solr_index) = parts.iter().position(|&x| x == "solr") {
            if solr_index + 1 < parts.len() {
                return Some(parts[solr_index + 1].to_string());
            }
        }
    }
    
    None
}