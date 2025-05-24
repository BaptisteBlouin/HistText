import React from 'react';
import {
  Backdrop,
  Card,
  CircularProgress,
  Typography,
  LinearProgress,
  useTheme
} from '@mui/material';

interface LoadingOverlayProps {
  loading: boolean;
  progress: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ loading, progress }) => {
  const theme = useTheme();

  return (
    <Backdrop open={loading} sx={{ zIndex: theme.zIndex.drawer + 1, color: '#fff' }}>
      <Card sx={{ p: 4, textAlign: 'center', minWidth: 300 }}>
        <CircularProgress size={60} sx={{ mb: 3 }} />
        <Typography variant="h6" gutterBottom>
          Processing Query
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {progress > 0 ? `${progress.toFixed(0)}% complete` : 'Initializing...'}
        </Typography>
        {progress > 0 && (
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        )}
      </Card>
    </Backdrop>
  );
};

export default LoadingOverlay;