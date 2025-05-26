// Updated app/frontend/src/containers/admin/components/Dashboard.tsx

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
  LinearProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider
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
  Analytics,
  CheckCircle,
  Error,
  Warning,
  AccessTime,
  Group,
  PersonAdd,
  CloudQueue,
  Psychology
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface LegacyStats {
  total_docs: number;
  total_collections: number;
  total_users: number;
  active_collections: number;
}

interface SolrDatabaseStatus {
  id: number;
  name: string;
  status: 'online' | 'offline' | 'error';
  document_count?: number;
  collections: CollectionStatus[];
  response_time_ms?: number;
  error_message?: string;
}

interface CollectionStatus {
  name: string;
  document_count?: number;
  has_embeddings: boolean;
  embedding_path?: string;
}

interface EmbeddingSummary {
  total_cached_embeddings: number;
  cache_hit_ratio: number;
  memory_usage_mb: number;
  memory_usage_percent: number;
  cached_collections: number;
}

interface ComprehensiveStats {
  total_documents: number;
  total_collections: number;
  total_users: number;
  active_collections: number;
  active_sessions: number;
  recent_registrations_24h: number;
  solr_databases: SolrDatabaseStatus[];
  embedding_summary: EmbeddingSummary;
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
  
  const [comprehensiveStats, setComprehensiveStats] = useState<ComprehensiveStats | null>(null);
  const [legacyStats, setLegacyStats] = useState<LegacyStats | null>(null);
  const [embeddingDetails, setEmbeddingDetails] = useState<DetailedEmbeddingStats | null>(null);
  const [advancedStats, setAdvancedStats] = useState<AdvancedCacheStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [advancedLoading, setAdvancedLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmbeddingDetails, setShowEmbeddingDetails] = useState<boolean>(false);
  const [showAdvancedStats, setShowAdvancedStats] = useState<boolean>(false);
  const [showSolrDetails, setShowSolrDetails] = useState<boolean>(false);

  const fetchComprehensiveStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get<ComprehensiveStats>('/api/dashboard/comprehensive', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setComprehensiveStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load comprehensive stats:', err);
      // Fallback to legacy stats
      await fetchLegacyStats();
    } finally {
      setLoading(false);
    }
  };

  const fetchLegacyStats = async () => {
    try {
      const response = await axios.get<LegacyStats>('/api/stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setLegacyStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load legacy stats:', err);
      setError('Failed to load dashboard stats. Please try again.');
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
      if (comprehensiveStats) {
        fetchComprehensiveStats();
      } else {
        fetchLegacyStats();
      }
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
      fetchComprehensiveStats();
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle color="success" />;
      case 'offline':
        return <Error color="error" />;
      case 'error':
        return <Warning color="warning" />;
      default:
        return <Warning color="disabled" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'offline':
        return 'error';
      case 'error':
        return 'warning';
      default:
        return 'default';
    }
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

  if (error && !legacyStats && !comprehensiveStats) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={fetchComprehensiveStats}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  const stats = comprehensiveStats || legacyStats;
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
            <IconButton onClick={fetchComprehensiveStats} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Enhanced Main Stats Grid */}
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
              value={formatNumber(comprehensiveStats ? comprehensiveStats.total_documents : stats.total_docs)}
              subtitle={comprehensiveStats ? "Real-time count" : "From cache"}
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
          
          {/* Additional stats if comprehensive data is available */}
          {comprehensiveStats && (
            <>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  icon={<Group />}
                  title="Active Sessions"
                  value={formatNumber(comprehensiveStats.active_sessions)}
                  subtitle="Last 24 hours"
                  color="info"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  icon={<PersonAdd />}
                  title="New Users"
                  value={formatNumber(comprehensiveStats.recent_registrations_24h)}
                  subtitle="Last 24 hours"
                  color="success"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  icon={<Psychology />}
                  title="Cached Embeddings"
                  value={formatNumber(comprehensiveStats.embedding_summary.total_cached_embeddings)}
                  subtitle={`${comprehensiveStats.embedding_summary.cache_hit_ratio.toFixed(1)}% hit ratio`}
                  color="primary"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  icon={<Memory />}
                  title="Cache Memory"
                  value={comprehensiveStats.embedding_summary.memory_usage_mb.toFixed(1) + ' MB'}
                  subtitle={`${comprehensiveStats.embedding_summary.memory_usage_percent.toFixed(1)}% used`}
                  color="warning"
                />
              </Grid>
            </>
          )}
        </Grid>

        {/* Solr Database Status */}
        {comprehensiveStats && (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CloudQueue />
                  Solr Database Status
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => setShowSolrDetails(!showSolrDetails)}
                  endIcon={showSolrDetails ? <ExpandLess /> : <ExpandMore />}
                  size="small"
                >
                  {showSolrDetails ? 'Hide Details' : 'Show Details'}
                </Button>
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                {comprehensiveStats.solr_databases.map((db) => (
                  <Grid item xs={12} sm={6} md={4} key={db.id}>
                    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                      {getStatusIcon(db.status)}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {db.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip 
                            label={db.status.toUpperCase()} 
                            size="small" 
                            color={getStatusColor(db.status) as any}
                          />
                          {db.response_time_ms && (
                            <Chip 
                              icon={<AccessTime />}
                              label={`${db.response_time_ms}ms`} 
                              size="small" 
                              variant="outlined"
                            />
                          )}
                        </Stack>
                        {db.document_count !== undefined && (
                          <Typography variant="body2" color="text.secondary">
                            {formatNumber(db.document_count)} documents
                          </Typography>
                        )}
                        {db.error_message && (
                          <Typography variant="caption" color="error">
                            {db.error_message}
                          </Typography>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Collapse in={showSolrDetails}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Collection Details
                </Typography>
                {comprehensiveStats.solr_databases.map((db) => (
                  <Box key={db.id} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                      {db.name} Collections
                    </Typography>
                    {db.collections.length > 0 ? (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Collection Name</TableCell>
                            <TableCell align="right">Documents</TableCell>
                            <TableCell align="center">Embeddings</TableCell>
                            <TableCell>Embedding Path</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {db.collections.map((collection) => (
                            <TableRow key={collection.name}>
                              <TableCell component="th" scope="row">
                                {collection.name}
                              </TableCell>
                              <TableCell align="right">
                                {collection.document_count !== undefined 
                                  ? formatNumber(collection.document_count)
                                  : 'N/A'
                                }
                              </TableCell>
                              <TableCell align="center">
                                <Chip 
                                  label={collection.has_embeddings ? 'Yes' : 'No'}
                                  size="small"
                                  color={collection.has_embeddings ? 'success' : 'default'}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ 
                                  maxWidth: 200, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {collection.embedding_path || 'Default'}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No collections configured for this database.
                      </Typography>
                    )}
                  </Box>
                ))}
              </Collapse>
            </CardContent>
          </Card>
        )}

        {/* Embedding Cache Management */}
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

        {/* Show fallback message if using legacy stats */}
        {!comprehensiveStats && legacyStats && (
          <Alert severity="info" sx={{ mb: 4 }}>
            Using basic statistics. Some advanced features may not be available. 
            The comprehensive dashboard endpoint might not be implemented yet.
          </Alert>
        )}
      </Box>
    </Fade>
  );
};

export default Dashboard;