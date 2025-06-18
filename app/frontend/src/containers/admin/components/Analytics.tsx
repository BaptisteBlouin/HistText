import React, { useState, useCallback, useEffect } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Container,
  Paper,
  useTheme,
  useMediaQuery,
  Switch,
  FormControlLabel,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Fade,
} from "@mui/material";
import {
  Analytics as AnalyticsIcon,
  Security,
  Refresh,
  Schedule,
  Sync,
} from "@mui/icons-material";
import { useAuth, useAuthCheck } from "../../../hooks/useAuth";

// Components
import TabbedDashboard from "./dashboard/components/TabbedDashboard";
import ExportImportControls from "./dashboard/components/ExportImportControls";

// Hooks
import { useDashboardData } from "./dashboard/hooks/useDashboardData";
import { useAnalytics } from "./dashboard/hooks/useAnalytics";
import { useUserActivity } from "./dashboard/hooks/useUserActivity";

/**
 * Analytics Dashboard
 *
 * Dedicated analytics page with API analytics, user behavior, query analytics,
 * collections intelligence, and system health monitoring.
 */
const Analytics: React.FC = () => {
  useAuthCheck();
  const { accessToken, session } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isAdmin = session?.hasRole("Admin");

  // State
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Main dashboard data hook
  const {
    comprehensiveStats,
    embeddingDetails,
    advancedStats,
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

  // Analytics data hooks
  const { analytics, analyticsLoading, fetchAnalytics } = useAnalytics(
    accessToken || null,
    true,
  );

  const { userActivity, userActivityLoading, fetchUserActivity } =
    useUserActivity(accessToken || null, true);

  /**
   * Refresh all analytics data (optionally force bypassing cache).
   */
  const refreshAll = useCallback(
    async (force: boolean = false): Promise<void> => {
      setLastRefresh(new Date());
      const promises: Promise<void>[] = [
        fetchComprehensiveStats({ force }),
        fetchAnalytics(),
        fetchUserActivity(),
        fetchEmbeddingDetails({ force }),
        fetchAdvancedStats({ force }),
      ];

      await Promise.allSettled(promises);
    },
    [
      fetchComprehensiveStats,
      fetchAnalytics,
      fetchUserActivity,
      fetchEmbeddingDetails,
      fetchAdvancedStats,
    ],
  );

  // Export/Import functions
  const handleExportAll = async () => {
    try {
      const exportData = {
        exportType: 'complete-analytics',
        timestamp: new Date().toISOString(),
        version: '1.0',
        comprehensiveStats,
        analytics,
        userActivity,
        embeddingDetails,
        advancedStats,
        settings: {
          autoRefresh,
        },
      };
      return exportData;
    } catch (error) {
      console.error('Analytics export failed:', error);
      throw error;
    }
  };

  const handleExportTab = async (tabName: string) => {
    try {
      const baseData = {
        exportType: 'analytics-tab',
        tabName,
        timestamp: new Date().toISOString(),
        version: '1.0',
      };

      switch (tabName) {
        case 'overview':
          return { ...baseData, data: { comprehensiveStats, userActivity } };
        case 'api-analytics':
          return { ...baseData, data: { analytics } };
        case 'user-behavior':
          return { ...baseData, data: { userActivity } };
        case 'query-analytics':
          return { ...baseData, data: { analytics } };
        case 'collections':
          return { ...baseData, data: { comprehensiveStats } };
        case 'system-health':
          return { ...baseData, data: { embeddingDetails, advancedStats } };
        default:
          throw new Error(`Unknown analytics tab: ${tabName}`);
      }
    } catch (error) {
      console.error('Analytics tab export failed:', error);
      throw error;
    }
  };

  const handleImport = async (importData: any) => {
    try {
      console.log('Importing analytics data:', importData);
      
      // For now, just trigger a refresh to simulate import
      await refreshAll(true);
      
      return Promise.resolve();
    } catch (error) {
      console.error('Analytics import failed:', error);
      throw error;
    }
  };

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

  return (
    <Fade in={true} timeout={600}>
      <Box sx={{ pb: isMobile ? 8 : 0 }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "center",
            mb: { xs: 3, md: 4 },
            flexDirection: { xs: "column", md: "row" },
            gap: { xs: 2, md: 2 },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant={isMobile ? "h5" : "h4"}
              sx={{
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' },
              }}
            >
              <AnalyticsIcon color="primary" sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }} />
              {isMobile ? "Analytics" : "Analytics Dashboard"}
            </Typography>
            <Typography 
              variant={isMobile ? "body2" : "body1"} 
              color="text.secondary"
              sx={{ 
                fontSize: { xs: '0.875rem', md: '1rem' },
                mt: 0.5,
              }}
            >
              {isMobile ? "Detailed insights & metrics" : "Comprehensive analytics, user behavior, and system insights"}
            </Typography>
            <Stack 
              direction={{ xs: "column", sm: "row" }} 
              spacing={1} 
              sx={{ 
                mt: 1,
                gap: { xs: 0.5, sm: 1 },
              }}
            >
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
          <Stack 
            direction={{ xs: "column", sm: "row" }} 
            spacing={{ xs: 1, sm: 2 }} 
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ 
              width: { xs: "100%", md: "auto" },
              minWidth: { sm: 200 },
            }}
          >
            {!isMobile && (
              <ExportImportControls
                onExportAll={handleExportAll}
                onExportTab={handleExportTab}
                onImport={handleImport}
                availableTabs={[
                  { name: 'overview', label: 'Overview', icon: <AnalyticsIcon fontSize="small" /> },
                  { name: 'api-analytics', label: 'API Analytics', icon: <AnalyticsIcon fontSize="small" /> },
                  { name: 'user-behavior', label: 'User Behavior', icon: <AnalyticsIcon fontSize="small" /> },
                  { name: 'query-analytics', label: 'Query Analytics', icon: <AnalyticsIcon fontSize="small" /> },
                  { name: 'collections', label: 'Collections', icon: <AnalyticsIcon fontSize="small" /> },
                  { name: 'system-health', label: 'System Health', icon: <AnalyticsIcon fontSize="small" /> },
                ]}
              />
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  size="small"
                />
              }
              label={isMobile ? "Auto" : "Auto Refresh"}
              sx={{ 
                margin: 0,
                "& .MuiFormControlLabel-label": {
                  fontSize: { xs: '0.875rem', md: '1rem' },
                },
              }}
            />
            <Tooltip
              title={isDataFresh ? "Force Refresh" : "Refresh Stale Data"}
            >
              <IconButton 
                onClick={() => refreshAll(true)} 
                color="primary"
                size={isMobile ? "small" : "medium"}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {/* Analytics Dashboard */}
        <TabbedDashboard
          comprehensiveStats={comprehensiveStats}
          analytics={analytics}
          userActivity={userActivity}
          embeddingDetails={embeddingDetails}
          advancedStats={advancedStats}
          detailsLoading={detailsLoading}
          advancedLoading={advancedLoading}
          userActivityLoading={userActivityLoading}
          autoRefresh={autoRefresh}
          onClearCache={clearEmbeddingCache}
          onResetMetrics={resetMetrics}
          fetchEmbeddingDetails={fetchEmbeddingDetails}
          fetchAdvancedStats={fetchAdvancedStats}
        />
      </Box>
    </Fade>
  );
};

export default Analytics;