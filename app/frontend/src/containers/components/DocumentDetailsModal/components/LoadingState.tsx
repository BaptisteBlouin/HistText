import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingState: React.FC = React.memo(() => (
  <Box 
    display="flex" 
    flexDirection="column"
    justifyContent="center" 
    alignItems="center" 
    minHeight="400px"
    gap={2}
  >
    <CircularProgress size={48} />
    <Typography variant="h6" color="text.secondary">
      Loading document...
    </Typography>
  </Box>
));

LoadingState.displayName = 'LoadingState';

export default LoadingState;