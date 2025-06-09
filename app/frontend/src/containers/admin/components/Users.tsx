import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Paper,
  TextField,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  useTheme,
  useMediaQuery,
  Fade,
  CircularProgress,
  InputAdornment,
  Divider,
  Badge,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import {
  Add,
  Edit,
  Delete,
  PersonAdd,
  Search,
  Email,
  Badge as BadgeIcon,
  CheckCircle,
  Cancel,
  People,
  Refresh,
  GetApp,
  DeleteSweep,
  SelectAll,
  CloudUpload,
} from "@mui/icons-material";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

/**
 * Represents a user account in the system.
 */
interface User {
  id: number;
  email: string;
  hash_password: string;
  activated: boolean;
  firstname: string;
  lastname: string;
  created_at: string;
  updated_at: string;
}

/**
 * Notification banner state.
 */
interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

/**
 * Returns an Axios instance with Bearer token from context.
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
 * Main component for managing users. Provides CRUD operations for user accounts.
 */
const Users: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<Partial<User>>({});
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});
  const [search, setSearch] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [openBulkDeleteDialog, setOpenBulkDeleteDialog] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  /**
   * Fetch users on component mount.
   */
  useEffect(() => {
    fetchUsers();
  }, []);

  /**
   * Auto-refresh functionality
   */
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchUsers();
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            setOpenAddDialog(true);
            break;
          case 'r':
            e.preventDefault();
            fetchUsers();
            break;
        }
      } else if (e.key === 'Delete' && selectedUsers.length > 0) {
        e.preventDefault();
        setOpenBulkDeleteDialog(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedUsers([]);
        setOpenAddDialog(false);
        setOpenDeleteDialog(false);
        setOpenBulkDeleteDialog(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedUsers]);

  /**
   * Loads all users from the API.
   */
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/users");
      setUsers(Array.isArray(data) ? data : []);
      setLastRefresh(new Date());
      setSelectedUsers([]); // Clear selection on refresh
    } catch (err) {
      console.error("Fetch users failed:", err);
      showNotification("Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Show a temporary notification banner.
   */
  const showNotification = (
    message: string,
    severity: NotificationState["severity"] = "info",
    duration: number = 5000,
  ) => {
    setNotification({ open: true, message, severity });
    setTimeout(
      () => setNotification((prev) => ({ ...prev, open: false })),
      duration,
    );
  };

  /**
   * Validate email format
   */
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Check if user already exists
   */
  const userExists = (email: string, excludeId?: number) => {
    return users.some(user => 
      user.email.toLowerCase() === email.toLowerCase() && 
      user.id !== excludeId
    );
  };

  /**
   * Validate user form data
   */
  const validateUserForm = (userData: Partial<User>, isEdit = false) => {
    const errors: string[] = [];
    
    if (!userData.email?.trim()) {
      errors.push("Email is required");
    } else if (!isValidEmail(userData.email)) {
      errors.push("Please enter a valid email address");
    } else if (userExists(userData.email, isEdit ? editingUserId || undefined : undefined)) {
      errors.push("A user with this email already exists");
    }
    
    if (!userData.firstname?.trim()) {
      errors.push("First name is required");
    }
    
    if (!userData.lastname?.trim()) {
      errors.push("Last name is required");
    }
    
    if (!isEdit && !userData.hash_password?.trim()) {
      errors.push("Password is required");
    } else if (!isEdit && userData.hash_password && userData.hash_password.length < 6) {
      errors.push("Password must be at least 6 characters long");
    }
    
    return errors;
  };

  /**
   * Add a new user with enhanced validation.
   */
  const handleAdd = async () => {
    const validationErrors = validateUserForm(newUser);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    try {
      await authAxios.post("/api/users", newUser);
      setNewUser({});
      setOpenAddDialog(false);
      fetchUsers();
      showNotification(`User "${newUser.firstname} ${newUser.lastname}" added successfully`, "success");
    } catch (err: any) {
      console.error("Add user failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 409 || errorMessage.includes("already exists")) {
        showNotification("A user with this email already exists", "error");
      } else if (err.response?.status === 400) {
        showNotification(`Invalid user data: ${errorMessage}`, "error");
      } else if (err.response?.status === 422) {
        showNotification("Please check your input and try again", "error");
      } else {
        showNotification(`Failed to add user: ${errorMessage}`, "error");
      }
    }
  };

  /**
   * Update an existing user by id with enhanced validation.
   */
  const handleUpdate = async (id: number) => {
    const validationErrors = validateUserForm(editingUser, true);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    try {
      await authAxios.put(`/api/users/${id}`, editingUser);
      const userName = `${editingUser.firstname} ${editingUser.lastname}`.trim() || editingUser.email;
      setEditingUserId(null);
      setEditingUser({});
      fetchUsers();
      showNotification(`User "${userName}" updated successfully`, "success");
    } catch (err: any) {
      console.error("Update user failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 409 || errorMessage.includes("already exists")) {
        showNotification("A user with this email already exists", "error");
      } else if (err.response?.status === 404) {
        showNotification("User not found. Please refresh and try again", "error");
        fetchUsers();
      } else if (err.response?.status === 400) {
        showNotification(`Invalid user data: ${errorMessage}`, "error");
      } else {
        showNotification(`Failed to update user: ${errorMessage}`, "error");
      }
    }
  };

  /**
   * Delete a user by id with enhanced error handling.
   */
  const handleDelete = async (id: number) => {
    const userToDeleteName = userToDelete ? 
      `${userToDelete.firstname} ${userToDelete.lastname}`.trim() || userToDelete.email : 
      `User ${id}`;
    
    try {
      await authAxios.delete(`/api/users/${id}`);
      fetchUsers();
      setOpenDeleteDialog(false);
      setUserToDelete(null);
      showNotification(`User "${userToDeleteName}" deleted successfully`, "success");
    } catch (err: any) {
      console.error("Delete user failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 404) {
        showNotification("User not found. It may have already been deleted", "error");
        fetchUsers();
      } else if (err.response?.status === 409 || errorMessage.includes("constraint")) {
        showNotification("Cannot delete user: user has associated data (roles, permissions, etc.)", "error");
      } else if (err.response?.status === 403) {
        showNotification("You don't have permission to delete this user", "error");
      } else {
        showNotification(`Failed to delete user: ${errorMessage}`, "error");
      }
      setOpenDeleteDialog(false);
      setUserToDelete(null);
    }
  };

  /**
   * Open the dialog to confirm user deletion.
   */
  const handleDeleteDialogOpen = (user: User) => {
    setUserToDelete(user);
    setOpenDeleteDialog(true);
  };

  /**
   * Handle bulk delete operation
   */
  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      await Promise.all(
        selectedUsers.map(id => authAxios.delete(`/api/users/${id}`))
      );
      
      showNotification(
        `Successfully deleted ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`,
        "success"
      );
      
      setSelectedUsers([]);
      setOpenBulkDeleteDialog(false);
      fetchUsers();
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      showNotification(
        `Failed to delete some users: ${err.response?.data?.message || err.message}`,
        "error"
      );
      setOpenBulkDeleteDialog(false);
    }
  };

  /**
   * Select all filtered users
   */
  const handleSelectAll = () => {
    const allUserIds = filteredUsers.map(user => user.id);
    setSelectedUsers(allUserIds);
  };

  /**
   * Deselect all users
   */
  const handleDeselectAll = () => {
    setSelectedUsers([]);
  };

  /**
   * Handle CSV file import
   */
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
      const expectedHeaders = ['email', 'firstname', 'lastname', 'password'];
      
      // Validate headers
      const missingHeaders = expectedHeaders.filter(h => !headers.some(header => header.toLowerCase().includes(h)));
      if (missingHeaders.length > 0) {
        showNotification(`Missing required columns: ${missingHeaders.join(', ')}. Expected: email, firstname, lastname, password`, "error");
        return;
      }

      // Parse CSV data
      const userData = [];
      const activatedIndex = headers.findIndex(h => h.toLowerCase().includes('activated'));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= 4) {
          userData.push({
            email: values[headers.findIndex(h => h.toLowerCase().includes('email'))],
            firstname: values[headers.findIndex(h => h.toLowerCase().includes('firstname'))],
            lastname: values[headers.findIndex(h => h.toLowerCase().includes('lastname'))],
            hash_password: values[headers.findIndex(h => h.toLowerCase().includes('password'))],
            activated: activatedIndex >= 0 ? values[activatedIndex].toLowerCase() === 'true' : true, // Default to true if not specified
          });
        }
      }

      if (userData.length === 0) {
        showNotification("No valid user data found in CSV", "error");
        return;
      }

      // Import users
      let successCount = 0;
      const errors: string[] = [];
      
      for (const user of userData) {
        try {
          await authAxios.post('/api/users', user);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to import user ${user.email}:`, err);
          
          let specificError = 'Unknown error';
          
          if (err.response?.data) {
            const responseData = err.response.data;
            
            // Handle the API structure: response.data.error.message
            if (responseData.error && responseData.error.message) {
              specificError = responseData.error.message;
            } 
            // Fallback: direct message in responseData
            else if (responseData.message) {
              specificError = responseData.message;
            }
            // Fallback: error object as string
            else if (responseData.error && typeof responseData.error === 'object') {
              if (responseData.error.code) {
                specificError = responseData.error.code.replace(/_/g, ' ');
              } else {
                specificError = 'Validation error';
              }
            }
            // Handle string responses like Json deserialize errors  
            else if (typeof responseData === 'string') {
              if (responseData.includes('Json deserialize error')) {
                if (responseData.includes('missing field')) {
                  const field = responseData.match(/missing field `([^`]+)`/)?.[1];
                  specificError = field ? `Missing required field: ${field}` : 'Missing required field';
                } else {
                  specificError = 'Invalid data format';
                }
              } else {
                specificError = responseData;
              }
            }
            // Last resort fallback
            else {
              specificError = 'Invalid request format';
            }
          } else if (err.message) {
            specificError = err.message;
          }
          
          // Add user email and clean error message
          errors.push(`${user.email}: ${specificError}`);
        }
      }

      // Show detailed results with longer duration for errors
      if (successCount > 0 && errors.length === 0) {
        showNotification(`Successfully imported all ${successCount} users`, "success");
        fetchUsers();
      } else if (successCount > 0 && errors.length > 0) {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Imported ${successCount} users successfully. ${errors.length} failed: ${errorSummary}`, "warning", 10000);
        fetchUsers();
      } else {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Import failed for all users: ${errorSummary}`, "error", 15000);
      }
      
      setOpenImportDialog(false);
      setImportFile(null);
    } catch (err: any) {
      console.error('Import failed:', err);
      showNotification(`Import failed: ${err.message}`, "error");
    } finally {
      setImporting(false);
    }
  };

  /**
   * Export users to CSV
   */
  const handleExportCSV = () => {
    const csvData = users.map(user => ({
      ID: user.id,
      "First Name": user.firstname,
      "Last Name": user.lastname,
      Email: user.email,
      Status: user.activated ? "Active" : "Inactive",
      "Created At": new Date(user.created_at).toLocaleDateString(),
      "Updated At": new Date(user.updated_at).toLocaleDateString()
    }));
    
    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification(`Exported ${users.length} users to CSV`, "success");
  };

  /**
   * Highlight search terms in text
   */
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0 2px' }}>
          {part}
        </mark>
      ) : part
    );
  };

  /**
   * Open the edit dialog for a specific user.
   */
  const handleEditOpen = (user: User) => {
    setEditingUserId(user.id);
    setEditingUser({
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      activated: user.activated,
    });
  };

  /**
   * Close the edit dialog.
   */
  const handleEditClose = () => {
    setEditingUserId(null);
    setEditingUser({});
  };

  const filteredUsers = users.filter((u) =>
    `${u.firstname} ${u.lastname} ${u.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  /**
   * Table columns for user data.
   */
  const columns: GridColDef[] = [
    {
      field: "avatar",
      headerName: "",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Avatar
          sx={{ bgcolor: params.row.activated ? "success.main" : "error.main" }}
        >
          {params.row.firstname?.charAt(0) ||
            params.row.email?.charAt(0) ||
            "?"}
        </Avatar>
      ),
    },
    {
      field: "id",
      headerName: "ID",
      width: 70,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: "firstname",
      headerName: "First Name",
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {highlightSearchTerm(params.value || "-", search)}
        </Typography>
      ),
    },
    {
      field: "lastname",
      headerName: "Last Name",
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {highlightSearchTerm(params.value || "-", search)}
        </Typography>
      ),
    },
    {
      field: "email",
      headerName: "Email",
      width: 250,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Email fontSize="small" color="action" />
          <Typography variant="body2">
            {highlightSearchTerm(params.value, search)}
          </Typography>
        </Box>
      ),
    },
    {
      field: "activated",
      headerName: "Status",
      width: 130,
      renderCell: (params) => (
        <Chip
          icon={params.value ? <CheckCircle /> : <Cancel />}
          label={params.value ? "Active" : "Inactive"}
          color={params.value ? "success" : "error"}
          size="small"
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit User">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEditOpen(params.row)}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteDialogOpen(params.row)}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Stack>
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
              <People color="primary" />
              User Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage system users and their account settings
            </Typography>
            {selectedUsers.length > 0 && (
              <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
              {autoRefresh && " • Auto-refresh enabled"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {selectedUsers.length > 0 && (
              <>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => setOpenBulkDeleteDialog(true)}
                  size="small"
                >
                  Delete ({selectedUsers.length})
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Cancel />}
                  onClick={() => setSelectedUsers([])}
                  size="small"
                >
                  Clear Selection
                </Button>
              </>
            )}
            <Tooltip title="Toggle Auto-refresh (30s)">
              <IconButton 
                onClick={() => setAutoRefresh(!autoRefresh)} 
                color={autoRefresh ? "primary" : "default"}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              onClick={() => setOpenAddDialog(true)}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Add User
            </Button>
          </Stack>
        </Box>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="Search users by name or email..."
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
                  {selectedUsers.length > 0 && (
                    <>
                      <Badge badgeContent={selectedUsers.length} color="primary">
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
                      </Badge>
                      <Tooltip title="Delete Selected Users (Delete/Backspace)">
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteSweep />}
                          onClick={handleBulkDelete}
                        >
                          Delete ({selectedUsers.length})
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
                  {selectedUsers.length === 0 && (
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
                          disabled={filteredUsers.length === 0}
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
                          disabled={filteredUsers.length === 0}
                        >
                          Select All
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </Stack>
              </Grid>
            </Grid>
            {selectedUsers.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Divider />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {selectedUsers.length} user(s) selected | Keyboard shortcuts: Ctrl+E (export), Delete (bulk delete), Ctrl+R (refresh)
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
              rows={filteredUsers}
              columns={columns}
              initialState={{
                pagination: {
                  page: 0,
                  pageSize: 10,
                },
              }}
              pageSize={100}
              getRowId={(row) => row.id}
              checkboxSelection
              selectionModel={selectedUsers}
              onSelectionModelChange={(newSelection: any) => {
                setSelectedUsers(newSelection as number[]);
              }}
              disableSelectionOnClick={false}
              sx={{
                border: "none",
                "& .MuiDataGrid-cell": {
                  outline: "none",
                  borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                },
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "rgba(102, 126, 234, 0.08)",
                  borderBottom: "2px solid rgba(102, 126, 234, 0.2)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                },
                "& .MuiDataGrid-row": {
                  transition: "background-color 0.2s ease, transform 0.1s ease",
                  "&:hover": {
                    backgroundColor: "rgba(102, 126, 234, 0.08)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.15)",
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

        <Dialog
          open={openAddDialog}
          onClose={() => setOpenAddDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PersonAdd />
            Add New User
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  value={newUser.firstname || ""}
                  onChange={(e) =>
                    setNewUser({ ...newUser, firstname: e.target.value })
                  }
                  fullWidth
                  required
                  error={!newUser.firstname?.trim()}
                  helperText={!newUser.firstname?.trim() ? "First name is required" : ""}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  value={newUser.lastname || ""}
                  onChange={(e) =>
                    setNewUser({ ...newUser, lastname: e.target.value })
                  }
                  fullWidth
                  required
                  error={!newUser.lastname?.trim()}
                  helperText={!newUser.lastname?.trim() ? "Last name is required" : ""}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email"
                  type="email"
                  value={newUser.email || ""}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  fullWidth
                  required
                  error={newUser.email ? (!isValidEmail(newUser.email) || userExists(newUser.email)) : false}
                  helperText={
                    !newUser.email?.trim() ? "Email is required" :
                    !isValidEmail(newUser.email) ? "Please enter a valid email address" :
                    userExists(newUser.email) ? "A user with this email already exists" : ""
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Password"
                  type="password"
                  value={newUser.hash_password || ""}
                  onChange={(e) =>
                    setNewUser({ ...newUser, hash_password: e.target.value })
                  }
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newUser.activated || false}
                      onChange={(e) =>
                        setNewUser({ ...newUser, activated: e.target.checked })
                      }
                    />
                  }
                  label="Account Activated"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={
                !newUser.email ||
                !newUser.firstname ||
                !newUser.lastname ||
                !newUser.hash_password
              }
            >
              Add User
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={editingUserId !== null}
          onClose={handleEditClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Edit />
            Edit User
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  value={editingUser.firstname || ""}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      firstname: e.target.value,
                    })
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  value={editingUser.lastname || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, lastname: e.target.value })
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email"
                  value={editingUser.email || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="New Password (leave empty to keep current)"
                  type="password"
                  value={editingUser.hash_password || ""}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      hash_password: e.target.value,
                    })
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editingUser.activated || false}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          activated: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Account Activated"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleEditClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => editingUserId && handleUpdate(editingUserId)}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={openDeleteDialog}
          onClose={() => setOpenDeleteDialog(false)}
        >
          <DialogTitle sx={{ color: "error.main" }}>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete user "{userToDelete?.email}"? This
              action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => userToDelete && handleDelete(userToDelete.id)}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog
          open={openBulkDeleteDialog}
          onClose={() => setOpenBulkDeleteDialog(false)}
        >
          <DialogTitle sx={{ color: "error.main" }}>Confirm Bulk Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete {selectedUsers.length} selected user{selectedUsers.length !== 1 ? 's' : ''}? 
              This action cannot be undone.
            </Typography>
            {selectedUsers.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Users to be deleted:
                </Typography>
                {selectedUsers.slice(0, 5).map(id => {
                  const user = users.find(u => u.id === id);
                  return user ? (
                    <Typography key={id} variant="body2" sx={{ ml: 2 }}>
                      • {user.firstname} {user.lastname} ({user.email})
                    </Typography>
                  ) : null;
                })}
                {selectedUsers.length > 5 && (
                  <Typography variant="body2" sx={{ ml: 2, fontStyle: 'italic' }}>
                    ... and {selectedUsers.length - 5} more
                  </Typography>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenBulkDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleBulkDelete}
            >
              Delete {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
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
            Import Users from CSV
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" paragraph>
              Upload a CSV file with columns: <strong>email, firstname, lastname, password</strong>
              <br />
              Optional: <strong>activated</strong> (true/false, defaults to true)
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

export default Users;
