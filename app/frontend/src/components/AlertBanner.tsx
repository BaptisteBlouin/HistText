import React from 'react';
import { Alert, AlertTitle, Box, IconButton, Slide, Typography, keyframes, useTheme, useMediaQuery } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useConfig } from '../contexts/ConfigurationContext';
import { useResponsive } from '../lib/responsive-utils';

interface AlertBannerProps {
  onDismiss?: () => void;
  dismissed?: boolean;
  sidebarCollapsed?: boolean;
  currentDrawerWidth?: number;
}

// Moving gradient animation for important alerts
const movingGradient = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// Subtle pulse animation
const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 5px rgba(0,0,0,0.1); }
  50% { box-shadow: 0 0 20px rgba(0,0,0,0.2); }
`;

const AlertBanner: React.FC<AlertBannerProps> = ({ 
  onDismiss, 
  dismissed = false, 
  sidebarCollapsed = false, 
  currentDrawerWidth = 280 
}) => {
  const config = useConfig();
  const { isMobile } = useResponsive();

  // Don't show if alert is disabled, empty, or dismissed
  if (!config.alert_enabled || !config.alert_message || dismissed) {
    return null;
  }

  const severity = config.alert_type || 'info';
  
  // Calculate left position based on sidebar state
  const getLeftPosition = () => {
    if (isMobile) {
      return 0; // Mobile uses overlay drawer, so no offset needed
    }
    return currentDrawerWidth; // Desktop: offset by sidebar width
  };
  
  // Enhanced styling based on severity
  const getSeverityStyles = () => {
    const isImportant = severity === 'error' || severity === 'warning';
    
    return {
      background: isImportant 
        ? `linear-gradient(45deg, 
            ${severity === 'error' ? '#ffebee, #ffcdd2, #ffebee' : '#fff3e0, #ffe0b2, #fff3e0'})`
        : undefined,
      backgroundSize: isImportant ? '200% 200%' : undefined,
      animation: isImportant 
        ? `${movingGradient} 3s ease-in-out infinite, ${pulseGlow} 2s ease-in-out infinite`
        : `${pulseGlow} 3s ease-in-out infinite`,
      borderLeft: severity === 'error' 
        ? '4px solid #f44336' 
        : severity === 'warning' 
        ? '4px solid #ff9800'
        : severity === 'success'
        ? '4px solid #4caf50'
        : '4px solid #2196f3',
    };
  };

  return (
    <Slide direction="down" in={!dismissed} mountOnEnter unmountOnExit>
      <Box 
        sx={{ 
          position: 'fixed',
          top: 0,
          left: getLeftPosition(),
          right: 0,
          zIndex: 1300, // Higher than sidebar and app bar
          margin: 0,
        }}
      >
        <Alert
          severity={severity}
          action={
            onDismiss && (
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={onDismiss}
                sx={{
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    transform: 'scale(1.1)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            )
          }
          sx={{
            borderRadius: 0,
            textAlign: 'center',
            justifyContent: 'center',
            minHeight: '56px',
            display: 'flex',
            alignItems: 'center',
            ...getSeverityStyles(),
            '& .MuiAlert-message': {
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
            },
            '& .MuiAlert-action': {
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              marginLeft: 0,
              paddingLeft: 0,
            },
          }}
        >
          <Typography 
            variant="body1" 
            component="div"
            sx={{
              fontWeight: severity === 'error' || severity === 'warning' ? 600 : 500,
              fontSize: '1rem',
              lineHeight: 1.4,
              maxWidth: '90%',
              margin: '0 auto',
            }}
          >
            {config.alert_message}
          </Typography>
        </Alert>
      </Box>
    </Slide>
  );
};

export default AlertBanner;