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
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
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
  ViewModule,
  ViewList,
} from '@mui/icons-material';
import { useAuth } from '../../../../../hooks/useAuth';
import { UserList } from '../../../../../components/ui';

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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { accessToken } = useAuth();
  const [analytics, setAnalytics] = useState<EnhancedRequestAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

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
            <ErrorIcon color="error" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
            <Typography 
              variant={isMobile ? "h6" : "h6"} 
              sx={{ 
                fontWeight: 600,
                fontSize: { xs: '1.125rem', md: '1.25rem' },
                lineHeight: 1.2,
              }}
            >
              {isMobile ? "API Error Tracking" : "Enhanced API Analytics & Error Tracking"}
            </Typography>
            {analytics && (
              <Chip
                label={`${analytics.enhanced_error_tracking.error_details.length} Error${analytics.enhanced_error_tracking.error_details.length !== 1 ? 's' : ''}`}
                color="error"
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
              {/* Overview Stats */}
              <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }} sx={{ mb: { xs: 3, md: 4 } }}>
                <Grid item xs={6} sm={6} md={3}>
                  <Paper sx={{ 
                    p: { xs: 1.5, sm: 2 }, 
                    textAlign: 'center',
                    borderRadius: { xs: 2, md: 1 },
                  }}>
                    <Typography 
                      variant={isMobile ? "h5" : "h4"} 
                      color="error.main"
                      sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
                    >
                      {analytics.enhanced_error_tracking.error_details.length}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                    >
                      {isMobile ? "Errors" : "Unique Error Types"}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                  <Paper sx={{ 
                    p: { xs: 1.5, sm: 2 }, 
                    textAlign: 'center',
                    borderRadius: { xs: 2, md: 1 },
                  }}>
                    <Typography 
                      variant={isMobile ? "h5" : "h4"} 
                      color="warning.main"
                      sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
                    >
                      {analytics.enhanced_error_tracking.top_failing_endpoints.length}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                    >
                      {isMobile ? "Failing" : "Failing Endpoints"}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                  <Paper sx={{ 
                    p: { xs: 1.5, sm: 2 }, 
                    textAlign: 'center',
                    borderRadius: { xs: 2, md: 1 },
                  }}>
                    <Typography 
                      variant={isMobile ? "h5" : "h4"} 
                      color="info.main"
                      sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
                    >
                      {analytics.error_rate_percent.toFixed(1)}%
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                    >
                      {isMobile ? "Error Rate" : "Overall Error Rate"}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                  <Paper sx={{ 
                    p: { xs: 1.5, sm: 2 }, 
                    textAlign: 'center',
                    borderRadius: { xs: 2, md: 1 },
                  }}>
                    <Typography 
                      variant={isMobile ? "h5" : "h4"} 
                      color="success.main"
                      sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
                    >
                      {analytics.average_response_time_ms.toFixed(0)}ms
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                    >
                      {isMobile ? "Avg Time" : "Avg Response Time"}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Error Details Section */}
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
                    <Warning color="error" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }} />
                    {isMobile ? "Error Details" : "Error Details & Categorization"}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: { xs: 1, sm: 2 } }}>
                  {isMobile || viewMode === 'cards' ? (
                    <Stack spacing={2}>
                      {analytics.enhanced_error_tracking.error_details
                        .slice(0, isMobile ? 5 : 10)
                        .map((error, index) => (
                          <Card key={index} variant="outlined" sx={{ borderRadius: 2 }}>
                            <CardContent sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    wordBreak: 'break-all',
                                    flex: 1,
                                    mr: 1,
                                  }}
                                >
                                  {error.endpoint}
                                </Typography>
                                <Chip
                                  label={error.status_code}
                                  color={error.status_code >= 500 ? 'error' : 'warning'}
                                  size="small"
                                />
                              </Box>
                              <Grid container spacing={1} sx={{ mb: 1 }}>
                                <Grid item xs={6}>
                                  <Chip
                                    label={error.error_type}
                                    color={getErrorSeverityColor(error.error_type) as any}
                                    size="small"
                                    sx={{ fontSize: '0.65rem' }}
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                    <TrendingUp fontSize="small" color="error" />
                                    <Typography variant="caption" color="error">
                                      {error.frequency}
                                    </Typography>
                                  </Box>
                                </Grid>
                              </Grid>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Person fontSize="small" color="action" />
                                  <Typography variant="caption" color="text.secondary">
                                    {error.affected_users} affected
                                  </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                  {formatTimestamp(error.last_occurrence)}
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        ))}
                    </Stack>
                  ) : (
                    <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
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
                                        last_error: user.last_error,
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
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Top Failing Endpoints */}
              <Accordion>
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
                    <Api color="warning" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }} />
                    {isMobile ? "Failing Endpoints" : "Top Failing Endpoints"}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: { xs: 1, sm: 2 } }}>
                  <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                    {analytics.enhanced_error_tracking.top_failing_endpoints
                      .slice(0, isMobile ? 4 : 6)
                      .map((endpoint, index) => (
                        <Grid item xs={12} sm={6} md={6} key={index}>
                          <Paper sx={{ 
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: { xs: 2, md: 1 },
                          }}>
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontFamily: 'monospace', 
                                mb: 1,
                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                wordBreak: 'break-all',
                              }}
                            >
                              <Chip 
                                label={endpoint.method} 
                                size="small" 
                                color="warning" 
                                sx={{ mr: 1, fontSize: '0.65rem' }}
                              />
                              {endpoint.endpoint}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                Failure Rate
                              </Typography>
                              <Typography 
                                variant="body2" 
                                color="error.main" 
                                sx={{ 
                                  fontWeight: 600,
                                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                }}
                              >
                                {endpoint.failure_rate_percent.toFixed(1)}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={endpoint.failure_rate_percent}
                              color="error"
                              sx={{ mb: 1, height: { xs: 6, sm: 4 } }}
                            />
                            <Typography 
                              variant="body2" 
                              color="text.secondary"
                              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                            >
                              {endpoint.error_count} errors of {endpoint.total_requests} requests
                            </Typography>
                            {!isMobile && (
                              <Typography 
                                variant="body2" 
                                color="text.secondary" 
                                sx={{ 
                                  mt: 1,
                                  fontSize: '0.75rem',
                                  wordBreak: 'break-word',
                                }}
                              >
                                Most common: {endpoint.most_common_error}
                              </Typography>
                            )}
                          </Paper>
                        </Grid>
                      ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Error Patterns */}
              <Accordion>
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
                    <Assessment color="info" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }} />
                    {isMobile ? "Error Patterns" : "Error Patterns & Correlations"}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: { xs: 1, sm: 2 } }}>
                  <Grid container spacing={{ xs: 2, md: 3 }}>
                    {/* Time of Day Correlation */}
                    <Grid item xs={12} md={4}>
                      <Typography 
                        variant={isMobile ? "body1" : "subtitle1"} 
                        sx={{ 
                          mb: 2,
                          fontSize: { xs: '1rem', md: '1.125rem' },
                          fontWeight: 600,
                        }}
                      >
                        <Schedule sx={{ mr: 1, verticalAlign: 'middle', fontSize: { xs: '1rem', md: '1.125rem' } }} />
                        {isMobile ? "By Hour" : "Errors by Hour"}
                      </Typography>
                      <Stack spacing={1}>
                        {Object.entries(analytics.enhanced_error_tracking.error_patterns.time_of_day_correlation)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, isMobile ? 3 : 5)
                          .map(([hour, count]) => (
                            <Box key={hour} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography 
                                variant="body2"
                                sx={{ fontSize: { xs: '0.875rem', md: '0.875rem' } }}
                              >
                                {hour}:00
                              </Typography>
                              <Chip 
                                label={count} 
                                size="small" 
                                color="error"
                                sx={{ fontSize: '0.65rem' }}
                              />
                            </Box>
                          ))}
                      </Stack>
                    </Grid>

                    {/* Endpoint Correlation */}
                    <Grid item xs={12} md={8}>
                      <Typography 
                        variant={isMobile ? "body1" : "subtitle1"} 
                        sx={{ 
                          mb: 2,
                          fontSize: { xs: '1rem', md: '1.125rem' },
                          fontWeight: 600,
                        }}
                      >
                        <Api sx={{ mr: 1, verticalAlign: 'middle', fontSize: { xs: '1rem', md: '1.125rem' } }} />
                        {isMobile ? "Error-Prone" : "Top Error-Prone Endpoints"}
                      </Typography>
                      {isMobile ? (
                        <Stack spacing={1}>
                          {Object.entries(analytics.enhanced_error_tracking.error_patterns.endpoint_correlation)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 4)
                            .map(([endpoint, count]) => (
                              <Card key={endpoint} variant="outlined" sx={{ borderRadius: 2 }}>
                                <CardContent sx={{ p: 1.5 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography 
                                      sx={{ 
                                        fontFamily: 'monospace', 
                                        fontSize: '0.75rem',
                                        wordBreak: 'break-all',
                                        flex: 1,
                                        mr: 1,
                                      }}
                                    >
                                      {endpoint}
                                    </Typography>
                                    <Chip 
                                      label={count} 
                                      size="small" 
                                      color="error"
                                      sx={{ fontSize: '0.65rem' }}
                                    />
                                  </Box>
                                </CardContent>
                              </Card>
                            ))}
                        </Stack>
                      ) : (
                        <TableContainer component={Paper} sx={{ maxHeight: 300, borderRadius: 2 }}>
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
                      )}
                    </Grid>
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

export default EnhancedApiAnalytics;