import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import { CheckCircle, Error, Warning, Info } from '@mui/icons-material';

interface NotificationProps {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

const NotificationSystem: React.FC<NotificationProps> = ({
  open,
  message,
  severity,
  onClose
}) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert 
        onClose={onClose} 
        severity={severity}
        variant="filled"
        sx={{ width: '100%' }}
        iconMapping={{
          success: <CheckCircle fontSize="inherit" />,
          error: <Error fontSize="inherit" />,
          warning: <Warning fontSize="inherit" />,
          info: <Info fontSize="inherit" />
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default NotificationSystem;