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
  Badge,
} from '@mui/material';
import {
  Error as ErrorIcon,
  TrendingUp,
  ExpandMore,
  Warning,
  Schedule,
  Speed,
  Person,
  Api,
  Assessment,
  Refresh,
} from '@mui/icons-material';
import { useAuth } from '../../../../../hooks/useAuth';
import UserList from '../../../../../components/ui/UserList';

interface AffectedUser {
  user_id: number;
  username: string;
  error_count: number;
  last_error: number;
}

interface ErrorDetail {
  endpoint: string;
  error_type: string;
  error_message: string;
  frequency: number;
  first_occurrence: number;
  last_occurrence: number;
  affected_users: number;
  affected_user_list: AffectedUser[];
  status_code: number;
}

interface ErrorPatterns {
  time_of_day_correlation: Record<string, number>;
  user_agent_correlation: Record<string, number>;
  endpoint_correlation: Record<string, number>;
}

interface FailingEndpoint {
  endpoint: string;
  method: string;
  error_count: number;
  total_requests: number;
  failure_rate_percent: number;
  most_common_error: string;
}

interface EnhancedErrorTracking {
  error_details: ErrorDetail[];
  error_patterns: ErrorPatterns;
  top_failing_endpoints: FailingEndpoint[];
}

interface EnhancedRequestAnalytics {
  endpoint_stats: Record<string, any>;
  error_stats: Record<string, number>;
  enhanced_error_tracking: EnhancedErrorTracking;
  hourly_requests: any[];
  top_slow_endpoints: any[];
  total_requests_24h: number;
  average_response_time_ms: number;
  error_rate_percent: number;
  last_updated: number;
}

interface EnhancedApiAnalyticsProps {
  autoRefresh: boolean;
  refreshInterval: number;
  onToggle: () => void;
  isVisible: boolean;
}

const EnhancedApiAnalytics: React.FC<EnhancedApiAnalyticsProps> = ({
  autoRefresh,
  refreshInterval,
  onToggle,
  isVisible,
}) => {
  const theme = useTheme();
  const { accessToken } = useAuth();
  const [analytics, setAnalytics] = useState<EnhancedRequestAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/dashboard/enhanced-analytics', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
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

  const getErrorSeverityColor = (errorType: string) => {
    switch (errorType) {
      case 'server_error': return 'error';
      case 'authentication': return 'warning';
      case 'authorization': return 'warning';
      case 'rate_limit': return 'info';
      case 'validation': return 'secondary';
      default: return 'default';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ErrorIcon color="error" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Enhanced API Analytics & Error Tracking
            </Typography>
            {analytics && (
              <Chip
                label={`${analytics.enhanced_error_tracking.error_details.length} Error Types`}
                color="error"
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
              {/* Overview Stats */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {analytics.enhanced_error_tracking.error_details.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Unique Error Types
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {analytics.enhanced_error_tracking.top_failing_endpoints.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Failing Endpoints
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {analytics.error_rate_percent.toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Overall Error Rate
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {analytics.average_response_time_ms.toFixed(0)}ms
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Response Time
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Error Details Section */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning color="error" />
                    Error Details & Categorization
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Endpoint</TableCell>
                          <TableCell>Error Type</TableCell>
                          <TableCell>Frequency</TableCell>
                          <TableCell>Affected Users</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Last Occurrence</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analytics.enhanced_error_tracking.error_details
                          .slice(0, 10)
                          .map((error, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {error.endpoint}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={error.error_type}
                                  color={getErrorSeverityColor(error.error_type) as any}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Badge badgeContent={error.frequency} color="error">
                                  <TrendingUp fontSize="small" />
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {error.affected_user_list && error.affected_user_list.length > 0 ? (
                                  <UserList
                                    users={error.affected_user_list.map(user => ({
                                      user_id: user.user_id,
                                      username: user.username,
                                      error_count: user.error_count,
                                      last_activity: user.last_error,
                                    }))}
                                    variant="compact"
                                    title="Affected Users"
                                    maxVisibleUsers={3}
                                  />
                                ) : (
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                    <Person fontSize="small" />
                                    {error.affected_users}
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={error.status_code}
                                  color={error.status_code >= 500 ? 'error' : 'warning'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {formatTimestamp(error.last_occurrence)}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>

              {/* Top Failing Endpoints */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Api color="warning" />
                    Top Failing Endpoints
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {analytics.enhanced_error_tracking.top_failing_endpoints
                      .slice(0, 6)
                      .map((endpoint, index) => (
                        <Grid item xs={12} md={6} key={index}>
                          <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                              {endpoint.method} {endpoint.endpoint}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Failure Rate
                              </Typography>
                              <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                                {endpoint.failure_rate_percent.toFixed(1)}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={endpoint.failure_rate_percent}
                              color="error"
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {endpoint.error_count} errors of {endpoint.total_requests} requests
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              Most common: {endpoint.most_common_error}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Error Patterns */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Assessment color="info" />
                    Error Patterns & Correlations
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* Time of Day Correlation */}
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Errors by Hour
                      </Typography>
                      <Stack spacing={1}>
                        {Object.entries(analytics.enhanced_error_tracking.error_patterns.time_of_day_correlation)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 5)
                          .map(([hour, count]) => (
                            <Box key={hour} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">{hour}:00</Typography>
                              <Chip label={count} size="small" color="error" />
                            </Box>
                          ))}
                      </Stack>
                    </Grid>

                    {/* Endpoint Correlation */}
                    <Grid item xs={12} md={8}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <Api sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Top Error-Prone Endpoints
                      </Typography>
                      <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>Endpoint</TableCell>
                              <TableCell align="right">Error Count</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(analytics.enhanced_error_tracking.error_patterns.endpoint_correlation)
                              .sort(([,a], [,b]) => b - a)
                              .slice(0, 8)
                              .map(([endpoint, count]) => (
                                <TableRow key={endpoint}>
                                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                    {endpoint}
                                  </TableCell>
                                  <TableCell align="right">
                                    <Chip label={count} size="small" color="error" />
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
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

export default EnhancedApiAnalytics;