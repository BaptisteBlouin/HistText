import React from 'react';
import { Box, Typography } from '@mui/material';

export const Permissions = ({ auth }) => {
  return (
    <Box sx={{ backgroundColor: '#f1f1f1', p: 3, borderRadius: 2 }}>
      <Typography variant="h6">Permissions</Typography>
      <pre>
        {!auth.session && <Typography>Error: No auth session present.</Typography>}
        {auth.session?.permissions?.map((perm, index) => (
          <Typography key={index}>{JSON.stringify(perm)}</Typography>
        ))}
        {auth.session?.permissions?.length === 0 && (
          <Typography>No permissions granted.</Typography>
        )}
      </pre>
    </Box>
  );
};
