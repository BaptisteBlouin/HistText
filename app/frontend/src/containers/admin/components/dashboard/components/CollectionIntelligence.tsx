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
  Storage,
  TrendingUp,
  ExpandMore,
  Schedule,
  Speed,
  Assessment,
  Refresh,
  Warning,
  CheckCircle,
  Person,
  Memory,
  DataUsage,
  CloudQueue,
  Analytics,
  BugReport,
  Insights,
  HealthAndSafety,
} from '@mui/icons-material';
import { useAuth } from '../../../../../hooks/useAuth';
import { UserList } from '../../../../../components/ui';

interface CollectionUsageMetrics {
  collection_name: string;
  query_frequency: number;
  unique_users: number;
  user_list?: Array<{
    user_id: number;
    username: string;
    usage_count: number;
    last_access: number;
  }>;
  data_volume_gb: number;
  document_count: number;
  user_engagement_score: number;
  performance_score: number;
  growth_rate_7d: number;
  growth_rate_30d: number;
}

interface UnderutilizedCollection {
  collection_name: string;
  utilization_score: number;
  reasons: string[];
  recommendations: string[];
  potential_savings: {
    storage_gb: number;
    compute_resources_percent: number;
    maintenance_hours_per_month: number;
  };
}

interface CollectionHealthScore {
  collection_name: string;
  health_score: number;
  performance_score: number;
  reliability_score: number;
  efficiency_score: number;
  last_assessment: number;
}

interface CollectionIntelligence {
  usage_metrics: CollectionUsageMetrics[];
  optimization_insights: {
    underutilized_collections: UnderutilizedCollection[];
    high_maintenance_collections: any[];
    migration_candidates: any[];
  };
  resource_allocation: {
    current_allocation: {
      total_storage_gb: number;
      total_memory_gb: number;
      total_cpu_cores: number;
    };
    capacity_planning: {
      current_capacity_utilization: number;
      projected_capacity_needs: {
        storage_needs_3m: number;
        storage_needs_6m: number;
        storage_needs_12m: number;
      };
    };
  };
  growth_projections: {
    data_growth_trends: {
      overall_growth_rate_per_month: number;
      projected_total_size_12m: number;
    };
    usage_growth_trends: {
      query_volume_growth: number;
      user_base_growth: number;
    };
  };
  health_assessment: {
    overall_health_score: number;
    collection_health_scores: CollectionHealthScore[];
    critical_issues: any[];
    health_trends: {
      health_score_trend_7d: number;
      health_score_trend_30d: number;
      improving_collections: string[];
      degrading_collections: string[];
    };
  };
  last_updated: number;
}

interface CollectionIntelligenceProps {
  autoRefresh: boolean;
  refreshInterval: number;
  onToggle: () => void;
  isVisible: boolean;
}

