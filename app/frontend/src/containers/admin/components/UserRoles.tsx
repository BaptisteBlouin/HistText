import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Card,
  CardContent,
  Chip,
  Stack,
  Alert,
  useTheme,
  useMediaQuery,
  Fade,
  CircularProgress,
  InputAdornment,
  Avatar,
  Tooltip,
  IconButton,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControlLabel,
  Switch,
  Badge as MuiBadge,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams, GridRowSelectionModel } from "@mui/x-data-grid";
import {
  Add,
  Delete,
  Search,
  Security,
  Person,
  Badge,
  Refresh,
  GetApp,
  DeleteSweep,
  SelectAll,
  Autorenew,
  CloudUpload,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

/**
 * User-role assignment record.
 */
interface UserRole {
  user_id: number;
  role: string;
  created_at: string;
}

/**
 * User profile for role assignment.
 */
interface User {
  id: number;
  email: string;
  firstname?: string;
  lastname?: string;
}

/**
 * Banner notification state.
 */
interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

/**
 * Axios instance with Authorization from useAuth.
 */
const useAuthAxios = () => {
  const { accessToken } = useAuth();
  return useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers = new AxiosHeaders({
          ...config.headers,
          Authorization: `Bearer ${accessToken}`,
        });
      }
      return config;
    }, Promise.reject);
    return instance;
  }, [accessToken]);
};

/**
 * Role management interface for users. Assign and remove user roles.
 */
