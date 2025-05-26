import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Box, Container, Paper, Fade, Typography } from '@mui/material';
import { Search, Storage, TableRows, TableChart, Analytics, AccountTree } from '@mui/icons-material';
import { Cloud as CloudIcon } from '@mui/icons-material';

import DatabaseSelector from './DatabaseSelector/';
import TabNavigation, { FullscreenMode } from './TabNavigation/';
import LoadingOverlay from './LoadingOverlay';
import QuickActions from './QuickActions';
import NotificationSystem from './NotificationSystem';
import EmptyState from './EmptyState';
import MetadataForm from './MetadataForm';
import DataGrid from './DataGrid';
import StatisticsDisplay from './StatisticsDisplay';
import Cloud from './Cloud';
import NERDisplay from './NERDisplay';

// Constants for tabs to prevent magic numbers
const TABS = {
  QUERY: 0,
  PARTIAL_RESULTS: 1,
  ALL_RESULTS: 2,
  STATS: 3,
  CLOUD: 4,
  NER: 5,
} as const;

// Memoized TabPanel component
const TabPanel = React.memo<{
  children: React.ReactNode;
  value: number;
  index: number;
}>(({ children, value, index }) => (
  <div 
    role="tabpanel" 
    hidden={value !== index} 
    style={{ height: value === index ? 'auto' : 0 }}
  >
    {value === index && (
      <Fade in={true} timeout={300}>
        <Box sx={{ height: '100%' }}>{children}</Box>
      </Fade>
    )}
  </div>
));

TabPanel.displayName = 'TabPanel';

interface HistTextLayoutProps {
  data: any;
  actions: any;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  fullscreenMode: FullscreenMode;
  setFullscreenMode: (mode: FullscreenMode) => void;
  quickActions: boolean;
  setQuickActions: (open: boolean) => void;
  notification: any;
  setNotification: (notification: any) => void;
  onSolrDatabaseChange: (database: any) => void;
  showNotification: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
}

// Style constants to prevent inline object creation
const getContainerStyles = (fullscreenMode: FullscreenMode, isNativeFullscreen: boolean) => {
  const baseStyles = {
    width: '100%',
    bgcolor: 'background.default',
    position: 'relative' as const,
  };

  switch (fullscreenMode) {
    case 'browser':
      return {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'background.default',
        zIndex: 9998,
        overflow: 'auto',
      };
    case 'native':
      return {
        ...baseStyles,
        minHeight: '100vh',
        ...(isNativeFullscreen && {
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          overflow: 'auto'
        })
      };
    default:
      return {
        ...baseStyles,
        minHeight: '100vh',
      };
  }
};

const getPaperStyles = (fullscreenMode: FullscreenMode, isNativeFullscreen: boolean) => {
  const baseStyles = {
    width: '100%',
    bgcolor: 'background.paper',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  };

  switch (fullscreenMode) {
    case 'browser':
      return {
        ...baseStyles,
        borderRadius: 0,
        boxShadow: 'none',
        height: '100vh',
        minHeight: '100vh',
      };
    case 'native':
      return {
        ...baseStyles,
        borderRadius: isNativeFullscreen ? 0 : 3,
        boxShadow: isNativeFullscreen ? 'none' : '0 4px 20px rgba(0,0,0,0.1)',
        height: isNativeFullscreen ? '100vh' : 'auto',
        minHeight: isNativeFullscreen ? '100vh' : '60vh',
      };
    default:
      return {
        ...baseStyles,
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        minHeight: '60vh',
      };
  }
};

const FULLSCREEN_INFO_STYLES = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  px: 2,
  py: 1,
  bgcolor: 'primary.main',
  color: 'white',
  mb: 0
} as const;

