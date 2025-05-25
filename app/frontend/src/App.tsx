import { useApolloClient } from '@apollo/client';
import { useAuth, useAuthCheck } from './hooks/useAuth';
import { AccountPage } from './containers/AccountPage';
import { LoginPage } from './containers/LoginPage';
import { OauthLoginResultPage } from './containers/OauthLoginResultPage';
import { ActivationPage } from './containers/ActivationPage';
import { RegistrationPage } from './containers/RegistrationPage';
import { RecoveryPage } from './containers/RecoveryPage';
import { ResetPage } from './containers/ResetPage';
import React, { useState } from 'react';
import './App.css';
import { Home } from './containers/Home';
import { Route, useNavigate, Routes } from 'react-router-dom';
import HistText from './containers/HistText';
import AdminPanel from './containers/admin/AdminPanel';
import { 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  IconButton, 
  useTheme, 
  useMediaQuery, 
  Avatar, 
  Menu, 
  MenuItem,
  Divider,
  Typography,
  Button,
  Fab,
  Tooltip,
  Collapse
} from '@mui/material';
import { 
  Home as HomeIcon, 
  Description, 
  AdminPanelSettings, 
  AccountCircle, 
  Login, 
  Logout, 
  Menu as MenuIcon,
  Close as CloseIcon,
  ChevronLeft,
  ChevronRight
} from '@mui/icons-material';
import HistLogo from './images/HistTextLogoC.png';

