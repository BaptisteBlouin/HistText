import React, { useState, Suspense, useEffect } from "react";
import { useAuth, useAuthCheck } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  Typography,
  LinearProgress,
  Alert,
  Drawer,
  Fab,
  Stack,
  alpha,
  useTheme,
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
  Home as HomeIcon,
  ArrowBack,
  ChevronLeft,
  Analytics as AnalyticsIcon,
} from "@mui/icons-material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useResponsive } from "../../lib/responsive-utils";
import AdminDashboardCards from "./components/AdminDashboardCards";

// Lazy‐loaded section components
const Users = React.lazy(() => import("./components/Users"));
const UserRoles = React.lazy(() => import("./components/UserRoles"));
const RolePermissions = React.lazy(() => import("./components/RolePermissions"));
const SolrDatabase = React.lazy(() => import("./components/SolrDatabase"));
const SolrDatabaseInfo = React.lazy(() => import("./components/SolrDatabaseInfo"));
const SolrDatabasePermissions = React.lazy(() => import("./components/SolrDatabasePermissions"));
const Dashboard = React.lazy(() => import("./components/dashboard"));
const Analytics = React.lazy(() => import("./components/Analytics"));
const PrecomputeNER = React.lazy(() => import("./components/PrecomputedNER"));
const TokenizeSolr = React.lazy(() => import("./components/TokenizeSolr"));
const ComputeWordEmbeddings = React.lazy(() => import("./components/ComputeWordEmbeddings"));
const SystemConfiguration = React.lazy(() => import("./components/SystemConfiguration"));

// ReadMe tab component
const ReadMeTab: React.FC = () => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/docs/READMES.md")
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <LinearProgress />
        <Typography mt={2}>Loading documentation…</Typography>
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error">Error: {error}</Alert>;
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxHeight: "100%", overflow: "auto" }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
};

// API Documentation card
const ApiDocumentation: React.FC = () => (
  <Container maxWidth="md" sx={{ py: 4 }}>
    <Card sx={{ textAlign: "center", p: 4 }}>
      <MenuBook sx={{ fontSize: 80, color: "primary.main", mb: 3 }} />
      <Typography variant="h4" fontWeight={600} gutterBottom>
        API Documentation
      </Typography>
      <Typography color="text.secondary" paragraph>
        Interactive Swagger UI for all endpoints.
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={() => window.open("/swagger-ui/", "_blank")}
        sx={{
          background: "linear-gradient(135deg,#667eea,#764ba2)",
          "&:hover": { background: "linear-gradient(135deg,#5a6fd8,#6a4190)" },
        }}
      >
        Open API Docs
      </Button>
    </Card>
  </Container>
);