const CollectionIntelligence: React.FC<CollectionIntelligenceProps> = ({
  autoRefresh,
  refreshInterval,
  onToggle,
  isVisible,
}) => {
  const theme = useTheme();
  const { accessToken } = useAuth();
  const [intelligence, setIntelligence] = useState<CollectionIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/dashboard/collection-intelligence', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch collection intelligence: ${response.statusText}`);
      }
      
      const data = await response.json();
      setIntelligence(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchIntelligence();
    }
  }, [isVisible, accessToken]);

  useEffect(() => {
    if (autoRefresh && isVisible) {
      const interval = setInterval(fetchIntelligence, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isVisible, refreshInterval]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getEngagementColor = (score: number) => {
    if (score >= 7) return 'success';
    if (score >= 4) return 'warning';
    return 'error';
  };

  const formatBytes = (gb: number) => {
    if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Storage color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Collection Usage Intelligence & Optimization
            </Typography>
            {intelligence && (
              <Chip
                label={`${intelligence.usage_metrics.length} Collections`}
                color="primary"
                size="small"
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Refresh Intelligence">
              <IconButton onClick={fetchIntelligence} disabled={loading}>
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
          {intelligence && (
            <Box>
              {/* System Overview */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                    <HealthAndSafety sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4">{intelligence.health_assessment.overall_health_score.toFixed(1)}</Typography>
                    <Typography variant="body2">Overall Health Score</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)', color: 'white' }}>
                    <Memory sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4">{formatBytes(intelligence.resource_allocation.current_allocation.total_storage_gb)}</Typography>
                    <Typography variant="body2">Total Storage</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}>
                    <TrendingUp sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4">{intelligence.growth_projections.data_growth_trends.overall_growth_rate_per_month.toFixed(1)}%</Typography>
                    <Typography variant="body2">Monthly Growth</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white' }}>
                    <DataUsage sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4">{intelligence.resource_allocation.capacity_planning.current_capacity_utilization.toFixed(1)}%</Typography>
                    <Typography variant="body2">Capacity Used</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Collection Usage Metrics */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Analytics color="primary" />
                    Collection Usage & Performance Metrics
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Collection</TableCell>
                          <TableCell align="right">Queries</TableCell>
                          <TableCell align="right">Users</TableCell>
                          <TableCell align="right">Data Size</TableCell>
                          <TableCell align="right">Engagement</TableCell>
                          <TableCell align="right">Performance</TableCell>
                          <TableCell align="right">Growth (7d)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {intelligence.usage_metrics
                          .sort((a, b) => b.query_frequency - a.query_frequency)
                          .slice(0, 10)
                          .map((collection, index) => (
                            <TableRow key={collection.collection_name}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {collection.collection_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {collection.document_count.toLocaleString()} docs
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip label={collection.query_frequency} size="small" color="primary" />
                              </TableCell>
                              <TableCell align="right">
                                {collection.user_list && collection.user_list.length > 0 ? (
                                  <UserList
                                    users={collection.user_list.map(user => ({
                                      user_id: user.user_id,
                                      username: user.username,
                                      request_count: user.usage_count,
                                      last_activity: user.last_access,
                                    }))}
                                    variant="compact"
                                    title="Collection Users"
                                    maxVisibleUsers={3}
                                  />
                                ) : (
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                    <Person fontSize="small" />
                                    {collection.unique_users}
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">
                                  {formatBytes(collection.data_volume_gb)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={collection.user_engagement_score.toFixed(1)}
                                  size="small"
                                  color={getEngagementColor(collection.user_engagement_score) as any}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={collection.performance_score.toFixed(1)}
                                  size="small"
                                  color={getHealthColor(collection.performance_score * 10) as any}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Typography 
                                  variant="body2" 
                                  color={collection.growth_rate_7d > 0 ? 'success.main' : 'error.main'}
                                >
                                  {collection.growth_rate_7d > 0 ? '+' : ''}{collection.growth_rate_7d.toFixed(1)}%
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>

              {/* Optimization Opportunities */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Insights color="warning" />
                    Optimization Opportunities
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {intelligence.optimization_insights.underutilized_collections.length > 0 ? (
                    <Stack spacing={2}>
                      {intelligence.optimization_insights.underutilized_collections.map((collection, index) => (
                        <Paper key={index} sx={{ p: 3 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Warning color="warning" />
                            {collection.collection_name}
                            <Chip
                              label={`${collection.utilization_score.toFixed(1)}% utilized`}
                              size="small"
                              color="warning"
                            />
                          </Typography>
                          
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>Issues Identified:</Typography>
                              <Stack spacing={0.5}>
                                {collection.reasons.map((reason, idx) => (
                                  <Alert key={idx} severity="warning" variant="outlined" sx={{ py: 0.5 }}>
                                    {reason}
                                  </Alert>
                                ))}
                              </Stack>
                            </Grid>
                            
                            <Grid item xs={12} md={6}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>Recommendations:</Typography>
                              <Stack spacing={0.5}>
                                {collection.recommendations.map((rec, idx) => (
                                  <Alert key={idx} severity="info" variant="outlined" sx={{ py: 0.5 }}>
                                    {rec}
                                  </Alert>
                                ))}
                              </Stack>
                            </Grid>
                          </Grid>

                          <Divider sx={{ my: 2 }} />

                          <Typography variant="subtitle2" sx={{ mb: 1 }}>Potential Savings:</Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                              <Paper sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h6" color="success.main">
                                  {formatBytes(collection.potential_savings.storage_gb)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Storage
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Paper sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h6" color="success.main">
                                  {collection.potential_savings.compute_resources_percent.toFixed(1)}%
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Compute Resources
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Paper sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h6" color="success.main">
                                  {collection.potential_savings.maintenance_hours_per_month.toFixed(1)}h
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Maintenance/Month
                                </Typography>
                              </Paper>
                            </Grid>
                          </Grid>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="success">
                      All collections are well-utilized. No optimization opportunities identified.
                    </Alert>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Capacity Planning & Growth */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp color="info" />
                    Capacity Planning & Growth Projections
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* Current Resource Allocation */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <Memory sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Current Resource Allocation
                      </Typography>
                      <Stack spacing={2}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2">Storage</Typography>
                          <Typography variant="h5" color="primary.main">
                            {formatBytes(intelligence.resource_allocation.current_allocation.total_storage_gb)}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={intelligence.resource_allocation.capacity_planning.current_capacity_utilization}
                            color={intelligence.resource_allocation.capacity_planning.current_capacity_utilization > 80 ? 'error' : 'primary'}
                            sx={{ mt: 1 }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {intelligence.resource_allocation.capacity_planning.current_capacity_utilization.toFixed(1)}% utilized
                          </Typography>
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2">Memory</Typography>
                          <Typography variant="h5" color="secondary.main">
                            {intelligence.resource_allocation.current_allocation.total_memory_gb.toFixed(1)} GB
                          </Typography>
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2">CPU Cores</Typography>
                          <Typography variant="h5" color="success.main">
                            {intelligence.resource_allocation.current_allocation.total_cpu_cores}
                          </Typography>
                        </Paper>
                      </Stack>
                    </Grid>

                    {/* Growth Projections */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Growth Projections
                      </Typography>
                      <Stack spacing={2}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>Storage Needs</Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">3 Months</Typography>
                            <Typography variant="body2" color="primary.main">
                              {formatBytes(intelligence.resource_allocation.capacity_planning.projected_capacity_needs.storage_needs_3m)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">6 Months</Typography>
                            <Typography variant="body2" color="warning.main">
                              {formatBytes(intelligence.resource_allocation.capacity_planning.projected_capacity_needs.storage_needs_6m)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">12 Months</Typography>
                            <Typography variant="body2" color="error.main">
                              {formatBytes(intelligence.resource_allocation.capacity_planning.projected_capacity_needs.storage_needs_12m)}
                            </Typography>
                          </Box>
                        </Paper>
                        
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 2 }}>Usage Growth Trends</Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Query Volume Growth</Typography>
                            <Chip
                              label={`+${intelligence.growth_projections.usage_growth_trends.query_volume_growth.toFixed(1)}%`}
                              size="small"
                              color="info"
                            />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">User Base Growth</Typography>
                            <Chip
                              label={`+${intelligence.growth_projections.usage_growth_trends.user_base_growth.toFixed(1)}%`}
                              size="small"
                              color="success"
                            />
                          </Box>
                        </Paper>

                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>12-Month Projection</Typography>
                          <Typography variant="h5" color="info.main">
                            {formatBytes(intelligence.growth_projections.data_growth_trends.projected_total_size_12m)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Projected total system size
                          </Typography>
                        </Paper>
                      </Stack>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Health Assessment */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HealthAndSafety color="success" />
                    Collection Health Assessment
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* Health Trends */}
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>Health Trends</Typography>
                      <Stack spacing={2}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2">7-Day Trend</Typography>
                          <Typography 
                            variant="h5" 
                            color={intelligence.health_assessment.health_trends.health_score_trend_7d > 0 ? 'success.main' : 'error.main'}
                          >
                            {intelligence.health_assessment.health_trends.health_score_trend_7d > 0 ? '+' : ''}
                            {intelligence.health_assessment.health_trends.health_score_trend_7d.toFixed(1)}
                          </Typography>
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2">30-Day Trend</Typography>
                          <Typography 
                            variant="h5" 
                            color={intelligence.health_assessment.health_trends.health_score_trend_30d > 0 ? 'success.main' : 'error.main'}
                          >
                            {intelligence.health_assessment.health_trends.health_score_trend_30d > 0 ? '+' : ''}
                            {intelligence.health_assessment.health_trends.health_score_trend_30d.toFixed(1)}
                          </Typography>
                        </Paper>
                      </Stack>
                    </Grid>

                    {/* Improving Collections */}
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }} color="success.main">
                        <CheckCircle sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Improving Collections
                      </Typography>
                      <Stack spacing={1}>
                        {intelligence.health_assessment.health_trends.improving_collections.length > 0 ? (
                          intelligence.health_assessment.health_trends.improving_collections.map((collection, index) => (
                            <Chip key={index} label={collection} color="success" variant="outlined" />
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No collections showing improvement
                          </Typography>
                        )}
                      </Stack>
                    </Grid>

                    {/* Degrading Collections */}
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }} color="error.main">
                        <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Attention Needed
                      </Typography>
                      <Stack spacing={1}>
                        {intelligence.health_assessment.health_trends.degrading_collections.length > 0 ? (
                          intelligence.health_assessment.health_trends.degrading_collections.map((collection, index) => (
                            <Chip key={index} label={collection} color="error" variant="outlined" />
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No collections need attention
                          </Typography>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Last updated: {formatTimestamp(intelligence.last_updated)}
                </Typography>
              </Box>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default CollectionIntelligence;