import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Divider,
  IconButton,
  useTheme,
  alpha,
} from "@mui/material";
import { useAuth } from "../../hooks/useAuth";
import {
  Keyboard,
  Close,
  Search,
  Add,
  Refresh,
  GetApp,
  Delete,
  ExitToApp,
  Home,
  Description,
  AdminPanelSettings,
  AccountCircle,
  History,
  ArrowBack,
  ArrowForward,
  Tab,
  ExpandLess,
  ExpandMore,
} from "@mui/icons-material";

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
  icon?: React.ReactNode;
  adminOnly?: boolean;
  requiresAuth?: boolean;
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation Shortcuts
  {
    keys: ["Ctrl", "H"],
    description: "Go to Home",
    category: "Navigation",
    icon: <Home fontSize="small" />,
  },
  {
    keys: ["Ctrl", "M"],
    description: "Go to HistText",
    category: "Navigation",
    icon: <Description fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "A"],
    description: "Go to Account",
    category: "Navigation",
    icon: <AccountCircle fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "Shift", "A"],
    description: "Go to Admin Panel",
    category: "Navigation",
    icon: <AdminPanelSettings fontSize="small" />,
    adminOnly: true,
  },
  {
    keys: ["Ctrl", "Shift", "H"],
    description: "Open Search History",
    category: "Navigation",
    icon: <History fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "B"],
    description: "Toggle Sidebar",
    category: "Navigation",
    icon: <ExpandLess fontSize="small" />,
  },
  {
    keys: ["Alt", "Left"],
    description: "Go Back",
    category: "Navigation",
    icon: <ArrowBack fontSize="small" />,
  },
  {
    keys: ["Alt", "Right"],
    description: "Go Forward",
    category: "Navigation",
    icon: <ArrowForward fontSize="small" />,
  },
  
  // Tab Navigation
  {
    keys: ["Ctrl", "1"],
    description: "Switch to Query tab",
    category: "Tabs",
    icon: <Search fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "2"],
    description: "Switch to Partial Results",
    category: "Tabs",
    icon: <Tab fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "3"],
    description: "Switch to All Results",
    category: "Tabs",
    icon: <Tab fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "4"],
    description: "Switch to Word Cloud",
    category: "Tabs",
    icon: <Tab fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "5"],
    description: "Switch to Statistics",
    category: "Tabs",
    icon: <Tab fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "6"],
    description: "Switch to NER",
    category: "Tabs",
    icon: <Tab fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "Left"],
    description: "Previous Tab",
    category: "Tabs",
    icon: <ArrowBack fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "Right"],
    description: "Next Tab",
    category: "Tabs",
    icon: <ArrowForward fontSize="small" />,
    requiresAuth: true,
  },

  // Search & Actions
  {
    keys: ["Ctrl", "K"],
    description: "Focus search field",
    category: "Search",
    icon: <Search fontSize="small" />,
  },
  {
    keys: ["Ctrl", "Enter"],
    description: "Execute search",
    category: "Search",
    icon: <Search fontSize="small" />,
  },
  {
    keys: ["Ctrl", "N"],
    description: "Add new item",
    category: "Actions",
    icon: <Add fontSize="small" />,
    adminOnly: true,
  },
  {
    keys: ["Ctrl", "R"],
    description: "Refresh data",
    category: "Actions",
    icon: <Refresh fontSize="small" />,
  },
  {
    keys: ["Ctrl", "E"],
    description: "Export selected",
    category: "Actions",
    icon: <GetApp fontSize="small" />,
    requiresAuth: true,
  },
  {
    keys: ["Ctrl", "Shift", "Del"],
    description: "Delete selected",
    category: "Actions",
    icon: <Delete fontSize="small" />,
    adminOnly: true,
  },
  {
    keys: ["Escape"],
    description: "Close dialogs/clear selection",
    category: "General",
    icon: <ExitToApp fontSize="small" />,
  },
  {
    keys: ["?"],
    description: "Show this help",
    category: "Help",
    icon: <Keyboard fontSize="small" />,
  },
];

const KeyChip: React.FC<{ keyName: string }> = ({ keyName }) => {
  const theme = useTheme();
  
  return (
    <Box
      component="kbd"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 24,
        height: 24,
        px: 1,
        fontSize: "0.75rem",
        fontFamily: "monospace",
        fontWeight: 600,
        color: theme.palette.text.primary,
        backgroundColor: alpha(theme.palette.primary.main, 0.1),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        borderRadius: 1,
        boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.1)}`,
      }}
    >
      {keyName}
    </Box>
  );
};

export const KeyboardShortcutsHelp: React.FC = () => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Only show if not in an input field
        const target = event.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          event.preventDefault();
          setOpen(true);
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Filter shortcuts based on user permissions
  const filteredShortcuts = shortcuts.filter(shortcut => {
    if (shortcut.adminOnly && (!user || !user.is_admin)) {
      return false;
    }
    if (shortcut.requiresAuth && !isAuthenticated) {
      return false;
    }
    return true;
  });

  const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <>
      {/* Help trigger button - floating */}
      <IconButton
        onClick={() => setOpen(true)}
        sx={{
          position: "fixed",
          bottom: 16,
          left: 16,
          zIndex: 1000,
          backgroundColor: "primary.main",
          color: "white",
          "&:hover": {
            backgroundColor: "primary.dark",
          },
          boxShadow: 3,
        }}
        size="small"
      >
        <Keyboard fontSize="small" />
      </IconButton>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            backgroundColor: "background.paper",
            backdropFilter: "blur(20px)",
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            background: theme.palette.mode === 'dark' 
              ? "linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(40, 40, 40, 0.95) 100%)"
              : "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)",
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Keyboard color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Keyboard Shortcuts
          </Typography>
          <IconButton
            onClick={() => setOpen(false)}
            size="small"
            sx={{ color: "text.secondary" }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Use these keyboard shortcuts to navigate and interact with the application more efficiently.
          </Typography>

          <Stack spacing={3}>
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <Box key={category}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 2,
                    color: "primary.main",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {category}
                </Typography>
                
                <Stack spacing={1.5}>
                  {categoryShortcuts.map((shortcut, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 1,
                        px: 2,
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.primary.main, 0.02),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                        transition: "all 0.2s ease",
                        "&:hover": {
                          backgroundColor: alpha(theme.palette.primary.main, 0.05),
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        {shortcut.icon && (
                          <Box sx={{ color: "primary.main" }}>
                            {shortcut.icon}
                          </Box>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {shortcut.description}
                        </Typography>
                      </Box>
                      
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <KeyChip keyName={key} />
                            {keyIndex < shortcut.keys.length - 1 && (
                              <Typography variant="body2" sx={{ mx: 0.5, color: "text.secondary" }}>
                                +
                              </Typography>
                            )}
                          </React.Fragment>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
                
                {category !== Object.keys(groupedShortcuts)[Object.keys(groupedShortcuts).length - 1] && (
                  <Divider sx={{ mt: 2 }} />
                )}
              </Box>
            ))}
          </Stack>

          <Box sx={{ mt: 3, p: 2, backgroundColor: alpha(theme.palette.info.main, 0.1), borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Tip:</strong> Press <KeyChip keyName="?" /> anytime to show this help, or click the keyboard icon in the bottom-left corner.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpen(false)} variant="contained" color="primary">
            Got it!
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default KeyboardShortcutsHelp;