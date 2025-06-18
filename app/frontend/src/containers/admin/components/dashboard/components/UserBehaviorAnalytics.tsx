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
  useMediaQuery,
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
  ViewModule,
  ViewList,
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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { accessToken } = useAuth();
  const [analytics, setAnalytics] = useState<UserBehaviorAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

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
    <Card sx={{ 
      mb: { xs: 3, md: 4 },
      borderRadius: { xs: 2, md: 3 },
    }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: isMobile ? 'flex-start' : 'center', 
          justifyContent: 'space-between', 
          mb: { xs: 2, md: 3 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 },
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
            <Group color="primary" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
            <Typography 
              variant={isMobile ? "h6" : "h6"} 
              sx={{ 
                fontWeight: 600,
                fontSize: { xs: '1.125rem', md: '1.25rem' },
                lineHeight: 1.2,
              }}
            >
              {isMobile ? "User Behavior" : "User Behavior Analytics & Patterns"}
            </Typography>
            {analytics && (
              <Chip
                label={isMobile ? `${analytics.usage_patterns.most_active_users.length} Active` : `${analytics.usage_patterns.most_active_users.length} Active Users`}
                color="primary"
                size="small"
                sx={{ fontSize: { xs: '0.6875rem', md: '0.75rem' } }}
              />
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {!isMobile && isVisible && (
              <Tooltip title={`Switch to ${viewMode === 'cards' ? 'Table' : 'Cards'} View`}>
                <IconButton
                  onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                  color="primary"
                  size="small"
                >
                  {viewMode === 'cards' ? <ViewList /> : <ViewModule />}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Refresh Analytics">
              <IconButton 
                onClick={fetchAnalytics} 
                disabled={loading}
                size={isMobile ? "small" : "medium"}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <IconButton 
              onClick={onToggle}
              size={isMobile ? "small" : "medium"}
            >
              <ExpandMore
                sx={{
                  transform: isVisible ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}
              />
            </IconButton>
          </Stack>
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
              <Grid container spacing={{ xs: 2, sm: 2, md: 3 }} sx={{ mb: { xs: 3, md: 4 } }}>
                <Grid item xs={12} sm={4} md={4}>
                  <Paper sx={{ 
                    p: { xs: 2, sm: 2.5, md: 3 }, 
                    textAlign: 'center', 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    color: 'white',
                    borderRadius: { xs: 2, md: 1 },
                  }}>
                    <Star sx={{ fontSize: { xs: 32, sm: 36, md: 40 }, mb: 1 }} />
                    <Typography 
                      variant={isMobile ? "h5" : "h4"}
                      sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' } }}
                    >
                      {analytics.user_segments.power_users.count}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ fontSize: { xs: '0.875rem', md: '0.875rem' } }}
                    >
                      {isMobile ? "Power" : "Power Users"}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}
                    >
                      ({analytics.user_segments.power_users.percentage.toFixed(1)}%)
                    </Typography>
                    <Chip
                      label={isMobile ? `${analytics.user_segments.power_users.engagement_score.toFixed(1)}` : `${analytics.user_segments.power_users.engagement_score.toFixed(1)} engagement`}
                      size="small"
                      sx={{ 
                        mt: 1, 
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        fontSize: { xs: '0.65rem', md: '0.75rem' },
                      }}
                    />
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4} md={4}>
                  <Paper sx={{ 
                    p: { xs: 2, sm: 2.5, md: 3 }, 
                    textAlign: 'center', 
                    background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)', 
                    color: 'white',
                    borderRadius: { xs: 2, md: 1 },
                  }}>
                    <Person sx={{ fontSize: { xs: 32, sm: 36, md: 40 }, mb: 1 }} />
                    <Typography 
                      variant={isMobile ? "h5" : "h4"}
                      sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' } }}
                    >
                      {analytics.user_segments.casual_users.count}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ fontSize: { xs: '0.875rem', md: '0.875rem' } }}
                    >
                      {isMobile ? "Casual" : "Casual Users"}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}
                    >
                      ({analytics.user_segments.casual_users.percentage.toFixed(1)}%)
                    </Typography>
                    <Chip
                      label={isMobile ? `${analytics.user_segments.casual_users.engagement_score.toFixed(1)}` : `${analytics.user_segments.casual_users.engagement_score.toFixed(1)} engagement`}
                      size="small"
                      sx={{ 
                        mt: 1, 
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        fontSize: { xs: '0.65rem', md: '0.75rem' },
                      }}
                    />
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4} md={4}>
                  <Paper sx={{ 
                    p: { xs: 2, sm: 2.5, md: 3 }, 
                    textAlign: 'center', 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                    color: 'white',
                    borderRadius: { xs: 2, md: 1 },
                  }}>
                    <Psychology sx={{ fontSize: { xs: 32, sm: 36, md: 40 }, mb: 1 }} />
                    <Typography 
                      variant={isMobile ? "h5" : "h4"}
                      sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' } }}
                    >
                      {analytics.user_segments.new_users.count}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ fontSize: { xs: '0.875rem', md: '0.875rem' } }}
                    >
                      {isMobile ? "New" : "New Users"}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}
                    >
                      ({analytics.user_segments.new_users.percentage.toFixed(1)}%)
                    </Typography>
                    <Chip
                      label={isMobile ? `${analytics.user_segments.new_users.engagement_score.toFixed(1)}` : `${analytics.user_segments.new_users.engagement_score.toFixed(1)} engagement`}
                      size="small"
                      sx={{ 
                        mt: 1, 
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        fontSize: { xs: '0.65rem', md: '0.75rem' },
                      }}
                    />
                  </Paper>
                </Grid>
              </Grid>

              {/* Most Active Users */}
              <Accordion defaultExpanded={!isMobile}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography 
                    variant={isMobile ? "subtitle1" : "h6"} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      fontSize: { xs: '1.125rem', md: '1.25rem' },
                    }}
                  >
                    <TrendingUp color="primary" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }} />
                    {isMobile ? "Active Users" : "Most Active Users"}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: { xs: 1, sm: 2 } }}>
                  <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                    {analytics.usage_patterns.most_active_users.slice(0, isMobile ? 4 : 8).map((user, index) => (
                      <Grid item xs={12} sm={6} md={3} key={user.user_id}>
                        <Paper sx={{ 
                          p: { xs: 1.5, sm: 2 },
                          borderRadius: { xs: 2, md: 1 },
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, mb: 2 }}>
                            <Avatar sx={{ 
                              bgcolor: 'primary.main',
                              width: { xs: 32, sm: 40 },
                              height: { xs: 32, sm: 40 },
                              fontSize: { xs: '0.875rem', sm: '1rem' },
                            }}>
                              {user.username.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography 
                                variant="subtitle2" 
                                sx={{ 
                                  fontWeight: 600,
                                  fontSize: { xs: '0.875rem', sm: '0.875rem' },
                                  lineHeight: 1.2,
                                  wordBreak: 'break-word',
                                }}
                              >
                                {user.username}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                ID: {user.user_id}
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography 
                                variant="body2"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                Requests
                              </Typography>
                              <Chip 
                                label={user.request_count} 
                                size="small" 
                                color="primary"
                                sx={{ fontSize: '0.65rem' }}
                              />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography 
                                variant="body2"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                Sessions
                              </Typography>
                              <Typography 
                                variant="body2"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                {user.session_count}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography 
                                variant="body2"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                Avg Session
                              </Typography>
                              <Typography 
                                variant="body2"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                {user.average_session_duration_minutes.toFixed(1)}min
                              </Typography>
                            </Box>
                          </Stack>

                          {!isMobile && user.favorite_features.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.75rem' }}>
                                Favorite Features:
                              </Typography>
                              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                                {user.favorite_features.slice(0, 2).map((feature, idx) => (
                                  <Chip 
                                    key={idx} 
                                    label={feature} 
                                    size="small" 
                                    variant="outlined"
                                    sx={{ fontSize: '0.6rem' }}
                                  />
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

              <Box sx={{ mt: { xs: 2, md: 3 }, textAlign: 'center' }}>
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ 
                    fontSize: { xs: '0.75rem', md: '0.75rem' },
                    px: { xs: 2, md: 0 },
                  }}
                >
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