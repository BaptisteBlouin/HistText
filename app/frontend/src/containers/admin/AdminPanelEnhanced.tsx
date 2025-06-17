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
import BreadcrumbNavigation from "../../components/ui/BreadcrumbNavigation";
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
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

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

  // Mobile Bottom Navigation for admin sections
  const renderMobileBottomNav = () => {
    if (!isMobile || currentView === 'dashboard') return null;

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
        }}
        elevation={8}
      >
        <BottomNavigation
          value={mainTab}
          sx={{
            backgroundColor: 'transparent',
            height: 64,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              '&.Mui-selected': {
                color: theme.palette.primary.main,
              },
            },
          }}
        >
          {mainTabs.slice(0, 4).map((tab, index) => (
            <BottomNavigationAction
              key={index}
              label={tab.label.split(' ')[0]} // Shortened labels for mobile
              icon={tab.icon}
              onClick={() => handleNavigateToSection(index)}
              sx={{
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
            <BreadcrumbNavigation
              darkMode={darkMode}
              items={[
                { label: 'Home', path: '/', icon: <Home fontSize="small" /> },
                { label: 'Admin Panel', icon: <AdminPanelSettings fontSize="small" /> },
                { label: mainTabs[mainTab]?.label || 'Dashboard', current: true },
              ]}
            />
          </Box>
        )}

        {sectionContent}
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Layout Toggle FAB */}
      <Tooltip title="Switch to Classic Layout">
        <Fab
          size="small"
          onClick={() => navigate('/Admin/classic')}
          sx={{
            position: 'fixed',
            top: { xs: 20, sm: 24 },
            right: { xs: 20, sm: 24 },
            zIndex: 1000,
            bgcolor: 'secondary.main',
            color: 'white',
            '&:hover': { bgcolor: 'secondary.dark' },
          }}
        >
          <ViewList />
        </Fab>
      </Tooltip>

      <Container
        maxWidth="xl"
        sx={{
          py: { xs: 2, sm: 4 },
          px: { xs: 1, sm: 3 },
          pb: isMobile ? 10 : undefined, // Space for mobile bottom nav
        }}
      >
        <Fade in={true} timeout={500}>
          <Box>
            {renderContent()}
          </Box>
        </Fade>
      </Container>

      {renderMobileBottomNav()}
    </Box>
  );
};

export default AdminPanelEnhanced;