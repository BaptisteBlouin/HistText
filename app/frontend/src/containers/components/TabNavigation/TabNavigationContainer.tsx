import React, { useEffect } from "react";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import { FullscreenMode } from "./index";
import { useResponsive } from "../../../lib/responsive-utils";
import TabsHeader from "./TabsHeader";
import FullscreenControls from "./FullscreenControls";
import NERToggle from "./NERToggle";

interface TabNavigationContainerProps {
  activeTab: number;
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
  partialResults: any[];
  allResults: any[];
  statsReady: boolean;
  wordFrequency: any[];
  nerReady: boolean;
  loading: boolean;
  isDataLoading: boolean;
  isStatsLoading: boolean;
  isCloudLoading: boolean;
  isNERLoading: boolean;
  fullscreenMode: FullscreenMode;
  onFullscreenModeChange: (mode: FullscreenMode) => void;
  isNERVisible: boolean;
  viewNER: boolean;
  onToggleNER: () => void;
  containerRef?: React.RefObject<HTMLElement>;
}

const TABS = {
  QUERY: 0,
  PARTIAL_RESULTS: 1,
  ALL_RESULTS: 2,
  STATS: 3,
  CLOUD: 4,
  NER: 5,
};

const TabNavigationContainer: React.FC<TabNavigationContainerProps> = ({
  activeTab,
  onTabChange,
  partialResults,
  allResults,
  statsReady,
  wordFrequency,
  nerReady,
  loading,
  isDataLoading,
  isStatsLoading,
  isCloudLoading,
  isNERLoading,
  fullscreenMode,
  onFullscreenModeChange,
  isNERVisible,
  viewNER,
  onToggleNER,
  containerRef,
}) => {
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();
  const isAnyFullscreen =
    fullscreenMode === "browser" || fullscreenMode === "native";

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyNativeFullscreen = Boolean(document.fullscreenElement);
      if (!isCurrentlyNativeFullscreen && fullscreenMode === "native") {
        onFullscreenModeChange("normal");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [fullscreenMode, onFullscreenModeChange]);

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 1, sm: 2 },
          py: { xs: 0.5, sm: 1 },
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: { xs: 1, sm: 0 },
        }}
      >
        <TabsHeader
          activeTab={activeTab}
          onTabChange={onTabChange}
          partialResults={partialResults}
          allResults={allResults}
          statsReady={statsReady}
          wordFrequency={wordFrequency}
          nerReady={nerReady}
          loading={loading}
          isDataLoading={isDataLoading}
          isStatsLoading={isStatsLoading}
          isCloudLoading={isCloudLoading}
          isNERLoading={isNERLoading}
        />

        <FullscreenControls
          fullscreenMode={fullscreenMode}
          onFullscreenModeChange={onFullscreenModeChange}
          containerRef={containerRef}
          isAnyFullscreen={isAnyFullscreen}
        />
      </Box>

      <NERToggle
        activeTab={activeTab}
        isNERVisible={isNERVisible}
        viewNER={viewNER}
        onToggleNER={onToggleNER}
        isAnyFullscreen={isAnyFullscreen}
        tabsConstant={TABS}
      />
    </Box>
  );
};

export default React.memo(TabNavigationContainer);