const UserRoles: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<UserRole | null>(null);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchUserRoles();
    fetchUsers();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchUserRoles();
      }, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  const filteredUserRoles = useMemo(() => 
    userRoles.filter((ur) => {
      const user = users.find((u) => u.id === ur.user_id);
      const searchTerm = search.toLowerCase();
      return (
        user?.email.toLowerCase().includes(searchTerm) ||
        user?.firstname?.toLowerCase().includes(searchTerm) ||
        user?.lastname?.toLowerCase().includes(searchTerm) ||
        ur.role.toLowerCase().includes(searchTerm)
      );
    }), [userRoles, users, search]
  );

  // Highlight search terms
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0 2px' }}>{part}</mark> : part
    );
  };

  /**
   * Format user full name or fallback to email.
   */
  const getUserDisplayName = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return `User ${userId}`;
    const fullName = `${user.firstname || ""} ${user.lastname || ""}`.trim();
    return fullName || user.email;
  };

  /**
   * Initials for user avatar display.
   */
  const getUserInitials = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return "?";
    if (user.firstname && user.lastname) {
      return `${user.firstname.charAt(0)}${user.lastname.charAt(0)}`;
    }
    return user.email.charAt(0).toUpperCase();
  };

  // Handle CSV file import for user roles
  const handleImportCSV = async () => {
    if (!importFile) {
      showNotification("Please select a file to import", "warning");
      return;
    }

    setImporting(true);
    
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        showNotification("CSV file must contain header and at least one data row", "error");
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const expectedHeaders = ['user_id', 'role'];
      
      // Validate headers
      const missingHeaders = expectedHeaders.filter(h => !headers.some(header => header.toLowerCase().includes(h)));
      if (missingHeaders.length > 0) {
        showNotification(`Missing required columns: ${missingHeaders.join(', ')}. Expected: user_id, role`, "error");
        return;
      }

      // Parse CSV data
      const userRoleData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= 2) {
          userRoleData.push({
            user_id: parseInt(values[headers.findIndex(h => h.toLowerCase().includes('user_id'))]),
            role: values[headers.findIndex(h => h.toLowerCase().includes('role'))],
          });
        }
      }

      if (userRoleData.length === 0) {
        showNotification("No valid user role data found in CSV", "error");
        return;
      }

      // Import user roles
      let successCount = 0;
      const errors: string[] = [];
      
      for (const ur of userRoleData) {
        try {
          await authAxios.post('/api/user_roles', ur);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to import user role ${ur.user_id}-${ur.role}:`, err);
          
          let specificError = 'Unknown error';
          
          if (err.response?.data) {
            const responseData = err.response.data;
            
            if (responseData.error && responseData.error.message) {
              specificError = responseData.error.message;
            } else if (responseData.message) {
              specificError = responseData.message;
            } else if (responseData.error && typeof responseData.error === 'object') {
              if (responseData.error.code) {
                specificError = responseData.error.code.replace(/_/g, ' ');
              } else {
                specificError = 'Validation error';
              }
            } else if (typeof responseData === 'string') {
              specificError = responseData;
            } else {
              specificError = 'Invalid request format';
            }
          } else if (err.message) {
            specificError = err.message;
          }
          
          errors.push(`User ${ur.user_id} → ${ur.role}: ${specificError}`);
        }
      }

      // Show detailed results with longer duration for errors
      if (successCount > 0 && errors.length === 0) {
        showNotification(`Successfully imported all ${successCount} user role assignments`, "success");
        fetchUserRoles();
      } else if (successCount > 0 && errors.length > 0) {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Imported ${successCount} user roles successfully. ${errors.length} failed: ${errorSummary}`, "warning", 10000);
        fetchUserRoles();
      } else {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Import failed for all user roles: ${errorSummary}`, "error", 15000);
      }
      
      setOpenImportDialog(false);
      setImportFile(null);
    } catch (err: any) {
      console.error('Import failed:', err);
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Unknown error occurred';
      showNotification(`Import failed: ${errorMsg}`, "error", 10000);
    } finally {
      setImporting(false);
    }
  };

  // Export to CSV functionality
  const handleExportCSV = useCallback(() => {
    const csvHeaders = ['User ID', 'User Name', 'Email', 'Role', 'Assigned Date'];
    const csvData = filteredUserRoles.map(ur => {
      const user = users.find(u => u.id === ur.user_id);
      return [
        ur.user_id,
        getUserDisplayName(ur.user_id),
        user?.email || '',
        ur.role,
        new Date(ur.created_at).toISOString()
      ];
    });
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `user_roles_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    showNotification(`Exported ${filteredUserRoles.length} user role assignments to CSV`, 'success');
  }, [filteredUserRoles, users]);

  // Bulk delete functionality
  const handleBulkDelete = useCallback(() => {
    if (selectedRows.length === 0) {
      showNotification('No role assignments selected for deletion', 'warning');
      return;
    }
    
    const selectedRoles = filteredUserRoles.filter(ur => 
      selectedRows.includes(`${ur.user_id}-${ur.role}`)
    );
    setRoleToDelete(selectedRoles[0]); // Use first selected for display
    setOpenDeleteDialog(true);
  }, [selectedRows, filteredUserRoles]);

  // Bulk delete confirmation handler
  const handleBulkDeleteConfirm = async () => {
    if (selectedRows.length === 0) return;
    
    const selectedRoles = filteredUserRoles.filter(ur => 
      selectedRows.includes(`${ur.user_id}-${ur.role}`)
    );
    
    try {
      const deletions = selectedRoles.map(ur => 
        authAxios.delete(`/api/user_roles/${ur.user_id}/${encodeURIComponent(ur.role)}`)
      );
      
      await Promise.all(deletions);
      setSelectedRows([]);
      setOpenDeleteDialog(false);
      setRoleToDelete(null);
      fetchUserRoles();
      
      showNotification(`Successfully removed ${selectedRoles.length} role assignment(s)`, 'success');
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error occurred';
      showNotification(`Failed to remove some role assignments: ${errorMessage}`, 'error');
      fetchUserRoles(); // Refresh to sync with server
    }
  };

  // Bulk operations
  const handleSelectAll = () => {
    const allIds = filteredUserRoles.map(ur => `${ur.user_id}-${ur.role}`);
    setSelectedRows(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedRows([]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'r':
            event.preventDefault();
            fetchUserRoles();
            break;
          case 'n':
            event.preventDefault();
            setOpenAddDialog(true);
            break;
          case 'a':
            if (event.shiftKey) {
              event.preventDefault();
              const allIds = filteredUserRoles.map(ur => `${ur.user_id}-${ur.role}`);
              setSelectedRows(allIds);
            }
            break;
          case 'e':
            if (selectedRows.length > 0) {
              event.preventDefault();
              handleExportCSV();
            }
            break;
          case 'Delete':
          case 'Backspace':
            if (selectedRows.length > 0) {
              event.preventDefault();
              handleBulkDelete();
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedRows, filteredUserRoles, handleExportCSV, handleBulkDelete]);

  /**
   * Display feedback notification to the user.
   */
  const showNotification = (
    message: string,
    severity: NotificationState["severity"] = "info",
  ) => {
    setNotification({ open: true, message, severity });
    setTimeout(
      () => setNotification((prev) => ({ ...prev, open: false })),
      5000,
    );
  };

  /**
   * Load all user-role assignments and available roles.
   */
  const fetchUserRoles = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/user_roles");
      setUserRoles(data);
      const uniqueRoles = Array.from(
        new Set((data as UserRole[]).map((ur) => ur.role)),
      ).filter((r): r is string => typeof r === "string");
      setRoles(uniqueRoles);
      if (selectedRoles.length === 0 && uniqueRoles.length > 0) {
        setSelectedRoles([uniqueRoles[0]]);
      }
    } catch (err) {
      console.error("Fetch user roles failed:", err);
      showNotification("Failed to fetch user roles", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load all users.
   */
  const fetchUsers = async () => {
    try {
      const { data } = await authAxios.get("/api/users");
      setUsers(data);
      if (selectedUsers.length === 0 && data.length > 0) {
        setSelectedUsers([data[0].id]);
      }
    } catch (err) {
      console.error("Fetch users failed:", err);
      showNotification("Failed to fetch users", "error");
    }
  };

  /**
   * Check if a user-role combination already exists
   */
  const userRoleExists = (userId: number, role: string) => {
    return userRoles.some(ur => ur.user_id === userId && ur.role === role);
  };

  /**
   * Validate role assignment
   */
  const validateRoleAssignment = () => {
    const errors: string[] = [];
    
    if (selectedUsers.length === 0) {
      errors.push("Please select at least one user");
    }
    
    if (selectedRoles.length === 0) {
      errors.push("Please select at least one role");
    }
    
    // Check for existing assignments
    const existingAssignments = [];
    for (const userId of selectedUsers) {
      for (const role of selectedRoles) {
        if (userRoleExists(userId, role)) {
          const user = users.find(u => u.id === userId);
          const userName = user ? getUserDisplayName(userId) : `User ${userId}`;
          existingAssignments.push(`${userName} already has role "${role}"`);
        }
      }
    }
    
    if (existingAssignments.length > 0) {
      errors.push(...existingAssignments.slice(0, 3)); // Show max 3 conflicts
      if (existingAssignments.length > 3) {
        errors.push(`... and ${existingAssignments.length - 3} more conflicts`);
      }
    }
    
    return errors;
  };

  /**
   * Assign multiple roles to multiple users with enhanced validation.
   */
  const handleAdd = async () => {
    const validationErrors = validateRoleAssignment();
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    try {
      const assignments = [];
      const newAssignments = [];
      
      for (const userId of selectedUsers) {
        for (const role of selectedRoles) {
          if (!userRoleExists(userId, role)) {
            assignments.push(
              authAxios.post("/api/user_roles", { user_id: userId, role })
            );
            const user = users.find(u => u.id === userId);
            newAssignments.push(`${getUserDisplayName(userId)} → ${role}`);
          }
        }
      }
      
      if (assignments.length === 0) {
        showNotification("All selected role assignments already exist", "warning");
        return;
      }
      
      await Promise.all(assignments);
      setSelectedUsers([]);
      setSelectedRoles([]);
      fetchUserRoles();
      
      const successMessage = newAssignments.length === 1 ? 
        `Successfully assigned: ${newAssignments[0]}` :
        `Successfully assigned ${newAssignments.length} role assignments`;
      
      showNotification(successMessage, "success");
    } catch (err: any) {
      console.error("Add user roles failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 409 || errorMessage.includes("already exists")) {
        showNotification("Some role assignments already exist. Please refresh and try again.", "error");
      } else if (err.response?.status === 404) {
        showNotification("User or role not found. Please refresh and try again.", "error");
      } else if (err.response?.status === 403) {
        showNotification("You don't have permission to assign roles", "error");
      } else {
        showNotification(`Failed to assign roles: ${errorMessage}`, "error");
      }
      fetchUserRoles(); // Refresh data
    }
  };

  /**
   * Remove a role from a user with enhanced error handling.
   */
  const handleDelete = async (userId: number, role: string) => {
    const userName = getUserDisplayName(userId);
    
    try {
      await authAxios.delete(
        `/api/user_roles/${userId}/${encodeURIComponent(role)}`,
      );
      fetchUserRoles();
      showNotification(`Successfully removed role "${role}" from ${userName}`, "success");
    } catch (err: any) {
      console.error("Delete user role failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 404) {
        showNotification("Role assignment not found. It may have already been removed.", "error");
        fetchUserRoles(); // Refresh to sync with server
      } else if (err.response?.status === 403) {
        showNotification("You don't have permission to remove this role", "error");
      } else if (err.response?.status === 409 || errorMessage.includes("constraint")) {
        showNotification("Cannot remove role: it may be required for this user", "error");
      } else {
        showNotification(`Failed to remove role: ${errorMessage}`, "error");
      }
    }
  };

  /**
   * Deterministically color roles for visual variety.
   */
  const getRoleColor = (role: string) => {
    const colors = [
      "primary",
      "secondary",
      "success",
      "warning",
      "error",
      "info",
    ];
    const index = role.length % colors.length;
    return colors[index] as any;
  };

  const columns: GridColDef[] = [
    {
      field: "avatar",
      headerName: "",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Avatar sx={{ bgcolor: `${getRoleColor(params.row.role)}.main` }}>
          {getUserInitials(params.row.user_id)}
        </Avatar>
      ),
    },
    {
      field: "user_id",
      headerName: "User ID",
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: "user_name",
      headerName: "User",
      width: 250,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Person fontSize="small" color="action" />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {highlightText(getUserDisplayName(params.row.user_id), search)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {highlightText(users.find((u) => u.id === params.row.user_id)?.email || "", search)}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: "role",
      headerName: "Role",
      width: 200,
      renderCell: (params) => (
        <Chip
          icon={<Badge />}
          label={highlightText(params.value, search)}
          color={getRoleColor(params.value)}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      ),
    },
    {
      field: "created_at",
      headerName: "Assigned Date",
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title="Remove Role">
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(params.row.user_id, params.row.role)}
          >
            <Delete />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Fade in={true} timeout={600}>
      <Box>
        {notification.open && (
          <Alert
            severity={notification.severity}
            sx={{ mb: 3 }}
            onClose={() =>
              setNotification((prev) => ({ ...prev, open: false }))
            }
          >
            {notification.message}
          </Alert>
        )}

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 4,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Security color="primary" />
              User Roles
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Assign and manage user roles and permissions
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Auto-refresh (30s)">
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Autorenew fontSize="small" />
                    Auto
                  </Box>
                }
              />
            </Tooltip>
            <Tooltip title="Refresh Data (Ctrl+R)">
              <IconButton onClick={fetchUserRoles} color="primary">
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenAddDialog(true)}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Assign Roles (Ctrl+N)
            </Button>
          </Stack>
        </Box>


        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="Search by user name, email, or role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                  {selectedRows.length > 0 && (
                    <>
                      <MuiBadge badgeContent={selectedRows.length} color="primary">
                        <Tooltip title="Export Selected to CSV (Ctrl+E)">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<GetApp />}
                            onClick={handleExportCSV}
                          >
                            Export
                          </Button>
                        </Tooltip>
                      </MuiBadge>
                      <Tooltip title="Remove Selected Roles (Delete/Backspace)">
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteSweep />}
                          onClick={handleBulkDelete}
                        >
                          Remove ({selectedRows.length})
                        </Button>
                      </Tooltip>
                      <Tooltip title="Deselect All">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleDeselectAll}
                        >
                          Clear
                        </Button>
                      </Tooltip>
                    </>
                  )}
                  {selectedRows.length === 0 && (
                    <>
                      <Tooltip title="Import from CSV">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<CloudUpload />}
                          onClick={() => setOpenImportDialog(true)}
                        >
                          Import
                        </Button>
                      </Tooltip>
                      <Tooltip title="Export All to CSV">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<GetApp />}
                          onClick={handleExportCSV}
                          disabled={filteredUserRoles.length === 0}
                        >
                          Export All
                        </Button>
                      </Tooltip>
                      <Tooltip title="Select All (Ctrl+Shift+A)">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<SelectAll />}
                          onClick={handleSelectAll}
                          disabled={filteredUserRoles.length === 0}
                        >
                          Select All
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </Stack>
              </Grid>
            </Grid>
            {selectedRows.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Divider />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {selectedRows.length} role assignment(s) selected | Keyboard shortcuts: Ctrl+E (export), Delete (bulk remove), Ctrl+R (refresh)
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Paper sx={{ height: 600, borderRadius: 3, overflow: "hidden" }}>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={filteredUserRoles}
              columns={columns}
              initialState={{
                pagination: {
                  paginationModel: { page: 0, pageSize: 10 },
                },
              }}
              paginationModel={{
                page: Math.floor((selectedRows.length > 0 ? 0 : 0)),
                pageSize: 10
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              getRowId={(row) => `${row.user_id}-${row.role}`}
              checkboxSelection
              rowSelectionModel={selectedRows}
              onRowSelectionModelChange={(newSelection) => {
                setSelectedRows(newSelection);
              }}
              disableRowSelectionOnClick={false}
              sx={{
                border: "none",
                "& .MuiDataGrid-cell": {
                  outline: "none",
                  borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                },
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "rgba(0, 200, 83, 0.08)",
                  borderBottom: "2px solid rgba(0, 200, 83, 0.2)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                },
                "& .MuiDataGrid-row": {
                  transition: "background-color 0.2s ease, transform 0.1s ease",
                  "&:hover": {
                    backgroundColor: "rgba(0, 200, 83, 0.08)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(0, 200, 83, 0.15)",
                  },
                },
                "& .MuiDataGrid-footerContainer": {
                  borderTop: "2px solid rgba(224, 224, 224, 0.3)",
                  backgroundColor: "rgba(248, 249, 250, 0.8)",
                },
                "& .MuiDataGrid-selectedRowCount": {
                  visibility: "hidden",
                },
              }}
            />
          )}
        </Paper>

        {/* Assign Roles Dialog */}
        <Dialog
          open={openAddDialog}
          onClose={() => setOpenAddDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
            }}
          >
            <Add />
            Assign Roles to Users
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={(user) => 
                    `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.email
                  }
                  value={users.filter(user => selectedUsers.includes(user.id))}
                  onChange={(_, newValue) => {
                    setSelectedUsers(newValue.map(user => user.id));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Users"
                      placeholder="Choose users..."
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((user, index) => (
                      <Chip
                        variant="outlined"
                        label={`${user.firstname || ""} ${user.lastname || ""}`.trim() || user.email}
                        size="small"
                        avatar={
                          <Avatar sx={{ width: 20, height: 20, fontSize: "0.7rem" }}>
                            {user.firstname?.charAt(0) || user.email.charAt(0)}
                          </Avatar>
                        }
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  renderOption={(props, user) => (
                    <Box component="li" {...props}>
                      <Avatar
                        sx={{ width: 24, height: 24, fontSize: "0.75rem", mr: 1 }}
                      >
                        {user.firstname?.charAt(0) || user.email.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">
                          {`${user.firstname || ""} ${user.lastname || ""}`.trim() || user.email}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email} (ID: {user.id})
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={roles}
                  value={selectedRoles}
                  onChange={(_, newValue) => {
                    setSelectedRoles(newValue.filter(v => typeof v === 'string'));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Roles"
                      placeholder="Choose or type roles..."
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((role, index) => (
                      <Chip
                        variant="outlined"
                        label={role}
                        size="small"
                        color={getRoleColor(role)}
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenAddDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                handleAdd();
                setOpenAddDialog(false);
              }}
              disabled={selectedUsers.length === 0 || selectedRoles.length === 0}
              startIcon={<Add />}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Assign {selectedRoles.length} Role{selectedRoles.length !== 1 ? 's' : ''} to {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog
          open={openDeleteDialog}
          onClose={() => setOpenDeleteDialog(false)}
        >
          <DialogTitle
            sx={{
              color: "error.main",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Delete />
            Confirm Role Removal
          </DialogTitle>
          <DialogContent>
            {selectedRows.length > 1 ? (
              <Typography>
                Are you sure you want to remove {selectedRows.length} selected role assignments? This action cannot be undone.
              </Typography>
            ) : (
              <Typography>
                Are you sure you want to remove the role "{roleToDelete?.role}" from {roleToDelete ? getUserDisplayName(roleToDelete.user_id) : 'this user'}? This action cannot be undone.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                if (selectedRows.length > 1) {
                  handleBulkDeleteConfirm();
                } else if (roleToDelete) {
                  handleDelete(roleToDelete.user_id, roleToDelete.role);
                }
                setOpenDeleteDialog(false);
              }}
            >
              Remove {selectedRows.length > 1 ? `${selectedRows.length} Assignments` : 'Role'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Import CSV Dialog */}
        <Dialog
          open={openImportDialog}
          onClose={() => setOpenImportDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
            }}
          >
            <CloudUpload />
            Import User Roles from CSV
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" paragraph>
              Upload a CSV file with columns: <strong>user_id, role</strong>
            </Typography>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              style={{ marginBottom: '16px' }}
            />
            {importFile && (
              <Typography variant="body2" color="success.main">
                Selected: {importFile.name}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenImportDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleImportCSV}
              disabled={!importFile || importing}
              startIcon={importing ? <CircularProgress size={20} /> : <CloudUpload />}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default UserRoles;