const HistTextLayout: React.FC<HistTextLayoutProps> = React.memo(({
  data,
  actions,
  activeTab,
  setActiveTab,
  fullscreenMode,
  setFullscreenMode,
  quickActions,
  setQuickActions,
  notification,
  setNotification,
  onSolrDatabaseChange,
  showNotification
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainPaperRef = useRef<HTMLDivElement>(null);

  // Memoized fullscreen state calculations
  const fullscreenState = useMemo(() => {
    const isNativeFullscreen = Boolean(document.fullscreenElement);
    const isBrowserFullscreen = fullscreenMode === 'browser';
    const isAnyFullscreen = isNativeFullscreen || isBrowserFullscreen;
    
    return {
      isNativeFullscreen,
      isBrowserFullscreen,
      isAnyFullscreen
    };
  }, [fullscreenMode]);

  // Memoized style objects
  const containerStyles = useMemo(() => 
    getContainerStyles(fullscreenMode, fullscreenState.isNativeFullscreen),
    [fullscreenMode, fullscreenState.isNativeFullscreen]
  );

  const paperStyles = useMemo(() => 
    getPaperStyles(fullscreenMode, fullscreenState.isNativeFullscreen),
    [fullscreenMode, fullscreenState.isNativeFullscreen]
  );

  const containerConfig = useMemo(() => ({
    maxWidth: fullscreenState.isAnyFullscreen ? false : "xl" as const,
    sx: {
      py: fullscreenState.isAnyFullscreen ? 1 : 3,
      height: fullscreenState.isAnyFullscreen ? '100vh' : 'auto',
      maxWidth: fullscreenState.isAnyFullscreen ? '100%' : undefined,
      px: fullscreenState.isAnyFullscreen ? 1 : 3,
      display: 'flex',
      flexDirection: 'column' as const
    }
  }), [fullscreenState.isAnyFullscreen]);

  // Optimized keyboard handler
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (fullscreenMode !== 'normal') {
        setFullscreenMode('normal');
      }
    }
  }, [fullscreenMode, setFullscreenMode]);

  // Effect for ESC key handling
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Memoized quick actions handlers
  const quickActionsHandlers = useMemo(() => ({
    onOpen: () => setQuickActions(true),
    onClose: () => setQuickActions(false),
    onExportData: actions.exportAllData,
    onRefreshData: actions.refreshData,
    onShareQuery: actions.shareQuery,
    onOpenSettings: actions.openSettings,
  }), [setQuickActions, actions]);

  // Memoized notification handlers
  const notificationHandlers = useMemo(() => ({
    onClose: () => setNotification(prev => ({ ...prev, open: false }))
  }), [setNotification]);

  // Memoized empty state action
  const emptyStateAction = useMemo(() => {
    if (fullscreenState.isAnyFullscreen) return undefined;
    
    return {
      label: "Choose Data Source",
      icon: <Search />,
      onClick: () => showNotification("Please select a database and collection above", "info")
    };
  }, [fullscreenState.isAnyFullscreen, showNotification]);

  // Memoized tab content renderers
  const renderTabContent = useCallback((tabIndex: number) => {
    const tabContentStyles = { p: fullscreenState.isAnyFullscreen ? 2 : 3 };
    
    switch (tabIndex) {
      case TABS.QUERY:
        if (data.selectedAlias && data.metadata.length > 0) {
          return (
            <Box sx={tabContentStyles}>
              <MetadataForm
                metadata={data.metadata}
                formData={data.formData}
                setFormData={data.setFormData}
                dateRange={data.dateRange}
                handleQuery={actions.handleQuery}
                getNER={data.getNER}
                setGetNER={data.setGetNER}
                downloadOnly={data.downloadOnly}
                setdownloadOnly={data.setdownloadOnly}
                statsLevel={data.statsLevel}
                setStatsLevel={data.setStatsLevel}
                docLevel={data.docLevel}
                setDocLevel={data.setDocLevel}
                solrDatabaseId={data.selectedSolrDatabase?.id || null}
                selectedAlias={data.selectedAlias}
              />
            </Box>
          );
        }
        return (
          <EmptyState
            icon={<Storage />}
            title="Get Started"
            description="Select a database and collection from above to begin your text analysis journey"
            action={emptyStateAction}
          />
        );

      case TABS.PARTIAL_RESULTS:
        return data.partialResults.length > 0 ? (
          <DataGrid
            results={data.partialResults}
            formData={data.formData}
            nerData={data.nerData}
            viewNER={data.viewNER}
            selectedAlias={data.selectedAlias}
            selectedSolrDatabase={data.selectedSolrDatabase}
            authAxios={data.authAxios}
          />
        ) : (
          <EmptyState
            icon={<TableRows />}
            title="No partial results available"
            description="Execute a query to see results"
          />
        );

      case TABS.ALL_RESULTS:
        return data.allResults.length > 0 ? (
          <DataGrid
            results={data.allResults}
            formData={data.formData}
            nerData={data.nerData}
            viewNER={false}
            selectedAlias={data.selectedAlias}
            selectedSolrDatabase={data.selectedSolrDatabase}
            authAxios={data.authAxios}
          />
        ) : (
          <EmptyState
            icon={<TableChart />}
            title="No complete results available"
            description="Execute a query to see the full dataset"
          />
        );

      case TABS.STATS:
        return data.stats ? (
          <StatisticsDisplay
            stats={data.stats}
            selectedStat={data.selectedStat}
            onStatChange={data.setSelectedStat}
          />
        ) : (
          <EmptyState
            icon={<Analytics />}
            title={data.isStatsLoading ? "Generating statistics..." : "No statistics available"}
            description={data.isStatsLoading ? "This may take a moment for large datasets" : "Execute a query to generate statistical analysis"}
          />
        );

      case TABS.CLOUD:
        if (data.isCloudLoading) {
          return (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <CloudIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
              <Typography variant="h6" gutterBottom>
                Generating Word Cloud...
              </Typography>
            </Box>
          );
        }
        
        return data.wordFrequency && data.wordFrequency.length > 0 ? (
          <Box sx={{ p: fullscreenState.isAnyFullscreen ? 1 : 3, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cloud wordFrequency={data.wordFrequency} />
          </Box>
        ) : (
          <EmptyState
            icon={<CloudIcon />}
            title="No word cloud data available"
            description="Execute a query with text data to generate word cloud"
          />
        );

      case TABS.NER:
        return data.nerData && Object.keys(data.nerData).length > 0 ? (
          <NERDisplay
            nerData={data.nerData}
            authAxios={data.authAxios}
            selectedAlias={data.selectedAlias}
            selectedSolrDatabase={data.selectedSolrDatabase}
            viewNER={data.viewNER}
          />
        ) : (
          <EmptyState
            icon={<AccountTree />}
            title={data.isNERLoading ? "Processing NER data..." : "No NER data available"}
            description={data.isNERLoading ? "Analyzing entities in your text" : "Enable NER in query options to extract named entities"}
          />
        );

      default:
        return null;
    }
  }, [
    data, 
    actions, 
    fullscreenState.isAnyFullscreen, 
    emptyStateAction
  ]);

  return (
    <Box ref={containerRef} sx={containerStyles}>
      <LoadingOverlay loading={data.loading} progress={data.progress} />
      
      <Container {...containerConfig}>
        {/* Database Selector - Hidden in fullscreen */}
        {!fullscreenState.isAnyFullscreen && (
          <DatabaseSelector
            solrDatabases={data.solrDatabases}
            selectedSolrDatabase={data.selectedSolrDatabase}
            onSolrDatabaseChange={onSolrDatabaseChange}
            aliases={data.aliases}
            selectedAlias={data.selectedAlias}
            onAliasChange={actions.handleAliasChange}
            allResults={data.allResults}
            isDataLoading={data.isDataLoading}
            isStatsLoading={data.isStatsLoading}
            isCloudLoading={data.isCloudLoading}
            isNERLoading={data.isNERLoading}
            statsReady={data.statsReady}
            stats={data.stats}
            totalEntities={data.totalEntities}
          />
        )}

        {/* Minimal info in fullscreen */}
        {fullscreenState.isAnyFullscreen && data.selectedAlias && (
          <Box sx={FULLSCREEN_INFO_STYLES}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {data.selectedSolrDatabase?.name} › {data.selectedAlias}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {data.allResults.length > 0 && (
                <Typography variant="caption">
                  {data.allResults.length} documents
                </Typography>
              )}
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {fullscreenMode === 'browser' ? 'Browser Fullscreen' : 'Native Fullscreen'} - ESC to exit
              </Typography>
            </Box>
          </Box>
        )}

        <Paper ref={mainPaperRef} sx={paperStyles}>
          <TabNavigation
            activeTab={activeTab}
            onTabChange={(e, newValue) => setActiveTab(newValue)}
            partialResults={data.partialResults}
            allResults={data.allResults}
            statsReady={data.statsReady}
            wordFrequency={data.wordFrequency}
            nerReady={data.nerReady}
            loading={data.loading}
            isDataLoading={data.isDataLoading}
            isStatsLoading={data.isStatsLoading}
            isCloudLoading={data.isCloudLoading}
            isNERLoading={data.isNERLoading}
            fullscreenMode={fullscreenMode}
            onFullscreenModeChange={setFullscreenMode}
            isNERVisible={data.isNERVisible}
            viewNER={data.viewNER}
            onToggleNER={() => data.setViewNER(!data.viewNER)}
            containerRef={mainPaperRef}
          />

          <Box sx={{ 
            position: 'relative', 
            flex: 1,
            minHeight: 0,
            overflow: 'auto'
          }}>
            {Object.values(TABS).map(tabIndex => (
              <TabPanel key={tabIndex} value={activeTab} index={tabIndex}>
                {renderTabContent(tabIndex)}
              </TabPanel>
            ))}
          </Box>
        </Paper>
      </Container>

      {/* Quick Actions - Hidden in fullscreen */}
      {!fullscreenState.isAnyFullscreen && (
        <QuickActions
          open={quickActions}
          {...quickActionsHandlers}
        />
      )}

      <NotificationSystem
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        {...notificationHandlers}
      />
    </Box>
  );
});

HistTextLayout.displayName = 'HistTextLayout';

export default HistTextLayout;