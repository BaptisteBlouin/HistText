import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Box, Container, Paper, Fade } from '@mui/material';
import { FullscreenContainer } from '../../../components/ui';
import DatabaseSelector from '../DatabaseSelector';
import TabNavigation, { FullscreenMode } from '../TabNavigation';
import LoadingOverlay from '../LoadingOverlay';
import QuickActions from '../QuickActions';
import NotificationSystem from '../NotificationSystem';
import FullscreenInfo from './FullscreenInfo';
import MainContent from './MainContent';
import { useHistTextLayoutState } from './hooks/useHistTextLayoutState';
import { useKeyboardHandlers } from './hooks/useKeyboardHandlers';

interface HistTextLayoutContainerProps {
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

const HistTextLayoutContainer: React.FC<HistTextLayoutContainerProps> = ({
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

  // Custom hooks for state and behavior
  const { containerConfig, paperStyles } = useHistTextLayoutState(fullscreenState);
  const { quickActionsHandlers, notificationHandlers } = useKeyboardHandlers(
    fullscreenMode,
    setFullscreenMode,
    setQuickActions,
    setNotification,
    actions,
    showNotification
  );

  return (
    <FullscreenContainer
      ref={containerRef}
      fullscreenMode={fullscreenMode}
      isNativeFullscreen={fullscreenState.isNativeFullscreen}
    >
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
        <FullscreenInfo
          isAnyFullscreen={fullscreenState.isAnyFullscreen}
          selectedAlias={data.selectedAlias}
          selectedSolrDatabase={data.selectedSolrDatabase}
          allResults={data.allResults}
          fullscreenMode={fullscreenMode}
        />

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

          <MainContent
            activeTab={activeTab}
            data={data}
            actions={actions}
            fullscreenState={fullscreenState}
          />
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
    </FullscreenContainer>
  );
};

export default React.memo(HistTextLayoutContainer);