const App = () => {
  useAuthCheck();
  const auth = useAuth();
  const navigate = useNavigate();
  const apollo = useApolloClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const navigationItems = [
    { text: 'Home', icon: <HomeIcon />, path: '/', public: true },
    { text: 'HistText Analysis', icon: <Description />, path: '/histtext', auth: true },
  ];

  const adminItems = [
    { text: 'Admin Panel', icon: <AdminPanelSettings />, path: '/Admin', role: 'Admin' },
  ];

  const drawerWidth = 280;
  const collapsedWidth = 64;

  const drawer = (collapsed = false) => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toggle Button - Desktop Only */}
      {!isMobile && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: collapsed ? 'center' : 'flex-end',
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
            <IconButton 
              onClick={handleSidebarToggle}
              sx={{
                backgroundColor: 'background.paper',
                boxShadow: 1,
                '&:hover': {
                  backgroundColor: 'primary.light',
                  color: 'white'
                }
              }}
            >
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Logo Section */}
      <Box sx={{ 
        p: collapsed ? 1 : 3, 
        textAlign: 'center', 
        borderBottom: '1px solid', 
        borderColor: 'divider' 
      }}>
        {collapsed ? (
          <Tooltip title="HistText" placement="right">
            <Avatar 
              sx={{ 
                width: 40, 
                height: 40, 
                bgcolor: 'primary.main',
                cursor: 'pointer',
                margin: '0 auto'
              }}
              onClick={() => navigate('/histtext')}
            >
              <Description />
            </Avatar>
          </Tooltip>
        ) : (
          <>
            <img 
              src={HistLogo} 
              alt="HistText Logo" 
              style={{ height: '50px', cursor: 'pointer', marginBottom: '8px' }} 
              onClick={() => navigate('/histtext')}
            />
            <br />
            <Typography variant="caption" color="text.secondary">
              Text Analysis Platform
            </Typography>
          </>
        )}
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, py: 2 }}>
        <List>
          {navigationItems.map((item) => {
            if (item.auth && !auth.isAuthenticated) return null;
            if (item.public === false && !auth.isAuthenticated) return null;
            
            return (
              <Tooltip 
                key={item.text}
                title={collapsed ? item.text : ''} 
                placement="right"
                disableHoverListener={!collapsed}
              >
                <ListItem 
                  button 
                  onClick={() => {
                    navigate(item.path);
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{
                    borderRadius: 2,
                    mx: collapsed ? 1 : 2,
                    mb: 1,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 1 : 2,
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      color: 'white',
                      '& .MuiListItemIcon-root': {
                        color: 'white',
                      }
                    },
                  }}
                >
                  <ListItemIcon 
                    sx={{ 
                      color: 'primary.main',
                      minWidth: collapsed ? 'auto' : 40,
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                  )}
                </ListItem>
              </Tooltip>
            );
          })}
          
          {auth.isAuthenticated && adminItems.map((item) => {
            if (item.role && !auth.session?.hasRole(item.role)) return null;
            
            return (
              <Tooltip 
                key={item.text}
                title={collapsed ? item.text : ''} 
                placement="right"
                disableHoverListener={!collapsed}
              >
                <ListItem 
                  button 
                  onClick={() => {
                    navigate(item.path);
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{
                    borderRadius: 2,
                    mx: collapsed ? 1 : 2,
                    mb: 1,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 1 : 2,
                    '&:hover': {
                      backgroundColor: 'secondary.light',
                      color: 'white',
                      '& .MuiListItemIcon-root': {
                        color: 'white',
                      }
                    },
                  }}
                >
                  <ListItemIcon 
                    sx={{ 
                      color: 'secondary.main',
                      minWidth: collapsed ? 'auto' : 40,
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                  )}
                </ListItem>
              </Tooltip>
            );
          })}
        </List>
      </Box>

      <Divider />

      {/* User Section */}
      <Box sx={{ p: collapsed ? 1 : 2 }}>
        {auth.isAuthenticated ? (
          <Box>
            {collapsed ? (
              <Tooltip title="Account" placement="right">
                <IconButton
                  onClick={handleProfileMenuOpen}
                  sx={{
                    width: '100%',
                    height: 48,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    <AccountCircle />
                  </Avatar>
                </IconButton>
              </Tooltip>
            ) : (
              <ListItem 
                button
                onClick={handleProfileMenuOpen}
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  mb: 1,
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                <ListItemIcon>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    <AccountCircle />
                  </Avatar>
                </ListItemIcon>
                <ListItemText 
                  primary="Account"
                  secondary="Manage settings"
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
              </ListItem>
            )}

            {collapsed ? (
              <Tooltip title="Sign Out" placement="right">
                <IconButton
                  color="error"
                  onClick={() => {
                    auth.logout();
                    apollo.resetStore();
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{ 
                    width: '100%',
                    height: 40,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'error.main',
                    mt: 1,
                    '&:hover': {
                      backgroundColor: 'error.light',
                      color: 'white'
                    }
                  }}
                >
                  <Logout />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<Logout />}
                onClick={() => {
                  auth.logout();
                  apollo.resetStore();
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{ mt: 1 }}
              >
                Sign Out
              </Button>
            )}

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
              anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
            >
              <MenuItem onClick={() => { 
                navigate('/account'); 
                handleProfileMenuClose(); 
                if (isMobile) setMobileOpen(false);
              }}>
                <AccountCircle sx={{ mr: 1 }} /> Account Settings
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <>
            {collapsed ? (
              <Tooltip title="Sign In" placement="right">
                <IconButton
                  color="primary"
                  onClick={() => {
                    navigate('/login');
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{ 
                    width: '100%',
                    height: 40,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    }
                  }}
                >
                  <Login />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                fullWidth
                variant="contained"
                startIcon={<Login />}
                onClick={() => {
                  navigate('/login');
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                  }
                }}
              >
                Sign In
              </Button>
            )}
          </>
        )}
      </Box>
    </Box>
  );

  const currentDrawerWidth = isMobile ? drawerWidth : (sidebarCollapsed ? collapsedWidth : drawerWidth);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile Menu Button */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="menu"
          onClick={handleDrawerToggle}
          sx={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: theme.zIndex.speedDial,
          }}
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </Fab>
      )}

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
              width: drawerWidth,
              background: 'linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)',
            },
          }}
        >
          {drawer(false)}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: currentDrawerWidth,
            flexShrink: 0,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            '& .MuiDrawer-paper': {
              width: currentDrawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderColor: 'divider',
              background: 'linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: 'hidden',
            },
          }}
        >
          {drawer(sidebarCollapsed)}
        </Drawer>
      )}

      {/* Main Content */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          backgroundColor: '#f5f7fa',
          minHeight: '100vh',
          pt: isMobile ? 8 : 0,
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth/success" element={<OauthLoginResultPage />} />
          <Route path="/oauth/error" element={<OauthLoginResultPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/reset" element={<ResetPage />} />
          <Route path="/activate" element={<ActivationPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/histtext" element={<HistText />} />
          <Route path="/Admin" element={<AdminPanel />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default App;