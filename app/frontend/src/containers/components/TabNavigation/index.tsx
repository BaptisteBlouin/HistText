import React from "react";
import TabNavigationContainer from "./TabNavigationContainer";

export type FullscreenMode = "normal" | "browser" | "native";

interface TabNavigationProps {
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

const TabNavigation: React.FC<TabNavigationProps> = (props) => {
  return <TabNavigationContainer {...props} />;
};

export default TabNavigation;
