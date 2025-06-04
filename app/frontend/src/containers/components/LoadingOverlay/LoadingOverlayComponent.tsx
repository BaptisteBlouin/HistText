import React from 'react';
import {
  Backdrop,
  CircularProgress,
  Typography,
  LinearProgress,
  Box,
  useTheme,
  Button
} from '@mui/material';
import { Warning, Refresh } from '@mui/icons-material';
import { GradientPaper } from '../../../components/ui';

/**
 * Props for the LoadingOverlayComponent.
 *
 * @property loading - Whether the overlay is active for loading.
 * @property progress - Loading progress as a percentage (0–100).
 * @property title - Optional title to display.
 * @property description - Optional custom description.
 * @property error - Optional error message (displays error UI).
 * @property onRetry - Optional handler for retry action.
 * @property showRetry - Whether to show the retry button when an error is present.
 */
interface LoadingOverlayComponentProps {
  loading: boolean;
  progress: number;
  title?: string;
  description?: string;
  error?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

/**
 * Displays a full-screen overlay with progress indicator, error state, and retry support.
 * Used for blocking UI interactions during loading or when an error occurs.
 */
const LoadingOverlayComponent: React.FC<LoadingOverlayComponentProps> = ({ 
  loading, 
  progress,
  title = "Processing Query",
  description,
  error,
  onRetry,
  showRetry = false
}) => {
  const theme = useTheme();

  // Returns textual representation of current progress or error state
  const getProgressText = () => {
    if (error) return 'Error occurred';
    if (progress > 0) return `${progress.toFixed(0)}% complete`;
    return 'Initializing...';
  };

  // Returns the main description or error
  const getDescription = () => {
    if (error) return error;
    if (description) return description;
    if (progress > 0) return getProgressText();
    return 'Please wait while we process your request';
  };

  if (!loading && !error) return null;

  return (
    <Backdrop open={loading || !!error} sx={{ zIndex: theme.zIndex.drawer + 1, color: '#fff' }}>
      <GradientPaper 
        gradient={error ? "error" : "primary"}
        sx={{ 
          p: 4, 
          textAlign: 'center', 
          minWidth: 320,
          borderRadius: 3,
          color: 'white',
          boxShadow: theme.shadows[10]
        }}
      >
        {error ? (
          <Box sx={{ mb: 3 }}>
            <Warning 
              sx={{ 
                fontSize: 60,
                color: 'white',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                mb: 2
              }} 
            />
          </Box>
        ) : (
          <Box sx={{ mb: 3 }}>
            <CircularProgress 
              size={60} 
              sx={{ 
                color: 'white',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
              }} 
            />
          </Box>
        )}
        
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          {error ? 'Something went wrong' : title}
        </Typography>
        
        <Typography 
          variant="body2" 
          sx={{ 
            mb: error ? 3 : (progress > 0 ? 3 : 0), 
            opacity: 0.9,
            fontSize: '0.875rem'
          }}
        >
          {getDescription()}
        </Typography>
        
        {error && showRetry && onRetry && (
          <Button
            variant="contained"
            onClick={onRetry}
            startIcon={<Refresh />}
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.3)',
              }
            }}
          >
            Try Again
          </Button>
        )}
        
        {!error && progress > 0 && (
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