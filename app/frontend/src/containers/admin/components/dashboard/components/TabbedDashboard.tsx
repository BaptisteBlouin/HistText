import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Badge,
  useTheme,
  useMediaQuery,
  Slide,
  Fade,
  Typography,
  Chip,
  Stack,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Analytics,
  People,
  Search,
  Storage,
  Error as ErrorIcon,
  TrendingUp,
  Psychology,
  Api,
} from '@mui/icons-material';

// Components
import EnhancedApiAnalytics from './EnhancedApiAnalytics';
import UserBehaviorAnalytics from './UserBehaviorAnalytics';
import QueryAnalytics from './QueryAnalytics';
import CollectionIntelligence from './CollectionIntelligence';
import { ApiAnalytics } from './ApiAnalytics';
import { UserActivityMonitoring } from './UserActivityMonitoring';
import { EmbeddingCacheManagement } from './EmbeddingCacheManagement';
import { SolrDatabaseStatus } from './SolrDatabaseStatus';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Fade in={true} timeout={300}>
          <Box sx={{ py: 3 }}>
            {children}
          </Box>
        </Fade>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `dashboard-tab-${index}`,
    'aria-controls': `dashboard-tabpanel-${index}`,
  };
}

interface TabbedDashboardProps {
  comprehensiveStats?: any;
  analytics?: any;
  userActivity?: any;
  embeddingDetails?: any;
  advancedStats?: any;
  detailsLoading?: boolean;
  advancedLoading?: boolean;
  userActivityLoading?: boolean;
  autoRefresh: boolean;
  onClearCache: () => void;
  onResetMetrics: () => void;
  fetchEmbeddingDetails: () => void;
  fetchAdvancedStats: () => void;
}

const TabbedDashboard: React.FC<TabbedDashboardProps> = ({
  comprehensiveStats,
  analytics,
  userActivity,
  embeddingDetails,
  advancedStats,
  detailsLoading,
  advancedLoading,
  userActivityLoading,
  autoRefresh,
  onClearCache,
  onResetMetrics,
  fetchEmbeddingDetails,
  fetchAdvancedStats,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [value, setValue] = useState(0);

  // State for individual component visibility
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showUserActivity, setShowUserActivity] = useState(true);
  const [showEnhancedAnalytics, setShowEnhancedAnalytics] = useState(true);
  const [showUserBehavior, setShowUserBehavior] = useState(true);
  const [showQueryAnalytics, setShowQueryAnalytics] = useState(true);
  const [showCollectionIntelligence, setShowCollectionIntelligence] = useState(true);
  const [showEmbeddingDetails, setShowEmbeddingDetails] = useState(false);
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  // Calculate badges for tabs
  const getErrorCount = () => {
    if (!analytics?.enhanced_error_tracking) return 0;
    return analytics.enhanced_error_tracking.error_details?.length || 0;
  };

  const getActiveUsersCount = () => {
    if (!analytics?.enhanced_error_tracking) return 0;
    return analytics.enhanced_error_tracking.error_details?.reduce(
      (total: number, error: any) => total + (error.affected_users || 0), 
      0
    ) || 0;
  };

  const getQueryCount = () => {
    // Placeholder - would need real query count from analytics
    return 0;
  };

  const getCollectionCount = () => {
    if (!comprehensiveStats?.solr_databases) return 0;
    return comprehensiveStats.solr_databases.reduce(
      (total: number, db: any) => total + (db.collections?.length || 0), 
      0
    );
  };

  const tabs = [
    {
      label: 'Overview',
      icon: <DashboardIcon />,
      badge: null,
      color: 'primary' as const,
    },
    {
      label: 'API Analytics',
      icon: <ErrorIcon />,
      badge: getErrorCount(),
      color: 'error' as const,
    },
    {
      label: 'User Behavior',
      icon: <People />,
      badge: getActiveUsersCount(),
      color: 'info' as const,
    },
    {
      label: 'Query Analytics',
      icon: <Search />,
      badge: getQueryCount(),
      color: 'secondary' as const,
    },
    {
      label: 'Collections',
      icon: <Storage />,
      badge: getCollectionCount(),
      color: 'success' as const,
    },
    {
      label: 'System Health',
      icon: <Psychology />,
      badge: null,
      color: 'warning' as const,
    },
  ];

  return (
    <Paper sx={{ width: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs
          value={value}
          onChange={handleChange}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile={isMobile}
          sx={{
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  {tab.badge !== null && tab.badge > 0 ? (
                    <Badge badgeContent={tab.badge} color={tab.color} max={99}>
                      {tab.icon}
                    </Badge>
                  ) : (
                    tab.icon
                  )}
                  {!isMobile && (
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {tab.label}
                    </Typography>
                  )}
                </Stack>
              }
              {...a11yProps(index)}
              sx={{
                minHeight: 64,
                textTransform: 'none',
                '&.Mui-selected': {
                  color: `${tab.color}.main`,
                },
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={value} index={0}>
        <Stack spacing={3}>
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
        </Stack>
      </TabPanel>

      {/* API Analytics Tab */}
      <TabPanel value={value} index={1}>
        <EnhancedApiAnalytics
          autoRefresh={autoRefresh}
          refreshInterval={60000}
          onToggle={() => setShowEnhancedAnalytics(!showEnhancedAnalytics)}
          isVisible={showEnhancedAnalytics}
        />
      </TabPanel>

      {/* User Behavior Tab */}
      <TabPanel value={value} index={2}>
        <UserBehaviorAnalytics
          autoRefresh={autoRefresh}
          refreshInterval={60000}
          onToggle={() => setShowUserBehavior(!showUserBehavior)}
          isVisible={showUserBehavior}
        />
      </TabPanel>

      {/* Query Analytics Tab */}
      <TabPanel value={value} index={3}>
        <QueryAnalytics
          autoRefresh={autoRefresh}
          refreshInterval={60000}
          onToggle={() => setShowQueryAnalytics(!showQueryAnalytics)}
          isVisible={showQueryAnalytics}
        />
      </TabPanel>

      {/* Collections Tab */}
      <TabPanel value={value} index={4}>
        <CollectionIntelligence
          autoRefresh={autoRefresh}
          refreshInterval={60000}
          onToggle={() => setShowCollectionIntelligence(!showCollectionIntelligence)}
          isVisible={showCollectionIntelligence}
        />
      </TabPanel>

      {/* System Health Tab */}
      <TabPanel value={value} index={5}>
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
          onClearCache={onClearCache}
          onResetMetrics={onResetMetrics}
        />
      </TabPanel>
    </Paper>
  );
};

export default TabbedDashboard;