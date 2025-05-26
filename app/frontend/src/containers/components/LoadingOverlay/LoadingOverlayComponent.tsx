import React from 'react';
import {
  Backdrop,
  Card,
  CircularProgress,
  Typography,
  LinearProgress,
  Box,
  useTheme
} from '@mui/material';
import { GradientPaper } from '../../../components/ui';

interface LoadingOverlayComponentProps {
  loading: boolean;
  progress: number;
  title?: string;
  description?: string;
}

const LoadingOverlayComponent: React.FC<LoadingOverlayComponentProps> = ({ 
  loading, 
  progress,
  title = "Processing Query",
  description
}) => {
  const theme = useTheme();

  const getProgressText = () => {
    if (progress > 0) {
      return `${progress.toFixed(0)}% complete`;
    }
    return 'Initializing...';
  };

  const getDescription = () => {
    if (description) return description;
    if (progress > 0) return getProgressText();
    return 'Please wait while we process your request';
  };

  return (
    <Backdrop open={loading} sx={{ zIndex: theme.zIndex.drawer + 1, color: '#fff' }}>
      <GradientPaper 
        gradient="primary"
        sx={{ 
          p: 4, 
          textAlign: 'center', 
          minWidth: 320,
          borderRadius: 3,
          color: 'white',
          boxShadow: theme.shadows[10]
        }}
      >
        <Box sx={{ mb: 3 }}>
          <CircularProgress 
            size={60} 
            sx={{ 
              color: 'white',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
            }} 
          />
        </Box>
        
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        
        <Typography 
          variant="body2" 
          sx={{ 
            mb: 3, 
            opacity: 0.9,
            fontSize: '0.875rem'
          }}
        >
          {getDescription()}
        </Typography>
        
        {progress > 0 && (
          <Box sx={{ width: '100%' }}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'white',
                  borderRadius: 4
                }
              }}
            />
            <Typography 
              variant="caption" 
              sx={{ 
                mt: 1, 
                display: 'block',
                opacity: 0.8,
                fontWeight: 500
              }}
            >
              {progress.toFixed(0)}%
            </Typography>
          </Box>
        )}
      </GradientPaper>
    </Backdrop>
  );
};

export default React.memo(LoadingOverlayComponent);