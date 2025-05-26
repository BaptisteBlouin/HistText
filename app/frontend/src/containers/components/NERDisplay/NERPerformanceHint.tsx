import React from 'react';
import { Alert, Typography } from '@mui/material';
import { Lightbulb } from '@mui/icons-material';

interface NERPerformanceHintProps {
  totalEntities: number;
}

const NERPerformanceHint: React.FC<NERPerformanceHintProps> = ({ totalEntities }) => {
  if (totalEntities <= 1000) return null;

  return (
    <Alert severity="info" sx={{ mt: 2 }} icon={<Lightbulb />}>
      <Typography variant="body2">
        <strong>Performance Tip:</strong> With {totalEntities} entities, use filters to improve responsiveness. 
        The grid uses virtual scrolling for optimal performance.
      </Typography>
    </Alert>
  );
};

export default React.memo(NERPerformanceHint);