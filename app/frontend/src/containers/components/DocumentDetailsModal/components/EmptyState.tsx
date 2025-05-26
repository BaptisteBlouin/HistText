import React from 'react';
import { Box, Typography } from '@mui/material';
import { Description } from '@mui/icons-material';

const EmptyState: React.FC = React.memo(() => (
  <Box 
    display="flex" 
    flexDirection="column"
    justifyContent="center" 
    alignItems="center" 
    minHeight="400px"
  >
    <Description sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
    <Typography variant="h6" color="text.secondary" align="center">
      No document information available
    </Typography>
  </Box>
));

EmptyState.displayName = 'EmptyState';

export default EmptyState;