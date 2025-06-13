use dashmap::DashMap;
use log::{debug, info};
use serde_json::Value;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;

#[derive(Debug)]
struct CachedQuery {
    result: Value,
    created_at: SystemTime,
    last_accessed: RwLock<SystemTime>,
    access_count: RwLock<u64>,
}

impl CachedQuery {
    fn new(result: Value) -> Self {
        let now = SystemTime::now();
        Self {
            result,
            created_at: now,
            last_accessed: RwLock::new(now),
            access_count: RwLock::new(0),
        }
    }

    async fn touch(&self) -> Value {
        *self.last_accessed.write().await = SystemTime::now();
        *self.access_count.write().await += 1;
        self.result.clone()
    }

    async fn is_expired(&self, ttl_seconds: u64) -> bool {
        let last_access = *self.last_accessed.read().await;
        SystemTime::now()
            .duration_since(last_access)
            .map(|d| d.as_secs() > ttl_seconds)
            .unwrap_or(true)
    }

    async fn get_access_count(&self) -> u64 {
        *self.access_count.read().await
    }
}

static QUERY_CACHE: std::sync::LazyLock<DashMap<String, Arc<CachedQuery>>> =
    std::sync::LazyLock::new(DashMap::new);

pub async fn get_cached_query(cache_key: &str, ttl_seconds: u64) -> Option<Value> {
    if let Some(cached) = QUERY_CACHE.get(cache_key) {
        if !cached.is_expired(ttl_seconds).await {
            debug!("Query cache hit for key: {}", cache_key);
            return Some(cached.touch().await);
        } else {
            // Remove expired entry
            QUERY_CACHE.remove(cache_key);
            debug!("Removed expired query cache entry: {}", cache_key);
        }
    }

    debug!("Query cache miss for key: {}", cache_key);
    None
}

pub async fn cache_query_result(cache_key: String, result: Value) {
    let cached_query = Arc::new(CachedQuery::new(result));
    QUERY_CACHE.insert(cache_key.clone(), cached_query);
    debug!("Cached query result with key: {}", cache_key);

    // Trigger cleanup if cache is getting large
    if QUERY_CACHE.len() > 1000 {
        tokio::spawn(async move {
            cleanup_expired_queries().await;
        });
    }
}

pub async fn cleanup_expired_queries() {
    let ttl_seconds = {
        use crate::models::app_configurations::AppConfigurations;
        use crate::services::database::Database;
        use actix_web::web;

        let db = Database::new();
        let db_data = web::Data::new(db);

        crate::services::crud::execute_db_query(db_data, |conn| {
            Ok(
                AppConfigurations::get_number_value(conn, "cache_ttl_seconds", 3600i64)
                    as u64,
            )
        })
        .await
        .unwrap_or(3600u64)
    };

    let mut expired_keys = Vec::new();

    for entry in QUERY_CACHE.iter() {
        let (key, cached) = entry.pair();
        if cached.is_expired(ttl_seconds).await {
            expired_keys.push(key.clone());
        }
    }

    for key in &expired_keys {
        QUERY_CACHE.remove(key);
    }

    if !expired_keys.is_empty() {
        info!(
            "Cleaned up {} expired query cache entries",
            expired_keys.len()
        );
    }
}

pub async fn get_cache_stats() -> serde_json::Value {
    let cache_size = QUERY_CACHE.len();
    let mut total_access_count = 0u64;
    let mut active_entries = 0;

    let ttl_seconds = {
        use crate::models::app_configurations::AppConfigurations;
        use crate::services::database::Database;
        use actix_web::web;

        let db = Database::new();
        let db_data = web::Data::new(db);

        crate::services::crud::execute_db_query(db_data, |conn| {
            Ok(
                AppConfigurations::get_number_value(conn, "cache_ttl_seconds", 3600i64)
                    as u64,
            )
        })
        .await
        .unwrap_or(3600u64)
    };

    for entry in QUERY_CACHE.iter() {
        let cached = entry.value();
        if !cached.is_expired(ttl_seconds).await {
            active_entries += 1;
            total_access_count += cached.get_access_count().await;
        }
    }

    serde_json::json!({
        "total_entries": cache_size,
        "active_entries": active_entries,
        "expired_entries": cache_size - active_entries,
        "total_access_count": total_access_count,
        "ttl_seconds": ttl_seconds
    })
}

pub async fn clear_query_cache() {
    let cache_size = QUERY_CACHE.len();
    QUERY_CACHE.clear();
    info!("Cleared {} query cache entries", cache_size);
}
