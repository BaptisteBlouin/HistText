import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { Box, Container, Paper, Fade } from "@mui/material";
import { FullscreenContainer } from "../../../components/ui";
import { useResponsive } from "../../../lib/responsive-utils";
import DatabaseSelector, { DatabaseSelectorHandle } from "../DatabaseSelector";
import TabNavigation, { FullscreenMode } from "../TabNavigation";
import LoadingOverlay from "../LoadingOverlay";
import QuickActions from "../QuickActions";
import NotificationSystem from "../NotificationSystem";
import FullscreenInfo from "./FullscreenInfo";
import MainContent from "./MainContent";
import { useHistTextLayoutState } from "./hooks/useHistTextLayoutState";
import { useKeyboardHandlers } from "./hooks/useKeyboardHandlers";

/**
 * Props for the HistTextLayoutContainer component.
 *
 * @property data - All relevant data, results, and loading states for the app.
 * @property actions - Functions for data handling and tab actions.
 * @property activeTab - The current tab index.
 * @property setActiveTab - Handler to set the active tab.
 * @property fullscreenMode - The current fullscreen mode.
 * @property setFullscreenMode - Setter for fullscreen mode.
 * @property quickActions - Whether quick actions panel is open.
 * @property setQuickActions - Setter for quick actions panel.
 * @property notification - Notification system state.
 * @property setNotification - Setter for notification state.
 * @property onSolrDatabaseChange - Handler for database switching.
 * @property showNotification - Handler to trigger notifications.
 */
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
  showNotification: (
    message: string,
    severity?: "success" | "error" | "warning" | "info",
  ) => void;
}

/**
 * Top-level layout and logic for the historical text analytics UI.
 * Handles fullscreen logic, layout, tab navigation, notification, and state wiring.
 */
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
  showNotification,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainPaperRef = useRef<HTMLDivElement>(null);
  const databaseSelectorRef = useRef<DatabaseSelectorHandle>(null);
  const { isMobile, isTablet, getModalWidth } = useResponsive();

  // Fullscreen state calculation (native or browser)
  const fullscreenState = useMemo(() => {
    const isNativeFullscreen = Boolean(document.fullscreenElement);
    const isBrowserFullscreen = fullscreenMode === "browser";
    const isAnyFullscreen = isNativeFullscreen || isBrowserFullscreen;

    return {
      isNativeFullscreen,
      isBrowserFullscreen,
      isAnyFullscreen,
    };
  }, [fullscreenMode]);

  // Custom layout and keyboard handler hooks
  const { containerConfig, paperStyles } =
    useHistTextLayoutState(fullscreenState);
  const { quickActionsHandlers, notificationHandlers } = useKeyboardHandlers(
    fullscreenMode,
    setFullscreenMode,
    setQuickActions,
    setNotification,
    actions,
    showNotification,
  );

  // Function to open database selector
  const openDatabaseSelector = useCallback(() => {
    // If in fullscreen mode, exit fullscreen first
    if (fullscreenState.isAnyFullscreen) {
      setFullscreenMode("normal");
      // Wait a bit for the transition, then open the selector
      setTimeout(() => {
        databaseSelectorRef.current?.openDatabaseSelector();
      }, 300);
    } else {
      // Direct access in normal mode
      databaseSelectorRef.current?.openDatabaseSelector();
    }
  }, [fullscreenState.isAnyFullscreen, setFullscreenMode]);

  return (
    <FullscreenContainer
      ref={containerRef}
      fullscreenMode={fullscreenMode}
      isNativeFullscreen={fullscreenState.isNativeFullscreen}
    >
      <LoadingOverlay loading={data.loading} progress={data.progress} />

      <Container
        {...{
          ...containerConfig,
          maxWidth:
            containerConfig.maxWidth === true ? "xl" : containerConfig.maxWidth,
        }}
        sx={{
          px: { xs: 1, sm: 2, md: 3 },
          py: { xs: 1, sm: 2 },
        }}
      >
        {/* Database Selector - Hidden in fullscreen */}
        {!fullscreenState.isAnyFullscreen && (
          <DatabaseSelector
            ref={databaseSelectorRef}
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


        <Paper 
          ref={mainPaperRef} 
          sx={{
            ...paperStyles,
            borderRadius: { xs: fullscreenState.isAnyFullscreen ? 0 : 1, sm: fullscreenState.isAnyFullscreen ? 0 : 2 },
            borderTopLeftRadius: !fullscreenState.isAnyFullscreen ? 0 : undefined,
            borderTopRightRadius: !fullscreenState.isAnyFullscreen ? 0 : undefined,
            mx: { xs: 0, sm: 0 },
            p: { xs: 1, sm: 2, md: 3 },
          }}
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

          <MainContent
            activeTab={activeTab}
            data={data}
            actions={{
              ...actions,
              openDatabaseSelector,
            }}
            fullscreenState={fullscreenState}
          />
        </Paper>
      </Container>

      {/*
      {!fullscreenState.isAnyFullscreen && (
        <QuickActions
          open={quickActions}
          {...quickActionsHandlers}
        />
      )}
      */}
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
