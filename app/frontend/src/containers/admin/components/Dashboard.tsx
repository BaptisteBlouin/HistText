import React, { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography, CircularProgress, Button, Divider } from '@mui/material';
import axios from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface Stats {
  active_users: number;
  total_users: number;
  total_roles: number;
  total_permissions: number;
  solr_collections: number;
  embedding_files_loaded: number;
  embedding_collections_cached: number;
  embedding_words_loaded: number;
}

interface DetailedEmbeddingStats {
  embedding_files_loaded: number;
  embedding_collections_cached: number;
  embedding_words_loaded: number;
  cache_hit_ratio: number;
  memory_usage_mb: number;
}

interface AdvancedCacheStats {
  basic_stats: {
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
  collected_at: string;
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
      // Refresh data after clearing
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
      // Refresh advanced stats after reset
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

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (ratio: number) => {
    return (ratio * 100).toFixed(1) + '%';
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

      {/* User & System Stats */}
      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>
        System Overview
      </Typography>
      <Grid container spacing={3}>
        {renderCard('Active Users', stats.active_users)}
        {renderCard('Total Users', stats.total_users)}
        {renderCard('Total Roles', stats.total_roles)}
        {renderCard('Total Permissions', stats.total_permissions)}
        {renderCard('Solr Collections', stats.solr_collections)}
      </Grid>

      {/* Embedding Stats */}
      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Embedding Cache Statistics
      </Typography>
      <Grid container spacing={3}>
        {renderCard('Embedding Files Loaded', stats.embedding_files_loaded)}
        {renderCard('Collections Using Embeddings', stats.embedding_collections_cached)}
        {renderCard('Total Words in Cache', formatNumber(stats.embedding_words_loaded))}
      </Grid>

      {/* Embedding Controls */}
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

      {/* Basic Embedding Details */}
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
                  <Typography variant="h5">{formatPercentage(embeddingDetails.cache_hit_ratio)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2">Memory Usage</Typography>
                  <Typography variant="h5">{embeddingDetails.memory_usage_mb.toFixed(1)} MB</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2">Files Cached</Typography>
                  <Typography variant="h5">{embeddingDetails.embedding_files_loaded}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2">Collections Cached</Typography>
                  <Typography variant="h5">{embeddingDetails.embedding_collections_cached}</Typography>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {/* Advanced Cache Statistics */}
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
              {/* Cache Performance */}
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                Cache Performance
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Hit Ratio</Typography>
                    <Typography variant="h6">{formatPercentage(advancedStats.basic_stats.hit_ratio)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Total Hits</Typography>
                    <Typography variant="h6">{formatNumber(advancedStats.basic_stats.total_hits)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Total Misses</Typography>
                    <Typography variant="h6">{formatNumber(advancedStats.basic_stats.total_misses)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Evictions</Typography>
                    <Typography variant="h6">{formatNumber(advancedStats.basic_stats.total_evictions)}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Memory Usage */}
              <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
                Memory Usage
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Current Usage</Typography>
                    <Typography variant="h6">{formatBytes(advancedStats.basic_stats.memory_usage_bytes)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Memory Limit</Typography>
                    <Typography variant="h6">{formatBytes(advancedStats.basic_stats.memory_limit_bytes)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Peak Usage</Typography>
                    <Typography variant="h6">{formatBytes(advancedStats.performance.peak_memory_bytes)}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Performance Metrics */}
              <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
                Performance Metrics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Avg Search Time</Typography>
                    <Typography variant="h6">{advancedStats.performance.avg_search_time_ms.toFixed(1)} ms</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Avg Similarity Time</Typography>
                    <Typography variant="h6">{advancedStats.performance.avg_similarity_time_us.toFixed(1)} μs</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Total Searches</Typography>
                    <Typography variant="h6">{formatNumber(advancedStats.performance.total_searches)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Similarity Computations</Typography>
                    <Typography variant="h6">{formatNumber(advancedStats.performance.total_similarity_computations)}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* System Information */}
              <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
                System Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">CPU Cores</Typography>
                    <Typography variant="h6">{advancedStats.system_info.cpu_cores}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Total Memory</Typography>
                    <Typography variant="h6">{formatBytes(advancedStats.system_info.total_memory_bytes)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">Architecture</Typography>
                    <Typography variant="h6">{advancedStats.system_info.architecture}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2">OS</Typography>
                    <Typography variant="h6">{advancedStats.system_info.operating_system}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center' }}>
                Last updated: {new Date(advancedStats.collected_at).toLocaleString()}
              </Typography>
            </>
          )}
        </Box>
      )}

      {/* Refresh Button */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button variant="contained" onClick={fetchStats}>
          Refresh All Stats
        </Button>
      </Box>
    </Box>
  );
};

export default Dashboard;