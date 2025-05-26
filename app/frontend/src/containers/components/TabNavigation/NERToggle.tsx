import React from 'react';
import { Tooltip, Fab } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface NERToggleProps {
  activeTab: number;
  isNERVisible: boolean;
  viewNER: boolean;
  onToggleNER: () => void;
  isAnyFullscreen: boolean;
  tabsConstant: { PARTIAL_RESULTS: number };
}

const NERToggle: React.FC<NERToggleProps> = ({
  activeTab,
  isNERVisible,
  viewNER,
  onToggleNER,
  isAnyFullscreen,
  tabsConstant
}) => {
  if (activeTab !== tabsConstant.PARTIAL_RESULTS || !isNERVisible) {
    return null;
  }

  return (
    <Tooltip title={viewNER ? 'Hide NER highlighting' : 'Show NER highlighting'}>
      <Fab
        onClick={onToggleNER}
        size="medium"
        sx={{
          position: 'absolute',
          bottom: -28,
          right: isAnyFullscreen ? 80 : 24,
          bgcolor: viewNER ? 'error.main' : 'primary.main',
          '&:hover': { bgcolor: viewNER ? 'error.dark' : 'primary.dark' },
          zIndex: 1000,
        }}
      >
        {viewNER ? <VisibilityOff /> : <Visibility />}
      </Fab>
    </Tooltip>
  );
};

export default React.memo(NERToggle);