import React, { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography, CircularProgress, Button, Divider } from '@mui/material';
import axios from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface Stats {
  total_docs: number;
  total_collections: number;
  total_users: number;
  active_collections: number;
}

interface DetailedEmbeddingStats {
  collection_cache_entries: number;
  path_cache_entries: number;
  total_embeddings_loaded: number;
  memory_usage_bytes: number;
  memory_limit_bytes: number;
  memory_usage_percent: number;
  hit_ratio: number;
  total_hits: number;
  total_misses: number;
  total_evictions: number;
  last_eviction?: string;
  uptime_seconds: number;
}

interface AdvancedCacheStats {
  cache: {
    path_cache_entries: number;
    collection_cache_entries: number;
    total_embeddings_loaded: number;
    memory_usage_bytes: number;
    memory_limit_bytes: number;
    hit_ratio: number;
    total_hits: number;
    total_misses: number;
    total_evictions: number;
    last_eviction?: string;
  };
  system: {
    cache: {
      entries_count: number;
      memory_usage: number;
      max_memory: number;
      hit_ratio: number;
    };
    performance: {
      avg_similarity_time_us: number;
      avg_search_time_ms: number;
      total_similarity_computations: number;
      total_searches: number;
      peak_memory_bytes: number;
    };
    system_info: {
      cpu_cores: number;
      total_memory_bytes: number;
      architecture: string;
      operating_system: string;
    };
  };
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [embeddingDetails, setEmbeddingDetails] = useState<DetailedEmbeddingStats | null>(null);
  const [advancedStats, setAdvancedStats] = useState<AdvancedCacheStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [advancedLoading, setAdvancedLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmbeddingDetails, setShowEmbeddingDetails] = useState<boolean>(false);
  const [showAdvancedStats, setShowAdvancedStats] = useState<boolean>(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get<Stats>('/api/stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load dashboard stats:', err);
      setError('Failed to load dashboard stats. Please try again.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmbeddingDetails = async () => {
    try {
      setDetailsLoading(true);
      const response = await axios.get<DetailedEmbeddingStats>('/api/embeddings/stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setEmbeddingDetails(response.data);
    } catch (err: any) {
      console.error('Failed to load embedding details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchAdvancedStats = async () => {
    try {
      setAdvancedLoading(true);
      const response = await axios.get<AdvancedCacheStats>('/api/embeddings/advanced-stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setAdvancedStats(response.data);
    } catch (err: any) {
      console.error('Failed to load advanced cache stats:', err);
    } finally {
      setAdvancedLoading(false);
    }
  };

  const clearEmbeddingCache = async () => {
    try {
      await axios.post(
        '/api/embeddings/clear',
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      fetchStats();
      fetchEmbeddingDetails();
      if (showAdvancedStats) {
        fetchAdvancedStats();
      }
    } catch (err: any) {
      console.error('Failed to clear embedding cache:', err);
    }
  };

  const resetMetrics = async () => {
    try {
      await axios.post(
        '/api/embeddings/reset-metrics',
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (showAdvancedStats) {
        fetchAdvancedStats();
      }
    } catch (err: any) {
      console.error('Failed to reset metrics:', err);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchStats();
    }
  }, [accessToken]);

  useEffect(() => {
    if (showEmbeddingDetails && accessToken) {
      fetchEmbeddingDetails();
    }
  }, [showEmbeddingDetails, accessToken]);

  useEffect(() => {
    if (showAdvancedStats && accessToken) {
      fetchAdvancedStats();
    }
  }, [showAdvancedStats, accessToken]);

  const renderCard = (label: string, value: number | string) => (
    <Grid item xs={12} sm={6} md={4} key={label}>
      <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">{label}</Typography>
        <Typography variant="h4">{value}</Typography>
      </Paper>
    </Grid>
  );

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    return num.toLocaleString();
  };

  const formatBytes = (bytes: number | undefined | null) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (ratio: number | undefined | null) => {
    if (ratio === undefined || ratio === null || isNaN(ratio)) {
      return '0.0%';
    }
    return (ratio * 100).toFixed(1) + '%';
  };

  const safeNumber = (value: number | undefined | null): number => {
    return value && !isNaN(value) ? value : 0;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          {error}
        </Typography>
        <Button variant="contained" color="primary" onClick={fetchStats} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!stats) {
    return (
      <Typography variant="h6" color="error" sx={{ mt: 4 }}>
        No data available.
      </Typography>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>
        System Overview
      </Typography>
      <Grid container spacing={3}>
        {renderCard('Total Users', formatNumber(stats.total_users))}
        {renderCard('Total Collections', formatNumber(stats.total_collections))}
        {renderCard('Active Collections', formatNumber(stats.active_collections))}
        {renderCard('Total Documents', formatNumber(stats.total_docs))}
      </Grid>

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Embedding Cache Management
      </Typography>

      <Box sx={{ mt: 3, textAlign: 'center', display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          onClick={() => setShowEmbeddingDetails(!showEmbeddingDetails)}
        >
          {showEmbeddingDetails ? 'Hide Basic Stats' : 'Show Basic Stats'}
        </Button>
        <Button
          variant="outlined"
          onClick={() => setShowAdvancedStats(!showAdvancedStats)}
        >
          {showAdvancedStats ? 'Hide Advanced Stats' : 'Show Advanced Stats'}
        </Button>
        <Button variant="outlined" color="warning" onClick={clearEmbeddingCache}>
          Clear Cache
        </Button>
        <Button variant="outlined" color="secondary" onClick={resetMetrics}>
          Reset Metrics
        </Button>
      </Box>

      {showEmbeddingDetails && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="h6" gutterBottom>
            Basic Embedding Statistics
          </Typography>

          {detailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !embeddingDetails ? (
            <Typography color="text.secondary">No detailed information available</Typography>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2">Cache Hit Ratio</Typography>
                  <Typography variant="h5">{formatPercentage(embeddingDetails.hit_ratio)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2">Memory Usage</Typography>
                  <Typography variant="h5">{formatBytes(embeddingDetails.memory_usage_bytes)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2">Cache Entries</Typography>
                  <Typography variant="h5">{formatNumber(embeddingDetails.path_cache_entries)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2">Total Embeddings</Typography>
                  <Typography variant="h5">{formatNumber(embeddingDetails.total_embeddings_loaded)}</Typography>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {showAdvancedStats && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="h6" gutterBottom>
            Advanced Cache Statistics
          </Typography>

          {advancedLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !advancedStats ? (
            <Typography color="text.secondary">No advanced statistics available</Typography>
          ) : (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                Cache Performance
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Hit Ratio</Typography>
                    <Typography variant="h6">{formatPercentage(advancedStats.system?.cache?.hit_ratio)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Cache Entries</Typography>
                    <Typography variant="h6">{formatNumber(advancedStats.system?.cache?.entries_count)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Memory Usage</Typography>
                    <Typography variant="h6">{formatBytes(advancedStats.system?.cache?.memory_usage)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Memory Limit</Typography>
                    <Typography variant="h6">{formatBytes(advancedStats.system?.cache?.max_memory)}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
                Performance Metrics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Avg Search Time</Typography>
                    <Typography variant="h6">{safeNumber(advancedStats.system?.performance?.avg_search_time_ms).toFixed(1)} ms</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Avg Similarity Time</Typography>
                    <Typography variant="h6">{safeNumber(advancedStats.system?.performance?.avg_similarity_time_us).toFixed(1)} μs</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Total Searches</Typography>
                    <Typography variant="h6">{formatNumber(advancedStats.system?.performance?.total_searches)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Peak Memory</Typography>
                    <Typography variant="h6">{formatBytes(advancedStats.system?.performance?.peak_memory_bytes)}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
                System Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">CPU Cores</Typography>
                    <Typography variant="h6">{formatNumber(advancedStats.system?.system_info?.cpu_cores)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Total Memory</Typography>
                    <Typography variant="h6">{formatBytes(advancedStats.system?.system_info?.total_memory_bytes)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Architecture</Typography>
                    <Typography variant="h6">{advancedStats.system?.system_info?.architecture || 'Unknown'}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">OS</Typography>
                    <Typography variant="h6">{advancedStats.system?.system_info?.operating_system || 'Unknown'}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center' }}>
                Last updated: {new Date(advancedStats.timestamp).toLocaleString()}
              </Typography>
            </>
          )}
        </Box>
      )}

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button variant="contained" onClick={fetchStats}>
          Refresh All Stats
        </Button>
      </Box>
    </Box>
  );
};

export default Dashboard;