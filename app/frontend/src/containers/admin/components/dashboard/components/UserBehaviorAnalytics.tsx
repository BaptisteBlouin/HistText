import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  IconButton,
  Collapse,
  Tooltip,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Person,
  Group,
  TrendingUp,
  ExpandMore,
  Schedule,
  Speed,
  Assessment,
  Refresh,
  Star,
  Timeline,
  Psychology,
  AccountTree,
  TouchApp,
} from '@mui/icons-material';
import { useAuth } from '../../../../../hooks/useAuth';

interface ActiveUser {
  user_id: number;
  username: string;
  request_count: number;
  session_count: number;
  average_session_duration_minutes: number;
  favorite_features: string[];
  last_activity: number;
}

interface WorkflowPattern {
  name: string;
  sequence: string[];
  frequency: number;
  average_completion_time_minutes: number;
  success_rate_percent: number;
}

interface SessionDurationStats {
  average_minutes: number;
  median_minutes: number;
  short_sessions_percent: number;
  medium_sessions_percent: number;
  long_sessions_percent: number;
}

interface UsagePatterns {
  peak_hours: number[];
  common_workflows: WorkflowPattern[];
  session_duration_stats: SessionDurationStats;
  most_active_users: ActiveUser[];
}

interface UserSegment {
  count: number;
  percentage: number;
  characteristics: string[];
  typical_usage_patterns: string[];
  engagement_score: number;
}

interface UserSegments {
  power_users: UserSegment;
  casual_users: UserSegment;
  new_users: UserSegment;
}

interface UserBehaviorAnalytics {
  usage_patterns: UsagePatterns;
  user_segments: UserSegments;
  feature_adoption: Record<string, number>;
  user_journey_analysis: any;
  engagement_metrics: any;
  last_updated: number;
}

interface UserBehaviorAnalyticsProps {
  autoRefresh: boolean;
  refreshInterval: number;
  onToggle: () => void;
  isVisible: boolean;
}

