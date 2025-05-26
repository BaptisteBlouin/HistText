import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Fade,
  useTheme,
  useMediaQuery,
  Drawer,
  IconButton,
  Badge,
  Alert,
} from '@mui/material';
import {
  Person,
  Security,
  VpnKey,
  Settings,
  Menu as MenuIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { UserDetails } from './components/account/UserDetails';
import { ChangePasswordForm } from './components/account/ChangePasswordForm';
import { UserToken } from './components/account/UserToken';
import { Permissions } from './components/account/Permissions';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface MenuItem {
  id: number;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<{ auth: any }>;
  badge?: number;
}

const menuItems: MenuItem[] = [
  {
    id: 0,
    label: 'Profile Information',
    icon: <Person />,
    component: UserDetails,
  },
  {
    id: 1,
    label: 'Security & Password',
    icon: <Security />,
    component: ChangePasswordForm,
  },
  {
    id: 2,
    label: 'API Tokens',
    icon: <VpnKey />,
    component: UserToken,
  },
  {
    id: 3,
    label: 'Permissions',
    icon: <Settings />,
    component: Permissions,
  },
];

export const AccountPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (index: number) => {
    setActiveTab(index);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Paper 
          sx={{ 
            p: 6, 
            borderRadius: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            color: 'white' 
          }}
        >
          <Security sx={{ fontSize: 80, mb: 3, opacity: 0.9 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            Authentication Required
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, opacity: 0.9 }}>
            Please sign in to access your account settings.
          </Typography>
          <Box
            component="button"
            onClick={() => navigate('/login')}
            sx={{
              px: 4,
              py: 1.5,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              borderRadius: 2,
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            Sign In to Continue
          </Box>
        </Paper>
      </Container>
    );
  }

  const ActiveComponent = menuItems[activeTab]?.component || UserDetails;

  const renderSidebar = () => (
    <Box sx={{ width: 300, height: '100%' }}>
      {/* User Info Header */}
      <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
              fontSize: '1.2rem',
            }}
          >
            {auth.session?.user?.email?.charAt(0).toUpperCase() || 'U'}
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Account Settings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {auth.session?.user?.email}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Navigation Menu */}
      <List sx={{ p: 2 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.id}
            onClick={() => handleMenuClick(item.id)}
            selected={activeTab === item.id}
            sx={{
              borderRadius: 2,
              mb: 1,
              '&.Mui-selected': {
                backgroundColor: 'primary.light',
                color: 'primary.contrastText',
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText',
                },
                '&:hover': {
                  backgroundColor: 'primary.main',
                },
              },
              '&:hover': {
                backgroundColor: activeTab === item.id ? 'primary.main' : 'action.hover',
              },
              transition: 'all 0.2s ease',
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {item.badge ? (
                <Badge badgeContent={item.badge} color="error">
                  {item.icon}
                </Badge>
              ) : (
                item.icon
              )}
            </ListItemIcon>
            <ListItemText 
              primary={item.label}
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Fade in={true} timeout={600}>
        <Box>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 700,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1
              }}
            >
              Account Settings
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Manage your profile and account preferences
            </Typography>
          </Box>

          {/* Mobile Menu Button */}
          {isMobile && (
            <IconButton
              onClick={handleDrawerToggle}
              sx={{
                position: 'fixed',
                top: 100,
                left: 16,
                zIndex: theme.zIndex.speedDial,
                backgroundColor: 'primary.main',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                boxShadow: theme.shadows[4],
              }}
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          )}

          <Grid container spacing={3}>
            {/* Sidebar */}
            {isMobile ? (
              <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{ keepMounted: true }}
                sx={{
                  '& .MuiDrawer-paper': {
                    boxSizing: 'border-box',
                    width: 300,
                  },
                }}
              >
                {renderSidebar()}
              </Drawer>
            ) : (
              <Grid item xs={12} md={4} lg={3}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    overflow: 'hidden',
                    position: 'sticky',
                    top: 100,
                  }}
                >
                  {renderSidebar()}
                </Paper>
              </Grid>
            )}

            {/* Main Content */}
            <Grid item xs={12} md={8} lg={9}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  minHeight: '60vh',
                  overflow: 'hidden',
                }}
              >
                <ActiveComponent auth={auth} />
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Fade>
      <ToastContainer />
    </Container>
  );
};