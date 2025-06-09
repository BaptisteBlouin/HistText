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
import React, { useState } from "react";
import "./App.css";
import { CustomThemeProvider, useThemeMode } from "./contexts/ThemeContext";
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
  Menu,
  MenuItem,
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
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { darkMode, toggleDarkMode } = useThemeMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null); // Add proper typing

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Add proper typing for the event parameter
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
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

  const drawerWidth = 280;
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
          p: collapsed ? 1 : 3,
          textAlign: "center",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {collapsed ? (
          <Tooltip title="HistText" placement="right">
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: "primary.main",
                cursor: "pointer",
                margin: "0 auto",
              }}
              onClick={() => navigate("/histtext")}
            >
              <Description />
            </Avatar>
          </Tooltip>
        ) : (
          <>
            <img
              src={HistLogo}
              alt="HistText Logo"
              style={{ height: "50px", cursor: "pointer", marginBottom: "8px" }}
              onClick={() => navigate("/histtext")}
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
                  onClick={handleProfileMenuOpen}
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
                onClick={handleProfileMenuOpen}
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

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              transformOrigin={{ horizontal: "left", vertical: "bottom" }}
              anchorOrigin={{ horizontal: "left", vertical: "top" }}
            >
              <MenuItem
                onClick={() => {
                  navigate("/account");
                  handleProfileMenuClose();
                  if (isMobile) setMobileOpen(false);
                }}
              >
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
          sx={{
            position: "fixed",
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
          pt: isMobile ? 8 : 0,
          transition: theme.transitions.create("margin", {
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
