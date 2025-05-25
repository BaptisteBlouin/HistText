import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Typography, 
  CircularProgress, 
  Button, 
  Card,
  CardContent,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
  Alert,
  Fade,
  Tooltip,
  IconButton,
  Collapse,
  LinearProgress
} from '@mui/material';
import {
  People,
  Storage,
  Description,
  Refresh,
  TrendingUp,
  Memory,
  Speed,
  Assessment,
  ExpandMore,
  ExpandLess,
  Delete,
  Analytics
} from '@mui/icons-material';
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
    entries_count: number;
    memory_usage: number;
    max_memory: number;
    hit_ratio: number;
    total_hits: number;
    total_misses: number;
    total_evictions: number;
    total_embeddings_loaded: number;
  };
  performance: {
    avg_similarity_time_us: number;
    avg_search_time_ms: number;
    total_similarity_computations: number;
    total_searches: number;
    peak_memory_bytes: number;
    samples_collected: number;
  };
  system_info: {
    cpu_cores: number;
    total_memory_bytes: number;
    architecture: string;
    operating_system: string;
  };
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const { accessToken } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
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
        { headers: { Authorization: `Bearer ${accessToken}` } }
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
        { headers: { Authorization: `Bearer ${accessToken}` } }
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

  const StatCard = ({ icon, title, value, subtitle, color = 'primary' }: {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtitle?: string;
    color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  }) => (
    <Card 
      sx={{ 
        height: '100%',
        background: `linear-gradient(135deg, ${theme.palette[color].light} 0%, ${theme.palette[color].main} 100%)`,
        color: 'white',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        }
      }}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ fontSize: 40, opacity: 0.9 }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            {value}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, opacity: 0.9 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 8 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Loading dashboard data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={fetchStats}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert severity="warning">
        No dashboard data available.
      </Alert>
    );
  }

  return (
    <Fade in={true} timeout={600}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment color="primary" />
              System Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Monitor system performance and resource usage
            </Typography>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchStats} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<People />}
              title="Total Users"
              value={formatNumber(stats.total_users)}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Storage />}
              title="Collections"
              value={formatNumber(stats.total_collections)}
              subtitle={`${stats.active_collections} active`}
              color="secondary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Description />}
              title="Documents"
              value={formatNumber(stats.total_docs)}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<TrendingUp />}
              title="Active Collections"
              value={formatNumber(stats.active_collections)}
              color="warning"
           />
         </Grid>
       </Grid>

       <Card sx={{ mb: 4 }}>
         <CardContent>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
             <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
               <Memory />
               Embedding Cache Management
             </Typography>
             <Stack direction="row" spacing={1}>
               <Button
                 variant="outlined"
                 onClick={() => setShowEmbeddingDetails(!showEmbeddingDetails)}
                 endIcon={showEmbeddingDetails ? <ExpandLess /> : <ExpandMore />}
                 size="small"
               >
                 Basic Stats
               </Button>
               <Button
                 variant="outlined"
                 onClick={() => setShowAdvancedStats(!showAdvancedStats)}
                 endIcon={showAdvancedStats ? <ExpandLess /> : <ExpandMore />}
                 size="small"
               >
                 Advanced Stats
               </Button>
               <Button
                 variant="outlined"
                 color="warning"
                 onClick={clearEmbeddingCache}
                 startIcon={<Delete />}
                 size="small"
               >
                 Clear Cache
               </Button>
               <Button
                 variant="outlined"
                 color="secondary"
                 onClick={resetMetrics}
                 startIcon={<Analytics />}
                 size="small"
               >
                 Reset Metrics
               </Button>
             </Stack>
           </Box>

           <Collapse in={showEmbeddingDetails}>
             <Box sx={{ mb: 3 }}>
               <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                 <Speed />
                 Basic Performance Metrics
               </Typography>
               
               {detailsLoading ? (
                 <LinearProgress sx={{ my: 2 }} />
               ) : !embeddingDetails ? (
                 <Alert severity="info">No detailed embedding statistics available</Alert>
               ) : (
                 <Grid container spacing={2}>
                   <Grid item xs={12} sm={6} md={3}>
                     <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                       <Typography variant="h6">{formatPercentage(embeddingDetails.hit_ratio)}</Typography>
                       <Typography variant="body2">Cache Hit Ratio</Typography>
                     </Paper>
                   </Grid>
                   <Grid item xs={12} sm={6} md={3}>
                     <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
                       <Typography variant="h6">{formatBytes(embeddingDetails.memory_usage_bytes)}</Typography>
                       <Typography variant="body2">Memory Usage</Typography>
                     </Paper>
                   </Grid>
                   <Grid item xs={12} sm={6} md={3}>
                     <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                       <Typography variant="h6">{formatNumber(embeddingDetails.path_cache_entries)}</Typography>
                       <Typography variant="body2">Cache Entries</Typography>
                     </Paper>
                   </Grid>
                   <Grid item xs={12} sm={6} md={3}>
                     <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
                       <Typography variant="h6">{formatNumber(embeddingDetails.total_embeddings_loaded)}</Typography>
                       <Typography variant="body2">Total Embeddings</Typography>
                     </Paper>
                   </Grid>
                 </Grid>
               )}
             </Box>
           </Collapse>

           <Collapse in={showAdvancedStats}>
             <Box>
               <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                 <Analytics />
                 Advanced System Analytics
               </Typography>
               
               {advancedLoading ? (
                 <LinearProgress sx={{ my: 2 }} />
               ) : !advancedStats ? (
                 <Alert severity="info">No advanced statistics available</Alert>
               ) : (
                 <Stack spacing={3}>
                   <Box>
                     <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                       Cache Performance
                     </Typography>
                     <Grid container spacing={2}>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{formatPercentage(advancedStats.cache?.hit_ratio)}</Typography>
                           <Typography variant="body2">Hit Ratio</Typography>
                         </Paper>
                       </Grid>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{formatNumber(advancedStats.cache?.entries_count)}</Typography>
                           <Typography variant="body2">Cache Entries</Typography>
                         </Paper>
                       </Grid>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{formatBytes(advancedStats.cache?.memory_usage)}</Typography>
                           <Typography variant="body2">Memory Usage</Typography>
                         </Paper>
                       </Grid>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{formatBytes(advancedStats.cache?.max_memory)}</Typography>
                           <Typography variant="body2">Memory Limit</Typography>
                         </Paper>
                       </Grid>
                     </Grid>
                   </Box>

                   <Box>
                     <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                       Performance Metrics
                     </Typography>
                     <Grid container spacing={2}>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">
                             {(advancedStats.performance?.avg_search_time_ms || 0).toFixed(1)} ms
                           </Typography>
                           <Typography variant="body2">Avg Search Time</Typography>
                         </Paper>
                       </Grid>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">
                             {(advancedStats.performance?.avg_similarity_time_us || 0).toFixed(1)} μs
                           </Typography>
                           <Typography variant="body2">Avg Similarity Time</Typography>
                         </Paper>
                       </Grid>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{formatNumber(advancedStats.performance?.total_searches)}</Typography>
                           <Typography variant="body2">Total Searches</Typography>
                         </Paper>
                       </Grid>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{formatBytes(advancedStats.performance?.peak_memory_bytes)}</Typography>
                           <Typography variant="body2">Peak Memory</Typography>
                         </Paper>
                       </Grid>
                     </Grid>
                   </Box>

                   <Box>
                     <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                       System Information
                     </Typography>
                     <Grid container spacing={2}>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{formatNumber(advancedStats.system_info?.cpu_cores)}</Typography>
                           <Typography variant="body2">CPU Cores</Typography>
                         </Paper>
                       </Grid>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{formatBytes(advancedStats.system_info?.total_memory_bytes)}</Typography>
                           <Typography variant="body2">Total Memory</Typography>
                         </Paper>
                       </Grid>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{advancedStats.system_info?.architecture || 'Unknown'}</Typography>
                           <Typography variant="body2">Architecture</Typography>
                         </Paper>
                       </Grid>
                       <Grid item xs={12} sm={6} md={3}>
                         <Paper sx={{ p: 2, textAlign: 'center' }}>
                           <Typography variant="h6">{advancedStats.system_info?.operating_system || 'Unknown'}</Typography>
                           <Typography variant="body2">Operating System</Typography>
                         </Paper>
                       </Grid>
                     </Grid>
                     
                     <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
                       Last updated: {new Date(advancedStats.timestamp).toLocaleString()}
                     </Typography>
                   </Box>
                 </Stack>
               )}
             </Box>
           </Collapse>
         </CardContent>
       </Card>
     </Box>
   </Fade>
 );
};

export default Dashboard;