import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Props for the FullscreenInfo component.
 * 
 * @property isAnyFullscreen - Whether any fullscreen mode is active.
 * @property selectedAlias - Name of the selected collection/alias.
 * @property selectedSolrDatabase - Object representing the selected database.
 * @property allResults - Array of all result documents.
 * @property fullscreenMode - The current fullscreen mode ('browser' or 'native').
 */
interface FullscreenInfoProps {
  isAnyFullscreen: boolean;
  selectedAlias: string;
  selectedSolrDatabase: any;
  allResults: any[];
  fullscreenMode: string;
}

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

/**
 * Displays a top info bar with context when in fullscreen mode,
 * showing database/collection name, number of documents, and fullscreen status.
 */
const FullscreenInfo: React.FC<FullscreenInfoProps> = ({
  isAnyFullscreen,
  selectedAlias,
  selectedSolrDatabase,
  allResults,
  fullscreenMode
}) => {
  if (!isAnyFullscreen || !selectedAlias) {
    return null;
  }

  return (
    <Box sx={FULLSCREEN_INFO_STYLES}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {selectedSolrDatabase?.name} › {selectedAlias}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {allResults.length > 0 && (
          <Typography variant="caption">
            {allResults.length} documents
          </Typography>
        )}
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          {fullscreenMode === 'browser' ? 'Browser Fullscreen' : 'Native Fullscreen'} - ESC to exit
        </Typography>
      </Box>
    </Box>
  );
};

export default React.memo(FullscreenInfo);