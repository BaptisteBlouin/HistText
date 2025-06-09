import React, { useState, useCallback, useEffect } from "react";
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
  Switch,
  FormControlLabel,
  Chip,
  Stack,
  Divider,
} from "@mui/material";
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
  Sync,
  Schedule,
  Speed,
  CloudQueue,
  Analytics,
  Error as ErrorIcon,
  CheckCircle,
  AccessTime,
  DataUsage,
  Api,
  Computer,
  Timeline,
  Dns,
  AccountTree,
} from "@mui/icons-material";
import { useAuth, useAuthCheck } from "../../../../hooks/useAuth";

// Components
import { LoadingWrapper } from "./components/LoadingStates";
import { StatCard } from "./components/StatCard";
import { SolrDatabaseStatus } from "./components/SolrDatabaseStatus";
import { ApiAnalytics } from "./components/ApiAnalytics";
import { EmbeddingCacheManagement } from "./components/EmbeddingCacheManagement";
import { UserActivityMonitoring } from "./components/UserActivityMonitoring";

// Hooks
import { useDashboardData } from "./hooks/useDashboardData";
import { useAnalytics } from "./hooks/useAnalytics";
import { useUserActivity } from "./hooks/useUserActivity";

// Utilities
import { formatNumber } from "./utils/formatters";

/**
 * System Dashboard
 *
 * Main administrative dashboard page with metrics, analytics, cache and security widgets.
 * Handles loading, auth checks, and refreshing data.
 */
