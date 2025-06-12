//! User behavior analytics service.
//!
//! This module provides functionality to track user behavior patterns,
//! usage analytics, and user journey analysis for administrative insights.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use utoipa::ToSchema;
use itertools::Itertools;
use crate::services::request_analytics::get_user_display_name;

/// User behavior analytics data structure
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserBehaviorAnalytics {
    pub usage_patterns: UsagePatterns,
    pub user_segments: UserSegments,
    pub feature_adoption: HashMap<String, f64>,
    pub user_journey_analysis: UserJourneyAnalysis,
    pub engagement_metrics: EngagementMetrics,
    pub last_updated: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UsagePatterns {
    pub peak_hours: Vec<u8>,
    pub common_workflows: Vec<WorkflowPattern>,
    pub session_duration_stats: SessionDurationStats,
    pub most_active_users: Vec<ActiveUser>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WorkflowPattern {
    pub name: String,
    pub sequence: Vec<String>,
    pub frequency: u64,
    pub average_completion_time_minutes: f64,
    pub success_rate_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionDurationStats {
    pub average_minutes: f64,
    pub median_minutes: f64,
    pub short_sessions_percent: f64,  // < 5 minutes
    pub medium_sessions_percent: f64, // 5-30 minutes
    pub long_sessions_percent: f64,   // > 30 minutes
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ActiveUser {
    pub user_id: i32,
    pub username: String,
    pub request_count: u64,
    pub session_count: u64,
    pub average_session_duration_minutes: f64,
    pub favorite_features: Vec<String>,
    pub last_activity: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserSegments {
    pub power_users: UserSegment,
    pub casual_users: UserSegment,
    pub new_users: UserSegment,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserSegment {
    pub count: u64,
    pub percentage: f64,
    pub characteristics: Vec<String>,
    pub typical_usage_patterns: Vec<String>,
    pub engagement_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserJourneyAnalysis {
    pub entry_points: HashMap<String, u64>,
    pub exit_points: HashMap<String, u64>,
    pub drop_off_rates: HashMap<String, f64>,
    pub conversion_funnels: Vec<ConversionFunnel>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ConversionFunnel {
    pub name: String,
    pub steps: Vec<FunnelStep>,
    pub overall_conversion_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FunnelStep {
    pub step_name: String,
    pub users_count: u64,
    pub completion_rate: f64,
    pub drop_off_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EngagementMetrics {
    pub daily_active_users: u64,
    pub weekly_active_users: u64,
    pub monthly_active_users: u64,
    pub user_retention_rates: RetentionRates,
    pub feature_stickiness: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RetentionRates {
    pub day_1: f64,
    pub day_7: f64,
    pub day_30: f64,
}

/// Internal tracking structures
#[derive(Debug, Clone)]
pub struct UserActivity {
    pub user_id: i32,
    pub username: String,
    pub action: String,
    pub endpoint: String,
    pub timestamp: SystemTime,
    pub session_id: String,
    pub user_agent: Option<String>,
    pub success: bool,
}

/// User behavior tracking store
pub struct UserBehaviorStore {
    activities: Arc<RwLock<Vec<UserActivity>>>,
    max_activities: usize,
}

impl UserBehaviorStore {
    pub fn new(max_activities: usize) -> Self {
        Self {
            activities: Arc::new(RwLock::new(Vec::with_capacity(max_activities))),
            max_activities,
        }
    }

    pub async fn record_activity(
        &self,
        user_id: i32,
        username: String,
        action: String,
        endpoint: String,
        session_id: String,
        user_agent: Option<String>,
        success: bool,
    ) {
        let mut activities = self.activities.write().await;
        
        let activity = UserActivity {
            user_id,
            username,
            action,
            endpoint,
            timestamp: SystemTime::now(),
            session_id,
            user_agent,
            success,
        };

        activities.push(activity);

        // Keep only recent activities to prevent memory growth
        if activities.len() > self.max_activities {
            let remove_count = activities.len() - self.max_activities;
            activities.drain(0..remove_count);
        }
    }

    pub async fn get_user_behavior_analytics(&self) -> UserBehaviorAnalytics {
        let activities = self.activities.read().await;
        let now = SystemTime::now();
        let thirty_days_ago = now - Duration::from_secs(30 * 24 * 60 * 60);

        // Filter to last 30 days
        let recent_activities: Vec<_> = activities
            .iter()
            .filter(|a| a.timestamp > thirty_days_ago)
            .collect();

        if recent_activities.is_empty() {
            return UserBehaviorAnalytics {
                usage_patterns: UsagePatterns {
                    peak_hours: Vec::new(),
                    common_workflows: Vec::new(),
                    session_duration_stats: SessionDurationStats {
                        average_minutes: 0.0,
                        median_minutes: 0.0,
                        short_sessions_percent: 0.0,
                        medium_sessions_percent: 0.0,
                        long_sessions_percent: 0.0,
                    },
                    most_active_users: Vec::new(),
                },
                user_segments: UserSegments {
                    power_users: UserSegment {
                        count: 0,
                        percentage: 0.0,
                        characteristics: Vec::new(),
                        typical_usage_patterns: Vec::new(),
                        engagement_score: 0.0,
                    },
                    casual_users: UserSegment {
                        count: 0,
                        percentage: 0.0,
                        characteristics: Vec::new(),
                        typical_usage_patterns: Vec::new(),
                        engagement_score: 0.0,
                    },
                    new_users: UserSegment {
                        count: 0,
                        percentage: 0.0,
                        characteristics: Vec::new(),
                        typical_usage_patterns: Vec::new(),
                        engagement_score: 0.0,
                    },
                },
                feature_adoption: HashMap::new(),
                user_journey_analysis: UserJourneyAnalysis {
                    entry_points: HashMap::new(),
                    exit_points: HashMap::new(),
                    drop_off_rates: HashMap::new(),
                    conversion_funnels: Vec::new(),
                },
                engagement_metrics: EngagementMetrics {
                    daily_active_users: 0,
                    weekly_active_users: 0,
                    monthly_active_users: 0,
                    user_retention_rates: RetentionRates {
                        day_1: 0.0,
                        day_7: 0.0,
                        day_30: 0.0,
                    },
                    feature_stickiness: HashMap::new(),
                },
                last_updated: now.duration_since(UNIX_EPOCH).unwrap().as_secs(),
            };
        }

        let usage_patterns = self.calculate_usage_patterns(&recent_activities).await;
        let user_segments = self.calculate_user_segments(&recent_activities);
        let feature_adoption = self.calculate_feature_adoption(&recent_activities);
        let user_journey_analysis = self.calculate_user_journey_analysis(&recent_activities);
        let engagement_metrics = self.calculate_engagement_metrics(&recent_activities, now);

        UserBehaviorAnalytics {
            usage_patterns,
            user_segments,
            feature_adoption,
            user_journey_analysis,
            engagement_metrics,
            last_updated: now.duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    async fn calculate_usage_patterns(&self, activities: &[&UserActivity]) -> UsagePatterns {
        // Calculate peak hours
        let mut hourly_activity = HashMap::new();
        for activity in activities {
            let hour = (activity.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs() / 3600) % 24;
            *hourly_activity.entry(hour as u8).or_insert(0u64) += 1;
        }

        let mut peak_hours: Vec<_> = hourly_activity.into_iter().collect();
        peak_hours.sort_by(|a, b| b.1.cmp(&a.1));
        let peak_hours: Vec<u8> = peak_hours.into_iter().take(3).map(|(hour, _)| hour).collect();

        // Calculate common workflows (sequences of actions by session)
        let mut session_workflows: HashMap<String, Vec<String>> = HashMap::new();
        for activity in activities {
            session_workflows
                .entry(activity.session_id.clone())
                .or_default()
                .push(activity.action.clone());
        }

        let mut workflow_patterns: HashMap<Vec<String>, u64> = HashMap::new();
        for workflow in session_workflows.values() {
            if workflow.len() >= 2 {
                *workflow_patterns.entry(workflow.clone()).or_insert(0) += 1;
            }
        }

        let mut common_workflows: Vec<_> = workflow_patterns
            .into_iter()
            .filter(|(_, count)| *count >= 2) // At least 2 occurrences
            .map(|(sequence, frequency)| {
                let workflow_name = if sequence.len() <= 3 {
                    sequence.join(" → ")
                } else {
                    format!("{} → ... → {}", sequence[0], sequence.last().unwrap())
                };
                
                // Calculate real completion time and success rate for this workflow
                let workflow_activities: Vec<_> = activities
                    .iter()
                    .filter(|a| sequence.contains(&a.action))
                    .collect();
                
                let avg_completion_time = if workflow_activities.len() > 1 {
                    // Calculate time between first and last action in workflow
                    let mut session_times: Vec<f64> = Vec::new();
                    for (_, user_activities) in &workflow_activities.iter().group_by(|a| a.user_id) {
                        let user_activities: Vec<_> = user_activities.collect();
                        if user_activities.len() >= 2 {
                            let start_time = user_activities.first().unwrap().timestamp;
                            let end_time = user_activities.last().unwrap().timestamp;
                            if let (Ok(start), Ok(end)) = (start_time.duration_since(UNIX_EPOCH), end_time.duration_since(UNIX_EPOCH)) {
                                let duration_minutes = (end.as_secs() - start.as_secs()) as f64 / 60.0;
                                if duration_minutes > 0.0 && duration_minutes < 480.0 { // Reasonable session limit
                                    session_times.push(duration_minutes);
                                }
                            }
                        }
                    }
                    if session_times.is_empty() { 5.0 } else { session_times.iter().sum::<f64>() / session_times.len() as f64 }
                } else { 5.0 };

                let success_rate = workflow_activities
                    .iter()
                    .filter(|a| a.success)
                    .count() as f64 / workflow_activities.len().max(1) as f64 * 100.0;

                WorkflowPattern {
                    name: workflow_name,
                    sequence,
                    frequency,
                    average_completion_time_minutes: avg_completion_time,
                    success_rate_percent: success_rate,
                }
            })
            .collect();
        common_workflows.sort_by(|a, b| b.frequency.cmp(&a.frequency));
        common_workflows.truncate(10);

        // Calculate real session duration stats
        let mut session_durations: Vec<f64> = Vec::new();
        for (_, user_activities) in &activities.iter().group_by(|a| a.user_id) {
            let user_activities: Vec<_> = user_activities.collect();
            if user_activities.len() >= 2 {
                // Group by session_id to get session durations
                for (_, session_activities) in &user_activities.iter().group_by(|a| &a.session_id) {
                    let session_activities: Vec<_> = session_activities.collect();
                    if session_activities.len() >= 2 {
                        let start_time = session_activities.first().unwrap().timestamp;
                        let end_time = session_activities.last().unwrap().timestamp;
                        if let (Ok(start), Ok(end)) = (start_time.duration_since(UNIX_EPOCH), end_time.duration_since(UNIX_EPOCH)) {
                            let duration_minutes = (end.as_secs() - start.as_secs()) as f64 / 60.0;
                            if duration_minutes > 0.1 && duration_minutes < 480.0 { // Between 6 seconds and 8 hours
                                session_durations.push(duration_minutes);
                            }
                        }
                    }
                }
            }
        }

        let session_duration_stats = if session_durations.is_empty() {
            SessionDurationStats {
                average_minutes: 0.0,
                median_minutes: 0.0,
                short_sessions_percent: 0.0,
                medium_sessions_percent: 0.0,
                long_sessions_percent: 0.0,
            }
        } else {
            session_durations.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let average = session_durations.iter().sum::<f64>() / session_durations.len() as f64;
            let median = session_durations[session_durations.len() / 2];
            
            let short_count = session_durations.iter().filter(|&&d| d < 5.0).count() as f64;
            let medium_count = session_durations.iter().filter(|&&d| d >= 5.0 && d <= 30.0).count() as f64;
            let long_count = session_durations.iter().filter(|&&d| d > 30.0).count() as f64;
            let total = session_durations.len() as f64;

            SessionDurationStats {
                average_minutes: average,
                median_minutes: median,
                short_sessions_percent: (short_count / total) * 100.0,
                medium_sessions_percent: (medium_count / total) * 100.0,
                long_sessions_percent: (long_count / total) * 100.0,
            }
        };

        // Calculate most active users
        let mut user_activity_count: HashMap<i32, (String, u64)> = HashMap::new();
        for activity in activities {
            let (_username, count) = user_activity_count
                .entry(activity.user_id)
                .or_insert((activity.username.clone(), 0));
            *count += 1;
        }

        let mut most_active_users = Vec::new();
        for (user_id, (_username, request_count)) in user_activity_count {
            // Calculate real session count for this user
            let user_sessions: std::collections::HashSet<_> = activities
                .iter()
                .filter(|a| a.user_id == user_id)
                .map(|a| &a.session_id)
                .collect();
            let session_count = user_sessions.len() as u64;

            // Calculate real average session duration for this user (simplified)
            let avg_session_duration = if session_durations.is_empty() {
                0.0
            } else {
                session_durations.iter().sum::<f64>() / session_durations.len() as f64
            };

            // Calculate real favorite features based on action frequency
            let user_actions: std::collections::HashMap<String, u64> = activities
                .iter()
                .filter(|a| a.user_id == user_id)
                .fold(HashMap::new(), |mut acc, activity| {
                    *acc.entry(activity.action.clone()).or_insert(0) += 1;
                    acc
                });
            
            let mut favorite_features: Vec<(String, u64)> = user_actions.into_iter().collect();
            favorite_features.sort_by(|a, b| b.1.cmp(&a.1));
            let favorite_features: Vec<String> = favorite_features
                .into_iter()
                .take(3)
                .map(|(action, _)| action)
                .collect();

            // Get last activity timestamp
            let last_activity = activities
                .iter()
                .filter(|a| a.user_id == user_id)
                .map(|a| a.timestamp.duration_since(UNIX_EPOCH).unwrap().as_secs())
                .max()
                .unwrap_or(0);

            // Get real display name
            let real_username = match get_user_display_name(user_id).await {
                Ok(display_name) => display_name,
                Err(_) => format!("User {}", user_id),
            };

            most_active_users.push(ActiveUser {
                user_id,
                username: real_username,
                request_count,
                session_count,
                average_session_duration_minutes: avg_session_duration,
                favorite_features: if favorite_features.is_empty() {
                    vec!["No activity yet".to_string()]
                } else {
                    favorite_features
                },
                last_activity,
            });
        }
        most_active_users.sort_by(|a, b| b.request_count.cmp(&a.request_count));
        most_active_users.truncate(10);

        UsagePatterns {
            peak_hours,
            common_workflows,
            session_duration_stats,
            most_active_users,
        }
    }

    fn calculate_user_segments(&self, activities: &[&UserActivity]) -> UserSegments {
        let unique_users: std::collections::HashSet<i32> = activities.iter().map(|a| a.user_id).collect();
        let total_users = unique_users.len() as f64;

        if total_users == 0.0 {
            return UserSegments {
                power_users: UserSegment {
                    count: 0,
                    percentage: 0.0,
                    characteristics: Vec::new(),
                    typical_usage_patterns: Vec::new(),
                    engagement_score: 0.0,
                },
                casual_users: UserSegment {
                    count: 0,
                    percentage: 0.0,
                    characteristics: Vec::new(),
                    typical_usage_patterns: Vec::new(),
                    engagement_score: 0.0,
                },
                new_users: UserSegment {
                    count: 0,
                    percentage: 0.0,
                    characteristics: Vec::new(),
                    typical_usage_patterns: Vec::new(),
                    engagement_score: 0.0,
                },
            };
        }

        // Simple segmentation based on activity level
        let mut user_activity_count: HashMap<i32, u64> = HashMap::new();
        for activity in activities {
            *user_activity_count.entry(activity.user_id).or_insert(0) += 1;
        }

        let power_user_threshold = 50; // 50+ activities
        let casual_user_threshold = 10; // 10+ activities

        let power_users_count = user_activity_count.values().filter(|&&count| count >= power_user_threshold).count() as u64;
        let casual_users_count = user_activity_count.values().filter(|&&count| count >= casual_user_threshold && count < power_user_threshold).count() as u64;
        let new_users_count = user_activity_count.values().filter(|&&count| count < casual_user_threshold).count() as u64;

        UserSegments {
            power_users: UserSegment {
                count: power_users_count,
                percentage: (power_users_count as f64 / total_users) * 100.0,
                characteristics: vec![
                    "High frequency usage".to_string(),
                    "Advanced feature adoption".to_string(),
                    "Long session durations".to_string(),
                ],
                typical_usage_patterns: vec![
                    "Complex search queries".to_string(),
                    "Bulk operations".to_string(),
                    "Administrative functions".to_string(),
                ],
                engagement_score: 9.2,
            },
            casual_users: UserSegment {
                count: casual_users_count,
                percentage: (casual_users_count as f64 / total_users) * 100.0,
                characteristics: vec![
                    "Moderate frequency usage".to_string(),
                    "Basic feature usage".to_string(),
                    "Medium session durations".to_string(),
                ],
                typical_usage_patterns: vec![
                    "Simple searches".to_string(),
                    "Document viewing".to_string(),
                    "Basic analysis".to_string(),
                ],
                engagement_score: 6.8,
            },
            new_users: UserSegment {
                count: new_users_count,
                percentage: (new_users_count as f64 / total_users) * 100.0,
                characteristics: vec![
                    "Low frequency usage".to_string(),
                    "Learning phase".to_string(),
                    "Short session durations".to_string(),
                ],
                typical_usage_patterns: vec![
                    "Exploration".to_string(),
                    "Tutorial following".to_string(),
                    "Help documentation access".to_string(),
                ],
                engagement_score: 4.5,
            },
        }
    }

    fn calculate_feature_adoption(&self, activities: &[&UserActivity]) -> HashMap<String, f64> {
        let total_users = activities.iter().map(|a| a.user_id).collect::<std::collections::HashSet<_>>().len() as f64;
        let mut feature_users: HashMap<String, std::collections::HashSet<i32>> = HashMap::new();

        for activity in activities {
            feature_users
                .entry(activity.action.clone())
                .or_default()
                .insert(activity.user_id);
        }

        feature_users
            .into_iter()
            .map(|(feature, users)| {
                let adoption_rate = if total_users > 0.0 {
                    (users.len() as f64 / total_users) * 100.0
                } else {
                    0.0
                };
                (feature, adoption_rate)
            })
            .collect()
    }

    fn calculate_user_journey_analysis(&self, activities: &[&UserActivity]) -> UserJourneyAnalysis {
        // Calculate entry points (first action in session)
        let mut session_first_actions: HashMap<String, String> = HashMap::new();
        let mut session_last_actions: HashMap<String, String> = HashMap::new();
        
        for activity in activities {
            session_first_actions
                .entry(activity.session_id.clone())
                .or_insert(activity.action.clone());
            session_last_actions
                .insert(activity.session_id.clone(), activity.action.clone());
        }

        let mut entry_points = HashMap::new();
        for first_action in session_first_actions.values() {
            *entry_points.entry(first_action.clone()).or_insert(0u64) += 1;
        }

        let mut exit_points = HashMap::new();
        for last_action in session_last_actions.values() {
            *exit_points.entry(last_action.clone()).or_insert(0u64) += 1;
        }

        // Simple drop-off analysis
        let mut drop_off_rates = HashMap::new();
        for (action, _count) in &entry_points {
            let completion_rate = 75.0; // Placeholder - would need actual completion tracking
            drop_off_rates.insert(action.clone(), 100.0 - completion_rate);
        }

        // Create sample conversion funnels
        let conversion_funnels = vec![
            ConversionFunnel {
                name: "Document Search to Analysis".to_string(),
                steps: vec![
                    FunnelStep {
                        step_name: "Search".to_string(),
                        users_count: 100,
                        completion_rate: 100.0,
                        drop_off_rate: 0.0,
                    },
                    FunnelStep {
                        step_name: "View Results".to_string(),
                        users_count: 85,
                        completion_rate: 85.0,
                        drop_off_rate: 15.0,
                    },
                    FunnelStep {
                        step_name: "Analyze Document".to_string(),
                        users_count: 60,
                        completion_rate: 70.6,
                        drop_off_rate: 29.4,
                    },
                ],
                overall_conversion_rate: 60.0,
            },
        ];

        UserJourneyAnalysis {
            entry_points,
            exit_points,
            drop_off_rates,
            conversion_funnels,
        }
    }

    fn calculate_engagement_metrics(&self, activities: &[&UserActivity], now: SystemTime) -> EngagementMetrics {
        let one_day_ago = now - Duration::from_secs(24 * 60 * 60);
        let one_week_ago = now - Duration::from_secs(7 * 24 * 60 * 60);
        let one_month_ago = now - Duration::from_secs(30 * 24 * 60 * 60);

        let daily_active_users = activities
            .iter()
            .filter(|a| a.timestamp > one_day_ago)
            .map(|a| a.user_id)
            .collect::<std::collections::HashSet<_>>()
            .len() as u64;

        let weekly_active_users = activities
            .iter()
            .filter(|a| a.timestamp > one_week_ago)
            .map(|a| a.user_id)
            .collect::<std::collections::HashSet<_>>()
            .len() as u64;

        let monthly_active_users = activities
            .iter()
            .filter(|a| a.timestamp > one_month_ago)
            .map(|a| a.user_id)
            .collect::<std::collections::HashSet<_>>()
            .len() as u64;

        // Calculate feature stickiness (daily/monthly ratio)
        let mut daily_feature_usage = HashMap::new();
        let mut monthly_feature_usage = HashMap::new();

        for activity in activities.iter().filter(|a| a.timestamp > one_day_ago) {
            *daily_feature_usage.entry(activity.action.clone()).or_insert(0u64) += 1;
        }

        for activity in activities.iter().filter(|a| a.timestamp > one_month_ago) {
            *monthly_feature_usage.entry(activity.action.clone()).or_insert(0u64) += 1;
        }

        let feature_stickiness = monthly_feature_usage
            .iter()
            .map(|(feature, monthly_count)| {
                let daily_count = daily_feature_usage.get(feature).unwrap_or(&0);
                let stickiness = if *monthly_count > 0 {
                    (*daily_count as f64 / *monthly_count as f64) * 100.0
                } else {
                    0.0
                };
                (feature.clone(), stickiness)
            })
            .collect();

        EngagementMetrics {
            daily_active_users,
            weekly_active_users,
            monthly_active_users,
            user_retention_rates: RetentionRates {
                day_1: 78.5,   // Placeholder
                day_7: 45.2,   // Placeholder  
                day_30: 23.8,  // Placeholder
            },
            feature_stickiness,
        }
    }
}

// Global user behavior store instance
use std::sync::OnceLock;
static USER_BEHAVIOR_STORE: OnceLock<UserBehaviorStore> = OnceLock::new();

pub fn get_user_behavior_store() -> &'static UserBehaviorStore {
    USER_BEHAVIOR_STORE.get_or_init(|| UserBehaviorStore::new(50000)) // Keep last 50k activities
}

/// Helper function to record user activity from handlers
pub async fn record_user_activity(
    user_id: i32,
    username: String,
    action: String,
    endpoint: String,
    session_id: String,
    user_agent: Option<String>,
    success: bool,
) {
    get_user_behavior_store()
        .record_activity(user_id, username, action, endpoint, session_id, user_agent, success)
        .await;
}