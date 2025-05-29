// Create app/frontend/src/containers/components/NERDisplay/components/NERAnalyticsLimitDialog.tsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box,
  Chip,
  LinearProgress
} from '@mui/material';
import { Warning, TrendingUp, Speed, Memory } from '@mui/icons-material';

interface NERAnalyticsLimitDialogProps {
  open: boolean;
  onClose: () => void;
  onProceed: (useLimited: boolean) => void;
  totalEntities: number;
  maxEntities: number;
  estimatedTime: string;
}

const NERAnalyticsLimitDialog: React.FC<NERAnalyticsLimitDialogProps> = ({
  open,
  onClose,
  onProceed,
  totalEntities,
  maxEntities,
  estimatedTime
}) => {
  const percentageToProcess = Math.min((maxEntities / totalEntities) * 100, 100);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Warning color="warning" />
        Large Dataset Detected
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Your query returned <strong>{totalEntities.toLocaleString()} entities</strong>, 
            which may result in slow performance for advanced analytics.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Performance Impact
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Chip 
              icon={<Speed />} 
              label={`Estimated time: ${estimatedTime}`} 
              color="warning" 
              variant="outlined" 
            />
            <Chip 
              icon={<Memory />} 
              label="High memory usage" 
              color="error" 
              variant="outlined" 
            />
            <Chip 
              icon={<TrendingUp />} 
              label="Complex calculations" 
              color="info" 
              variant="outlined" 
            />
          </Box>
        </Box>

        <Typography variant="h6" gutterBottom>
          Choose how to proceed:
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              <strong>Option 1: Refine your query (Recommended)</strong>
            </Typography>
            <Typography variant="body2">
              Add more specific search criteria to reduce the number of results and get more focused insights.
            </Typography>
          </Alert>

          <Alert severity="success">
            <Typography variant="subtitle2" gutterBottom>
              <strong>Option 2: Analyze subset ({maxEntities.toLocaleString()} entities)</strong>
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Process the first {maxEntities.toLocaleString()} entities ({percentageToProcess.toFixed(1)}% of your data) 
              for faster performance while still getting meaningful insights.
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={percentageToProcess} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Alert>

          <Alert severity="error">
            <Typography variant="subtitle2" gutterBottom>
              <strong>Option 3: Process all entities (Not recommended)</strong>
            </Typography>
            <Typography variant="body2">
              This may take several minutes and could cause browser slowdowns or crashes.
            </Typography>
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button 
          onClick={onClose}
          variant="outlined"
        >
          Cancel & Refine Query
        </Button>
        <Button 
          onClick={() => onProceed(true)}
          variant="contained"
          color="success"
        >
          Analyze Subset ({maxEntities.toLocaleString()})
        </Button>
        <Button 
          onClick={() => onProceed(false)}
          variant="contained"
          color="error"
        >
          Process All (Risky)
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(NERAnalyticsLimitDialog);