const Dashboard: React.FC = () => {
  useAuthCheck();
  const { accessToken, session } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isAdmin = session?.hasRole("Admin");

  // State for expandable sections
  const [showEmbeddingDetails, setShowEmbeddingDetails] =
    useState<boolean>(false);
  const [showAdvancedStats, setShowAdvancedStats] = useState<boolean>(false);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [showUserActivity, setShowUserActivity] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Main dashboard data hook
  const {
    comprehensiveStats,
    legacyStats,
    embeddingDetails,
    advancedStats,
    loading,
    detailsLoading,
    advancedLoading,
    error,
    lastUpdated,
    isDataFresh,
    fetchComprehensiveStats,
    fetchEmbeddingDetails,
    fetchAdvancedStats,
    clearEmbeddingCache,
    resetMetrics,
  } = useDashboardData(accessToken || null);

  // Other data hooks
  const { analytics, analyticsLoading, fetchAnalytics } = useAnalytics(
    accessToken || null,
    showAnalytics,
  );

  const { userActivity, userActivityLoading, fetchUserActivity } =
    useUserActivity(accessToken || null, showUserActivity);

  /**
   * Refresh all dashboard data (optionally force bypassing cache).
   */
  const refreshAll = useCallback(
    async (force: boolean = false): Promise<void> => {
      setLastRefresh(new Date());
      const promises: Promise<void>[] = [fetchComprehensiveStats({ force })];

      if (showAnalytics) {
        promises.push(fetchAnalytics());
      }
      if (showUserActivity) {
        promises.push(fetchUserActivity());
      }
      if (showEmbeddingDetails) {
        promises.push(fetchEmbeddingDetails({ force }));
      }
      if (showAdvancedStats) {
        promises.push(fetchAdvancedStats({ force }));
      }

      await Promise.allSettled(promises);
    },
    [
      fetchComprehensiveStats,
      fetchAnalytics,
      fetchUserActivity,
      fetchEmbeddingDetails,
      fetchAdvancedStats,
      showAnalytics,
      showUserActivity,
      showEmbeddingDetails,
      showAdvancedStats,
    ],
  );

  // Auto refresh effect - only refresh if data is stale
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Only auto-refresh if data is stale
      if (!isDataFresh) {
        refreshAll(false); // Don't force, respect cache
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, isDataFresh, refreshAll]);

  /**
   * Computes main system metrics and stats.
   */
  const getSystemMetrics = () => {
    if (!stats)
      return {
        dbOnlineCount: 0,
        dbTotalCount: 0,
        dbUptime: 100,
        avgResponseTime: 0,
        errorRate: 0,
        totalRequests: 0,
        activeEndpoints: 0,
        docsPerCollection: 0,
        userEngagement: 0,
        systemLoad: 0,
        totalDocs: 0,
        totalCollections: 0,
      };

    const dbOnlineCount =
      comprehensiveStats?.solr_databases.filter((db) => db.status === "online")
        .length || 0;
    const dbTotalCount = comprehensiveStats?.solr_databases.length || 0;
    const avgResponseTime = analytics?.average_response_time_ms || 0;
    const errorRate = analytics?.error_rate_percent || 0;
    const totalRequests = analytics?.total_requests_24h || 0;
    const activeEndpoints = analytics
      ? Object.keys(analytics.endpoint_stats).length
      : 0;

    let totalDocs = 0;
    let totalCollections = 0;
    let docsPerCollection = 0;

    if (comprehensiveStats) {
      comprehensiveStats.solr_databases.forEach((db) => {
        db.collections.forEach((collection) => {
          totalCollections++;
          if (collection.document_count !== undefined) {
            totalDocs += collection.document_count;
          }
        });
      });
      docsPerCollection =
        totalCollections > 0 ? Math.round(totalDocs / totalCollections) : 0;
    } else {
      totalDocs = (stats as any).total_docs;
      totalCollections = stats.total_collections;
      docsPerCollection =
        totalCollections > 0 ? Math.round(totalDocs / totalCollections) : 0;
    }

    const userEngagement = comprehensiveStats
      ? (comprehensiveStats.active_sessions / stats.total_users) * 100
      : 0;

    return {
      dbOnlineCount,
      dbTotalCount,
      dbUptime: dbTotalCount > 0 ? (dbOnlineCount / dbTotalCount) * 100 : 100,
      avgResponseTime,
      errorRate,
      totalRequests,
      activeEndpoints,
      docsPerCollection,
      userEngagement,
      systemLoad: Math.min(100, (totalRequests / 10000) * 100),
      totalDocs,
      totalCollections,
    };
  };

  // Auth checks and admin gating
  if (!session) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Paper
          sx={{
            p: 6,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
          }}
        >
          <LinearProgress sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>
            Loading...
          </Typography>
          <Typography variant="body1">Checking authentication...</Typography>
        </Paper>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Paper
          sx={{
            p: 6,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            color: "white",
          }}
        >
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
  const metrics = getSystemMetrics();

  return (
    <LoadingWrapper
      loading={loading && !stats}
      error={!stats ? error : null}
      onRetry={() => fetchComprehensiveStats({ force: true })}
    >
      <Fade in={true} timeout={600}>
        <Box>
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 4,
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Assessment color="primary" />
                System Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Real-time monitoring and system analytics
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip
                  icon={<Schedule />}
                  label={
                    lastUpdated
                      ? `Updated: ${lastUpdated.toLocaleTimeString()}`
                      : "Never updated"
                  }
                  variant="outlined"
                  size="small"
                />
                <Chip
                  label={isDataFresh ? "Data Fresh" : "Data Stale"}
                  color={isDataFresh ? "success" : "warning"}
                  size="small"
                />
                {autoRefresh && (
                  <Chip
                    icon={<Sync />}
                    label="Live Updates"
                    color="success"
                    size="small"
                  />
                )}
              </Stack>
            </Box>

            {/* Controls */}
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    size="small"
                  />
                }
                label="Auto Refresh"
              />
              <Tooltip
                title={isDataFresh ? "Force Refresh" : "Refresh Stale Data"}
              >
                <IconButton onClick={() => refreshAll(true)} color="primary">
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {stats && (
            <>
              {/* Main Stats Grid */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* Row 1: Core System Stats */}
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    icon={<People />}
                    title="Total Users"
                    value={formatNumber(stats.total_users)}
                    subtitle="Registered in system"
                    color="primary"
                    loading={loading}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    icon={<Storage />}
                    title="Collections"
                    value={formatNumber(stats.total_collections)}
                    subtitle={`${stats.active_collections} active`}
                    color="secondary"
                    loading={loading}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    icon={<Description />}
                    title="Documents"
                    value={formatNumber(metrics.totalDocs)}
                    subtitle={
                      metrics.totalCollections > 0
                        ? `${formatNumber(metrics.totalCollections)} collections • ~${formatNumber(metrics.docsPerCollection)} avg per collection`
                        : "No collections"
                    }
                    color="success"
                    loading={loading}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    icon={<Dns />}
                    title="Database Status"
                    value={`${metrics.dbOnlineCount}/${metrics.dbTotalCount}`}
                    subtitle={`${metrics.dbUptime.toFixed(1)}% uptime`}
                    color={
                      metrics.dbUptime === 100
                        ? "success"
                        : metrics.dbUptime > 80
                          ? "warning"
                          : "error"
                    }
                    loading={loading}
                  />
                </Grid>

                {/* Row 2: Performance & Activity */}
                {analytics && (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<Speed />}
                        title="Response Time"
                        value={`${metrics.avgResponseTime.toFixed(0)}ms`}
                        subtitle="Average API response"
                        color={
                          metrics.avgResponseTime > 1000
                            ? "error"
                            : metrics.avgResponseTime > 500
                              ? "warning"
                              : "success"
                        }
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<ErrorIcon />}
                        title="Error Rate"
                        value={`${metrics.errorRate.toFixed(2)}%`}
                        subtitle="Last 24 hours"
                        color={
                          metrics.errorRate > 5
                            ? "error"
                            : metrics.errorRate > 2
                              ? "warning"
                              : "success"
                        }
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<Api />}
                        title="API Requests"
                        value={formatNumber(metrics.totalRequests)}
                        subtitle="Last 24 hours"
                        color="info"
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<AccountTree />}
                        title="Active Endpoints"
                        value={formatNumber(metrics.activeEndpoints)}
                        subtitle="Available API routes"
                        color="secondary"
                      />
                    </Grid>
                  </>
                )}

                {/* Row 3: Advanced Stats (if comprehensive data available) */}
                {comprehensiveStats && (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<Group />}
                        title="Active Sessions"
                        value={formatNumber(comprehensiveStats.active_sessions)}
                        subtitle={`${metrics.userEngagement.toFixed(1)}% user engagement`}
                        color="info"
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<PersonAdd />}
                        title="New Registrations"
                        value={formatNumber(
                          comprehensiveStats.recent_registrations_24h,
                        )}
                        subtitle="Last 24 hours"
                        color="success"
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<Memory />}
                        title="Cache Memory"
                        value={`${comprehensiveStats.embedding_summary.memory_usage_mb.toFixed(1)}MB`}
                        subtitle={`${comprehensiveStats.embedding_summary.memory_usage_percent.toFixed(1)}% used`}
                        color={
                          comprehensiveStats.embedding_summary
                            .memory_usage_percent > 80
                            ? "error"
                            : comprehensiveStats.embedding_summary
                                  .memory_usage_percent > 60
                              ? "warning"
                              : "success"
                        }
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<Psychology />}
                        title="AI Embeddings"
                        value={formatNumber(
                          comprehensiveStats.embedding_summary
                            .total_cached_embeddings,
                        )}
                        subtitle={`${comprehensiveStats.embedding_summary.cache_hit_ratio.toFixed(1)}% cache hit rate`}
                        color="primary"
                      />
                    </Grid>

                    {/* Row 4: System Health & Performance */}
                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<Computer />}
                        title="System Load"
                        value={`${metrics.systemLoad.toFixed(1)}%`}
                        subtitle="Estimated load based on requests"
                        color={
                          metrics.systemLoad > 80
                            ? "error"
                            : metrics.systemLoad > 60
                              ? "warning"
                              : "success"
                        }
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<DataUsage />}
                        title="Cache Efficiency"
                        value={`${comprehensiveStats.embedding_summary.cache_hit_ratio.toFixed(1)}%`}
                        subtitle={`${comprehensiveStats.embedding_summary.cached_collections} collections cached`}
                        color={
                          comprehensiveStats.embedding_summary.cache_hit_ratio >
                          80
                            ? "success"
                            : comprehensiveStats.embedding_summary
                                  .cache_hit_ratio > 60
                              ? "warning"
                              : "error"
                        }
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <StatCard
                        icon={<Timeline />}
                        title="Data Growth"
                        value={`${(comprehensiveStats.total_documents / 1000).toFixed(1)}K`}
                        subtitle="Total indexed documents"
                        color="info"
                      />
                    </Grid>

                    <Grid item xs={12} sm={12} md={3}>
                      <StatCard
                        icon={<CheckCircle />}
                        title="System Health"
                        value={
                          metrics.dbUptime === 100 && metrics.errorRate < 1
                            ? "Excellent"
                            : metrics.dbUptime > 95 && metrics.errorRate < 5
                              ? "Good"
                              : "Needs Attention"
                        }
                        subtitle="Overall system status"
                        color={
                          metrics.dbUptime === 100 && metrics.errorRate < 1
                            ? "success"
                            : metrics.dbUptime > 95 && metrics.errorRate < 5
                              ? "warning"
                              : "error"
                        }
                      />
                    </Grid>
                  </>
                )}
              </Grid>

              <Divider sx={{ my: 4 }} />

              {/* Detailed Component Sections */}
              {comprehensiveStats && (
                <SolrDatabaseStatus comprehensiveStats={comprehensiveStats} />
              )}

              <ApiAnalytics
                autoRefresh={autoRefresh}
                refreshInterval={60000}
                onToggle={() => setShowAnalytics(!showAnalytics)}
                isVisible={showAnalytics}
              />

              <UserActivityMonitoring
                userActivity={userActivity}
                loading={userActivityLoading}
                onToggle={() => setShowUserActivity(!showUserActivity)}
                isVisible={showUserActivity}
              />

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

              {/* Fallback message */}
              {!comprehensiveStats && legacyStats && (
                <Alert
                  severity="info"
                  sx={{ mb: 4 }}
                  action={
                    <IconButton
                      color="inherit"
                      size="small"
                      onClick={() => fetchComprehensiveStats({ force: true })}
                    >
                      <Refresh />
                    </IconButton>
                  }
                >
                  Using basic statistics. Some advanced features may not be
                  available. Click refresh to try loading comprehensive data
                  again.
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
