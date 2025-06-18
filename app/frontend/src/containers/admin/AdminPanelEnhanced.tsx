import React, { useState, Suspense, useEffect } from "react";
import { useAuth, useAuthCheck } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  Tabs,
  Tab,
  Button,
  Container,
  Paper,
  Fade,
  useTheme,
  useMediaQuery,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Stack,
  LinearProgress,
  Alert,
  Fab,
  Grid,
  CardContent,
  AppBar,
  Toolbar,
  BottomNavigation,
  BottomNavigationAction,
  alpha,
  Tooltip,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  People,
  Security,
  Storage,
  Psychology,
  MenuBook,
  Menu as MenuIcon,
  Close as CloseIcon,
  AdminPanelSettings,
  Home,
  ArrowBack,
  MoreVert,
  ViewModule,
  ViewList,
} from "@mui/icons-material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useThemeMode } from "../../contexts/ThemeContext";
import { useResponsive } from "../../lib/responsive-utils";
import AdminDashboardCards from "./components/AdminDashboardCards";

// Lazy load enhanced components
const Users = React.lazy(() => import("./components/UsersEnhanced"));
const RolePermissions = React.lazy(
  () => import("./components/RolePermissionsEnhanced"),
);
const UserRoles = React.lazy(() => import("./components/UserRolesEnhanced"));
const SolrDatabase = React.lazy(() => import("./components/SolrDatabaseEnhanced"));
const SolrDatabasePermissions = React.lazy(
  () => import("./components/SolrDatabasePermissionsEnhanced"),
);
const SolrDatabaseInfo = React.lazy(
  () => import("./components/SolrDatabaseInfoEnhanced"),
);
const Dashboard = React.lazy(() => import("./components/dashboard"));
const PrecomputeNER = React.lazy(() => import("./components/PrecomputedNER"));
const TokenizeSolr = React.lazy(() => import("./components/TokenizeSolr"));
const ComputeWordEmbeddings = React.lazy(
  () => import("./components/ComputeWordEmbeddings"),
);
const SystemConfiguration = React.lazy(
  () => import("./components/SystemConfiguration"),
);

// ReadMe and API Documentation components (same as before)
const ReadMeTab: React.FC = () => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/docs/READMES.md")
      .then((res) => {
        if (!res.ok)
          throw new Error(`Failed to fetch README: ${res.statusText}`);
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <LinearProgress sx={{ width: "100%" }} />
        <Typography>Loading Documentation...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 4 }}>
        Error loading documentation: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: "100%", overflow: "auto" }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
};

const ApiDocumentation: React.FC = () => {
  const handleOpenApiDocs = () => {
    window.open("/swagger-ui/", "_blank");
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card sx={{ textAlign: "center", p: 4 }}>
        <MenuBook sx={{ fontSize: 80, color: "primary.main", mb: 3 }} />
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          API Documentation
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4 }}>
          Access the complete API documentation with interactive endpoints using Swagger UI.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={handleOpenApiDocs}
          sx={{
            px: 4,
            py: 1.5,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            "&:hover": {
              background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
            },
          }}
        >
          Open API Documentation
        </Button>
      </Card>
    </Container>
  );
};

