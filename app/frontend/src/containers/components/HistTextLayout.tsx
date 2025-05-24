import React, { useRef, useEffect } from 'react';
import { Box, Container, Paper, Fade, Typography } from '@mui/material';
import { Search, Storage, TableRows, TableChart, Analytics, AccountTree } from '@mui/icons-material';
import { Cloud as CloudIcon } from '@mui/icons-material';

import DatabaseSelector from './DatabaseSelector';
import TabNavigation, { FullscreenMode } from './TabNavigation';
import LoadingOverlay from './LoadingOverlay';
import QuickActions from './QuickActions';
import NotificationSystem from './NotificationSystem';
import EmptyState from './EmptyState';
import MetadataForm from './MetadataForm';
import DataGrid from './DataGrid';
import StatisticsDisplay from './StatisticsDisplay';
import Cloud from './Cloud';
import NERDisplay from './NERDisplay';

const TABS = {
  QUERY: 0,
  PARTIAL_RESULTS: 1,
  ALL_RESULTS: 2,
  STATS: 3,
  CLOUD: 4,
  NER: 5,
};

const TabPanel = ({ children, value, index, ...other }) => (
  <div role="tabpanel" hidden={value !== index} {...other} style={{ height: value === index ? 'auto' : 0 }}>
    {value === index && (
      <Fade in={true} timeout={300}>
        <Box sx={{ height: '100%' }}>{children}</Box>
      </Fade>
    )}
  </div>
);

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

const HistTextLayout: React.FC<HistTextLayoutProps> = ({
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

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (fullscreenMode !== 'normal') {
          setFullscreenMode('normal');
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [fullscreenMode, setFullscreenMode]);

  // Determine layout based on fullscreen mode
  const isNativeFullscreen = Boolean(document.fullscreenElement);
  const isBrowserFullscreen = fullscreenMode === 'browser';
  const isAnyFullscreen = isNativeFullscreen || isBrowserFullscreen;

  const getContainerStyles = () => {
    switch (fullscreenMode) {
      case 'normal':
        return {
          width: '100%',
          bgcolor: 'background.default',
          minHeight: '100vh',
          position: 'relative' as const,
        };
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
          width: '100%',
          bgcolor: 'background.default',
          minHeight: '100vh',
          position: 'relative' as const,
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
          width: '100%',
          bgcolor: 'background.default',
          minHeight: '100vh',
          position: 'relative' as const,
        };
    }
  };

  const getPaperStyles = () => {
    const baseStyles = {
      width: '100%',
      bgcolor: 'background.paper',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
    };

    switch (fullscreenMode) {
      case 'normal':
        return {
          ...baseStyles,
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          minHeight: '60vh',
        };
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
        return baseStyles;
    }
  };

  return (
    <Box 
      ref={containerRef}
      sx={getContainerStyles()}
    >
      <LoadingOverlay loading={data.loading} progress={data.progress} />
      
      <Container 
        maxWidth={isAnyFullscreen ? false : "xl"} 
        sx={{ 
          py: isAnyFullscreen ? 1 : 3,
          height: isAnyFullscreen ? '100vh' : 'auto',
          maxWidth: isAnyFullscreen ? '100%' : undefined,
          px: isAnyFullscreen ? 1 : 3,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Hide database selector in fullscreen modes */}
        {!isAnyFullscreen && (
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

        {/* Show minimal info in fullscreen modes */}
        {isAnyFullscreen && data.selectedAlias && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            px: 2, 
            py: 1, 
            bgcolor: 'primary.main', 
            color: 'white',
            mb: 0
          }}>
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

        <Paper 
          ref={mainPaperRef}
          sx={getPaperStyles()}
        >
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
            <TabPanel value={activeTab} index={TABS.QUERY}>
              {data.selectedAlias && data.metadata.length > 0 ? (
                <Box sx={{ p: isAnyFullscreen ? 2 : 3 }}>
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
              ) : (
                <EmptyState
                  icon={<Storage />}
                  title="Get Started"
                  description="Select a database and collection from above to begin your text analysis journey"
                  action={!isAnyFullscreen ? {
                    label: "Choose Data Source",
                    icon: <Search />,
                    onClick: () => showNotification("Please select a database and collection above", "info")
                  } : undefined}
                />
              )}
            </TabPanel>

            <TabPanel value={activeTab} index={TABS.PARTIAL_RESULTS}>
              <Box sx={{ position: 'relative', height: '100%' }}>
                {data.partialResults.length > 0 ? (
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
                )}
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index={TABS.ALL_RESULTS}>
              <Box sx={{ position: 'relative', height: '100%' }}>
                {data.allResults.length > 0 ? (
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
                )}
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index={TABS.STATS}>
              {data.stats ? (
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
              )}
            </TabPanel>

            <TabPanel value={activeTab} index={TABS.CLOUD}>
              {data.isCloudLoading ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <CloudIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                  <Typography variant="h6" gutterBottom>
                    Generating Word Cloud...
                  </Typography>
                </Box>
              ) : data.wordFrequency && data.wordFrequency.length > 0 ? (
                <Box sx={{ p: isAnyFullscreen ? 1 : 3, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cloud wordFrequency={data.wordFrequency} />
                </Box>
              ) : (
                <EmptyState
                  icon={<CloudIcon />}
                  title="No word cloud data available"
                  description="Execute a query with text data to generate word cloud"
                />
              )}
            </TabPanel>

            <TabPanel value={activeTab} index={TABS.NER}>
              {data.nerData && Object.keys(data.nerData).length > 0 ? (
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
             )}
           </TabPanel>
         </Box>
       </Paper>
     </Container>

     {/* Hide quick actions in fullscreen modes */}
     {!isAnyFullscreen && (
       <QuickActions
         open={quickActions}
         onOpen={() => setQuickActions(true)}
         onClose={() => setQuickActions(false)}
         onExportData={actions.exportAllData}
         onRefreshData={actions.refreshData}
         onShareQuery={actions.shareQuery}
         onOpenSettings={actions.openSettings}
       />
     )}

     <NotificationSystem
       open={notification.open}
       message={notification.message}
       severity={notification.severity}
       onClose={() => setNotification(prev => ({ ...prev, open: false }))}
     />
   </Box>
 );
};

export default HistTextLayout;