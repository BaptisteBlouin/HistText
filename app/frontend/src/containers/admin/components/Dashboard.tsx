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
  collection_cache_entries: number;
  path_cache_entries: number;
  total_embeddings_loaded: number;
  path_cache_details: Array<{
    path: string;
    size: number;
    last_used: string;
  }>;
}

const Dashboard: React.FC = () => {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [embeddingDetails, setEmbeddingDetails] = useState<DetailedEmbeddingStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmbeddingDetails, setShowEmbeddingDetails] = useState<boolean>(false);

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
    } catch (err: any) {
      console.error('Failed to clear embedding cache:', err);
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

      {/* Embedding Details Toggle */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button
          variant="outlined"
          onClick={() => setShowEmbeddingDetails(!showEmbeddingDetails)}
          sx={{ mr: 2 }}
        >
          {showEmbeddingDetails ? 'Hide Details' : 'Show Embedding Details'}
        </Button>
        <Button variant="outlined" color="warning" onClick={clearEmbeddingCache}>
          Clear Embedding Cache
        </Button>
      </Box>

      {/* Embedding Details Section */}
      {showEmbeddingDetails && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="h6" gutterBottom>
            Detailed Embedding Cache Information
          </Typography>

          {detailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !embeddingDetails ? (
            <Typography color="text.secondary">No detailed information available</Typography>
          ) : (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Cache Files:
              </Typography>
              {embeddingDetails.path_cache_details.length === 0 ? (
                <Typography color="text.secondary">No embedding files cached</Typography>
              ) : (
                embeddingDetails.path_cache_details.map((detail, index) => (
                  <Paper elevation={1} sx={{ p: 2, mb: 2 }} key={index}>
                    <Typography component="div">
                      <strong>Path:</strong> {detail.path}
                    </Typography>
                    <Typography component="div">
                      <strong>Word Count:</strong> {formatNumber(detail.size)}
                    </Typography>
                    <Typography component="div">
                      <strong>Last Used:</strong> {detail.last_used}
                    </Typography>
                  </Paper>
                ))
              )}
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
