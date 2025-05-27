// app/frontend/src/containers/admin/components/dashboard/components/ApiAnalytics.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Collapse,
  LinearProgress,
  Alert,
  Stack,
  Grid,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Analytics,
  ExpandMore,
  ExpandLess,
  Refresh,
  TrendingUp,
  TrendingDown,
  Timeline,
} from '@mui/icons-material';
import { useAuth } from '../../../../../hooks/useAuth';
import { RequestAnalytics } from '../types';
import { formatNumber } from '../utils/formatters';
import { useAnalytics } from '../hooks/useAnalytics';

interface ApiAnalyticsProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onToggle?: () => void;
  isVisible?: boolean;
}

export const ApiAnalytics: React.FC<ApiAnalyticsProps> = ({
  autoRefresh = false,
  refreshInterval = 60000,
  onToggle,
  isVisible: propIsVisible,
}) => {
  const { accessToken } = useAuth();
  const [internalIsVisible, setInternalIsVisible] = useState(false);
  const [previousData, setPreviousData] = useState<RequestAnalytics | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use prop visibility if provided, otherwise use internal state
  const isVisible = propIsVisible !== undefined ? propIsVisible : internalIsVisible;

  const {
    analytics,
    analyticsLoading,
    fetchAnalytics,
  } = useAnalytics(accessToken || null, isVisible); // Fixed: provide both arguments

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh && isVisible && !analyticsLoading) {
      intervalRef.current = setInterval(() => {
        fetchAnalytics();
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, isVisible, analyticsLoading, refreshInterval, fetchAnalytics]);

  // Track changes for trend indicators
  useEffect(() => {
    if (analytics && previousData) {
      // You can add notification logic here for significant changes
    }
    if (analytics) {
      setPreviousData(analytics);
    }
  }, [analytics, previousData]);

  const getTrendIndicator = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    
    if (Math.abs(change) < 5) return null; // No significant change
    
    return (
      <Chip
        icon={change > 0 ? <TrendingUp /> : <TrendingDown />}
        label={`${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
        color={change > 0 ? 'success' : 'error'}
        size="small"
        variant="outlined"
      />
    );
  };

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      const newVisible = !internalIsVisible;
      setInternalIsVisible(newVisible);
      
      if (newVisible && !analytics) {
        fetchAnalytics();
      }
    }
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Analytics />
            API Usage Analytics
            {autoRefresh && isVisible && (
              <Chip 
                icon={<Timeline />}
                label="Live"
                color="success"
                size="small"
              />
            )}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Analytics">
              <IconButton onClick={fetchAnalytics} disabled={analyticsLoading}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              onClick={handleToggle}
              endIcon={isVisible ? <ExpandLess /> : <ExpandMore />}
              size="small"
            >
              {isVisible ? 'Hide Analytics' : 'Show Analytics'}
            </Button>
          </Stack>
        </Box>

        <Collapse in={isVisible}>
          {analyticsLoading ? (
            <Box>
              <LinearProgress sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Loading API analytics...
              </Typography>
            </Box>
          ) : !analytics ? (
            <Alert severity="info">No analytics data available</Alert>
          ) : (
            <Stack spacing={3}>
              {/* Overall API Stats with Trends */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  24-Hour Overview
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                      <Typography variant="h6">{formatNumber(analytics.total_requests_24h)}</Typography>
                      <Typography variant="body2">Total Requests</Typography>
                      {previousData && getTrendIndicator(
                        analytics.total_requests_24h, 
                        previousData.total_requests_24h
                      )}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                      <Typography variant="h6">{analytics.average_response_time_ms.toFixed(1)} ms</Typography>
                      <Typography variant="body2">Avg Response Time</Typography>
                      {previousData && getTrendIndicator(
                        analytics.average_response_time_ms, 
                        previousData.average_response_time_ms
                      )}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ 
                      p: 2, 
                      textAlign: 'center', 
                      bgcolor: analytics.error_rate_percent > 5 ? 'error.light' : 'warning.light', 
                      color: analytics.error_rate_percent > 5 ? 'error.contrastText' : 'warning.contrastText' 
                    }}>
                      <Typography variant="h6">{analytics.error_rate_percent.toFixed(1)}%</Typography>
                      <Typography variant="body2">Error Rate</Typography>
                      {previousData && getTrendIndicator(
                        analytics.error_rate_percent, 
                        previousData.error_rate_percent
                      )}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
                      <Typography variant="h6">{Object.keys(analytics.endpoint_stats).length}</Typography>
                      <Typography variant="body2">Active Endpoints</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>

              {/* Most Used Endpoints */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Most Used Endpoints
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Method</TableCell>
                      <TableCell>Endpoint</TableCell>
                      <TableCell align="right">Requests</TableCell>
                      <TableCell align="right">Avg Time (ms)</TableCell>
                      <TableCell align="right">Success Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.values(analytics.endpoint_stats)
                      .sort((a, b) => b.request_count - a.request_count)
                      .slice(0, 10)
                      .map((endpoint, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Chip 
                              label={endpoint.method} 
                              size="small"
                              color={endpoint.method === 'GET' ? 'success' : endpoint.method === 'POST' ? 'primary' : 'default'}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            {endpoint.path_pattern}
                          </TableCell>
                          <TableCell align="right">{formatNumber(endpoint.request_count)}</TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="body2" 
                              color={endpoint.average_response_time_ms > 1000 ? 'error' : endpoint.average_response_time_ms > 500 ? 'warning.main' : 'inherit'}
                            >
                              {endpoint.average_response_time_ms.toFixed(1)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="body2" 
                              color={endpoint.success_rate_percent < 95 ? 'error' : 'inherit'}
                            >
                              {endpoint.success_rate_percent.toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Box>

              {/* Slowest Endpoints */}
              {analytics.top_slow_endpoints.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'warning.main' }}>
                    Slowest Endpoints (Needs Attention)
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Method</TableCell>
                        <TableCell>Endpoint</TableCell>
                        <TableCell align="right">Avg Time (ms)</TableCell>
                        <TableCell align="right">Requests</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.top_slow_endpoints.slice(0, 5).map((endpoint, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Chip label={endpoint.method} size="small" color="warning" />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            {endpoint.path}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                              {endpoint.average_response_time_ms.toFixed(1)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{formatNumber(endpoint.request_count)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}

              <Typography variant="caption" display="block" sx={{ textAlign: 'center', color: 'text.secondary' }}>
                Last updated: {new Date(analytics.last_updated * 1000).toLocaleString()}
                {autoRefresh && ` • Auto-refresh: ${refreshInterval / 1000}s`}
              </Typography>
            </Stack>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default ApiAnalytics;