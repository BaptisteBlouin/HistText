import React from "react";
import { Box } from "@mui/material";
import TabPanel from "./TabPanel";
import { useTabContent } from "./hooks/useTabContent";

const TABS = {
  QUERY: 0,
  PARTIAL_RESULTS: 1,
  ALL_RESULTS: 2,
  STATS: 3,
  CLOUD: 4,
  NER: 5,
} as const;

/**
 * Props for the MainContent component.
 *
 * @property activeTab - Index of the currently active tab.
 * @property data - Data and state relevant to the content panels.
 * @property actions - Actions and handlers for content operations.
 * @property fullscreenState - Current fullscreen mode state.
 */
interface MainContentProps {
  activeTab: number;
  data: any;
  actions: any;
  fullscreenState: any;
}

/**
 * Renders the main tabbed content area for the historical text analytics UI.
 * Uses TabPanel for conditional rendering and useTabContent to select content by tab.
 */
const MainContent: React.FC<MainContentProps> = ({
  activeTab,
  data,
  actions,
  fullscreenState,
}) => {
  const { renderTabContent } = useTabContent(data, actions, fullscreenState);

  return (
    <Box
      sx={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        overflow: "auto",
      }}
    >
      {Object.values(TABS).map((tabIndex) => (
        <TabPanel key={tabIndex} value={activeTab} index={tabIndex}>
          {renderTabContent(tabIndex)}
        </TabPanel>
      ))}
    </Box>
  );
};

export default React.memo(MainContent);
