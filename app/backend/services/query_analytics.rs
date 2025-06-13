//! Query analytics service.
//!
//! This module provides functionality to track search query patterns,
//! performance metrics, and optimization insights for Solr operations.

use crate::services::request_analytics::get_user_display_name;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use utoipa::ToSchema;

/// Query analytics data structure
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QueryAnalytics {
    pub top_queries: Vec<TopQuery>,
    pub query_performance: QueryPerformance,
    pub search_trends: SearchTrends,
    pub optimization_insights: OptimizationInsights,
    pub user_search_behavior: UserSearchBehavior,
    pub last_updated: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QueryUser {
    pub user_id: i32,
    pub username: String,
    pub query_count: u64,
    pub last_query: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TopQuery {
    pub query: String,
    pub frequency: u64,
    pub avg_response_time_ms: f64,
    pub result_count_avg: f64,
    pub success_rate_percent: f64,
    pub unique_users: u64,
    pub user_list: Vec<QueryUser>,
    pub peak_usage_hour: u8,
    pub collections: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QueryPerformance {
    pub slow_queries: Vec<SlowQuery>,
    pub failed_queries: Vec<FailedQuery>,
    pub optimization_suggestions: Vec<String>,
    pub index_usage_stats: HashMap<String, IndexUsageStats>,
    pub response_time_distribution: ResponseTimeDistribution,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SlowQuery {
    pub query: String,
    pub avg_response_time_ms: f64,
    pub frequency: u64,
    pub collection: String,
    pub optimization_potential: f64, // 0-100 score
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FailedQuery {
    pub query: String,
    pub error_message: String,
    pub frequency: u64,
    pub last_failure: u64,
    pub collection: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct IndexUsageStats {
    pub field_name: String,
    pub query_frequency: u64,
    pub performance_score: f64,
    pub cardinality_estimate: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ResponseTimeDistribution {
    pub very_fast: u64, // < 100ms
    pub fast: u64,      // 100-500ms
    pub moderate: u64,  // 500ms-2s
    pub slow: u64,      // 2s-10s
    pub very_slow: u64, // > 10s
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SearchTrends {
    pub popular_collections: Vec<CollectionUsage>,
    pub emerging_topics: Vec<EmergingTopic>,
    pub seasonal_patterns: HashMap<String, f64>,
    pub query_complexity_trends: QueryComplexityTrends,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CollectionUsage {
    pub collection_name: String,
    pub query_count: u64,
    pub unique_users: u64,
    pub avg_response_time_ms: f64,
    pub growth_rate_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EmergingTopic {
    pub topic: String,
    pub frequency_growth: f64,
    pub related_queries: Vec<String>,
    pub first_seen: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QueryComplexityTrends {
    pub simple_queries_percent: f64,   // Single term
    pub moderate_queries_percent: f64, // 2-5 terms
    pub complex_queries_percent: f64,  // > 5 terms or advanced operators
    pub avg_terms_per_query: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OptimizationInsights {
    pub cache_effectiveness: CacheEffectiveness,
    pub index_optimization_opportunities: Vec<IndexOptimization>,
    pub query_rewrite_suggestions: Vec<QueryRewriteSuggestion>,
    pub resource_utilization: ResourceUtilization,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CacheEffectiveness {
    pub hit_rate_percent: f64,
    pub cache_size_mb: f64,
    pub eviction_rate: f64,
    pub most_cached_queries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct IndexOptimization {
    pub field_name: String,
    pub optimization_type: String,
    pub potential_improvement: f64,
    pub implementation_effort: String, // "Low", "Medium", "High"
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QueryRewriteSuggestion {
    pub original_query: String,
    pub suggested_query: String,
    pub performance_improvement_percent: f64,
    pub confidence_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ResourceUtilization {
    pub cpu_usage_percent: f64,
    pub memory_usage_percent: f64,
    pub disk_io_rate: f64,
    pub concurrent_queries_avg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserSearchBehavior {
    pub query_refinement_patterns: Vec<QueryRefinementPattern>,
    pub session_search_depth: SessionSearchDepth,
    pub search_abandonment_rate: f64,
    pub most_productive_search_patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QueryRefinementPattern {
    pub pattern_name: String,
    pub frequency: u64,
    pub success_rate_percent: f64,
    pub example_sequence: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionSearchDepth {
    pub avg_queries_per_session: f64,
    pub single_query_sessions_percent: f64,
    pub deep_search_sessions_percent: f64, // > 10 queries
    pub max_queries_in_session: u64,
}

/// Internal tracking structures
#[derive(Debug, Clone)]
pub struct QueryRecord {
    pub query: String,
    pub collection: String,
    pub user_id: Option<i32>,
    pub session_id: String,
    pub response_time_ms: u64,
    pub result_count: u64,
    pub success: bool,
    pub error_message: Option<String>,
    pub timestamp: SystemTime,
    pub query_type: QueryType,
    pub filters_used: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum QueryType {
    Simple,   // Single term
    Moderate, // 2-5 terms
    Complex,  // Advanced operators, many terms
    Faceted,  // Using facets
    Filtered, // Using filters
}

/// Query analytics store
pub struct QueryAnalyticsStore {
    queries: Arc<RwLock<Vec<QueryRecord>>>,
    max_queries: usize,
}

impl QueryAnalyticsStore {
    pub fn new(max_queries: usize) -> Self {
        Self {
            queries: Arc::new(RwLock::new(Vec::with_capacity(max_queries))),
            max_queries,
        }
    }

    pub async fn record_query(
        &self,
        query: String,
        collection: String,
        user_id: Option<i32>,
        session_id: String,
        response_time_ms: u64,
        result_count: u64,
        success: bool,
        error_message: Option<String>,
        filters_used: Vec<String>,
    ) {
        let mut queries = self.queries.write().await;

        let query_type = self.classify_query_type(&query, &filters_used);

        let record = QueryRecord {
            query,
            collection,
            user_id,
            session_id,
            response_time_ms,
            result_count,
            success,
            error_message,
            timestamp: SystemTime::now(),
            query_type,
            filters_used,
        };

        queries.push(record);

        // Keep only recent queries to prevent memory growth
        if queries.len() > self.max_queries {
            let remove_count = queries.len() - self.max_queries;
            queries.drain(0..remove_count);
        }
    }

    fn classify_query_type(&self, query: &str, filters: &[String]) -> QueryType {
        if !filters.is_empty() {
            return QueryType::Filtered;
        }

        let term_count = query.split_whitespace().count();
        let has_operators = query.contains(':')
            || query.contains('"')
            || query.contains("AND")
            || query.contains("OR")
            || query.contains("NOT")
            || query.contains('*')
            || query.contains('?');

        if has_operators || term_count > 5 {
            QueryType::Complex
        } else if term_count > 1 {
            QueryType::Moderate
        } else {
            QueryType::Simple
        }
    }

    pub async fn get_query_analytics(&self) -> QueryAnalytics {
        let queries = self.queries.read().await;
        let now = SystemTime::now();
        let seven_days_ago = now - Duration::from_secs(7 * 24 * 60 * 60);

        // Filter to last 7 days for most analytics
        let recent_queries: Vec<_> = queries
            .iter()
            .filter(|q| q.timestamp > seven_days_ago)
            .collect();

        if recent_queries.is_empty() {
            return QueryAnalytics {
                top_queries: Vec::new(),
                query_performance: QueryPerformance {
                    slow_queries: Vec::new(),
                    failed_queries: Vec::new(),
                    optimization_suggestions: Vec::new(),
                    index_usage_stats: HashMap::new(),
                    response_time_distribution: ResponseTimeDistribution {
                        very_fast: 0,
                        fast: 0,
                        moderate: 0,
                        slow: 0,
                        very_slow: 0,
                    },
                },
                search_trends: SearchTrends {
                    popular_collections: Vec::new(),
                    emerging_topics: Vec::new(),
                    seasonal_patterns: HashMap::new(),
                    query_complexity_trends: QueryComplexityTrends {
                        simple_queries_percent: 0.0,
                        moderate_queries_percent: 0.0,
                        complex_queries_percent: 0.0,
                        avg_terms_per_query: 0.0,
                    },
                },
                optimization_insights: OptimizationInsights {
                    cache_effectiveness: CacheEffectiveness {
                        hit_rate_percent: 0.0,
                        cache_size_mb: 0.0,
                        eviction_rate: 0.0,
                        most_cached_queries: Vec::new(),
                    },
                    index_optimization_opportunities: Vec::new(),
                    query_rewrite_suggestions: Vec::new(),
                    resource_utilization: ResourceUtilization {
                        cpu_usage_percent: 0.0,
                        memory_usage_percent: 0.0,
                        disk_io_rate: 0.0,
                        concurrent_queries_avg: 0.0,
                    },
                },
                user_search_behavior: UserSearchBehavior {
                    query_refinement_patterns: Vec::new(),
                    session_search_depth: SessionSearchDepth {
                        avg_queries_per_session: 0.0,
                        single_query_sessions_percent: 0.0,
                        deep_search_sessions_percent: 0.0,
                        max_queries_in_session: 0,
                    },
                    search_abandonment_rate: 0.0,
                    most_productive_search_patterns: Vec::new(),
                },
                last_updated: now.duration_since(UNIX_EPOCH).unwrap().as_secs(),
            };
        }

        let top_queries = self.calculate_top_queries(&recent_queries).await;
        let query_performance = self.calculate_query_performance(&recent_queries);
        let search_trends = self.calculate_search_trends(&recent_queries);
        let optimization_insights = self.calculate_optimization_insights(&recent_queries);
        let user_search_behavior = self.calculate_user_search_behavior(&recent_queries);

        QueryAnalytics {
            top_queries,
            query_performance,
            search_trends,
            optimization_insights,
            user_search_behavior,
            last_updated: now.duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    async fn calculate_top_queries(&self, queries: &[&QueryRecord]) -> Vec<TopQuery> {
        let mut query_stats: HashMap<
            String,
            (
                Vec<&QueryRecord>,
                std::collections::HashSet<i32>,
                std::collections::HashSet<String>,
            ),
        > = HashMap::new();

        for query in queries {
            let (records, users, collections) = query_stats.entry(query.query.clone()).or_default();
            records.push(query);
            if let Some(user_id) = query.user_id {
                users.insert(user_id);
            }
            collections.insert(query.collection.clone());
        }

        let mut top_queries = Vec::new();
        for (query_text, (records, users, collections)) in query_stats {
            if records.len() < 2 {
                continue;
            } // At least 2 occurrences

            let frequency = records.len() as u64;
            let avg_response_time =
                records.iter().map(|r| r.response_time_ms).sum::<u64>() as f64 / frequency as f64;
            let avg_result_count =
                records.iter().map(|r| r.result_count).sum::<u64>() as f64 / frequency as f64;
            let success_rate =
                (records.iter().filter(|r| r.success).count() as f64 / frequency as f64) * 100.0;
            let unique_users = users.len() as u64;

            // Calculate peak usage hour
            let mut hourly_usage = HashMap::new();
            for record in &records {
                let hour = (record
                    .timestamp
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs()
                    / 3600)
                    % 24;
                *hourly_usage.entry(hour as u8).or_insert(0u64) += 1;
            }
            let peak_usage_hour = hourly_usage
                .into_iter()
                .max_by_key(|(_, count)| *count)
                .map(|(hour, _)| hour)
                .unwrap_or(12);

            // Build user list with real information
            let mut user_list = Vec::new();
            for &user_id in &users {
                let user_records: Vec<_> = records
                    .iter()
                    .filter(|r| r.user_id == Some(user_id))
                    .collect();
                let query_count = user_records.len() as u64;
                let last_query = user_records
                    .iter()
                    .map(|r| r.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs())
                    .max()
                    .unwrap_or(0);

                // Get real username
                let username = match get_user_display_name(user_id).await {
                    Ok(display_name) => display_name,
                    Err(_) => format!("User {}", user_id),
                };

                user_list.push(QueryUser {
                    user_id,
                    username,
                    query_count,
                    last_query,
                });
            }

            // Sort users by query count (most active first)
            user_list.sort_by(|a, b| b.query_count.cmp(&a.query_count));

            top_queries.push(TopQuery {
                query: query_text,
                frequency,
                avg_response_time_ms: avg_response_time,
                result_count_avg: avg_result_count,
                success_rate_percent: success_rate,
                unique_users,
                user_list,
                peak_usage_hour,
                collections: collections.into_iter().collect(),
            });
        }

        top_queries.sort_by(|a, b| b.frequency.cmp(&a.frequency));
        top_queries.truncate(20); // Top 20 queries
        top_queries
    }

    fn calculate_query_performance(&self, queries: &[&QueryRecord]) -> QueryPerformance {
        // Calculate slow queries
        let mut slow_queries: Vec<_> = queries
            .iter()
            .filter(|q| q.response_time_ms > 2000) // > 2 seconds
            .fold(
                HashMap::new(),
                |mut acc: HashMap<String, Vec<&QueryRecord>>, query| {
                    acc.entry(query.query.clone()).or_default().push(query);
                    acc
                },
            )
            .into_iter()
            .map(|(query_text, records)| {
                let frequency = records.len() as u64;
                let avg_response_time = records.iter().map(|r| r.response_time_ms).sum::<u64>()
                    as f64
                    / frequency as f64;
                let collection = records[0].collection.clone();
                let optimization_potential = (avg_response_time / 10000.0).min(100.0); // Simple scoring

                SlowQuery {
                    query: query_text,
                    avg_response_time_ms: avg_response_time,
                    frequency,
                    collection,
                    optimization_potential,
                }
            })
            .collect();
        slow_queries.sort_by(|a, b| {
            b.avg_response_time_ms
                .partial_cmp(&a.avg_response_time_ms)
                .unwrap()
        });
        slow_queries.truncate(10);

        // Calculate failed queries
        let mut failed_queries: Vec<_> = queries
            .iter()
            .filter(|q| !q.success)
            .fold(
                HashMap::new(),
                |mut acc: HashMap<String, Vec<&QueryRecord>>, query| {
                    acc.entry(query.query.clone()).or_default().push(query);
                    acc
                },
            )
            .into_iter()
            .map(|(query_text, records)| {
                let frequency = records.len() as u64;
                let last_failure = records
                    .iter()
                    .map(|r| r.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs())
                    .max()
                    .unwrap_or(0);
                let error_message = records
                    .iter()
                    .find_map(|r| r.error_message.as_ref())
                    .unwrap_or(&"Unknown error".to_string())
                    .clone();
                let collection = records[0].collection.clone();

                FailedQuery {
                    query: query_text,
                    error_message,
                    frequency,
                    last_failure,
                    collection,
                }
            })
            .collect();
        failed_queries.sort_by(|a, b| b.frequency.cmp(&a.frequency));
        failed_queries.truncate(10);

        // Calculate response time distribution
        let mut response_time_distribution = ResponseTimeDistribution {
            very_fast: 0,
            fast: 0,
            moderate: 0,
            slow: 0,
            very_slow: 0,
        };

        for query in queries {
            match query.response_time_ms {
                0..=99 => response_time_distribution.very_fast += 1,
                100..=499 => response_time_distribution.fast += 1,
                500..=1999 => response_time_distribution.moderate += 1,
                2000..=9999 => response_time_distribution.slow += 1,
                _ => response_time_distribution.very_slow += 1,
            }
        }

        // Generate optimization suggestions
        let mut optimization_suggestions = Vec::new();
        if slow_queries.len() > 3 {
            optimization_suggestions
                .push("Consider adding indexes for frequently slow queries".to_string());
        }
        if failed_queries.len() > 5 {
            optimization_suggestions
                .push("Review query syntax validation and error handling".to_string());
        }
        if response_time_distribution.very_slow > 10 {
            optimization_suggestions
                .push("Investigate very slow queries for potential optimization".to_string());
        }

        QueryPerformance {
            slow_queries,
            failed_queries,
            optimization_suggestions,
            index_usage_stats: HashMap::new(), // Would need Solr schema analysis
            response_time_distribution,
        }
    }

    fn calculate_search_trends(&self, queries: &[&QueryRecord]) -> SearchTrends {
        // Calculate popular collections
        let mut collection_stats: HashMap<String, (u64, std::collections::HashSet<i32>, Vec<u64>)> =
            HashMap::new();

        for query in queries {
            let (count, users, response_times) = collection_stats
                .entry(query.collection.clone())
                .or_default();
            *count += 1;
            if let Some(user_id) = query.user_id {
                users.insert(user_id);
            }
            response_times.push(query.response_time_ms);
        }

        let mut popular_collections: Vec<_> = collection_stats
            .into_iter()
            .map(|(collection_name, (query_count, users, response_times))| {
                let unique_users = users.len() as u64;
                let avg_response_time_ms = if response_times.is_empty() {
                    0.0
                } else {
                    response_times.iter().sum::<u64>() as f64 / response_times.len() as f64
                };

                let growth_rate = self.calculate_growth_rate(&collection_name, &queries);
                CollectionUsage {
                    collection_name,
                    query_count,
                    unique_users,
                    avg_response_time_ms,
                    growth_rate_percent: growth_rate,
                }
            })
            .collect();
        popular_collections.sort_by(|a, b| b.query_count.cmp(&a.query_count));
        popular_collections.truncate(10);

        // Calculate query complexity trends
        let total_queries = queries.len() as f64;
        let simple_count = queries
            .iter()
            .filter(|q| matches!(q.query_type, QueryType::Simple))
            .count() as f64;
        let moderate_count = queries
            .iter()
            .filter(|q| matches!(q.query_type, QueryType::Moderate))
            .count() as f64;
        let complex_count = queries
            .iter()
            .filter(|q| {
                matches!(
                    q.query_type,
                    QueryType::Complex | QueryType::Filtered | QueryType::Faceted
                )
            })
            .count() as f64;

        let avg_terms_per_query = if total_queries > 0.0 {
            queries
                .iter()
                .map(|q| q.query.split_whitespace().count() as f64)
                .sum::<f64>()
                / total_queries
        } else {
            0.0
        };

        let query_complexity_trends = QueryComplexityTrends {
            simple_queries_percent: (simple_count / total_queries) * 100.0,
            moderate_queries_percent: (moderate_count / total_queries) * 100.0,
            complex_queries_percent: (complex_count / total_queries) * 100.0,
            avg_terms_per_query,
        };

        SearchTrends {
            popular_collections,
            emerging_topics: Vec::new(),       // Would need NLP analysis
            seasonal_patterns: HashMap::new(), // Would need longer-term data
            query_complexity_trends,
        }
    }

    fn calculate_optimization_insights(&self, queries: &[&QueryRecord]) -> OptimizationInsights {
        // Calculate cache effectiveness based on query patterns
        let total_queries = queries.len() as f64;
        let fast_queries = queries.iter().filter(|q| q.response_time_ms < 100).count() as f64;
        let hit_rate = if total_queries > 0.0 {
            (fast_queries / total_queries) * 100.0
        } else {
            0.0
        };

        // Calculate estimated cache size based on query complexity
        let avg_query_length = if total_queries > 0.0 {
            queries.iter().map(|q| q.query.len()).sum::<usize>() as f64 / total_queries
        } else {
            0.0
        };
        let estimated_cache_size = (total_queries * avg_query_length * 0.001).min(2048.0); // Rough estimate in MB

        let cache_effectiveness = CacheEffectiveness {
            hit_rate_percent: hit_rate,
            cache_size_mb: estimated_cache_size,
            eviction_rate: if total_queries > 1000.0 { 0.05 } else { 0.01 },
            most_cached_queries: queries
                .iter()
                .filter(|q| q.response_time_ms < 50) // Very fast queries are likely cached
                .map(|q| q.query.clone())
                .collect::<std::collections::HashSet<_>>() // Remove duplicates
                .into_iter()
                .take(5)
                .collect(),
        };

        // Calculate resource utilization based on query patterns
        let avg_response_time = if total_queries > 0.0 {
            queries.iter().map(|q| q.response_time_ms).sum::<u64>() as f64 / total_queries
        } else {
            0.0
        };

        let resource_utilization = ResourceUtilization {
            cpu_usage_percent: (avg_response_time / 10.0).min(100.0), // Rough estimate
            memory_usage_percent: (estimated_cache_size / 16.0).min(100.0), // Assume 16GB total
            disk_io_rate: queries.iter().map(|q| q.result_count).sum::<u64>() as f64 / 1000.0, // Rough estimate
            concurrent_queries_avg: if total_queries > 0.0 {
                (total_queries / 24.0 / 60.0).max(1.0)
            } else {
                0.0
            }, // Estimates per minute
        };

        OptimizationInsights {
            cache_effectiveness,
            index_optimization_opportunities: Vec::new(),
            query_rewrite_suggestions: Vec::new(),
            resource_utilization,
        }
    }

    fn calculate_user_search_behavior(&self, queries: &[&QueryRecord]) -> UserSearchBehavior {
        // Calculate session search depth
        let mut session_query_counts: HashMap<String, u64> = HashMap::new();
        for query in queries {
            *session_query_counts
                .entry(query.session_id.clone())
                .or_insert(0) += 1;
        }

        let total_sessions = session_query_counts.len() as f64;
        let avg_queries_per_session = if total_sessions > 0.0 {
            session_query_counts.values().sum::<u64>() as f64 / total_sessions
        } else {
            0.0
        };

        let single_query_sessions = session_query_counts
            .values()
            .filter(|&&count| count == 1)
            .count() as f64;
        let deep_search_sessions = session_query_counts
            .values()
            .filter(|&&count| count > 10)
            .count() as f64;
        let max_queries_in_session = session_query_counts.values().max().copied().unwrap_or(0);

        let session_search_depth = SessionSearchDepth {
            avg_queries_per_session,
            single_query_sessions_percent: (single_query_sessions / total_sessions) * 100.0,
            deep_search_sessions_percent: (deep_search_sessions / total_sessions) * 100.0,
            max_queries_in_session,
        };

        // Calculate search abandonment rate based on zero-result queries
        let total_queries = queries.len() as f64;
        let zero_result_queries = queries.iter().filter(|q| q.result_count == 0).count() as f64;
        let abandonment_rate = if total_queries > 0.0 {
            (zero_result_queries / total_queries) * 100.0
        } else {
            0.0
        };

        // Calculate most productive search patterns based on high result queries
        let mut pattern_counts: std::collections::HashMap<String, u32> =
            std::collections::HashMap::new();
        for q in queries.iter().filter(|q| q.result_count > 10) {
            let pattern = if q.filters_used.is_empty() {
                "direct search".to_string()
            } else if q.filters_used.len() == 1 {
                format!(
                    "{} → filter",
                    if q.query.contains(' ') {
                        "complex query"
                    } else {
                        "keyword"
                    }
                )
            } else {
                "keyword → multiple filters".to_string()
            };
            *pattern_counts.entry(pattern).or_insert(0) += 1;
        }

        let productive_patterns: Vec<String> = pattern_counts
            .into_iter()
            .map(|(pattern, _count)| pattern)
            .take(3)
            .collect();

        UserSearchBehavior {
            query_refinement_patterns: Vec::new(), // Would need sequence analysis
            session_search_depth,
            search_abandonment_rate: abandonment_rate,
            most_productive_search_patterns: if productive_patterns.is_empty() {
                vec!["No productive patterns yet".to_string()]
            } else {
                productive_patterns
            },
        }
    }

    fn calculate_growth_rate(&self, collection_name: &str, queries: &[&QueryRecord]) -> f64 {
        let now = SystemTime::now();
        let seven_days_ago = now - Duration::from_secs(7 * 24 * 60 * 60);
        let fourteen_days_ago = now - Duration::from_secs(14 * 24 * 60 * 60);

        // Count queries in last 7 days vs previous 7 days
        let recent_count = queries
            .iter()
            .filter(|q| q.collection == collection_name && q.timestamp > seven_days_ago)
            .count() as f64;

        let previous_count = queries
            .iter()
            .filter(|q| {
                q.collection == collection_name
                    && q.timestamp > fourteen_days_ago
                    && q.timestamp <= seven_days_ago
            })
            .count() as f64;

        if previous_count == 0.0 {
            if recent_count > 0.0 {
                100.0
            } else {
                0.0
            } // New collection or no data
        } else {
            ((recent_count - previous_count) / previous_count) * 100.0
        }
    }
}

// Global query analytics store instance
use std::sync::OnceLock;
static QUERY_ANALYTICS_STORE: OnceLock<QueryAnalyticsStore> = OnceLock::new();

pub fn get_query_analytics_store() -> &'static QueryAnalyticsStore {
    QUERY_ANALYTICS_STORE.get_or_init(|| QueryAnalyticsStore::new(25000)) // Keep last 25k queries
}

impl QueryAnalyticsStore {
    /// Simplified method for middleware integration
    pub async fn record_search_query(
        &self,
        query: String,
        response_time: Duration,
        success: bool,
        user_id: i32,
        session_id: String,
    ) {
        self.record_query(
            query,
            "unknown".to_string(), // Collection would be extracted from request
            Some(user_id),
            session_id,
            response_time.as_millis() as u64,
            0, // Result count unknown from middleware
            success,
            if success {
                None
            } else {
                Some("Request failed".to_string())
            },
            Vec::new(), // Filters unknown from middleware
        )
        .await;
    }
}

/// Helper function to record query from handlers
pub async fn record_query(
    query: String,
    collection: String,
    user_id: Option<i32>,
    session_id: String,
    response_time_ms: u64,
    result_count: u64,
    success: bool,
    error_message: Option<String>,
    filters_used: Vec<String>,
) {
    get_query_analytics_store()
        .record_query(
            query,
            collection,
            user_id,
            session_id,
            response_time_ms,
            result_count,
            success,
            error_message,
            filters_used,
        )
        .await;
}
