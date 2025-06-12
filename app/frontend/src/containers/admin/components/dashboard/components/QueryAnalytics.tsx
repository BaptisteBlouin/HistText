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
  Search,
  TrendingUp,
  ExpandMore,
  Schedule,
  Speed,
  Assessment,
  Refresh,
  Storage,
  Timeline,
  Psychology,
  Warning,
  CheckCircle,
  Person,
  AccessTime,
  QueryStats,
} from '@mui/icons-material';
import { useAuth } from '../../../../../hooks/useAuth';
import { UserList } from '../../../../../components/ui';

interface TopQuery {
  query: string;
  frequency: number;
  avg_response_time_ms: number;
  result_count_avg: number;
  success_rate_percent: number;
  unique_users: number;
  user_list?: Array<{
    user_id: number;
    username: string;
    query_count: number;
    last_query: number;
  }>;
  peak_usage_hour: number;
  collections?: string[];
}

interface SlowQuery {
  query: string;
  avg_response_time_ms: number;
  frequency: number;
  collection: string;
  optimization_potential: number;
}

interface CollectionUsage {
  collection_name: string;
  query_count: number;
  unique_users: number;
  avg_response_time_ms: number;
  growth_rate_percent: number;
}

interface QueryComplexityTrends {
  simple_queries_percent: number;
  moderate_queries_percent: number;
  complex_queries_percent: number;
  avg_terms_per_query: number;
}

interface ResponseTimeDistribution {
  very_fast: number;
  fast: number;
  moderate: number;
  slow: number;
  very_slow: number;
}

interface QueryAnalytics {
  top_queries: TopQuery[];
  query_performance: {
    slow_queries: SlowQuery[];
    failed_queries: any[];
    optimization_suggestions: string[];
    response_time_distribution: ResponseTimeDistribution;
  };
  search_trends: {
    popular_collections: CollectionUsage[];
    query_complexity_trends: QueryComplexityTrends;
  };
  optimization_insights: any;
  user_search_behavior: any;
  last_updated: number;
}

interface QueryAnalyticsProps {
  autoRefresh: boolean;
  refreshInterval: number;
  onToggle: () => void;
  isVisible: boolean;
}

