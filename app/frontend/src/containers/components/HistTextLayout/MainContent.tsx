import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import TabPanel from './TabPanel';
import { useTabContent } from './hooks/useTabContent';

// Constants for tabs to prevent magic numbers
const TABS = {
  QUERY: 0,
  PARTIAL_RESULTS: 1,
  ALL_RESULTS: 2,
  STATS: 3,
  CLOUD: 4,
  NER: 5,
} as const;

interface MainContentProps {
  activeTab: number;
  data: any;
  actions: any;
  fullscreenState: any;
}

const MainContent: React.FC<MainContentProps> = ({
  activeTab,
  data,
  actions,
  fullscreenState
}) => {
  // Custom hook for tab content rendering
  const { renderTabContent } = useTabContent(data, actions, fullscreenState);

  return (
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
  );
};

export default React.memo(MainContent);