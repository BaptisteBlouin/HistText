import React, { useEffect } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { FullscreenMode } from './index';
import TabsHeader from './TabsHeader';
import FullscreenControls from './FullscreenControls';
import NERToggle from './NERToggle';

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
  containerRef
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isAnyFullscreen = fullscreenMode === 'browser' || fullscreenMode === 'native';

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyNativeFullscreen = Boolean(document.fullscreenElement);
      if (!isCurrentlyNativeFullscreen && fullscreenMode === 'native') {
        onFullscreenModeChange('normal');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [fullscreenMode, onFullscreenModeChange]);

  return (
    <Box sx={{ 
      borderBottom: 1, 
      borderColor: 'divider',
      background: 'linear-gradient(90deg, #f8fafc 0%, #e2e8f0 100%)',
      position: 'relative'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
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
          isMobile={isMobile}
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