// SectionCard wrapper
interface SectionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
}
const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  icon,
  children,
  color = "primary",
}) => {
  const theme = useTheme();
  return (
    <Card sx={{ mb: 3, position: "relative", overflow: "hidden" }}>
      <CardContent sx={{ p: 0 }}>
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            background: `linear-gradient(135deg, ${alpha(
              theme.palette[color].light,
              0.1
            )}, ${alpha(theme.palette[color].main, 0.05)})`,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                p: 1.5,
                borderRadius: "12px",
                background: `linear-gradient(135deg, ${theme.palette[color].light}, ${theme.palette[color].main})`,
                color: "#fff",
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Box sx={{ p: { xs: 2, sm: 3 }, maxHeight: "70vh", overflow: "auto" }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
};

const AdminPanel: React.FC = () => {
  useAuthCheck();
  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const { isMobile } = useResponsive();
  const isAdmin = auth.session?.hasRole("Admin");

  const [view, setView] = useState<"dashboard" | "section">("dashboard");
  const [mainTab, setMainTab] = useState(0);
  const [subTab, setSubTab] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const mainTabs = [
    { label: "Dashboard", icon: <DashboardIcon />, color: "primary" as const },
    { label: "Analytics", icon: <AnalyticsIcon />, color: "info" as const },
    { label: "Users", icon: <People />, color: "secondary" as const },
    { label: "Data", icon: <Storage />, color: "success" as const },
    { label: "Config", icon: <Security />, color: "error" as const },
    { label: "NLP", icon: <Psychology />, color: "warning" as const },
    { label: "API", icon: <MenuBook />, color: "warning" as const },
  ];

  const userSubTabs = [
    { label: "Users", component: Users },
    { label: "Roles", component: UserRoles },
    { label: "Permissions", component: RolePermissions },
  ];
  const dataSubTabs = [
    { label: "Databases", component: SolrDatabase },
    { label: "Info", component: SolrDatabaseInfo },
    { label: "Permissions", component: SolrDatabasePermissions },
  ];
  const nlpSubTabs = [
    { label: "Docs", component: ReadMeTab },
    { label: "NER", component: PrecomputeNER },
    { label: "Tokenize", component: TokenizeSolr },
    { label: "Embeddings", component: ComputeWordEmbeddings },
  ];

  const goSection = (index: number) => {
    setMainTab(index);
    setSubTab(0);
    setView("section");
    if (isMobile) setDrawerOpen(false);
  };
  const backToDashboard = () => setView("dashboard");
  const toggleSidebar = () => setSidebarOpen(open => !open);
  const toggleDrawer = () => setDrawerOpen(open => !open);

  const ModernSidebar = ({
    variant = "permanent",
  }: {
    variant?: "permanent" | "temporary";
  }) => {
    const width = variant === "permanent"
      ? (sidebarOpen ? 280 : 72)
      : 280;

    return (
      <Box
        sx={{
          width,
          bgcolor: "background.paper",
          borderRight: variant === "permanent" ? "1px solid" : "none",
          borderColor: "divider",
          transition: theme.transitions.create("width", {
            duration: theme.transitions.duration.standard,
          }),
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarOpen ? "space-between" : "center",
            p: 2,
            background: "linear-gradient(135deg,#667eea,#764ba2)",
            color: "#fff",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={sidebarOpen ? 1 : 0}>
            <Tooltip title="Admin Home">
              <IconButton
                onClick={() => {
                  backToDashboard();
                  navigate("/admin");
                }}
                sx={{ color: "#fff" }}
              >
                <HomeIcon />
              </IconButton>
            </Tooltip>
            {sidebarOpen && (
              <Button
                variant="text"
                color="inherit"
                onClick={() => {
                  backToDashboard();
                  navigate("/admin");
                }}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Administration Panel
              </Button>
            )}
          </Stack>
          <Tooltip title={sidebarOpen ? "Collapse" : "Expand"}>
            <IconButton
              onClick={toggleSidebar}
              sx={{
                transform: sidebarOpen ? "rotate(0deg)" : "rotate(180deg)",
                transition: "transform .3s",
                color: "#fff",
              }}
            >
              <ChevronLeft />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1 }}>
          {mainTabs.map((tab, idx) => (
            <Tooltip
              key={idx}
              title={sidebarOpen ? "" : tab.label}
              placement="right"
              disableHoverListener={sidebarOpen}
            >
              <ListItem
                button
                onClick={() => goSection(idx)}
                sx={{
                  borderRadius: 2,
                  bgcolor: mainTab === idx ? `${tab.color}.main` : "transparent",
                  color: mainTab === idx ? `${tab.color}.contrastText` : "text.primary",
                  px: sidebarOpen ? 2 : 1,
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                }}
              >
                <ListItemIcon
                  sx={{
                    color: "inherit",
                    minWidth: sidebarOpen ? 40 : "auto",
                    justifyContent: "center",
                  }}
                >
                  {tab.icon}
                </ListItemIcon>
                {sidebarOpen && <ListItemText primary={tab.label} />}
              </ListItem>
            </Tooltip>
          ))}
        </Box>
      </Box>
    );
  };

  if (!auth.session)
    return (
      <Container sx={{ textAlign: "center", p: 4 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography>Checking authentication…</Typography>
      </Container>
    );
  if (!isAdmin)
    return (
      <Container sx={{ textAlign: "center", p: 4 }}>
        <Security sx={{ fontSize: 80, color: theme.palette.error.main }} />
        <Typography variant="h5">Access Denied</Typography>
      </Container>
    );

  const renderSection = () => {
    switch (mainTab) {
      case 0:
        return (
          <SectionCard
            title="System Dashboard"
            description="Live monitoring and analytics"
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
            title="Analytics Dashboard"
            description="Comprehensive insights & metrics"
            icon={<AnalyticsIcon />}
            color="info"
          >
            <Suspense fallback={<LinearProgress />}>
              <Analytics />
            </Suspense>
          </SectionCard>
        );
      case 2:
        return (
          <SectionCard
            title="User Management"
            description="Users, roles & permissions"
            icon={<People />}
            color="secondary"
          >
            <Tabs
              value={subTab}
              onChange={(_, v) => setSubTab(v)}
              variant={isMobile ? "scrollable" : "fullWidth"}
              sx={{ mb: 2 }}
            >
              {userSubTabs.map((t, i) => (
                <Tab key={i} label={t.label} />
              ))}
            </Tabs>
            <Suspense fallback={<LinearProgress />}>
              {React.createElement(userSubTabs[subTab].component)}
            </Suspense>
          </SectionCard>
        );
      case 3:
        return (
          <SectionCard
            title="Data Management"
            description="Databases & access"
            icon={<Storage />}
            color="success"
          >
            <Tabs
              value={subTab}
              onChange={(_, v) => setSubTab(v)}
              variant={isMobile ? "scrollable" : "fullWidth"}
              sx={{ mb: 2 }}
            >
              {dataSubTabs.map((t, i) => (
                <Tab key={i} label={t.label} />
              ))}
            </Tabs>
            <Suspense fallback={<LinearProgress />}>
              {React.createElement(dataSubTabs[subTab].component)}
            </Suspense>
          </SectionCard>
        );
      case 4:
        return (
          <SectionCard
            title="System Configuration"
            description="Global settings & options"
            icon={<Security />}
            color="error"
          >
            <Suspense fallback={<LinearProgress />}>
              <SystemConfiguration />
            </Suspense>
          </SectionCard>
        );
      case 5:
        return (
          <SectionCard
            title="NLP Tools"
            description="Text analysis utilities"
            icon={<Psychology />}
            color="warning"
          >
            <Tabs
              value={subTab}
              onChange={(_, v) => setSubTab(v)}
              variant={isMobile ? "scrollable" : "fullWidth"}  
              sx={{ mb: 2 }}
            >
              {nlpSubTabs.map((t, i) => (
                <Tab key={i} label={t.label} />
              ))}
            </Tabs>
            <Suspense fallback={<LinearProgress />}>
              {React.createElement(nlpSubTabs[subTab].component)}
            </Suspense>
          </SectionCard>
        );
      case 6:
        return (
          <SectionCard
            title="API Documentation"
            description="Interactive API explorer"
            icon={<MenuBook />}
            color="info"
          >
            <ApiDocumentation />
          </SectionCard>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: "flex", width: "100%", height: "100vh", bgcolor: "background.default" }}>
      {!isMobile && <ModernSidebar variant="permanent" />}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={toggleDrawer}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: 280 } }}
        >
          <ModernSidebar variant="temporary" />
        </Drawer>
      )}
      {isMobile && (
        <Fab
          onClick={toggleDrawer}
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
          {drawerOpen ? <CloseIcon /> : <MenuIcon />}
        </Fab>
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: isMobile
            ? "100%"
            : `calc(100% - ${sidebarOpen ? 280 : 72}px)`,
          transition: theme.transitions.create("width", {
            duration: theme.transitions.duration.standard,
          }),
          overflow: "auto",
          p: { xs: 1, sm: 2, md: 3 },
          height: '100vh'
        }}
      >
        {view === "section" && (
          <Box sx={{ mb: 2, display: "flex", alignItems: "center" }}>
            <Button startIcon={<ArrowBack />} onClick={backToDashboard}>
              Back to Home
            </Button>
          </Box>
        )}
        {view === "dashboard"
          ? <AdminDashboardCards onNavigate={goSection} />
          : renderSection()
        }
      </Box>
    </Box>
  );
};

export default AdminPanel;