const QueryAnalytics: React.FC<QueryAnalyticsProps> = ({
  autoRefresh,
  refreshInterval,
  onToggle,
  isVisible,
}) => {
  const theme = useTheme();
  const { accessToken } = useAuth();
  const [analytics, setAnalytics] = useState<QueryAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/dashboard/query-analytics', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch query analytics: ${response.statusText}`);
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

  const getPerformanceColor = (responseTime: number) => {
    if (responseTime < 100) return 'success';
    if (responseTime < 500) return 'info';
    if (responseTime < 2000) return 'warning';
    return 'error';
  };

  const getComplexityColor = (type: string) => {
    switch (type) {
      case 'simple': return 'success';
      case 'moderate': return 'warning';
      case 'complex': return 'error';
      default: return 'default';
    }
  };

  const truncateQuery = (query: string, maxLength: number = 50) => {
    return query.length > maxLength ? `${query.substring(0, maxLength)}...` : query;
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Search color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Query Analytics & Search Patterns
            </Typography>
            {analytics && (
              <Chip
                label={`${analytics.top_queries.length} Top Queries`}
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
              {/* Query Performance Overview */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary.main">
                      {analytics.top_queries.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Popular Queries
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {analytics.query_performance.slow_queries.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Slow Queries
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {analytics.search_trends.popular_collections.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Collections
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {analytics.search_trends.query_complexity_trends.avg_terms_per_query.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Terms/Query
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Top Queries */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp color="primary" />
                    Top Queries & Performance
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Query</TableCell>
                          <TableCell align="right">Collections</TableCell>
                          <TableCell align="right">Frequency</TableCell>
                          <TableCell align="right">Avg Response</TableCell>
                          <TableCell align="right">Success Rate</TableCell>
                          <TableCell align="right">Users</TableCell>
                          <TableCell align="right">Peak Hour</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analytics.top_queries.slice(0, 10).map((query, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Tooltip title={query.query}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', maxWidth: 200 }}>
                                  {truncateQuery(query.query)}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end' }}>
                                {query.collections && query.collections.length > 0 ? (
                                  query.collections.slice(0, 2).map((collection, idx) => (
                                    <Chip 
                                      key={idx} 
                                      label={collection} 
                                      size="small" 
                                      variant="outlined" 
                                      color="info"
                                    />
                                  ))
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    N/A
                                  </Typography>
                                )}
                                {query.collections && query.collections.length > 2 && (
                                  <Tooltip title={`+${query.collections.length - 2} more: ${query.collections.slice(2).join(', ')}`}>
                                    <Chip 
                                      label={`+${query.collections.length - 2}`} 
                                      size="small" 
                                      variant="outlined" 
                                      color="default"
                                    />
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Chip label={query.frequency} size="small" color="primary" />
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={`${query.avg_response_time_ms.toFixed(0)}ms`}
                                size="small"
                                color={getPerformanceColor(query.avg_response_time_ms) as any}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color={query.success_rate_percent > 95 ? 'success.main' : 'warning.main'}>
                                {query.success_rate_percent.toFixed(1)}%
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {query.user_list && query.user_list.length > 0 ? (
                                <UserList
                                  users={query.user_list.map(user => ({
                                    user_id: user.user_id,
                                    username: user.username,
                                    request_count: user.query_count,
                                    last_activity: user.last_query,
                                  }))}
                                  variant="compact"
                                  title="Query Users"
                                  maxVisibleUsers={3}
                                />
                              ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                  <Person fontSize="small" />
                                  {query.unique_users}
                                </Box>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {query.peak_usage_hour}:00
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>

              {/* Query Performance Issues */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning color="warning" />
                    Performance Issues & Optimization
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* Slow Queries */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Slow Queries (&gt;2s)
                      </Typography>
                      <Stack spacing={2}>
                        {analytics.query_performance.slow_queries.slice(0, 5).map((query, index) => (
                          <Paper key={index} sx={{ p: 2 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                              {truncateQuery(query.query, 40)}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Collection: {query.collection}
                              </Typography>
                              <Typography variant="caption" color="error.main">
                                {query.avg_response_time_ms.toFixed(0)}ms
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(query.optimization_potential, 100)}
                              color="warning"
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="caption">
                              Optimization potential: {query.optimization_potential.toFixed(1)}%
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    </Grid>

                    {/* Response Time Distribution */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <AccessTime sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Response Time Distribution
                      </Typography>
                      <Stack spacing={2}>
                        <Paper sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Very Fast (&lt;100ms)</Typography>
                            <Chip label={analytics.query_performance.response_time_distribution.very_fast} color="success" size="small" />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(analytics.query_performance.response_time_distribution.very_fast / 100) * 100}
                            color="success"
                          />
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Fast (100-500ms)</Typography>
                            <Chip label={analytics.query_performance.response_time_distribution.fast} color="info" size="small" />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(analytics.query_performance.response_time_distribution.fast / 100) * 100}
                            color="info"
                          />
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Moderate (500ms-2s)</Typography>
                            <Chip label={analytics.query_performance.response_time_distribution.moderate} color="warning" size="small" />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(analytics.query_performance.response_time_distribution.moderate / 100) * 100}
                            color="warning"
                          />
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Slow (&gt;2s)</Typography>
                            <Chip label={analytics.query_performance.response_time_distribution.slow + analytics.query_performance.response_time_distribution.very_slow} color="error" size="small" />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={((analytics.query_performance.response_time_distribution.slow + analytics.query_performance.response_time_distribution.very_slow) / 100) * 100}
                            color="error"
                          />
                        </Paper>
                      </Stack>
                    </Grid>
                  </Grid>

                  {/* Optimization Suggestions */}
                  {analytics.query_performance.optimization_suggestions.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Optimization Suggestions
                      </Typography>
                      <Stack spacing={1}>
                        {analytics.query_performance.optimization_suggestions.map((suggestion, index) => (
                          <Alert key={index} severity="info" variant="outlined">
                            {suggestion}
                          </Alert>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Search Trends */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timeline color="info" />
                    Search Trends & Collection Usage
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* Popular Collections */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <Storage sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Most Popular Collections
                      </Typography>
                      <Stack spacing={2}>
                        {analytics.search_trends.popular_collections.slice(0, 5).map((collection, index) => (
                          <Paper key={index} sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                              {collection.collection_name}
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">Queries</Typography>
                                <Typography variant="body2">{collection.query_count}</Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">Users</Typography>
                                <Typography variant="body2">{collection.unique_users}</Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">Avg Response</Typography>
                                <Typography variant="body2">{collection.avg_response_time_ms.toFixed(0)}ms</Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">Growth</Typography>
                                <Typography variant="body2" color={collection.growth_rate_percent > 0 ? 'success.main' : 'error.main'}>
                                  {collection.growth_rate_percent > 0 ? '+' : ''}{collection.growth_rate_percent.toFixed(1)}%
                                </Typography>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))}
                      </Stack>
                    </Grid>

                    {/* Query Complexity Trends */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <QueryStats sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Query Complexity Analysis
                      </Typography>
                      <Stack spacing={2}>
                        <Paper sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Simple Queries</Typography>
                            <Chip 
                              label={`${analytics.search_trends.query_complexity_trends.simple_queries_percent.toFixed(1)}%`} 
                              color="success" 
                              size="small" 
                            />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={analytics.search_trends.query_complexity_trends.simple_queries_percent}
                            color="success"
                          />
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Moderate Queries</Typography>
                            <Chip 
                              label={`${analytics.search_trends.query_complexity_trends.moderate_queries_percent.toFixed(1)}%`} 
                              color="warning" 
                              size="small" 
                            />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={analytics.search_trends.query_complexity_trends.moderate_queries_percent}
                            color="warning"
                          />
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Complex Queries</Typography>
                            <Chip 
                              label={`${analytics.search_trends.query_complexity_trends.complex_queries_percent.toFixed(1)}%`} 
                              color="error" 
                              size="small" 
                            />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={analytics.search_trends.query_complexity_trends.complex_queries_percent}
                            color="error"
                          />
                        </Paper>
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                          <Typography variant="h6" color="primary.main">
                            {analytics.search_trends.query_complexity_trends.avg_terms_per_query.toFixed(1)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Average terms per query
                          </Typography>
                        </Box>
                      </Stack>
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

export default QueryAnalytics;