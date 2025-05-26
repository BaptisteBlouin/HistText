import React from 'react';
import { Box, Fade } from '@mui/material';

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div 
    role="tabpanel" 
    hidden={value !== index} 
    style={{ height: value === index ? 'auto' : 0 }}
  >
    {value === index && (
      <Fade in={true} timeout={300}>
        <Box sx={{ height: '100%' }}>{children}</Box>
      </Fade>
    )}
  </div>
);

export default React.memo(TabPanel);