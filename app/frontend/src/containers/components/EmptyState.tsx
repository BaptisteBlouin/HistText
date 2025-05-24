import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <Box sx={{ 
      textAlign: 'center', 
      py: 8,
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    }}>
      <Box sx={{ fontSize: 80, color: 'text.secondary', mb: 3, opacity: 0.5 }}>
        {icon}
      </Box>
      <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
        {description}
      </Typography>
      {action && (
        <Button 
          variant="outlined" 
          startIcon={action.icon}
          onClick={action.onClick}
          sx={{ 
            borderColor: '#667eea',
            color: '#667eea',
            '&:hover': { 
              borderColor: '#5a6fd8',
              backgroundColor: 'rgba(102, 126, 234, 0.1)'
            }
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;