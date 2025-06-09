import React, { useState, Suspense, useEffect } from "react";
import { useAuth, useAuthCheck } from "../../hooks/useAuth";
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  Switch,
  FormControlLabel,
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
  DarkMode,
  LightMode,
} from "@mui/icons-material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BreadcrumbNavigation } from "../../components/ui";
import StatusMonitor from "../../components/ui/StatusMonitor";
// import { useThemeMode } from "../../contexts/ThemeContext";

const Users = React.lazy(() => import("./components/Users"));
const RolePermissions = React.lazy(
  () => import("./components/RolePermissions"),
);
const UserRoles = React.lazy(() => import("./components/UserRoles"));
const SolrDatabase = React.lazy(() => import("./components/SolrDatabase"));
const SolrDatabasePermissions = React.lazy(
  () => import("./components/SolrDatabasePermissions"),
);
const SolrDatabaseInfo = React.lazy(
  () => import("./components/SolrDatabaseInfo"),
);
const Dashboard = React.lazy(() => import("./components/dashboard"));
const PrecomputeNER = React.lazy(() => import("./components/PrecomputedNER"));
const TokenizeSolr = React.lazy(() => import("./components/TokenizeSolr"));
const ComputeWordEmbeddings = React.lazy(
  () => import("./components/ComputeWordEmbeddings"),
);

