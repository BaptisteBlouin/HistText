// app/frontend/src/containers/components/NERDisplay/components/ProcessingBanner.tsx
import React from 'react';
import {
  Alert,
  Box,
  Typography,
  LinearProgress,
  CircularProgress,
  Chip
} from '@mui/material';
import { 
  CleaningServices, 
  Schedule, 
  CheckCircle,
  Warning
} from '@mui/icons-material';
import { ProcessingState } from '../types/ner-types';

interface ProcessingBannerProps {
  processingState: ProcessingState;
  isProcessing: boolean;
  stats?: any;
}

const ProcessingBanner: React.FC<ProcessingBannerProps> = ({
  processingState,
  isProcessing,
  stats
}) => {
  const getPhaseDescription = (phase: string) => {
    switch (phase) {
      case 'preprocessing': return 'Cleaning and normalizing entities...';
      case 'basic_stats': return 'Computing basic statistics...';
      case 'relationships': return 'Analyzing entity relationships...';
      case 'patterns': return 'Detecting patterns...';
      case 'complete': return 'Analysis complete!';
      default: return 'Processing...';
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'complete': return <CheckCircle color="success" />;
      case 'preprocessing': return <CleaningServices color="primary" />;
      default: return <CircularProgress size={16} />;
    }
  };

  if (!isProcessing && (!stats || stats.processingComplete)) {
    return (
      <Alert severity="success" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CheckCircle color="success" />
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            Enhanced Entity Analysis Complete
          </Typography>
        </Box>
        <Typography variant="body2">
          <strong>Processing Complete:</strong> Applied advanced normalization, filtering, and analysis.
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            icon={<CleaningServices />}
            label="Entities Normalized" 
            size="small" 
            color="success" 
            variant="outlined"
          />
          <Chip 
            icon={<CheckCircle />}
            label="Quality Filtered" 
            size="small" 
            color="success" 
            variant="outlined"
          />
          {stats?.hasAdvancedFeatures && (
            <Chip 
              icon={<CheckCircle />}
              label="Advanced Features Available" 
              size="small" 
              color="primary" 
              variant="outlined"
            />
          )}
        </Box>
      </Alert>
    );
  }

  if (!isProcessing && stats && !stats.processingComplete) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Schedule color="primary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            Basic Analysis Ready - Advanced Features Loading
          </Typography>
        </Box>
        <Typography variant="body2">
          Basic statistics are available now. Advanced features (relationships, patterns) are being computed in the background.
        </Typography>
        {!stats.hasAdvancedFeatures && (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
            <Warning sx={{ fontSize: 14, mr: 0.5 }} />
            Large dataset detected - some advanced features may be limited for performance.
          </Typography>
        )}
      </Alert>
    );
  }

  return (
    <Alert severity="info" sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {getPhaseIcon(processingState.phase)}
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          {getPhaseDescription(processingState.phase)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <LinearProgress 
          variant="determinate" 
          value={processingState.progress}
          sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
        />
        <Typography variant="caption">
          {processingState.progress.toFixed(0)}%
        </Typography>
      </Box>
      <Typography variant="body2">
        {processingState.currentTask}
      </Typography>
      {stats && !stats.hasAdvancedFeatures && (
        <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
          Large dataset - showing basic analysis for optimal performance
        </Typography>
      )}
    </Alert>
  );
};

export default React.memo(ProcessingBanner);