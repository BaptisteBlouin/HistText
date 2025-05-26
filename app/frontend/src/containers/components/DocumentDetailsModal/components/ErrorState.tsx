import React from 'react';
import { Box, Typography } from '@mui/material';
import { Description } from '@mui/icons-material';

interface ErrorStateProps {
  error: string;
}

const ErrorState: React.FC<ErrorStateProps> = React.memo(({ error }) => (
  <Box 
    display="flex" 
    flexDirection="column"
    justifyContent="center" 
    alignItems="center" 
    minHeight="400px"
    gap={2}
  >
    <Description sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
    <Typography variant="h6" color="error" align="center">
      {error}
    </Typography>
    <Typography variant="body2" color="text.secondary" align="center">
      The document could not be loaded. Please try again.
    </Typography>
  </Box>
));

ErrorState.displayName = 'ErrorState';

export default ErrorState;