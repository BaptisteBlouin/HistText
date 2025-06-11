import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Home as HomeIcon,
  Description,
  AdminPanelSettings,
  AccountCircle,
  History,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../lib/responsive-utils';

interface MobileBottomNavigationProps {
  onOpenSearchHistory?: () => void;
  searchHistoryCount?: number;
}

const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  onOpenSearchHistory,
  searchHistoryCount = 0,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { isAuthenticated, user } = useAuth();
  const { isMobile } = useResponsive();

  // Don't show on desktop or when not authenticated for most pages
  if (!isMobile) return null;

  const getCurrentValue = () => {
    const path = location.pathname;
    if (path === '/') return 0;
    if (path.startsWith('/histtext')) return 1;
    if (path.startsWith('/Admin') && isAuthenticated && user?.role === 'Admin') return 2;
    if (path.startsWith('/account')) return 3;
    return 1; // Default to HistText
  };

  const navigationItems = [
    {
      label: 'Home',
      icon: <HomeIcon />,
      value: 0,
      onClick: () => navigate('/'),
      show: true,
    },
    {
      label: 'HistText',
      icon: <Description />,
      value: 1,
      onClick: () => navigate('/histtext'),
      show: true,
    },
    {
      label: 'History',
      icon: searchHistoryCount > 0 ? (
        <Badge badgeContent={searchHistoryCount} color="error" max={99}>
          <History />
        </Badge>
      ) : (
        <History />
      ),
      value: 4,
      onClick: () => {
        if (onOpenSearchHistory) {
          onOpenSearchHistory();
        } else {
          // Fallback - navigate to histtext if no search history handler
          navigate('/histtext');
        }
      },
      show: isAuthenticated,
    },
    {
      label: 'Admin',
      icon: <AdminPanelSettings />,
      value: 2,
      onClick: () => navigate('/Admin'),
      show: isAuthenticated && user?.role === 'Admin',
    },
    {
      label: 'Account',
      icon: <AccountCircle />,
      value: 3,
      onClick: () => navigate('/account'),
      show: isAuthenticated,
    },
  ].filter(item => item.show);

  // Don't show if no items to display
  if (navigationItems.length === 0) return null;

  const currentValue = getCurrentValue();

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.appBar,
        borderTop: `1px solid ${theme.palette.divider}`,
        borderRadius: '16px 16px 0 0',
        backgroundColor: alpha(theme.palette.background.paper, 0.95),
        backdropFilter: 'blur(10px)',
        boxShadow: `0 -4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
      }}
      elevation={8}
    >
      <BottomNavigation
        value={currentValue}
        sx={{
          backgroundColor: 'transparent',
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            color: theme.palette.text.secondary,
            transition: theme.transitions.create(['color', 'transform'], {
              duration: theme.transitions.duration.short,
            }),
            '&:hover': {
              transform: 'translateY(-2px)',
            },
            '&.Mui-selected': {
              color: theme.palette.primary.main,
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.75rem',
                fontWeight: 600,
              },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.7rem',
              fontWeight: 500,
              transition: theme.transitions.create(['font-size', 'font-weight'], {
                duration: theme.transitions.duration.short,
              }),
            },
          },
        }}
      >
        {navigationItems.map((item) => (
          <BottomNavigationAction
            key={item.value}
            label={item.label}
            icon={item.icon}
            onClick={item.onClick}
            sx={{
              minWidth: 0,
              maxWidth: 'none',
              '&.Mui-selected': {
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                borderRadius: '12px',
                margin: '4px',
              },
            }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default MobileBottomNavigation;