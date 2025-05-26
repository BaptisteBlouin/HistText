import React, { useState } from 'react';
import { 
  Box, 
  Grid, 
  Typography, 
  Tooltip,
  IconButton,
  Fade,
  Container,
  Paper,
  LinearProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  People,
  Storage,
  Description,
  Refresh,
  TrendingUp,
  Memory,
  Assessment,
  Group,
  PersonAdd,
  Psychology,
  Security,
} from '@mui/icons-material';
import { useAuth, useAuthCheck } from '../../../../hooks/useAuth';

// Import components
import { LoadingWrapper } from './components/LoadingStates';
import { StatCard } from './components/StatCard';
import { SolrDatabaseStatus } from './components/SolrDatabaseStatus';
import { ApiAnalytics } from './components/ApiAnalytics';
import { EmbeddingCacheManagement } from './components/EmbeddingCacheManagement';

// Import hooks
import { useDashboardData } from './hooks/useDashboardData';
import { useAnalytics } from './hooks/useAnalytics';

// Import utilities
import { formatNumber } from './utils/formatters';

import { UserActivityMonitoring } from './components/UserActivityMonitoring';
import { useUserActivity } from './hooks/useUserActivity';

const Dashboard: React.FC = () => {
  useAuthCheck();
  const { accessToken, session } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isAdmin = session?.hasRole('Admin');
  
  // State for expandable sections
  const [showEmbeddingDetails, setShowEmbeddingDetails] = useState<boolean>(false);
  const [showAdvancedStats, setShowAdvancedStats] = useState<boolean>(false);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);

  const [showUserActivity, setShowUserActivity] = useState<boolean>(false);

  // Custom hooks for data fetching
  const {
    comprehensiveStats,
    legacyStats,
    embeddingDetails,
    advancedStats,
    loading,
    detailsLoading,
    advancedLoading,
    error,
    fetchComprehensiveStats,
    fetchEmbeddingDetails,
    fetchAdvancedStats,
    clearEmbeddingCache,
    resetMetrics,
  } = useDashboardData(accessToken);

  const {
    analytics,
    analyticsLoading,
  } = useAnalytics(accessToken, showAnalytics);

  const {
    userActivity,
    userActivityLoading,
  } = useUserActivity(accessToken, showUserActivity);
  // Auth checks
  if (!session) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Paper sx={{ p: 6, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <LinearProgress sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>Loading...</Typography>
          <Typography variant="body1">Checking authentication...</Typography>
        </Paper>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Paper sx={{ p: 6, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white' }}>
          <Security sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            Access Denied
          </Typography>
          <Typography variant="body1">
            You need administrator privileges to access this panel.
          </Typography>
        </Paper>
      </Container>
    );
  }

  const stats = comprehensiveStats || legacyStats;

  return (
    <LoadingWrapper
      loading={loading}
      error={!stats ? error : null}
      onRetry={fetchComprehensiveStats}
    >
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

          {stats && (
            <>
              {/* Main Stats Grid */}
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
                <SolrDatabaseStatus comprehensiveStats={comprehensiveStats} />
              )}

              {/* API Usage Analytics */}
              <ApiAnalytics
                analytics={analytics}
                loading={analyticsLoading}
                onToggle={() => setShowAnalytics(!showAnalytics)}
                isVisible={showAnalytics}
              />

                <UserActivityMonitoring
                userActivity={userActivity}
                loading={userActivityLoading}
                onToggle={() => setShowUserActivity(!showUserActivity)}
                isVisible={showUserActivity}
                />

              {/* Embedding Cache Management */}
              <EmbeddingCacheManagement
                embeddingDetails={embeddingDetails}
                advancedStats={advancedStats}
                detailsLoading={detailsLoading}
                advancedLoading={advancedLoading}
                showEmbeddingDetails={showEmbeddingDetails}
                showAdvancedStats={showAdvancedStats}
                onToggleEmbeddingDetails={() => {
                  setShowEmbeddingDetails(!showEmbeddingDetails);
                  if (!showEmbeddingDetails) {
                    fetchEmbeddingDetails();
                  }
                }}
                onToggleAdvancedStats={() => {
                  setShowAdvancedStats(!showAdvancedStats);
                  if (!showAdvancedStats) {
                    fetchAdvancedStats();
                  }
                }}
                onClearCache={clearEmbeddingCache}
                onResetMetrics={resetMetrics}
              />

              {/* Show fallback message if using legacy stats */}
              {!comprehensiveStats && legacyStats && (
                <Alert severity="info" sx={{ mb: 4 }}>
                  Using basic statistics. Some advanced features may not be available. 
                  The comprehensive dashboard endpoint might not be implemented yet.
                </Alert>
              )}
            </>
          )}
        </Box>
      </Fade>
    </LoadingWrapper>
  );
};

export default Dashboard;