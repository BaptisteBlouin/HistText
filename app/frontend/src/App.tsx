import { useAuth, useAuthCheck, AuthProvider } from "./hooks/useAuth";
import { AccountPage } from "./containers/AccountPage";
import { LoginPage } from "./containers/LoginPage";
import { OauthLoginResultPage } from "./containers/OauthLoginResultPage";
import { ActivationPage } from "./containers/ActivationPage";
import { RegistrationPage } from "./containers/RegistrationPage";
import { RecoveryPage } from "./containers/RecoveryPage";
import { ResetPage } from "./containers/ResetPage";
import { ProtectedRoute } from "./components/RouteGuards";
import { LogoutButton } from "./components/LogoutButton";
import { KeyboardShortcutsHelp } from "./components/ui";
import React, { useState } from "react";
import "./App.css";
import "./styles/ag-grid-dark-theme.css";
import "./styles/responsive.css";
import { CustomThemeProvider, useThemeMode } from "./contexts/ThemeContext";
import { useResponsive } from "./lib/responsive-utils";
import { Home } from "./containers/Home";
import { Route, useNavigate, Routes } from "react-router-dom";
import HistText from "./containers/HistText";
import AdminPanel from "./containers/admin/AdminPanel";

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
  Divider,
  Typography,
  Button,
  Fab,
  Tooltip,
} from "@mui/material";
import {
  Home as HomeIcon,
  Description,
  AdminPanelSettings,
  AccountCircle,
  Login,
  Menu as MenuIcon,
  Close as CloseIcon,
  ChevronLeft,
  ChevronRight,
  GitHub,
  DarkMode,
  LightMode,
} from "@mui/icons-material";
import HistLogo from "./images/HistTextLogoC.png";

