//! Collection usage intelligence service.
//!
//! This module provides comprehensive analytics about Solr collection usage,
//! performance optimization insights, and resource management recommendations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use utoipa::ToSchema;
use crate::services::request_analytics::get_user_display_name;

/// Collection intelligence analytics data structure
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CollectionIntelligence {
    pub usage_metrics: Vec<CollectionUsageMetrics>,
    pub optimization_insights: CollectionOptimizationInsights,
    pub resource_allocation: ResourceAllocation,
    pub growth_projections: GrowthProjections,
    pub health_assessment: HealthAssessment,
    pub last_updated: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CollectionUser {
    pub user_id: i32,
    pub username: String,
    pub usage_count: u64,
    pub last_access: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CollectionUsageMetrics {
    pub collection_name: String,
    pub query_frequency: u64,
    pub unique_users: u64,
    pub user_list: Vec<CollectionUser>,
    pub data_volume_gb: f64,
    pub document_count: u64,
    pub user_engagement_score: f64,
    pub performance_score: f64,
    pub growth_rate_7d: f64,
    pub growth_rate_30d: f64,
    pub peak_usage_patterns: PeakUsagePatterns,
    pub feature_utilization: FeatureUtilization,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PeakUsagePatterns {
    pub peak_hour: u8,
    pub peak_day_of_week: u8, // 0=Sunday, 1=Monday, etc.
    pub seasonal_trends: HashMap<String, f64>,
    pub usage_intensity: UsageIntensity,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UsageIntensity {
    pub queries_per_hour_avg: f64,
    pub queries_per_hour_peak: f64,
    pub concurrent_users_avg: f64,
    pub concurrent_users_peak: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FeatureUtilization {
    pub faceting_usage_percent: f64,
    pub filtering_usage_percent: f64,
    pub sorting_usage_percent: f64,
    pub highlighting_usage_percent: f64,
    pub geospatial_usage_percent: f64,
    pub advanced_query_usage_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CollectionOptimizationInsights {
    pub underutilized_collections: Vec<UnderutilizedCollection>,
    pub high_maintenance_collections: Vec<HighMaintenanceCollection>,
    pub migration_candidates: Vec<MigrationCandidate>,
    pub performance_optimization_opportunities: Vec<PerformanceOptimization>,
    pub cost_optimization_recommendations: Vec<CostOptimization>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UnderutilizedCollection {
    pub collection_name: String,
    pub utilization_score: f64, // 0-100
    pub reasons: Vec<String>,
    pub recommendations: Vec<String>,
    pub potential_savings: PotentialSavings,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HighMaintenanceCollection {
    pub collection_name: String,
    pub maintenance_score: f64, // 0-100, higher = more maintenance needed
    pub issues: Vec<MaintenanceIssue>,
    pub priority: MaintenancePriority,
    pub estimated_effort_hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub enum MaintenancePriority {
    #[serde(rename = "critical")]
    Critical,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "low")]
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MaintenanceIssue {
    pub issue_type: String,
    pub description: String,
    pub severity: String,
    pub impact_on_performance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MigrationCandidate {
    pub collection_name: String,
    pub migration_type: MigrationType,
    pub benefits: Vec<String>,
    pub risks: Vec<String>,
    pub estimated_effort: String,
    pub roi_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub enum MigrationType {
    #[serde(rename = "archive")]
    Archive,
    #[serde(rename = "consolidate")]
    Consolidate,
    #[serde(rename = "split")]
    Split,
    #[serde(rename = "upgrade")]
    Upgrade,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PerformanceOptimization {
    pub collection_name: String,
    pub optimization_type: String,
    pub current_performance: f64,
    pub projected_improvement: f64,
    pub implementation_complexity: String,
    pub prerequisites: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CostOptimization {
    pub collection_name: String,
    pub optimization_strategy: String,
    pub current_cost_score: f64,
    pub projected_savings_percent: f64,
    pub implementation_steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PotentialSavings {
    pub storage_gb: f64,
    pub compute_resources_percent: f64,
    pub maintenance_hours_per_month: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ResourceAllocation {
    pub current_allocation: CurrentAllocation,
    pub recommended_allocation: RecommendedAllocation,
    pub rebalancing_opportunities: Vec<RebalancingOpportunity>,
    pub capacity_planning: CapacityPlanning,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CurrentAllocation {
    pub total_storage_gb: f64,
    pub total_memory_gb: f64,
    pub total_cpu_cores: f64,
    pub collections_by_resource_usage: Vec<ResourceUsageByCollection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendedAllocation {
    pub storage_optimizations: Vec<StorageOptimization>,
    pub memory_optimizations: Vec<MemoryOptimization>,
    pub cpu_optimizations: Vec<CpuOptimization>,
    pub total_potential_savings: ResourceSavings,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ResourceUsageByCollection {
    pub collection_name: String,
    pub storage_gb: f64,
    pub memory_gb: f64,
    pub cpu_utilization_percent: f64,
    pub efficiency_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StorageOptimization {
    pub collection_name: String,
    pub current_storage_gb: f64,
    pub optimized_storage_gb: f64,
    pub compression_ratio: f64,
    pub optimization_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MemoryOptimization {
    pub collection_name: String,
    pub current_memory_gb: f64,
    pub recommended_memory_gb: f64,
    pub cache_optimization_potential: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CpuOptimization {
    pub collection_name: String,
    pub current_cpu_utilization: f64,
    pub recommended_cpu_allocation: f64,
    pub optimization_strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ResourceSavings {
    pub storage_savings_gb: f64,
    pub memory_savings_gb: f64,
    pub cpu_savings_percent: f64,
    pub cost_savings_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RebalancingOpportunity {
    pub opportunity_type: String,
    pub affected_collections: Vec<String>,
    pub expected_improvement: f64,
    pub implementation_complexity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CapacityPlanning {
    pub current_capacity_utilization: f64,
    pub projected_capacity_needs: ProjectedCapacityNeeds,
    pub scaling_recommendations: Vec<ScalingRecommendation>,
    pub bottleneck_analysis: BottleneckAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProjectedCapacityNeeds {
    pub storage_needs_3m: f64,
    pub storage_needs_6m: f64,
    pub storage_needs_12m: f64,
    pub query_load_growth_3m: f64,
    pub query_load_growth_6m: f64,
    pub query_load_growth_12m: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ScalingRecommendation {
    pub resource_type: String,
    pub timeline: String,
    pub recommended_action: String,
    pub priority: String,
    pub cost_impact: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BottleneckAnalysis {
    pub identified_bottlenecks: Vec<Bottleneck>,
    pub performance_impact: f64,
    pub mitigation_strategies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Bottleneck {
    pub bottleneck_type: String,
    pub affected_collections: Vec<String>,
    pub severity: String,
    pub symptoms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GrowthProjections {
    pub data_growth_trends: DataGrowthTrends,
    pub usage_growth_trends: UsageGrowthTrends,
    pub predictive_alerts: Vec<PredictiveAlert>,
    pub seasonal_adjustments: SeasonalAdjustments,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DataGrowthTrends {
    pub collections_by_growth_rate: Vec<CollectionGrowthTrend>,
    pub overall_growth_rate_per_month: f64,
    pub growth_acceleration: f64,
    pub projected_total_size_12m: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CollectionGrowthTrend {
    pub collection_name: String,
    pub monthly_growth_rate: f64,
    pub growth_stability: f64, // How consistent the growth is
    pub growth_pattern: String, // "linear", "exponential", "seasonal", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UsageGrowthTrends {
    pub query_volume_growth: f64,
    pub user_base_growth: f64,
    pub feature_adoption_rate: f64,
    pub complexity_growth: f64, // Growing sophistication in queries
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PredictiveAlert {
    pub alert_type: String,
    pub collection_name: Option<String>,
    pub predicted_date: u64,
    pub confidence_level: f64,
    pub recommended_action: String,
    pub impact_severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SeasonalAdjustments {
    pub seasonal_patterns: HashMap<String, SeasonalPattern>,
    pub holiday_impacts: Vec<HolidayImpact>,
    pub cyclical_trends: Vec<CyclicalTrend>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SeasonalPattern {
    pub pattern_name: String,
    pub peak_months: Vec<u8>,
    pub low_months: Vec<u8>,
    pub variance_coefficient: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HolidayImpact {
    pub holiday_name: String,
    pub usage_impact_percent: f64,
    pub affected_collections: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CyclicalTrend {
    pub cycle_name: String,
    pub cycle_length_days: u32,
    pub amplitude: f64,
    pub phase_offset: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthAssessment {
    pub overall_health_score: f64, // 0-100
    pub collection_health_scores: Vec<CollectionHealthScore>,
    pub critical_issues: Vec<CriticalIssue>,
    pub health_trends: HealthTrends,
    pub maintenance_schedule: MaintenanceSchedule,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CollectionHealthScore {
    pub collection_name: String,
    pub health_score: f64,
    pub performance_score: f64,
    pub reliability_score: f64,
    pub efficiency_score: f64,
    pub last_assessment: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CriticalIssue {
    pub issue_id: String,
    pub collection_name: String,
    pub issue_type: String,
    pub severity: String,
    pub description: String,
    pub detected_at: u64,
    pub estimated_resolution_time: f64,
    pub business_impact: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthTrends {
    pub health_score_trend_7d: f64,
    pub health_score_trend_30d: f64,
    pub improving_collections: Vec<String>,
    pub degrading_collections: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MaintenanceSchedule {
    pub upcoming_maintenance: Vec<ScheduledMaintenance>,
    pub recommended_maintenance: Vec<RecommendedMaintenance>,
    pub maintenance_windows: Vec<MaintenanceWindow>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ScheduledMaintenance {
    pub maintenance_id: String,
    pub collection_name: String,
    pub maintenance_type: String,
    pub scheduled_date: u64,
    pub estimated_duration_hours: f64,
    pub impact_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendedMaintenance {
    pub collection_name: String,
    pub maintenance_type: String,
    pub priority: String,
    pub recommended_timeframe: String,
    pub expected_benefits: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MaintenanceWindow {
    pub window_name: String,
    pub start_hour: u8,
    pub end_hour: u8,
    pub days_of_week: Vec<u8>,
    pub utilization_during_window: f64,
}

/// Internal tracking structures
#[derive(Debug, Clone)]
pub struct CollectionUsageRecord {
    pub collection_name: String,
    pub user_id: Option<i32>,
    pub operation_type: OperationType,
    pub data_size_mb: f64,
    pub response_time_ms: u64,
    pub success: bool,
    pub timestamp: SystemTime,
    pub features_used: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum OperationType {
    Query,
    Index,
    Update,
    Delete,
    Admin,
}

/// Collection intelligence store
pub struct CollectionIntelligenceStore {
    usage_records: Arc<RwLock<Vec<CollectionUsageRecord>>>,
    max_records: usize,
}

impl CollectionIntelligenceStore {
    pub fn new(max_records: usize) -> Self {
        Self {
            usage_records: Arc::new(RwLock::new(Vec::with_capacity(max_records))),
            max_records,
        }
    }

    pub async fn record_usage(
        &self,
        collection_name: String,
        user_id: Option<i32>,
        operation_type: OperationType,
        data_size_mb: f64,
        response_time_ms: u64,
        success: bool,
        features_used: Vec<String>,
    ) {
        let mut records = self.usage_records.write().await;
        
        let record = CollectionUsageRecord {
            collection_name,
            user_id,
            operation_type,
            data_size_mb,
            response_time_ms,
            success,
            timestamp: SystemTime::now(),
            features_used,
        };

        records.push(record);

        // Keep only recent records to prevent memory growth
        if records.len() > self.max_records {
            let remove_count = records.len() - self.max_records;
            records.drain(0..remove_count);
        }
    }

    /// Simplified method for middleware integration
    pub async fn record_collection_access(
        &self,
        collection_name: String,
        response_time: Duration,
        success: bool,
        user_id: i32,
    ) {
        self.record_usage(
            collection_name,
            Some(user_id),
            OperationType::Query, // Default to query operation
            0.0, // Data size unknown from middleware
            response_time.as_millis() as u64,
            success,
            Vec::new(), // Features unknown from middleware
        ).await;
    }

    pub async fn get_collection_intelligence(&self) -> CollectionIntelligence {
        let records = self.usage_records.read().await;
        let now = SystemTime::now();
        let thirty_days_ago = now - Duration::from_secs(30 * 24 * 60 * 60);

        // Filter to last 30 days
        let recent_records: Vec<_> = records
            .iter()
            .filter(|r| r.timestamp > thirty_days_ago)
            .collect();

        if recent_records.is_empty() {
            return self.empty_intelligence(now);
        }

        let usage_metrics = self.calculate_usage_metrics(&recent_records).await;
        let optimization_insights = self.calculate_optimization_insights(&recent_records);
        let resource_allocation = self.calculate_resource_allocation(&recent_records);
        let growth_projections = self.calculate_growth_projections(&recent_records);
        let health_assessment = self.calculate_health_assessment(&recent_records);

        CollectionIntelligence {
            usage_metrics,
            optimization_insights,
            resource_allocation,
            growth_projections,
            health_assessment,
            last_updated: now.duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    fn empty_intelligence(&self, now: SystemTime) -> CollectionIntelligence {
        CollectionIntelligence {
            usage_metrics: Vec::new(),
            optimization_insights: CollectionOptimizationInsights {
                underutilized_collections: Vec::new(),
                high_maintenance_collections: Vec::new(),
                migration_candidates: Vec::new(),
                performance_optimization_opportunities: Vec::new(),
                cost_optimization_recommendations: Vec::new(),
            },
            resource_allocation: ResourceAllocation {
                current_allocation: CurrentAllocation {
                    total_storage_gb: 0.0,
                    total_memory_gb: 0.0,
                    total_cpu_cores: 0.0,
                    collections_by_resource_usage: Vec::new(),
                },
                recommended_allocation: RecommendedAllocation {
                    storage_optimizations: Vec::new(),
                    memory_optimizations: Vec::new(),
                    cpu_optimizations: Vec::new(),
                    total_potential_savings: ResourceSavings {
                        storage_savings_gb: 0.0,
                        memory_savings_gb: 0.0,
                        cpu_savings_percent: 0.0,
                        cost_savings_percent: 0.0,
                    },
                },
                rebalancing_opportunities: Vec::new(),
                capacity_planning: CapacityPlanning {
                    current_capacity_utilization: 0.0,
                    projected_capacity_needs: ProjectedCapacityNeeds {
                        storage_needs_3m: 0.0,
                        storage_needs_6m: 0.0,
                        storage_needs_12m: 0.0,
                        query_load_growth_3m: 0.0,
                        query_load_growth_6m: 0.0,
                        query_load_growth_12m: 0.0,
                    },
                    scaling_recommendations: Vec::new(),
                    bottleneck_analysis: BottleneckAnalysis {
                        identified_bottlenecks: Vec::new(),
                        performance_impact: 0.0,
                        mitigation_strategies: Vec::new(),
                    },
                },
            },
            growth_projections: GrowthProjections {
                data_growth_trends: DataGrowthTrends {
                    collections_by_growth_rate: Vec::new(),
                    overall_growth_rate_per_month: 0.0,
                    growth_acceleration: 0.0,
                    projected_total_size_12m: 0.0,
                },
                usage_growth_trends: UsageGrowthTrends {
                    query_volume_growth: 0.0,
                    user_base_growth: 0.0,
                    feature_adoption_rate: 0.0,
                    complexity_growth: 0.0,
                },
                predictive_alerts: Vec::new(),
                seasonal_adjustments: SeasonalAdjustments {
                    seasonal_patterns: HashMap::new(),
                    holiday_impacts: Vec::new(),
                    cyclical_trends: Vec::new(),
                },
            },
            health_assessment: HealthAssessment {
                overall_health_score: 0.0,
                collection_health_scores: Vec::new(),
                critical_issues: Vec::new(),
                health_trends: HealthTrends {
                    health_score_trend_7d: 0.0,
                    health_score_trend_30d: 0.0,
                    improving_collections: Vec::new(),
                    degrading_collections: Vec::new(),
                },
                maintenance_schedule: MaintenanceSchedule {
                    upcoming_maintenance: Vec::new(),
                    recommended_maintenance: Vec::new(),
                    maintenance_windows: Vec::new(),
                },
            },
            last_updated: now.duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    async fn calculate_usage_metrics(&self, records: &[&CollectionUsageRecord]) -> Vec<CollectionUsageMetrics> {
        let mut collection_stats: HashMap<String, Vec<&CollectionUsageRecord>> = HashMap::new();
        
        for record in records {
            collection_stats
                .entry(record.collection_name.clone())
                .or_default()
                .push(record);
        }

        let mut metrics = Vec::new();
        for (collection_name, collection_records) in collection_stats {
                let query_frequency = collection_records
                    .iter()
                    .filter(|r| matches!(r.operation_type, OperationType::Query))
                    .count() as u64;

                let unique_users = collection_records
                    .iter()
                    .filter_map(|r| r.user_id)
                    .collect::<std::collections::HashSet<_>>()
                    .len() as u64;

                let data_volume_gb = collection_records
                    .iter()
                    .map(|r| r.data_size_mb)
                    .sum::<f64>() / 1024.0;

                // Calculate real document count from query results
                let document_count = collection_records
                    .iter()
                    .filter(|r| matches!(r.operation_type, OperationType::Query))
                    .map(|r| {
                        // Extract document count from features_used field (format: "docs:123")
                        for feature in &r.features_used {
                            if feature.starts_with("docs:") {
                                if let Ok(count) = feature[5..].parse::<u64>() {
                                    return count;
                                }
                            }
                        }
                        // Fallback: estimate from data size
                        ((r.data_size_mb * 100.0) as u64).max(1)
                    })
                    .sum::<u64>();

                // Calculate engagement score (0-10)
                let user_engagement_score = if unique_users > 0 {
                    ((query_frequency as f64 / unique_users as f64).min(100.0) / 10.0).min(10.0)
                } else {
                    0.0
                };

                // Calculate performance score based on response times
                let avg_response_time = if collection_records.is_empty() {
                    0.0
                } else {
                    collection_records.iter().map(|r| r.response_time_ms).sum::<u64>() as f64 
                        / collection_records.len() as f64
                };
                let performance_score = (10.0 - (avg_response_time / 1000.0).min(10.0)).max(0.0);

                // Calculate peak usage patterns
                let mut hourly_usage = HashMap::new();
                for record in &collection_records {
                    let hour = (record.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs() / 3600) % 24;
                    *hourly_usage.entry(hour as u8).or_insert(0u64) += 1;
                }
                let peak_hour = hourly_usage
                    .into_iter()
                    .max_by_key(|(_, count)| *count)
                    .map(|(hour, _)| hour)
                    .unwrap_or(12);

                let peak_usage_patterns = PeakUsagePatterns {
                    peak_hour,
                    peak_day_of_week: 2, // Tuesday placeholder
                    seasonal_trends: HashMap::new(),
                    usage_intensity: UsageIntensity {
                        queries_per_hour_avg: query_frequency as f64 / (24.0 * 30.0), // 30 days
                        queries_per_hour_peak: query_frequency as f64 / 24.0, // All in one day
                        concurrent_users_avg: unique_users as f64 / 30.0,
                        concurrent_users_peak: unique_users as f64,
                    },
                };

                // Calculate feature utilization
                let total_operations = collection_records.len() as f64;
                let feature_utilization = FeatureUtilization {
                    faceting_usage_percent: (collection_records
                        .iter()
                        .filter(|r| r.features_used.contains(&"faceting".to_string()))
                        .count() as f64 / total_operations) * 100.0,
                    filtering_usage_percent: (collection_records
                        .iter()
                        .filter(|r| r.features_used.contains(&"filtering".to_string()))
                        .count() as f64 / total_operations) * 100.0,
                    sorting_usage_percent: (collection_records
                        .iter()
                        .filter(|r| r.features_used.contains(&"sorting".to_string()))
                        .count() as f64 / total_operations) * 100.0,
                    highlighting_usage_percent: (collection_records
                        .iter()
                        .filter(|r| r.features_used.contains(&"highlighting".to_string()))
                        .count() as f64 / total_operations) * 100.0,
                    geospatial_usage_percent: (collection_records
                        .iter()
                        .filter(|r| r.features_used.contains(&"geospatial".to_string()))
                        .count() as f64 / total_operations) * 100.0,
                    advanced_query_usage_percent: (collection_records
                        .iter()
                        .filter(|r| r.features_used.contains(&"advanced".to_string()))
                        .count() as f64 / total_operations) * 100.0,
                };

                let growth_rate_7d = self.calculate_collection_growth_rate(&collection_name, &collection_records, 7);
                let growth_rate_30d = self.calculate_collection_growth_rate(&collection_name, &collection_records, 30);
                
                // Build user list with real information
                let user_ids: std::collections::HashSet<i32> = collection_records
                    .iter()
                    .filter_map(|r| r.user_id)
                    .collect();
                    
                let mut user_list = Vec::new();
                for user_id in user_ids {
                    let user_records: Vec<_> = collection_records.iter().filter(|r| r.user_id == Some(user_id)).collect();
                    let usage_count = user_records.len() as u64;
                    let last_access = user_records
                        .iter()
                        .map(|r| r.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs())
                        .max()
                        .unwrap_or(0);
                        
                    // Get real username
                    let username = match get_user_display_name(user_id).await {
                        Ok(display_name) => display_name,
                        Err(_) => format!("User {}", user_id),
                    };
                    
                    user_list.push(CollectionUser {
                        user_id,
                        username,
                        usage_count,
                        last_access,
                    });
                }
                
                // Sort users by usage count (most active first)
                user_list.sort_by(|a, b| b.usage_count.cmp(&a.usage_count));
                
            metrics.push(CollectionUsageMetrics {
                collection_name,
                query_frequency,
                unique_users,
                user_list,
                data_volume_gb,
                document_count,
                user_engagement_score,
                performance_score,
                growth_rate_7d,
                growth_rate_30d,
                peak_usage_patterns,
                feature_utilization,
            });
        }
        
        metrics
    }

    fn calculate_optimization_insights(&self, records: &[&CollectionUsageRecord]) -> CollectionOptimizationInsights {
        // Group records by collection to analyze utilization
        let mut collection_stats: HashMap<String, Vec<&CollectionUsageRecord>> = HashMap::new();
        for record in records {
            collection_stats
                .entry(record.collection_name.clone())
                .or_default()
                .push(record);
        }

        // Identify underutilized collections
        let mut underutilized_collections = Vec::new();
        for (collection_name, collection_records) in &collection_stats {
            let query_count = collection_records
                .iter()
                .filter(|r| matches!(r.operation_type, OperationType::Query))
                .count();
            
            let unique_users = collection_records
                .iter()
                .filter_map(|r| r.user_id)
                .collect::<std::collections::HashSet<_>>()
                .len();
            
            // Calculate utilization score based on queries per day and unique users
            let days_in_period = 30.0;
            let queries_per_day = query_count as f64 / days_in_period;
            let utilization_score = (queries_per_day * 10.0) + (unique_users as f64 * 20.0);
            
            // Collections with low utilization (< 50 score) are considered underutilized
            if utilization_score < 50.0 && query_count > 0 {
                let mut reasons = Vec::new();
                let mut recommendations = Vec::new();
                
                if queries_per_day < 1.0 {
                    reasons.push("Low query frequency (< 1 query/day)".to_string());
                    recommendations.push("Consider archiving if no business case".to_string());
                }
                if unique_users < 3 {
                    reasons.push(format!("Few active users ({})", unique_users));
                    recommendations.push("Evaluate user base and business value".to_string());
                }
                
                // Estimate potential savings based on collection size and usage
                let estimated_storage = collection_records.iter().map(|r| r.data_size_mb).sum::<f64>() / 1024.0;
                let potential_savings = PotentialSavings {
                    storage_gb: estimated_storage,
                    compute_resources_percent: (100.0 - utilization_score) / 10.0,
                    maintenance_hours_per_month: if utilization_score < 20.0 { 4.0 } else { 2.0 },
                };
                
                underutilized_collections.push(UnderutilizedCollection {
                    collection_name: collection_name.clone(),
                    utilization_score,
                    reasons,
                    recommendations,
                    potential_savings,
                });
            }
        }

        // Identify high maintenance collections based on error rates and response times
        let mut high_maintenance_collections = Vec::new();
        for (collection_name, collection_records) in &collection_stats {
            let total_operations = collection_records.len();
            let failed_operations = collection_records.iter().filter(|r| !r.success).count();
            let error_rate = if total_operations > 0 {
                (failed_operations as f64 / total_operations as f64) * 100.0
            } else {
                0.0
            };
            
            let avg_response_time = if !collection_records.is_empty() {
                collection_records.iter().map(|r| r.response_time_ms).sum::<u64>() as f64 / collection_records.len() as f64
            } else {
                0.0
            };
            
            // High maintenance score for collections with high error rates or slow response times
            let maintenance_score = error_rate + (avg_response_time / 100.0).min(50.0);
            
            if maintenance_score > 20.0 {
                let mut issues = Vec::new();
                
                if error_rate > 10.0 {
                    issues.push(MaintenanceIssue {
                        issue_type: "High Error Rate".to_string(),
                        description: format!("Error rate: {:.1}%", error_rate),
                        severity: if error_rate > 25.0 { "Critical" } else { "High" }.to_string(),
                        impact_on_performance: error_rate,
                    });
                }
                
                if avg_response_time > 2000.0 {
                    issues.push(MaintenanceIssue {
                        issue_type: "Slow Response Times".to_string(),
                        description: format!("Average response time: {:.0}ms", avg_response_time),
                        severity: if avg_response_time > 5000.0 { "High" } else { "Medium" }.to_string(),
                        impact_on_performance: (avg_response_time / 100.0).min(100.0),
                    });
                }
                
                let priority = if maintenance_score > 50.0 {
                    MaintenancePriority::Critical
                } else if maintenance_score > 35.0 {
                    MaintenancePriority::High
                } else {
                    MaintenancePriority::Medium
                };
                
                high_maintenance_collections.push(HighMaintenanceCollection {
                    collection_name: collection_name.clone(),
                    maintenance_score,
                    issues,
                    priority,
                    estimated_effort_hours: maintenance_score / 10.0,
                });
            }
        }

        CollectionOptimizationInsights {
            underutilized_collections,
            high_maintenance_collections,
            migration_candidates: Vec::new(), // Complex analysis - placeholder
            performance_optimization_opportunities: Vec::new(), // Complex analysis - placeholder
            cost_optimization_recommendations: Vec::new(), // Complex analysis - placeholder
        }
    }

    fn calculate_resource_allocation(&self, records: &[&CollectionUsageRecord]) -> ResourceAllocation {
        // Group records by collection to analyze resource usage
        let mut collection_stats: HashMap<String, Vec<&CollectionUsageRecord>> = HashMap::new();
        for record in records {
            collection_stats
                .entry(record.collection_name.clone())
                .or_default()
                .push(record);
        }

        // Calculate current resource usage by collection
        let mut collections_by_resource_usage = Vec::new();
        let mut total_storage = 0.0;
        let mut total_response_time = 0u64;
        let mut total_operations = 0u64;

        for (collection_name, collection_records) in &collection_stats {
            let storage_gb = collection_records.iter().map(|r| r.data_size_mb).sum::<f64>() / 1024.0;
            total_storage += storage_gb;
            
            let operations_count = collection_records.len() as u64;
            total_operations += operations_count;
            
            let avg_response_time = if !collection_records.is_empty() {
                collection_records.iter().map(|r| r.response_time_ms).sum::<u64>() / collection_records.len() as u64
            } else {
                0
            };
            total_response_time += avg_response_time * operations_count;
            
            // Estimate memory and CPU usage based on operations and data size
            let memory_gb = (storage_gb * 0.1).max(1.0); // Rough estimate: 10% of storage as memory
            let cpu_utilization = ((avg_response_time as f64 / 1000.0) * 10.0).min(100.0); // Response time correlates with CPU
            let efficiency_score = if avg_response_time > 0 {
                (1000.0 / avg_response_time as f64 * 100.0).min(100.0)
            } else {
                50.0
            };
            
            collections_by_resource_usage.push(ResourceUsageByCollection {
                collection_name: collection_name.clone(),
                storage_gb,
                memory_gb,
                cpu_utilization_percent: cpu_utilization,
                efficiency_score,
            });
        }

        // Estimate total system resources (simplified)
        let total_memory_gb = collections_by_resource_usage.iter().map(|c| c.memory_gb).sum::<f64>().max(16.0);
        let total_cpu_cores = 16.0; // Fixed estimate
        
        // Calculate average system utilization
        let avg_response_time = if total_operations > 0 {
            total_response_time / total_operations
        } else {
            0
        };
        let current_capacity_utilization = ((avg_response_time as f64 / 2000.0) * 100.0).min(100.0);

        // Generate storage optimizations for collections with low efficiency
        let mut storage_optimizations = Vec::new();
        for collection in &collections_by_resource_usage {
            if collection.efficiency_score < 60.0 && collection.storage_gb > 1.0 {
                let compression_ratio = 0.7; // Assume 30% compression
                storage_optimizations.push(StorageOptimization {
                    collection_name: collection.collection_name.clone(),
                    current_storage_gb: collection.storage_gb,
                    optimized_storage_gb: collection.storage_gb * compression_ratio,
                    compression_ratio,
                    optimization_method: "Data compression and cleanup".to_string(),
                });
            }
        }

        // Calculate potential savings
        let storage_savings = storage_optimizations
            .iter()
            .map(|opt| opt.current_storage_gb - opt.optimized_storage_gb)
            .sum::<f64>();
        
        let total_potential_savings = ResourceSavings {
            storage_savings_gb: storage_savings,
            memory_savings_gb: storage_savings * 0.1, // Memory savings proportional to storage
            cpu_savings_percent: if storage_savings > 10.0 { 15.0 } else { 5.0 },
            cost_savings_percent: (storage_savings / total_storage * 100.0).min(30.0),
        };

        ResourceAllocation {
            current_allocation: CurrentAllocation {
                total_storage_gb: total_storage,
                total_memory_gb: total_memory_gb,
                total_cpu_cores: total_cpu_cores,
                collections_by_resource_usage,
            },
            recommended_allocation: RecommendedAllocation {
                storage_optimizations,
                memory_optimizations: Vec::new(), // Complex analysis - placeholder
                cpu_optimizations: Vec::new(), // Complex analysis - placeholder
                total_potential_savings,
            },
            rebalancing_opportunities: Vec::new(), // Complex analysis - placeholder
            capacity_planning: CapacityPlanning {
                current_capacity_utilization,
                projected_capacity_needs: ProjectedCapacityNeeds {
                    storage_needs_3m: total_storage * 1.1,
                    storage_needs_6m: total_storage * 1.25,
                    storage_needs_12m: total_storage * 1.5,
                    query_load_growth_3m: 15.0,
                    query_load_growth_6m: 32.0,
                    query_load_growth_12m: 68.0,
                },
                scaling_recommendations: Vec::new(), // Complex analysis - placeholder
                bottleneck_analysis: BottleneckAnalysis {
                    identified_bottlenecks: Vec::new(), // Complex analysis - placeholder
                    performance_impact: 0.0,
                    mitigation_strategies: Vec::new(),
                },
            },
        }
    }

    fn calculate_growth_projections(&self, records: &[&CollectionUsageRecord]) -> GrowthProjections {
        // Group records by collection to analyze growth trends
        let mut collection_stats: HashMap<String, Vec<&CollectionUsageRecord>> = HashMap::new();
        for record in records {
            collection_stats
                .entry(record.collection_name.clone())
                .or_default()
                .push(record);
        }

        // Calculate growth trends by collection
        let mut collections_by_growth_rate = Vec::new();
        let mut total_operations = 0u64;
        let mut total_data_size = 0.0;

        for (collection_name, collection_records) in &collection_stats {
            let data_size_gb = collection_records.iter().map(|r| r.data_size_mb).sum::<f64>() / 1024.0;
            total_data_size += data_size_gb;
            total_operations += collection_records.len() as u64;
            
            // Calculate growth rate based on recent vs older activity
            let now = SystemTime::now();
            let two_weeks_ago = now - Duration::from_secs(14 * 24 * 60 * 60);
            let four_weeks_ago = now - Duration::from_secs(28 * 24 * 60 * 60);
            
            let recent_activity = collection_records
                .iter()
                .filter(|r| r.timestamp > two_weeks_ago)
                .count() as f64;
            
            let older_activity = collection_records
                .iter()
                .filter(|r| r.timestamp <= two_weeks_ago && r.timestamp > four_weeks_ago)
                .count() as f64;
            
            let monthly_growth_rate = if older_activity > 0.0 {
                ((recent_activity - older_activity) / older_activity) * 100.0
            } else if recent_activity > 0.0 {
                100.0 // New collection with activity
            } else {
                0.0
            };
            
            // Determine growth pattern and stability
            let growth_stability = if recent_activity > 0.0 && older_activity > 0.0 {
                let ratio = recent_activity / older_activity;
                (1.0 - (ratio - 1.0).abs()).max(0.0) * 100.0 // More stable = closer to 1.0 ratio
            } else {
                0.0
            };
            
            let growth_pattern = if monthly_growth_rate > 20.0 {
                "exponential"
            } else if monthly_growth_rate > 5.0 {
                "linear"
            } else if monthly_growth_rate < -5.0 {
                "declining"
            } else {
                "stable"
            }.to_string();
            
            collections_by_growth_rate.push(CollectionGrowthTrend {
                collection_name: collection_name.clone(),
                monthly_growth_rate,
                growth_stability,
                growth_pattern,
            });
        }
        
        // Calculate overall system growth metrics
        let overall_growth_rate = if collections_by_growth_rate.is_empty() {
            0.0
        } else {
            collections_by_growth_rate
                .iter()
                .map(|c| c.monthly_growth_rate)
                .sum::<f64>() / collections_by_growth_rate.len() as f64
        };
        
        let growth_acceleration = if overall_growth_rate > 10.0 { 1.5 } else { 1.0 };
        let projected_total_size_12m = total_data_size * (1.0 + overall_growth_rate / 100.0).powf(12.0);
        
        // Calculate usage growth trends
        let _unique_users = records
            .iter()
            .filter_map(|r| r.user_id)
            .collect::<std::collections::HashSet<_>>()
            .len() as f64;
        
        let _query_operations = records
            .iter()
            .filter(|r| matches!(r.operation_type, OperationType::Query))
            .count() as f64;
        
        let advanced_features_usage = records
            .iter()
            .filter(|r| !r.features_used.is_empty())
            .count() as f64;
        
        let usage_growth_trends = UsageGrowthTrends {
            query_volume_growth: overall_growth_rate.max(0.0),
            user_base_growth: (overall_growth_rate * 0.6).max(0.0), // User growth typically slower than query growth
            feature_adoption_rate: if total_operations > 0 {
                (advanced_features_usage / total_operations as f64) * 100.0
            } else {
                0.0
            },
            complexity_growth: overall_growth_rate * 0.8, // Complexity grows with overall usage
        };

        GrowthProjections {
            data_growth_trends: DataGrowthTrends {
                collections_by_growth_rate,
                overall_growth_rate_per_month: overall_growth_rate,
                growth_acceleration,
                projected_total_size_12m,
            },
            usage_growth_trends,
            predictive_alerts: Vec::new(), // Complex predictive modeling - placeholder
            seasonal_adjustments: SeasonalAdjustments {
                seasonal_patterns: HashMap::new(), // Seasonal analysis requires longer time series
                holiday_impacts: Vec::new(),
                cyclical_trends: Vec::new(),
            },
        }
    }

    fn calculate_collection_growth_rate(&self, _collection_name: &str, _all_records: &[&CollectionUsageRecord], days: u64) -> f64 {
        let _now = SystemTime::now();
        let _cutoff_time = _now - Duration::from_secs(days * 24 * 60 * 60);
        let _comparison_time = _now - Duration::from_secs(days * 2 * 24 * 60 * 60);

        // This is a simplified calculation - in a real implementation you'd want to:
        // - Compare usage in the last N days vs the previous N days
        // - Use actual historical data from a persistent store
        // For now, return a reasonable default growth rate
        if days <= 7 {
            2.5  // 2.5% weekly growth
        } else {
            8.0  // 8% monthly growth
        }
    }

    fn calculate_health_assessment(&self, records: &[&CollectionUsageRecord]) -> HealthAssessment {
        // Group records by collection to analyze health
        let mut collection_stats: HashMap<String, Vec<&CollectionUsageRecord>> = HashMap::new();
        for record in records {
            collection_stats
                .entry(record.collection_name.clone())
                .or_default()
                .push(record);
        }

        // Calculate health scores for each collection
        let mut collection_health_scores = Vec::new();
        let mut critical_issues = Vec::new();
        let mut improving_collections = Vec::new();
        let mut degrading_collections = Vec::new();
        let mut total_health_score = 0.0;

        for (collection_name, collection_records) in &collection_stats {
            let total_operations = collection_records.len();
            let failed_operations = collection_records.iter().filter(|r| !r.success).count();
            let error_rate = if total_operations > 0 {
                (failed_operations as f64 / total_operations as f64) * 100.0
            } else {
                0.0
            };
            
            let avg_response_time = if !collection_records.is_empty() {
                collection_records.iter().map(|r| r.response_time_ms).sum::<u64>() as f64 / collection_records.len() as f64
            } else {
                0.0
            };
            
            // Calculate health components
            let reliability_score = (100.0 - error_rate).max(0.0);
            let performance_score = if avg_response_time > 0.0 {
                (100.0 - (avg_response_time / 50.0)).max(0.0).min(100.0) // 5000ms = 0 score
            } else {
                75.0 // Default for no data
            };
            
            let efficiency_score = if avg_response_time > 0.0 && total_operations > 0 {
                let operations_per_second = total_operations as f64 / (30.0 * 24.0 * 3600.0); // 30 days in seconds
                (operations_per_second * 100.0).min(100.0)
            } else {
                50.0
            };
            
            let health_score = (reliability_score + performance_score + efficiency_score) / 3.0;
            total_health_score += health_score;
            
            collection_health_scores.push(CollectionHealthScore {
                collection_name: collection_name.clone(),
                health_score,
                performance_score,
                reliability_score,
                efficiency_score,
                last_assessment: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            });
            
            // Identify critical issues
            if error_rate > 25.0 {
                critical_issues.push(CriticalIssue {
                    issue_id: format!("ERR_{}", collection_name.replace(' ', "_")),
                    collection_name: collection_name.clone(),
                    issue_type: "High Error Rate".to_string(),
                    severity: "Critical".to_string(),
                    description: format!("Collection has {:.1}% error rate", error_rate),
                    detected_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
                    estimated_resolution_time: 4.0, // hours
                    business_impact: "High - Users experiencing frequent failures".to_string(),
                });
            }
            
            if avg_response_time > 5000.0 {
                critical_issues.push(CriticalIssue {
                    issue_id: format!("PERF_{}", collection_name.replace(' ', "_")),
                    collection_name: collection_name.clone(),
                    issue_type: "Poor Performance".to_string(),
                    severity: "High".to_string(),
                    description: format!("Average response time: {:.0}ms", avg_response_time),
                    detected_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
                    estimated_resolution_time: 2.0, // hours
                    business_impact: "Medium - Users experiencing slow responses".to_string(),
                });
            }
            
            // Simple trend analysis (would need historical data for real implementation)
            if health_score > 80.0 {
                improving_collections.push(collection_name.clone());
            } else if health_score < 60.0 {
                degrading_collections.push(collection_name.clone());
            }
        }
        
        let overall_health_score = if collection_health_scores.is_empty() {
            0.0
        } else {
            total_health_score / collection_health_scores.len() as f64
        };
        
        // Generate maintenance recommendations
        let mut recommended_maintenance = Vec::new();
        for collection in &collection_health_scores {
            if collection.health_score < 70.0 {
                recommended_maintenance.push(RecommendedMaintenance {
                    collection_name: collection.collection_name.clone(),
                    maintenance_type: if collection.performance_score < 50.0 {
                        "Performance Optimization"
                    } else {
                        "General Health Check"
                    }.to_string(),
                    priority: if collection.health_score < 50.0 { "High" } else { "Medium" }.to_string(),
                    recommended_timeframe: "Within 2 weeks".to_string(),
                    expected_benefits: vec![
                        "Improved response times".to_string(),
                        "Reduced error rates".to_string(),
                        "Better user experience".to_string(),
                    ],
                });
            }
        }

        HealthAssessment {
            overall_health_score,
            collection_health_scores,
            critical_issues,
            health_trends: HealthTrends {
                health_score_trend_7d: 0.0,  // Would need historical data
                health_score_trend_30d: 0.0, // Would need historical data
                improving_collections,
                degrading_collections,
            },
            maintenance_schedule: MaintenanceSchedule {
                upcoming_maintenance: Vec::new(), // Would integrate with scheduling system
                recommended_maintenance,
                maintenance_windows: vec![
                    MaintenanceWindow {
                        window_name: "Low Traffic Window".to_string(),
                        start_hour: 2,
                        end_hour: 6,
                        days_of_week: vec![1, 2, 3, 4, 5], // Weekdays
                        utilization_during_window: 15.0,
                    },
                ],
            },
        }
    }
}

// Global collection intelligence store instance
use std::sync::OnceLock;
static COLLECTION_INTELLIGENCE_STORE: OnceLock<CollectionIntelligenceStore> = OnceLock::new();

pub fn get_collection_intelligence_store() -> &'static CollectionIntelligenceStore {
    COLLECTION_INTELLIGENCE_STORE.get_or_init(|| CollectionIntelligenceStore::new(30000)) // Keep last 30k records
}

/// Helper function to record collection usage from handlers
pub async fn record_collection_usage(
    collection_name: String,
    user_id: Option<i32>,
    operation_type: OperationType,
    data_size_mb: f64,
    response_time_ms: u64,
    success: bool,
    features_used: Vec<String>,
) {
    get_collection_intelligence_store()
        .record_usage(
            collection_name,
            user_id,
            operation_type,
            data_size_mb,
            response_time_ms,
            success,
            features_used,
        )
        .await;
}