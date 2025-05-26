import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Analytics,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { RequestAnalytics } from '../types';
import { formatNumber } from '../utils/formatters';

interface ApiAnalyticsProps {
  analytics: RequestAnalytics | null;
  loading: boolean;
  onToggle: () => void;
  isVisible: boolean;
}

export const ApiAnalytics: React.FC<ApiAnalyticsProps> = ({
  analytics,
  loading,
  onToggle,
  isVisible,
}) => {
  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Analytics />
            API Usage Analytics
          </Typography>
          <Button
            variant="outlined"
            onClick={onToggle}
            endIcon={isVisible ? <ExpandLess /> : <ExpandMore />}
            size="small"
          >
            {isVisible ? 'Hide Analytics' : 'Show Analytics'}
          </Button>
        </Box>

        <Collapse in={isVisible}>
          {loading ? (
            <LinearProgress sx={{ my: 2 }} />
          ) : !analytics ? (
            <Alert severity="info">No analytics data available</Alert>
          ) : (
            <Stack spacing={3}>
              {/* Overall API Stats */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  24-Hour Overview
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                      <Typography variant="h6">{formatNumber(analytics.total_requests_24h)}</Typography>
                      <Typography variant="body2">Total Requests</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                      <Typography variant="h6">{analytics.average_response_time_ms.toFixed(1)} ms</Typography>
                      <Typography variant="body2">Avg Response Time</Typography>
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

              {/* Top Endpoints by Usage */}
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
              </Typography>
            </Stack>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};