// Section Card Component for mobile-optimized sections
interface SectionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  icon,
  children,
  color = 'primary'
}) => {
  const theme = useTheme();
  
  return (
    <Card
      sx={{
        mb: 3,
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(135deg, ${theme.palette[color].light} 0%, ${theme.palette[color].main} 100%)`,
        },
      }}
    >
      <CardContent sx={{ p: 0 }}>
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            background: `linear-gradient(135deg, ${alpha(theme.palette[color].light, 0.1)} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                display: 'inline-flex',
                p: 1.5,
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${theme.palette[color].light} 0%, ${theme.palette[color].main} 100%)`,
                color: 'white',
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
};

const AdminPanelEnhanced: React.FC = () => {
  useAuthCheck();
  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();
  const isAdmin = auth.session?.hasRole("Admin");
  const { darkMode } = useThemeMode();

  // State management
  const [currentView, setCurrentView] = useState<'dashboard' | 'section'>('dashboard');
  const [mainTab, setMainTab] = useState<number>(0);
  const [subTab, setSubTab] = useState<number>(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Tab definitions
  const mainTabs = [
    { label: "Dashboard", icon: <DashboardIcon />, color: "primary" },
    { label: "User Management", icon: <People />, color: "secondary" },
    { label: "Data Management", icon: <Storage />, color: "success" },
    { label: "System Configuration", icon: <Security />, color: "error" },
    { label: "NLP Tools", icon: <Psychology />, color: "warning" },
    { label: "API Docs", icon: <MenuBook />, color: "info" },
  ];

  const userSubTabs = [
    { label: "Users", component: Users },
    { label: "User Roles", component: UserRoles },
    { label: "Role Permissions", component: RolePermissions },
  ];

  const dataSubTabs = [
    { label: "Databases", component: SolrDatabase },
    { label: "Database Info", component: SolrDatabaseInfo },
    { label: "Database Permissions", component: SolrDatabasePermissions },
  ];

  const nlpSubTabs = [
    { label: "Documentation", component: ReadMeTab },
    { label: "Named Entity Recognition", component: PrecomputeNER },
    { label: "Tokenization", component: TokenizeSolr },
    { label: "Word Embeddings", component: ComputeWordEmbeddings },
  ];

  // Navigation handlers
  const handleNavigateToSection = (section: number, subsection?: number) => {
    setMainTab(section);
    setSubTab(subsection || 0);
    setCurrentView('section');
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleMobileDrawerToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  // Modern Sidebar Component
  const ModernSidebar = ({ variant = 'permanent' }: { variant?: 'permanent' | 'temporary' }) => (
    <Box
      sx={{
        width: variant === 'permanent' ? (sidebarOpen ? { xs: 280, sm: 280, md: 300 } : { xs: 72, sm: 72, md: 80 }) : { xs: 280, sm: 300 },
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: variant === 'permanent' ? '1px solid' : 'none',
        borderColor: 'divider',
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        overflow: 'hidden',
        maxWidth: { xs: '85vw', sm: '400px' },
        minWidth: variant === 'permanent' ? (sidebarOpen ? { xs: 260, sm: 280 } : { xs: 60, sm: 72 }) : { xs: 260, sm: 280 },
      }}
    >
      {/* Sidebar Header */}
      <Box
        sx={{
          p: sidebarOpen ? { xs: 2, sm: 2.5, md: 3 } : { xs: 1, sm: 1.25, md: 1.5 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 1.5, md: 2 },
          minHeight: { xs: 60, sm: 70, md: 80 },
          flexShrink: 0,
        }}
      >
        <AdminPanelSettings sx={{ 
          fontSize: sidebarOpen ? { xs: 28, sm: 32, md: 40 } : { xs: 24, sm: 28, md: 32 } 
        }} />
        {sidebarOpen && (
          <Box sx={{ overflow: 'hidden' }}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 700, 
                lineHeight: 1,
                fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
              }}
            >
              Admin Panel
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                opacity: 0.8,
                fontSize: { xs: '0.6875rem', sm: '0.75rem' }
              }}
            >
              System Management
            </Typography>
          </Box>
        )}
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flex: 1, py: { xs: 1, sm: 1.5, md: 2 }, overflow: 'auto' }}>
        <List sx={{ px: { xs: 0.5, sm: 1 } }}>
          {mainTabs.map((tab, index) => (
            <Tooltip
              key={index}
              title={sidebarOpen ? '' : tab.label}
              placement="right"
              disableHoverListener={sidebarOpen}
            >
              <ListItem
                button
                onClick={() => handleNavigateToSection(index)}
                sx={{
                  mx: { xs: 0.5, sm: 1 },
                  mb: { xs: 0.25, sm: 0.5 },
                  borderRadius: { xs: 1.5, sm: 2 },
                  bgcolor: mainTab === index ? `${tab.color}.light` : 'transparent',
                  color: mainTab === index ? `${tab.color}.contrastText` : 'text.primary',
                  '&:hover': {
                    bgcolor: mainTab === index ? `${tab.color}.main` : `${tab.color}.light`,
                    color: 'white',
                  },
                  transition: 'all 0.2s ease-in-out',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  px: sidebarOpen ? { xs: 1.5, sm: 2 } : { xs: 0.5, sm: 1 },
                  py: { xs: 1, sm: 1.25 },
                  minHeight: { xs: 40, sm: 44, md: 48 },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: 'inherit',
                    minWidth: sidebarOpen ? { xs: 32, sm: 36, md: 40 } : 'auto',
                    justifyContent: 'center',
                    '& .MuiSvgIcon-root': {
                      fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem' }
                    }
                  }}
                >
                  {tab.icon}
                </ListItemIcon>
                {sidebarOpen && (
                  <ListItemText
                    primary={tab.label}
                    primaryTypographyProps={{ 
                      fontWeight: 500,
                      fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '1rem' },
                      noWrap: true
                    }}
                  />
                )}
              </ListItem>
            </Tooltip>
          ))}
        </List>
      </Box>

      {/* Sidebar Footer */}
      <Box sx={{ 
        p: sidebarOpen ? { xs: 1.5, sm: 2 } : { xs: 0.75, sm: 1 }, 
        borderTop: '1px solid', 
        borderColor: 'divider',
        flexShrink: 0
      }}>
        {sidebarOpen ? (
          <Stack spacing={{ xs: 0.75, sm: 1 }}>
            <Button
              variant="outlined"
              onClick={handleToggleSidebar}
              startIcon={<ViewModule />}
              size="small"
              fullWidth
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              Collapse
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/Admin/classic')}
              startIcon={<ViewList />}
              size="small"
              fullWidth
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              Classic View
            </Button>
          </Stack>
        ) : (
          <Stack spacing={{ xs: 0.5, sm: 1 }} alignItems="center">
            <Tooltip title="Expand Sidebar" placement="right">
              <IconButton 
                onClick={handleToggleSidebar} 
                size="small"
                sx={{ 
                  width: { xs: 32, sm: 36 }, 
                  height: { xs: 32, sm: 36 } 
                }}
              >
                <ViewModule sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Classic View" placement="right">
              <IconButton 
                onClick={() => navigate('/Admin/classic')} 
                size="small"
                sx={{ 
                  width: { xs: 32, sm: 36 }, 
                  height: { xs: 32, sm: 36 } 
                }}
              >
                <ViewList sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>
    </Box>
  );

  // Authentication checks
  if (!auth.session) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Paper sx={{ p: 6, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white" }}>
          <LinearProgress sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>Loading...</Typography>
          <Typography variant="body1">Checking authentication...</Typography>
        </Paper>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Paper sx={{ p: 6, background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", color: "white" }}>
          <Security sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>Access Denied</Typography>
          <Typography variant="body1">You need administrator privileges to access this panel.</Typography>
        </Paper>
      </Container>
    );
  }


  // Content rendering based on current view
  const renderContent = () => {
    if (currentView === 'dashboard') {
      return <AdminDashboardCards onNavigate={handleNavigateToSection} />;
    }

    // Section view with enhanced mobile layout
    const sectionContent = (() => {
      switch (mainTab) {
        case 0:
          return (
            <SectionCard
              title="System Dashboard"
              description="Real-time system monitoring and analytics"
              icon={<DashboardIcon />}
              color="primary"
            >
              <Suspense fallback={<LinearProgress />}>
                <Dashboard />
              </Suspense>
            </SectionCard>
          );

        case 1:
          return (
            <SectionCard
              title="User Management"
              description="Manage users, roles, and permissions"
              icon={<People />}
              color="secondary"
            >
              <Tabs
                value={subTab}
                onChange={(_, newValue) => setSubTab(newValue)}
                variant={isMobile ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                sx={{ mb: 3 }}
              >
                {userSubTabs.map((tab, index) => (
                  <Tab key={index} label={tab.label} />
                ))}
              </Tabs>
              <Suspense fallback={<LinearProgress />}>
                {React.createElement(userSubTabs[subTab].component)}
              </Suspense>
            </SectionCard>
          );

        case 2:
          return (
            <SectionCard
              title="Data Management"
              description="Configure databases and data access"
              icon={<Storage />}
              color="success"
            >
              <Tabs
                value={subTab}
                onChange={(_, newValue) => setSubTab(newValue)}
                variant={isMobile ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                sx={{ mb: 3 }}
              >
                {dataSubTabs.map((tab, index) => (
                  <Tab key={index} label={tab.label} />
                ))}
              </Tabs>
              <Suspense fallback={<LinearProgress />}>
                {React.createElement(dataSubTabs[subTab].component)}
              </Suspense>
            </SectionCard>
          );

        case 3:
          return (
            <SectionCard
              title="System Configuration"
              description="Application settings and global configuration"
              icon={<Security />}
              color="error"
            >
              <Suspense fallback={<LinearProgress />}>
                <SystemConfiguration />
              </Suspense>
            </SectionCard>
          );

        case 4:
          return (
            <SectionCard
              title="NLP Tools"
              description="Natural language processing and text analysis"
              icon={<Psychology />}
              color="warning"
            >
              <Tabs
                value={subTab}
                onChange={(_, newValue) => setSubTab(newValue)}
                variant={isMobile ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                sx={{ mb: 3 }}
              >
                {nlpSubTabs.map((tab, index) => (
                  <Tab key={index} label={tab.label} />
                ))}
              </Tabs>
              <Suspense fallback={<LinearProgress />}>
                {React.createElement(nlpSubTabs[subTab].component)}
              </Suspense>
            </SectionCard>
          );

        case 5:
          return (
            <SectionCard
              title="API Documentation"
              description="Interactive API documentation and testing"
              icon={<MenuBook />}
              color="info"
            >
              <ApiDocumentation />
            </SectionCard>
          );

        default:
          return null;
      }
    })();

    return (
      <Box>
        {/* Mobile Header */}
        {isMobile && (
          <AppBar
            position="sticky"
            sx={{
              bgcolor: 'background.paper',
              color: 'text.primary',
              boxShadow: 1,
              mb: 2,
            }}
          >
            <Toolbar>
              <IconButton
                edge="start"
                onClick={handleBackToDashboard}
                sx={{ mr: 2 }}
              >
                <ArrowBack />
              </IconButton>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                {mainTabs[mainTab]?.label}
              </Typography>
            </Toolbar>
          </AppBar>
        )}

        {/* Desktop Back Button */}
        {!isMobile && (
          <Box sx={{ mb: 3 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={handleBackToDashboard}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
          </Box>
        )}

        {sectionContent}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <ModernSidebar variant="permanent" />
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileDrawerOpen}
          onClose={handleMobileDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: { xs: '85vw', sm: 320 },
              maxWidth: '400px',
              bgcolor: 'background.paper',
            },
          }}
        >
          <ModernSidebar variant="temporary" />
        </Drawer>
      )}

      {/* Mobile Menu Button */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="menu"
          onClick={handleMobileDrawerToggle}
          size="medium"
          sx={{
            position: 'fixed',
            top: { xs: 16, sm: 20 },
            left: { xs: 16, sm: 20 },
            zIndex: theme.zIndex.speedDial + 1,
            width: { xs: 48, sm: 56 },
            height: { xs: 48, sm: 56 },
            transition: theme.transitions.create(['transform', 'box-shadow'], {
              duration: theme.transitions.duration.short,
            }),
            '&:hover': {
              transform: 'scale(1.05)',
              boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
            },
            '&:active': {
              transform: 'scale(0.95)',
            },
          }}
        >
          {mobileDrawerOpen ? <CloseIcon /> : <MenuIcon />}
        </Fab>
      )}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          minHeight: '100vh',
          width: isMobile ? '100vw' : `calc(100vw - ${sidebarOpen ? '300px' : '80px'})`,
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          pt: isMobile ? 8 : 0, // Space for mobile menu button
          overflow: 'auto',
        }}
      >
        {/* Content Header for sections */}
        {currentView === 'section' && !isMobile && (
          <Box
            sx={{
              p: 3,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={handleBackToDashboard} size="small">
                  <ArrowBack />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {mainTabs[mainTab]?.label}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                onClick={handleToggleSidebar}
                startIcon={sidebarOpen ? <ViewModule /> : <ViewList />}
                size="small"
              >
                {sidebarOpen ? 'Collapse' : 'Expand'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Content */}
        <Container
          maxWidth={false}
          sx={{
            py: { xs: 1.5, sm: 2, md: 3 },
            px: { xs: 1, sm: 2, md: 3 },
            maxWidth: '100%',
            height: '100%',
          }}
        >
          <Fade in={true} timeout={500}>
            <Box sx={{ height: '100%' }}>
              {renderContent()}
            </Box>
          </Fade>
        </Container>
      </Box>
    </Box>
  );
};

export default AdminPanelEnhanced;