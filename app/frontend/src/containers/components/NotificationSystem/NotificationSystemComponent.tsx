import React from 'react';
import { Snackbar, Alert, AlertColor, useTheme } from '@mui/material';
import { CheckCircle, Error, Warning, Info } from '@mui/icons-material';

interface NotificationSystemComponentProps {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  autoHideDuration?: number;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

const NotificationSystemComponent: React.FC<NotificationSystemComponentProps> = ({
  open,
  message,
  severity,
  onClose,
  autoHideDuration = 6000,
  position = { vertical: 'bottom', horizontal: 'right' }
}) => {
  const theme = useTheme();

  const getIcon = (severity: AlertColor) => {
    const iconMap = {
      success: <CheckCircle fontSize="inherit" />,
      error: <Error fontSize="inherit" />,
      warning: <Warning fontSize="inherit" />,
      info: <Info fontSize="inherit" />
    };
    return iconMap[severity];
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={position}
    >
      <Alert 
        onClose={onClose} 
        severity={severity}
        variant="filled"
        sx={{ 
          width: '100%',
          borderRadius: 2,
          boxShadow: theme.shadows[6],
          '& .MuiAlert-icon': {
            fontSize: '1.25rem'
          }
        }}
        iconMapping={{
          success: getIcon('success'),
          error: getIcon('error'),
          warning: getIcon('warning'),
          info: getIcon('info')
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default React.memo(NotificationSystemComponent);