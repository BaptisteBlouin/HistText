// app/frontend/src/containers/components/NERDisplay/components/ProcessingStatus.tsx
import React from 'react';
import { Alert, Box, Typography, LinearProgress, Button } from '@mui/material';
import { Warning, Cancel } from '@mui/icons-material';

interface ProcessingStatusProps {
  isProcessing: boolean;
  processingState: any;
  onCancel?: () => void;
  showCancelButton?: boolean;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  isProcessing,
  processingState,
  onCancel,
  showCancelButton = true
}) => {
  if (!isProcessing) return null;

  const isStuck = processingState.progress === processingState.lastProgress && 
                 Date.now() - processingState.lastUpdate > 30000; // 30 seconds

  return (
    <Alert 
      severity={isStuck ? "warning" : "info"} 
      sx={{ mb: 2 }}
      action={
        showCancelButton && onCancel ? (
          <Button
            color="inherit"
            size="small"
            onClick={onCancel}
            startIcon={<Cancel />}
          >
            Cancel
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {isStuck && <Warning />}
        <Typography variant="subtitle2">
          {isStuck ? 'Processing seems stuck - you can cancel if needed' : processingState.currentTask}
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <LinearProgress 
          variant="determinate" 
          value={processingState.progress}
          sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
        />
        <Typography variant="caption">
          {processingState.progress.toFixed(0)}%
        </Typography>
      </Box>
      
      {isStuck && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Large datasets may take longer to process. Consider canceling and using a smaller sample.
        </Typography>
      )}
    </Alert>
  );
};

export default React.memo(ProcessingStatus);