import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Slide,
  SlideProps,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
} from '@mui/material';
import {
  CheckCircle,
  Info,
  Warning,
  Error,
  Email,
  AdminPanelSettings,
  Close,
} from '@mui/icons-material';

type NotificationType = 'success' | 'info' | 'warning' | 'error';

interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  details?: string;
  adminEmail?: string;
  autoHide?: boolean;
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'text' | 'outlined' | 'contained';
  }>;
}

interface NotificationContextType {
  showNotification: (notification: Omit<NotificationData, 'id'>) => void;
  showSuccess: (title: string, message: string, details?: string) => void;
  showInfo: (title: string, message: string, details?: string) => void;
  showWarning: (title: string, message: string, details?: string) => void;
  showError: (title: string, message: string, details?: string) => void;
  showEmailDisabled: (message: string, adminEmail: string, alternative?: string) => void;
  showAutoActivation: (message: string, info: string) => void;
  hideNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="down" />;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const showNotification = useCallback((notification: Omit<NotificationData, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: NotificationData = {
      id,
      autoHide: notification.autoHide ?? true,
      duration: notification.duration ?? 6000,
      ...notification,
    };

    setNotifications(prev => [newNotification, ...prev]);

    if (newNotification.autoHide) {
      setTimeout(() => {
        hideNotification(id);
      }, newNotification.duration);
    }
  }, []);

  const hideNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const showSuccess = useCallback((title: string, message: string, details?: string) => {
    showNotification({ type: 'success', title, message, details });
  }, [showNotification]);

  const showInfo = useCallback((title: string, message: string, details?: string) => {
    showNotification({ type: 'info', title, message, details });
  }, [showNotification]);

  const showWarning = useCallback((title: string, message: string, details?: string) => {
    showNotification({ type: 'warning', title, message, details });
  }, [showNotification]);

  const showError = useCallback((title: string, message: string, details?: string) => {
    showNotification({ type: 'error', title, message, details });
  }, [showNotification]);

  const showEmailDisabled = useCallback((message: string, adminEmail: string, alternative?: string) => {
    showNotification({
      type: 'warning',
      title: 'Email Service Unavailable',
      message,
      adminEmail,
      details: alternative,
      autoHide: false,
      actions: [
        {
          label: `Contact ${adminEmail}`,
          onClick: () => window.open(`mailto:${adminEmail}?subject=Password Reset Request`),
          variant: 'contained'
        }
      ]
    });
  }, [showNotification]);

  const showAutoActivation = useCallback((message: string, info: string) => {
    showNotification({
      type: 'success',
      title: 'Account Auto-Activated!',
      message,
      details: info,
      duration: 8000
    });
  }, [showNotification]);

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <CheckCircle />;
      case 'info': return <Info />;
      case 'warning': return <Warning />;
      case 'error': return <Error />;
    }
  };

  const value: NotificationContextType = {
    showNotification,
    showSuccess,
    showInfo,
    showWarning,
    showError,
    showEmailDisabled,
    showAutoActivation,
    hideNotification,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Render notifications */}
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, maxWidth: 400 }}>
        {notifications.map((notification) => (
          <Snackbar
            key={notification.id}
            open={true}
            TransitionComponent={SlideTransition}
            sx={{ position: 'relative', mb: 1 }}
          >
            <Alert
              severity={notification.type}
              icon={getIcon(notification.type)}
              sx={{
                width: '100%',
                borderRadius: 2,
                boxShadow: 3,
                '& .MuiAlert-message': { width: '100%' }
              }}
              action={
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => hideNotification(notification.id)}
                >
                  <Close fontSize="inherit" />
                </IconButton>
              }
            >
              <AlertTitle sx={{ fontWeight: 600, mb: 1 }}>
                {notification.title}
              </AlertTitle>
              
              <Typography variant="body2" sx={{ mb: 1 }}>
                {notification.message}
              </Typography>
              
              {notification.details && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {notification.details}
                </Typography>
              )}
              
              {notification.adminEmail && (
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Chip
                    icon={<AdminPanelSettings fontSize="small" />}
                    label={`Admin: ${notification.adminEmail}`}
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    icon={<Email fontSize="small" />}
                    label="Contact Support"
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={() => window.open(`mailto:${notification.adminEmail}?subject=Support Request`)}
                  />
                </Box>
              )}
              
              {notification.actions && notification.actions.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {notification.actions.map((action, index) => (
                    <Button
                      key={index}
                      size="small"
                      variant={action.variant || 'text'}
                      onClick={() => {
                        action.onClick();
                        if (notification.autoHide !== false) {
                          hideNotification(notification.id);
                        }
                      }}
                      sx={{ minWidth: 'auto' }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>
              )}
            </Alert>
          </Snackbar>
        ))}
      </Box>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}