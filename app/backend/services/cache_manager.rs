use dashmap::DashMap;
use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::interval;

pub struct CacheManager {
    cache: DashMap<String, CacheEntry>,
    hit_count: AtomicU64,
    miss_count: AtomicU64,
    eviction_count: Arc<AtomicU64>,
    max_size: usize,
    ttl: Duration,
}

#[derive(Clone)]
struct CacheEntry {
    value: Value,
    created_at: Instant,
    last_accessed: Instant,
    access_count: u64,
}

impl CacheManager {
    pub fn new(max_size: usize, ttl_seconds: u64) -> Self {
        let eviction_count = Arc::new(AtomicU64::new(0));

        let manager = Self {
            cache: DashMap::new(),
            hit_count: AtomicU64::new(0),
            miss_count: AtomicU64::new(0),
            eviction_count: eviction_count.clone(),
            max_size,
            ttl: Duration::from_secs(ttl_seconds),
        };

        let cache_clone = manager.cache.clone();
        let ttl_clone = manager.ttl;
        let eviction_count_clone = eviction_count.clone();

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(300));
            loop {
                interval.tick().await;
                Self::cleanup_expired(&cache_clone, ttl_clone, &eviction_count_clone);
            }
        });

        manager
    }

    pub fn get(&self, key: &str) -> Option<Value> {
        if let Some(mut entry) = self.cache.get_mut(key) {
            if entry.created_at.elapsed() < self.ttl {
                entry.last_accessed = Instant::now();
                entry.access_count += 1;
                self.hit_count.fetch_add(1, Ordering::Relaxed);
                return Some(entry.value.clone());
            } else {
                drop(entry);
                self.cache.remove(key);
                self.eviction_count.fetch_add(1, Ordering::Relaxed);
            }
        }

        self.miss_count.fetch_add(1, Ordering::Relaxed);
        None
    }

    pub fn put(&self, key: String, value: Value) {
        if self.cache.len() >= self.max_size {
            self.evict_lru();
        }

        let entry = CacheEntry {
            value,
            created_at: Instant::now(),
            last_accessed: Instant::now(),
            access_count: 1,
        };

        self.cache.insert(key, entry);
    }

    pub fn clear(&self) {
        let size = self.cache.len();
        self.cache.clear();
        self.eviction_count
            .fetch_add(size as u64, Ordering::Relaxed);
    }

    pub fn size(&self) -> usize {
        self.cache.len()
    }

    pub fn stats(&self) -> CacheStats {
        CacheStats {
            size: self.cache.len(),
            hit_count: self.hit_count.load(Ordering::Relaxed),
            miss_count: self.miss_count.load(Ordering::Relaxed),
            eviction_count: self.eviction_count.load(Ordering::Relaxed),
            hit_rate: {
                let hits = self.hit_count.load(Ordering::Relaxed);
                let total = hits + self.miss_count.load(Ordering::Relaxed);
                if total > 0 {
                    hits as f64 / total as f64
                } else {
                    0.0
                }
            },
        }
    }

    fn evict_lru(&self) {
        let mut oldest_key: Option<String> = None;
        let mut oldest_time = Instant::now();

        for entry in self.cache.iter() {
            if entry.value().last_accessed < oldest_time {
                oldest_time = entry.value().last_accessed;
                oldest_key = Some(entry.key().clone());
            }
        }

        if let Some(key) = oldest_key {
            self.cache.remove(&key);
            self.eviction_count.fetch_add(1, Ordering::Relaxed);
        }
    }

    fn cleanup_expired(
        cache: &DashMap<String, CacheEntry>,
        ttl: Duration,
        eviction_count: &Arc<AtomicU64>,
    ) {
        let now = Instant::now();
        let mut expired_keys = Vec::new();

        for entry in cache.iter() {
            if now.duration_since(entry.value().created_at) > ttl {
                expired_keys.push(entry.key().clone());
            }
        }

        let count = expired_keys.len();
        for key in expired_keys {
            cache.remove(&key);
        }

        if count > 0 {
            eviction_count.fetch_add(count as u64, Ordering::Relaxed);
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct CacheStats {
    pub size: usize,
    pub hit_count: u64,
    pub miss_count: u64,
    pub eviction_count: u64,
    pub hit_rate: f64,
}