const UserBehaviorAnalytics: React.FC<UserBehaviorAnalyticsProps> = ({
  autoRefresh,
  refreshInterval,
  onToggle,
  isVisible,
}) => {
  const theme = useTheme();
  const { accessToken } = useAuth();
  const [analytics, setAnalytics] = useState<UserBehaviorAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/dashboard/user-behavior', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user behavior analytics: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchAnalytics();
    }
  }, [isVisible, accessToken]);

  useEffect(() => {
    if (autoRefresh && isVisible) {
      const interval = setInterval(fetchAnalytics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isVisible, refreshInterval]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getEngagementColor = (score: number) => {
    if (score >= 8) return 'success';
    if (score >= 6) return 'warning';
    return 'error';
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'power': return <Star color="warning" />;
      case 'casual': return <Person color="info" />;
      case 'new': return <Psychology color="success" />;
      default: return <Person />;
    }
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Group color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              User Behavior Analytics & Patterns
            </Typography>
            {analytics && (
              <Chip
                label={`${analytics.usage_patterns.most_active_users.length} Active Users`}
                color="primary"
                size="small"
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Refresh Analytics">
              <IconButton onClick={fetchAnalytics} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onToggle}>
              <ExpandMore
                sx={{
                  transform: isVisible ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}
              />
            </IconButton>
          </Box>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Collapse in={isVisible}>
          {analytics && (
            <Box>
              {/* User Segments Overview */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 3, textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                    <Star sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4">{analytics.user_segments.power_users.count}</Typography>
                    <Typography variant="body2">Power Users</Typography>
                    <Typography variant="body2">({analytics.user_segments.power_users.percentage.toFixed(1)}%)</Typography>
                    <Chip
                      label={`${analytics.user_segments.power_users.engagement_score.toFixed(1)} engagement`}
                      size="small"
                      sx={{ mt: 1, backgroundColor: 'rgba(255,255,255,0.2)' }}
                    />
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 3, textAlign: 'center', background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)', color: 'white' }}>
                    <Person sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4">{analytics.user_segments.casual_users.count}</Typography>
                    <Typography variant="body2">Casual Users</Typography>
                    <Typography variant="body2">({analytics.user_segments.casual_users.percentage.toFixed(1)}%)</Typography>
                    <Chip
                      label={`${analytics.user_segments.casual_users.engagement_score.toFixed(1)} engagement`}
                      size="small"
                      sx={{ mt: 1, backgroundColor: 'rgba(255,255,255,0.2)' }}
                    />
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 3, textAlign: 'center', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}>
                    <Psychology sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4">{analytics.user_segments.new_users.count}</Typography>
                    <Typography variant="body2">New Users</Typography>
                    <Typography variant="body2">({analytics.user_segments.new_users.percentage.toFixed(1)}%)</Typography>
                    <Chip
                      label={`${analytics.user_segments.new_users.engagement_score.toFixed(1)} engagement`}
                      size="small"
                      sx={{ mt: 1, backgroundColor: 'rgba(255,255,255,0.2)' }}
                    />
                  </Paper>
                </Grid>
              </Grid>

              {/* Most Active Users */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp color="primary" />
                    Most Active Users
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {analytics.usage_patterns.most_active_users.slice(0, 8).map((user, index) => (
                      <Grid item xs={12} sm={6} md={3} key={user.user_id}>
                        <Paper sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              {user.username.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {user.username}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                ID: {user.user_id}
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">Requests</Typography>
                              <Chip label={user.request_count} size="small" color="primary" />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">Sessions</Typography>
                              <Typography variant="body2">{user.session_count}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">Avg Session</Typography>
                              <Typography variant="body2">{user.average_session_duration_minutes.toFixed(1)}min</Typography>
                            </Box>
                          </Stack>

                          {user.favorite_features.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Favorite Features:
                              </Typography>
                              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                                {user.favorite_features.slice(0, 2).map((feature, idx) => (
                                  <Chip key={idx} label={feature} size="small" variant="outlined" />
                                ))}
                              </Stack>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Usage Patterns */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Schedule color="info" />
                    Usage Patterns & Peak Hours
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* Peak Hours */}
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>Peak Activity Hours</Typography>
                      <Stack spacing={1}>
                        {analytics.usage_patterns.peak_hours.map((hour, index) => (
                          <Box key={hour} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2">{hour}:00</Typography>
                            <Chip 
                              label={`Rank ${index + 1}`} 
                              size="small" 
                              color={index === 0 ? 'error' : index === 1 ? 'warning' : 'info'} 
                            />
                          </Box>
                        ))}
                      </Stack>
                    </Grid>

                    {/* Session Duration Stats */}
                    <Grid item xs={12} md={8}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>Session Duration Distribution</Typography>
                      <Box sx={{ mb: 3 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h5" color="success.main">
                                {analytics.usage_patterns.session_duration_stats.short_sessions_percent.toFixed(1)}%
                              </Typography>
                              <Typography variant="body2">Short Sessions (&lt;5min)</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h5" color="warning.main">
                                {analytics.usage_patterns.session_duration_stats.medium_sessions_percent.toFixed(1)}%
                              </Typography>
                              <Typography variant="body2">Medium Sessions (5-30min)</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h5" color="error.main">
                                {analytics.usage_patterns.session_duration_stats.long_sessions_percent.toFixed(1)}%
                              </Typography>
                              <Typography variant="body2">Long Sessions (&gt;30min)</Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Average: {analytics.usage_patterns.session_duration_stats.average_minutes.toFixed(1)} minutes
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Median: {analytics.usage_patterns.session_duration_stats.median_minutes.toFixed(1)} minutes
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Common Workflows */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountTree color="secondary" />
                    Common User Workflows
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {analytics.usage_patterns.common_workflows.slice(0, 4).map((workflow, index) => (
                      <Grid item xs={12} md={6} key={index}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            {workflow.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Chip label={`${workflow.frequency} occurrences`} size="small" color="primary" />
                            <Chip label={`${workflow.success_rate_percent.toFixed(1)}% success`} size="small" color="success" />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Workflow Steps:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {workflow.sequence.map((step, stepIndex) => (
                              <React.Fragment key={stepIndex}>
                                <Chip label={step} size="small" variant="outlined" />
                                {stepIndex < workflow.sequence.length - 1 && (
                                  <Typography variant="body2" sx={{ alignSelf: 'center', mx: 0.5 }}>
                                    →
                                  </Typography>
                                )}
                              </React.Fragment>
                            ))}
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Avg completion time: {workflow.average_completion_time_minutes.toFixed(1)} minutes
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Feature Adoption */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TouchApp color="success" />
                    Feature Adoption Rates
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {Object.entries(analytics.feature_adoption)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 8)
                      .map(([feature, adoption]) => (
                        <Grid item xs={12} sm={6} md={3} key={feature}>
                          <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h5" color="primary.main">
                              {adoption.toFixed(1)}%
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {feature}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={adoption}
                              sx={{ mt: 1 }}
                              color={adoption > 70 ? 'success' : adoption > 40 ? 'warning' : 'error'}
                            />
                          </Paper>
                        </Grid>
                      ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Last updated: {formatTimestamp(analytics.last_updated)}
                </Typography>
              </Box>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default UserBehaviorAnalytics;