const AppContent = () => {
  useAuthCheck();
  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const { isMobile, isTablet, isVerySmallMobile } = useResponsive();
  const { darkMode, toggleDarkMode } = useThemeMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const navigationItems = [
    { text: "Home", icon: <HomeIcon />, path: "/", public: true },
    {
      text: "HistText Analysis",
      icon: <Description />,
      path: "/histtext",
      auth: true,
    },
  ];

  const adminItems = [
    {
      text: "Admin Panel",
      icon: <AdminPanelSettings />,
      path: "/Admin",
      role: "Admin",
    },
  ];

  const getDrawerWidth = () => {
    if (isMobile) return 280;
    if (isTablet) return 260;
    return 280;
  };
  
  const drawerWidth = getDrawerWidth();
  const collapsedWidth = 64;

  const drawer = (collapsed = false) => (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Toggle Button - Desktop Only */}
      {!isMobile && (
        <Box
          sx={{
            display: "flex",
            justifyContent: collapsed ? "center" : "flex-end",
            p: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Tooltip
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            placement="right"
          >
            <IconButton
              onClick={handleSidebarToggle}
              sx={{
                backgroundColor: "background.paper",
                boxShadow: 1,
                "&:hover": {
                  backgroundColor: "primary.light",
                  color: "white",
                },
              }}
            >
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Logo Section */}
      <Box
        sx={{
          p: collapsed ? 1 : { xs: 2, sm: 3 },
          textAlign: "center",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {collapsed ? (
          <Tooltip title="HistText" placement="right">
            <Avatar
              sx={{
                width: { xs: 36, sm: 40 },
                height: { xs: 36, sm: 40 },
                bgcolor: "primary.main",
                cursor: "pointer",
                margin: "0 auto",
              }}
              onClick={() => navigate("/histtext")}
            >
              <Description sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
            </Avatar>
          </Tooltip>
        ) : (
          <>
            <img
              src={HistLogo}
              alt="HistText Logo"
              style={{ 
                height: isMobile ? "40px" : "50px", 
                cursor: "pointer", 
                marginBottom: "8px" 
              }}
              onClick={() => navigate("/histtext")}
            />
            <br />
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
            >
              Text Analysis Platform
            </Typography>
          </>
        )}
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, py: { xs: 1.5, sm: 2 } }}>
        <List>
          {navigationItems.map((item) => {
            if (item.auth && !auth.isAuthenticated) return null;
            if (item.public === false && !auth.isAuthenticated) return null;

            return (
              <Tooltip
                key={item.text}
                title={collapsed ? item.text : ""}
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
                    mx: collapsed ? 1 : { xs: 1.5, sm: 2 },
                    mb: 1,
                    justifyContent: collapsed ? "center" : "flex-start",
                    px: collapsed ? 1 : { xs: 1.5, sm: 2 },
                    minHeight: { xs: 44, sm: 48 },
                    "&:hover": {
                      backgroundColor: "primary.light",
                      color: "white",
                      "& .MuiListItemIcon-root": {
                        color: "white",
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: "primary.main",
                      minWidth: collapsed ? "auto" : { xs: 36, sm: 40 },
                      justifyContent: "center",
                      '& svg': {
                        fontSize: { xs: '1.25rem', sm: '1.5rem' }
                      }
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{ 
                        fontWeight: 500,
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                    />
                  )}
                </ListItem>
              </Tooltip>
            );
          })}

          {auth.isAuthenticated &&
            adminItems.map((item) => {
              if (item.role && !auth.session?.hasRole(item.role)) return null;

              return (
                <Tooltip
                  key={item.text}
                  title={collapsed ? item.text : ""}
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
                      justifyContent: collapsed ? "center" : "flex-start",
                      px: collapsed ? 1 : 2,
                      "&:hover": {
                        backgroundColor: "secondary.light",
                        color: "white",
                        "& .MuiListItemIcon-root": {
                          color: "white",
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: "secondary.main",
                        minWidth: collapsed ? "auto" : 40,
                        justifyContent: "center",
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

      <Box sx={{ p: collapsed ? 1 : 2 }}>
        {/* Theme Toggle */}
        <Box sx={{ mb: 2 }}>
          {collapsed ? (
            <Tooltip title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"} placement="right">
              <IconButton
                onClick={toggleDarkMode}
                sx={{
                  width: "100%",
                  height: 48,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  mb: 1,
                  bgcolor: darkMode ? "grey.800" : "primary.light",
                  color: "white",
                  "&:hover": {
                    bgcolor: darkMode ? "grey.700" : "primary.main",
                  },
                }}
              >
                {darkMode ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>
          ) : (
            <ListItem
              button
              onClick={toggleDarkMode}
              sx={{
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                mb: 1,
                bgcolor: darkMode ? "grey.800" : "primary.light",
                color: "white",
                "&:hover": {
                  bgcolor: darkMode ? "grey.700" : "primary.main",
                },
              }}
            >
              <ListItemIcon>
                {darkMode ? <LightMode sx={{ color: "white" }} /> : <DarkMode sx={{ color: "white" }} />}
              </ListItemIcon>
              <ListItemText
                primary={darkMode ? "Light Mode" : "Dark Mode"}
                secondary="Toggle theme"
                secondaryTypographyProps={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}
              />
            </ListItem>
          )}
        </Box>
        
        <Box sx={{ mb: 2 }}>
          {collapsed ? (
            <Tooltip title="View on GitHub" placement="right">
              <IconButton
                onClick={() =>
                  window.open(
                    "https://github.com/BaptisteBlouin/HistText",
                    "_blank",
                  )
                }
                sx={{
                  width: "100%",
                  height: 48,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  mb: 1,
                  "&:hover": {
                    backgroundColor: "secondary.light",
                    borderColor: "secondary.main",
                    color: "white",
                  },
                }}
              >
                <GitHub sx={{ color: "secondary.main" }} />
              </IconButton>
            </Tooltip>
          ) : (
            <ListItem
              button
              onClick={() =>
                window.open(
                  "https://github.com/BaptisteBlouin/HistText",
                  "_blank",
                )
              }
              sx={{
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                mb: 1,
                "&:hover": {
                  backgroundColor: "secondary.light",
                  borderColor: "secondary.main",
                  color: "white",
                  "& .MuiListItemIcon-root": {
                    color: "white",
                  },
                },
              }}
            >
              <ListItemIcon>
                <GitHub sx={{ color: "secondary.main" }} />
              </ListItemIcon>
              <ListItemText
                primary="View on GitHub"
                secondary="Source code"
                secondaryTypographyProps={{ fontSize: "0.75rem" }}
              />
            </ListItem>
          )}
        </Box>
        {auth.isAuthenticated ? (
          <Box>
            {collapsed ? (
              <Tooltip title="Account" placement="right">
                <IconButton
                  onClick={() => {
                    navigate("/account");
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{
                    width: "100%",
                    height: 48,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    mb: 1,
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  }}
                >
                  <Avatar
                    sx={{ width: 32, height: 32, bgcolor: "primary.main" }}
                  >
                    <AccountCircle />
                  </Avatar>
                </IconButton>
              </Tooltip>
            ) : (
              <ListItem
                button
                onClick={() => {
                  navigate("/account");
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  mb: 1,
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <ListItemIcon>
                  <Avatar
                    sx={{ width: 32, height: 32, bgcolor: "primary.main" }}
                  >
                    <AccountCircle />
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary="Account"
                  secondary="Manage settings"
                  secondaryTypographyProps={{ fontSize: "0.75rem" }}
                />
              </ListItem>
            )}

            {/* Use the new LogoutButton component */}
            <LogoutButton
              variant={collapsed ? "icon" : "button"}
              collapsed={collapsed}
              onComplete={() => {
                if (isMobile) setMobileOpen(false);
              }}
            />

          </Box>
        ) : (
          <>
            {collapsed ? (
              <Tooltip title="Sign In" placement="right">
                <IconButton
                  color="primary"
                  onClick={() => {
                    navigate("/login");
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{
                    width: "100%",
                    height: 40,
                    borderRadius: 2,
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                    },
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
                  navigate("/login");
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                  },
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

  const currentDrawerWidth = isMobile
    ? drawerWidth
    : sidebarCollapsed
      ? collapsedWidth
      : drawerWidth;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile Menu Button */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="menu"
          onClick={handleDrawerToggle}
          size={isVerySmallMobile ? "small" : "medium"}
          sx={{
            position: "fixed",
            top: isVerySmallMobile ? 10 : 12,
            left: isVerySmallMobile ? 10 : 12,
            zIndex: theme.zIndex.speedDial,
            width: isVerySmallMobile ? 44 : 48,
            height: isVerySmallMobile ? 44 : 48,
          }}
        >
          {mobileOpen ? 
            <CloseIcon sx={{ fontSize: isVerySmallMobile ? '1.125rem' : '1.25rem' }} /> : 
            <MenuIcon sx={{ fontSize: isVerySmallMobile ? '1.125rem' : '1.25rem' }} />
          }
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
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              bgcolor: "background.paper",
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
            transition: theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            "& .MuiDrawer-paper": {
              width: currentDrawerWidth,
              boxSizing: "border-box",
              borderRight: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              transition: theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: "hidden",
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
          bgcolor: "background.default",
          minHeight: "100vh",
          pt: isMobile ? { xs: 7, sm: 8 } : 0,
          px: { xs: 1, sm: 0 },
          transition: theme.transitions.create(["margin", "padding"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Routes>
          {/* Public routes - only accessible when NOT authenticated */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/activate" element={<ActivationPage />} />
          <Route path="/reset" element={<ResetPage />} />

          {/* OAuth routes - these need special handling */}
          <Route path="/oauth/success" element={<OauthLoginResultPage />} />
          <Route path="/oauth/error" element={<OauthLoginResultPage />} />

          {/* Public/Mixed routes */}
          <Route path="/" element={<Home />} />

          {/* Protected routes - only accessible when authenticated */}
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/histtext"
            element={
              <ProtectedRoute>
                <HistText />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Admin"
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Box>
      
      {/* Global Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp />
    </Box>
  );
};

// Wrap the entire app with providers
const App = () => {
  return (
    <CustomThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </CustomThemeProvider>
  );
};

export default App;