/**
 * Component displaying the Markdown-based system documentation.
 */
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
      <Box
        sx={{
          p: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
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
    <Box
      sx={{
        p: { xs: 2, sm: 3, md: 4 },
        ml: 0,
        fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: "16px",
        lineHeight: 1.6,
        color: "rgba(0, 0, 0, 0.87)",
        maxWidth: "100%",
        overflow: "auto",
        "& h1": {
          fontSize: "2rem",
          mt: 4,
          mb: 2,
          pb: 1,
          borderBottom: "1px solid #eaecef",
          fontWeight: 600,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
        },
        "& h2": {
          fontSize: "1.5rem",
          mt: 3,
          mb: 2,
          pb: 0.5,
          borderBottom: "1px solid #eaecef",
          fontWeight: 600,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
        },
        "& h3": {
          fontSize: "1.25rem",
          mt: 3,
          mb: 1.5,
          fontWeight: 600,
          lineHeight: 1.25,
        },
        "& a": {
          color: "#0366d6",
          textDecoration: "none",
          "&:hover": {
            textDecoration: "underline",
          },
        },
        "& p": {
          mt: 0,
          mb: 1.5,
          lineHeight: 1.6,
        },
        "& ul, & ol": {
          mt: 0,
          mb: 2,
          paddingLeft: "2em",
          "& li": {
            mb: 0.5,
          },
        },
        "& table": {
          width: "100%",
          borderCollapse: "collapse",
          my: 2,
          display: "block",
          overflow: "auto",
        },
        "& th, & td": {
          border: "1px solid #dfe2e5",
          p: 1.5,
        },
        "& th": {
          backgroundColor: "#f6f8fa",
          fontWeight: 600,
        },
        "& pre": {
          backgroundColor: "#f6f8fa",
          borderRadius: 3,
          fontSize: "0.85rem",
          lineHeight: 1.45,
          overflow: "auto",
          p: 1.5,
          mb: 2,
          fontFamily:
            'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
        },
        "& :not(pre) > code": {
          fontFamily:
            'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
          backgroundColor: "rgba(27, 31, 35, 0.05)",
          padding: "0.2em 0.4em",
          borderRadius: 3,
          fontSize: "85%",
        },
        "& blockquote": {
          paddingLeft: 2,
          marginLeft: 0,
          marginRight: 0,
          borderLeft: "0.25em solid #dfe2e5",
          color: "#6a737d",
        },
        "& hr": {
          height: "0.25em",
          padding: 0,
          margin: "24px 0",
          backgroundColor: "#e1e4e8",
          border: 0,
        },
        "& img": {
          maxWidth: "100%",
          boxSizing: "content-box",
          backgroundColor: "#fff",
        },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
};

/**
 * Component for linking to Swagger/OpenAPI API documentation.
 */
const ApiDocumentation: React.FC = () => {
  /**
   * Opens Swagger UI in a new tab.
   */
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
        <Typography
          variant="body1"
          color="text.secondary"
          paragraph
          sx={{ mb: 4 }}
        >
          Access the complete API documentation with interactive endpoints using
          Swagger UI. This documentation covers all available endpoints
          organized into three main sections:
        </Typography>

        <Stack spacing={2} sx={{ mb: 4, textAlign: "left" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <People color="primary" />
            <Typography variant="body1">
              User Management API - accounts, roles, and permissions
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Storage color="primary" />
            <Typography variant="body1">
              Solr Administration API - database configurations and permissions
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Psychology color="primary" />
            <Typography variant="body1">
              HistText Core API - document search, metadata, and text analysis
            </Typography>
          </Box>
        </Stack>

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

/**
 * Main admin panel component for the application.
 * Handles tab selection, sidebar layout, and content rendering.
 */
const AdminPanel: React.FC = () => {
  useAuthCheck();
  const auth = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isAdmin = auth.session?.hasRole("Admin");
  // const { darkMode, toggleDarkMode } = useThemeMode();

  // State for tab selections and mobile drawer.
  const [mainTab, setMainTab] = useState<number>(() => {
    const storedTab = localStorage.getItem("adminMainTab");
    return storedTab ? parseInt(storedTab, 10) : 0;
  });
  const [subTab, setSubTab] = useState<number>(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  /**
   * Handle selection of main navigation tab.
   */
  const handleMainTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setMainTab(newValue);
    localStorage.setItem("adminMainTab", newValue.toString());
    if (newValue !== 3) setSubTab(0);
    if (isMobile) setMobileDrawerOpen(false);
  };

  /**
   * Handle selection of subtabs within a section.
   */
  const handleSubTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setSubTab(newValue);
  };

  // Tab definitions for main navigation and subtabs.
  const mainTabs = [
    { label: "Dashboard", icon: <DashboardIcon />, color: "primary" },
    { label: "User Management", icon: <People />, color: "secondary" },
    { label: "Data Management", icon: <Storage />, color: "success" },
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

  // Authentication checks
  if (!auth.session) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Paper
          sx={{
            p: 6,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
          }}
        >
          <LinearProgress sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>
            Loading...
          </Typography>
          <Typography variant="body1">Checking authentication...</Typography>
        </Paper>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Paper
          sx={{
            p: 6,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            color: "white",
          }}
        >
          <Security sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            Access Denied
          </Typography>
          <Typography variant="body1">
            You need administrator privileges to access this panel.
          </Typography>
        </Paper>
      </Container>
    );
  }

  /**
   * Renders the main panel content depending on the current tab.
   */
  const renderContent = () => {
    switch (mainTab) {
      case 0:
        return (
          <Suspense fallback={<LinearProgress />}>
            <Dashboard />
          </Suspense>
        );

      case 1:
        return (
          <Box>
            <Tabs
              value={subTab}
              onChange={handleSubTabChange}
              variant={isMobile ? "scrollable" : "fullWidth"}
              scrollButtons="auto"
              sx={{
                mb: 3,
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontWeight: 600,
                },
              }}
            >
              {userSubTabs.map((tab, index) => (
                <Tab key={index} label={tab.label} />
              ))}
            </Tabs>
            <Suspense fallback={<LinearProgress />}>
              {React.createElement(userSubTabs[subTab].component)}
            </Suspense>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Tabs
              value={subTab}
              onChange={handleSubTabChange}
              variant={isMobile ? "scrollable" : "fullWidth"}
              scrollButtons="auto"
              sx={{
                mb: 3,
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontWeight: 600,
                },
              }}
            >
              {dataSubTabs.map((tab, index) => (
                <Tab key={index} label={tab.label} />
              ))}
            </Tabs>
            <Suspense fallback={<LinearProgress />}>
              {React.createElement(dataSubTabs[subTab].component)}
            </Suspense>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Tabs
              value={subTab}
              onChange={handleSubTabChange}
              variant={isMobile ? "scrollable" : "fullWidth"}
              scrollButtons="auto"
              sx={{
                mb: 3,
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontWeight: 600,
                },
              }}
            >
              {nlpSubTabs.map((tab, index) => (
                <Tab key={index} label={tab.label} />
              ))}
            </Tabs>
            <Suspense fallback={<LinearProgress />}>
              {React.createElement(nlpSubTabs[subTab].component)}
            </Suspense>
          </Box>
        );

      case 4:
        return <ApiDocumentation />;

      default:
        return null;
    }
  };

  // Sidebar (drawer or permanent) navigation content
  const sidebarContent = (
    <Box
      sx={{
        width: 280,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          p: 3,
          borderBottom: "1px solid",
          borderColor: "divider",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          textAlign: "center",
        }}
      >
        <AdminPanelSettings sx={{ fontSize: 48, mb: 1, opacity: 0.9 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          Admin Panel
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          System administration and configuration
        </Typography>
      </Box>

      <List sx={{ flex: 1, py: 2, px: 1 }}>
        {mainTabs.map((tab, index) => (
          <ListItem
            key={index}
            onClick={() =>
              handleMainTabChange({} as React.SyntheticEvent, index)
            }
            sx={{
              cursor: "pointer",
              borderRadius: 3,
              mx: 1,
              my: 0.5,
              p: 1.5,
              background:
                mainTab === index
                  ? `linear-gradient(135deg, ${theme.palette[tab.color as keyof typeof theme.palette].main} 0%, ${theme.palette[tab.color as keyof typeof theme.palette].dark} 100%)`
                  : "transparent",
              color: mainTab === index ? "white" : "inherit",
              boxShadow:
                mainTab === index ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
              "&:hover": {
                background:
                  mainTab === index
                    ? `linear-gradient(135deg, ${theme.palette[tab.color as keyof typeof theme.palette].dark} 0%, ${theme.palette[tab.color as keyof typeof theme.palette].main} 100%)`
                    : `linear-gradient(135deg, ${theme.palette[tab.color as keyof typeof theme.palette].light} 0%, ${theme.palette[tab.color as keyof typeof theme.palette].main} 100%)`,
                color: "white",
                transform: "translateY(-2px)",
                boxShadow: `0 8px 25px rgba(${theme.palette[tab.color as keyof typeof theme.palette].main.slice(4, -1)}, 0.3)`,
              },
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <ListItemIcon
              sx={{
                color: "inherit",
                minWidth: 48,
                "& .MuiSvgIcon-root": {
                  fontSize: "1.5rem",
                  filter:
                    mainTab === index
                      ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                      : "none",
                },
              }}
            >
              {tab.icon}
            </ListItemIcon>
            <ListItemText
              primary={tab.label}
              primaryTypographyProps={{
                fontWeight: mainTab === index ? 700 : 600,
                fontSize: "0.95rem",
              }}
            />
            {mainTab === index && (
              <Chip
                size="small"
                label="Active"
                sx={{
                  bgcolor: "rgba(255,255,255,0.25)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                }}
              />
            )}
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mx: 2 }} />

      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 500 }}
        >
          HistText Admin v2.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      {isMobile ? (
        <>
          <IconButton
            onClick={() => setMobileDrawerOpen(true)}
            sx={{
              position: "fixed",
              top: 16,
              left: 16,
              zIndex: theme.zIndex.speedDial,
              bgcolor: "primary.main",
              color: "white",
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            <MenuIcon />
          </IconButton>

          <Drawer
            anchor="left"
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": {
                background: "linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)",
              },
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
              <IconButton onClick={() => setMobileDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
            {sidebarContent}
          </Drawer>
        </>
      ) : (
        <Paper
          elevation={1}
          sx={{
            background: "linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)",
            borderRadius: 0,
            borderRight: "1px solid",
            borderColor: "divider",
          }}
        >
          {sidebarContent}
        </Paper>
      )}

      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: "auto",
          pt: isMobile ? 8 : 0,
          background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
          minHeight: "100vh",
        }}
      >
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Fade in={true} timeout={500}>
            <Paper
              elevation={0}
              sx={{
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                borderRadius: 4,
                p: 3,
                minHeight: "calc(100vh - 8rem)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
              }}
            >
              {renderContent()}
            </Paper>
          </Fade>
        </Container>
      </Box>
    </Box>
  );
};

export default AdminPanel;
