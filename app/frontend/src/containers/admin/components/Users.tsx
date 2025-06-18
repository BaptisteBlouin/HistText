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
  CardActions,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  Fade,
  CircularProgress,
  InputAdornment,
  Divider,
  Badge,
  Collapse,
  AppBar,
  Toolbar,
  useTheme,
  alpha,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { LoadingButton } from "@mui/lab";
import {
  Edit,
  Delete,
  PersonAdd,
  Search,
  Email,
  CheckCircle,
  Cancel,
  People,
  Refresh,
  GetApp,
  DeleteSweep,
  SelectAll,
  CloudUpload,
  ExpandMore,
  ExpandLess,
  ViewList,
  ViewModule,
  FilterList,
  Clear,
  MoreVert,
  Person,
  Phone,
  LocationOn,
  Business,
} from "@mui/icons-material";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";
import { useResponsive } from "../../../lib/responsive-utils";

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

interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

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

// Enhanced User Card Component for Mobile
interface UserCardProps {
  user: User;
  selected: boolean;
  searchTerm: string;
  onSelect: (id: number) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  expanded: boolean;
  onToggleExpand: (id: number) => void;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  selected,
  searchTerm,
  onSelect,
  onEdit,
  onDelete,
  expanded,
  onToggleExpand,
}) => {
  const theme = useTheme();

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

  return (
    <Card
      sx={{
        mb: 2,
        border: selected ? `2px solid ${theme.palette.primary.main}` : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Header Row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            <Checkbox
              checked={selected}
              onChange={() => onSelect(user.id)}
              size="small"
            />
            <Avatar
              sx={{
                bgcolor: user.activated ? "success.main" : "error.main",
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
              }}
            >
              {user.firstname?.charAt(0) || user.email?.charAt(0) || "?"}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.25rem' },
                  lineHeight: 1.2,
                }}
              >
                {highlightSearchTerm(`${user.firstname} ${user.lastname}`, searchTerm)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  fontSize: { xs: '0.875rem', sm: '0.95rem' },
                }}
              >
                <Email fontSize="small" />
                {highlightSearchTerm(user.email, searchTerm)}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              icon={user.activated ? <CheckCircle /> : <Cancel />}
              label={user.activated ? "Active" : "Inactive"}
              color={user.activated ? "success" : "error"}
              size="small"
              variant="outlined"
            />
            <IconButton
              size="small"
              onClick={() => onToggleExpand(user.id)}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Quick Info */}
        <Stack direction="row" spacing={1} sx={{ mb: expanded ? 2 : 0 }}>
          <Chip
            icon={<Person />}
            label={`ID: ${user.id}`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`Created: ${new Date(user.created_at).toLocaleDateString()}`}
            size="small"
            variant="outlined"
          />
        </Stack>

        {/* Expanded Details */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Created At
                </Typography>
                <Typography variant="body2">
                  {new Date(user.created_at).toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Last Updated
                </Typography>
                <Typography variant="body2">
                  {new Date(user.updated_at).toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Account Status
                </Typography>
                <Typography variant="body2">
                  {user.activated 
                    ? "Account is active and can access the system" 
                    : "Account is inactive and cannot access the system"
                  }
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ p: { xs: 2, sm: 3 }, pt: 0, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          startIcon={<Edit />}
          onClick={() => onEdit(user)}
          variant="outlined"
        >
          Edit
        </Button>
        <Button
          size="small"
          startIcon={<Delete />}
          onClick={() => onDelete(user)}
          color="error"
          variant="outlined"
        >
          Delete
        </Button>
      </CardActions>
    </Card>
  );
};

// Mobile Header Component
interface MobileHeaderProps {
  title: string;
  subtitle: string;
  selectedCount: number;
  lastRefresh: Date;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onAddUser: () => void;
  onBulkDelete?: () => void;
  onClearSelection?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  selectedCount,
  lastRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  onAddUser,
  onBulkDelete,
  onClearSelection,
}) => {
  const theme = useTheme();

  return (
    <AppBar 
      position="sticky" 
      sx={{ 
        bgcolor: 'background.paper', 
        color: 'text.primary',
        boxShadow: 1,
        mb: 2,
      }}
    >
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <People color="primary" fontSize="small" />
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
          <IconButton 
            onClick={onToggleAutoRefresh} 
            color={autoRefresh ? "primary" : "default"}
            size="small"
          >
            <Refresh />
          </IconButton>
        </Box>

        {selectedCount > 0 && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              p: 1,
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" color="primary">
              {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
            </Typography>
            <Stack direction="row" spacing={1}>
              {onBulkDelete && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<Delete />}
                  onClick={onBulkDelete}
                >
                  Delete
                </Button>
              )}
              {onClearSelection && (
                <Button
                  size="small"
                  onClick={onClearSelection}
                >
                  Clear
                </Button>
              )}
            </Stack>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          Last updated: {lastRefresh.toLocaleTimeString()}
          {autoRefresh && " • Auto-refresh enabled"}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

const UsersEnhanced: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();

  // State management
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
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(isMobile ? 'card' : 'table');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Effects (same as original)
  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchUsers();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

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

  // All the original functions (same implementation)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/users");
      setUsers(Array.isArray(data) ? data : []);
      setLastRefresh(new Date());
      setSelectedUsers([]);
    } catch (err) {
      console.error("Fetch users failed:", err);
      showNotification("Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  };

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
            activated: activatedIndex >= 0 ? values[activatedIndex].toLowerCase() === 'true' : true,
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
          
          errors.push(`${user.email}: ${specificError}`);
        }
      }

      // Show detailed results
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
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Unknown error occurred';
      showNotification(`Import failed: ${errorMsg}`, "error", 10000);
    } finally {
      setImporting(false);
    }
  };

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

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const userExists = (email: string, excludeId?: number) => {
    return users.some(user => 
      user.email.toLowerCase() === email.toLowerCase() && 
      user.id !== excludeId
    );
  };

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

  // Include all other handler functions from original (handleAdd, handleUpdate, handleDelete, etc.)
  // For brevity, I'll include key ones:

  const handleAdd = async () => {
    const validationErrors = validateUserForm(newUser);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    setAdding(true);
    try {
      await authAxios.post("/api/users", newUser);
      setNewUser({});
      setOpenAddDialog(false);
      fetchUsers();
      showNotification(`User "${newUser.firstname} ${newUser.lastname}" added successfully`, "success");
    } catch (err: any) {
      console.error("Add user failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      showNotification(`Failed to add user: ${errorMessage}`, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: number) => {
    const validationErrors = validateUserForm(editingUser, true);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    setUpdating(true);
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
      showNotification(`Failed to update user: ${errorMessage}`, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: number) => {
    const userToDeleteName = userToDelete ? 
      `${userToDelete.firstname} ${userToDelete.lastname}`.trim() || userToDelete.email : 
      `User ${id}`;
    
    setDeleting(true);
    try {
      await authAxios.delete(`/api/users/${id}`);
      fetchUsers();
      setOpenDeleteDialog(false);
      setUserToDelete(null);
      showNotification(`User "${userToDeleteName}" deleted successfully`, "success");
    } catch (err: any) {
      console.error("Delete user failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      showNotification(`Failed to delete user: ${errorMessage}`, "error");
      setOpenDeleteDialog(false);
      setUserToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteDialogOpen = (user: User) => {
    setUserToDelete(user);
    setOpenDeleteDialog(true);
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return;
    
    setDeletingBulk(true);
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
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleSelectAll = () => {
    const allUserIds = filteredUsers.map(user => user.id);
    setSelectedUsers(allUserIds);
  };

  const handleDeselectAll = () => {
    setSelectedUsers([]);
  };

  const handleEditOpen = (user: User) => {
    setEditingUserId(user.id);
    setEditingUser({
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      activated: user.activated,
    });
  };

  const handleEditClose = () => {
    setEditingUserId(null);
    setEditingUser({});
  };

  const handleToggleCardExpansion = (id: number) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  const handleUserSelect = (id: number) => {
    const newSelection = selectedUsers.includes(id)
      ? selectedUsers.filter(userId => userId !== id)
      : [...selectedUsers, id];
    setSelectedUsers(newSelection);
  };

  // Filtered users with status filter
  const filteredUsers = users.filter((u) => {
    const matchesSearch = `${u.firstname} ${u.lastname} ${u.email}`
      .toLowerCase()
      .includes(search.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && u.activated) ||
      (filterStatus === 'inactive' && !u.activated);
    
    return matchesSearch && matchesStatus;
  });

  // DataGrid columns for table view
  const columns: GridColDef[] = [
    {
      field: "id",
      headerName: "ID",
      width: 80,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      renderCell: (params: GridRenderCellParams) => {
        const user = params.row as User;
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar
              sx={{
                bgcolor: user.activated ? "success.main" : "error.main",
                width: 32,
                height: 32,
                fontSize: '0.875rem'
              }}
            >
              {user.firstname?.charAt(0) || user.email?.charAt(0) || "?"}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user.firstname} {user.lastname}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
          </Box>
        );
      },
    },
    {
      field: "email",
      headerName: "Email",
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Email fontSize="small" color="action" />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: "activated",
      headerName: "Status",
      width: 120,
      renderCell: (params) => (
        <Chip
          icon={params.value ? <CheckCircle /> : <Cancel />}
          label={params.value ? "Active" : "Inactive"}
          color={params.value ? "success" : "error"}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: "created_at",
      headerName: "Created",
      width: 120,
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit User">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEditOpen(params.row as User)}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteDialogOpen(params.row as User)}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  // Enhanced Mobile Speed Dial
  const speedDialActions = [
    {
      icon: <PersonAdd />,
      name: 'Add User',
      onClick: () => setOpenAddDialog(true),
    },
    {
      icon: <CloudUpload />,
      name: 'Import CSV',
      onClick: () => setOpenImportDialog(true),
    },
    {
      icon: <GetApp />,
      name: 'Export All',
      onClick: handleExportCSV,
    },
    {
      icon: <Refresh />,
      name: 'Refresh',
      onClick: fetchUsers,
    },
  ];

  // Main render
  return (
    <Box sx={{ pb: isMobile ? 8 : 0 }}>
      {notification.open && (
        <Alert
          severity={notification.severity}
          sx={{ mb: 3 }}
          onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
        >
          {notification.message}
        </Alert>
      )}

      {/* Mobile Header */}
      {isMobile ? (
        <MobileHeader
          title="Users"
          subtitle="Manage system users and accounts"
          selectedCount={selectedUsers.length}
          lastRefresh={lastRefresh}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
          onAddUser={() => setOpenAddDialog(true)}
          onBulkDelete={selectedUsers.length > 0 ? () => setOpenBulkDeleteDialog(true) : undefined}
          onClearSelection={selectedUsers.length > 0 ? handleDeselectAll : undefined}
        />
      ) : (
        // Desktop Header
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
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
            <Tooltip title="Switch to Table View">
              <IconButton
                onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
                color={viewMode === 'table' ? "primary" : "default"}
              >
                {viewMode === 'card' ? <ViewList /> : <ViewModule />}
              </IconButton>
            </Tooltip>
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
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Add User
            </Button>
          </Stack>
        </Box>
      )}

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size={isMobile ? "small" : "medium"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: search && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch("")}>
                        <Clear />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                <Stack direction="row" spacing={1}>
                  <Chip
                    label="All"
                    variant={filterStatus === 'all' ? 'filled' : 'outlined'}
                    color={filterStatus === 'all' ? 'primary' : 'default'}
                    onClick={() => setFilterStatus('all')}
                    size="small"
                  />
                  <Chip
                    label="Active"
                    variant={filterStatus === 'active' ? 'filled' : 'outlined'}
                    color={filterStatus === 'active' ? 'success' : 'default'}
                    onClick={() => setFilterStatus('active')}
                    size="small"
                  />
                  <Chip
                    label="Inactive"
                    variant={filterStatus === 'inactive' ? 'filled' : 'outlined'}
                    color={filterStatus === 'inactive' ? 'error' : 'default'}
                    onClick={() => setFilterStatus('inactive')}
                    size="small"
                  />
                </Stack>
              </Stack>
            </Grid>
          </Grid>
          
          {/* Results summary and bulk actions */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredUsers.length} of {users.length} users
            </Typography>
            {!isMobile && (
              <Stack direction="row" spacing={1}>
                {selectedUsers.length > 0 ? (
                  <>
                    <Button
                      size="small"
                      startIcon={<SelectAll />}
                      onClick={handleSelectAll}
                      disabled={filteredUsers.length === 0}
                    >
                      Select All
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Clear />}
                      onClick={handleDeselectAll}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() => setOpenBulkDeleteDialog(true)}
                    >
                      Delete ({selectedUsers.length})
                    </Button>
                  </>
                ) : (
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
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<GetApp />}
                          onClick={handleExportCSV}
                          disabled={filteredUsers.length === 0}
                        >
                          Export All
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Select All Users">
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<SelectAll />}
                          onClick={handleSelectAll}
                          disabled={filteredUsers.length === 0}
                        >
                          Select All
                        </Button>
                      </span>
                    </Tooltip>
                  </>
                )}
              </Stack>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Content Area */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Fade in={true} timeout={600}>
          <Box>
            {filteredUsers.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <People sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {search ? 'No users found' : 'No users yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {search 
                    ? `No users match "${search}". Try a different search term.`
                    : 'Get started by adding your first user to the system.'
                  }
                </Typography>
                {!search && (
                  <Button
                    variant="contained"
                    startIcon={<PersonAdd />}
                    onClick={() => setOpenAddDialog(true)}
                    sx={{ mt: 2 }}
                  >
                    Add First User
                  </Button>
                )}
              </Paper>
            ) : viewMode === 'card' ? (
              <Grid container spacing={2}>
                {filteredUsers.map((user) => (
                  <Grid item xs={12} sm={6} md={4} key={user.id}>
                    <UserCard
                      user={user}
                      selected={selectedUsers.includes(user.id)}
                      searchTerm={search}
                      onSelect={handleUserSelect}
                      onEdit={handleEditOpen}
                      onDelete={handleDeleteDialogOpen}
                      expanded={expandedCards.has(user.id)}
                      onToggleExpand={handleToggleCardExpansion}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Paper sx={{ height: 600, borderRadius: 3, overflow: "hidden" }}>
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
                  onSelectionModelChange={(newSelection) => {
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
                      backgroundColor: "rgba(33, 150, 243, 0.08)",
                      borderBottom: "2px solid rgba(33, 150, 243, 0.2)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    },
                    "& .MuiDataGrid-row": {
                      transition: "background-color 0.2s ease, transform 0.1s ease",
                      "&:hover": {
                        backgroundColor: "rgba(33, 150, 243, 0.08)",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 12px rgba(33, 150, 243, 0.15)",
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
              </Paper>
            )}
          </Box>
        </Fade>
      )}

      {/* Mobile Speed Dial */}
      {isMobile && (
        <SpeedDial
          ariaLabel="User actions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
        >
          {speedDialActions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              onClick={action.onClick}
            />
          ))}
        </SpeedDial>
      )}

      {/* All dialogs from original component */}
      {/* Add User Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
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
                onChange={(e) => setNewUser({ ...newUser, firstname: e.target.value })}
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
                onChange={(e) => setNewUser({ ...newUser, lastname: e.target.value })}
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
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
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
                onChange={(e) => setNewUser({ ...newUser, hash_password: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newUser.activated || false}
                    onChange={(e) => setNewUser({ ...newUser, activated: e.target.checked })}
                  />
                }
                label="Account Activated"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenAddDialog(false)} disabled={adding}>Cancel</Button>
          <LoadingButton
            variant="contained"
            onClick={handleAdd}
            loading={adding}
            disabled={
              !newUser.email ||
              !newUser.firstname ||
              !newUser.lastname ||
              !newUser.hash_password
            }
          >
            Add User
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={editingUserId !== null}
        onClose={handleEditClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
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
                onChange={(e) => setEditingUser({ ...editingUser, firstname: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Last Name"
                value={editingUser.lastname || ""}
                onChange={(e) => setEditingUser({ ...editingUser, lastname: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email"
                value={editingUser.email || ""}
                onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="New Password (leave empty to keep current)"
                type="password"
                value={editingUser.hash_password || ""}
                onChange={(e) => setEditingUser({ ...editingUser, hash_password: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editingUser.activated || false}
                    onChange={(e) => setEditingUser({ ...editingUser, activated: e.target.checked })}
                  />
                }
                label="Account Activated"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleEditClose} disabled={updating}>Cancel</Button>
          <LoadingButton
            variant="contained"
            onClick={() => editingUserId && handleUpdate(editingUserId)}
            loading={updating}
          >
            Save Changes
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "{userToDelete?.email}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)} disabled={deleting}>Cancel</Button>
          <LoadingButton
            variant="contained"
            color="error"
            onClick={() => userToDelete && handleDelete(userToDelete.id)}
            loading={deleting}
          >
            Delete
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={openBulkDeleteDialog} onClose={() => setOpenBulkDeleteDialog(false)}>
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
          <Button onClick={() => setOpenBulkDeleteDialog(false)} disabled={deletingBulk}>Cancel</Button>
          <LoadingButton
            variant="contained"
            color="error"
            onClick={handleBulkDelete}
            loading={deletingBulk}
          >
            Delete {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
          </LoadingButton>
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
            Upload a CSV file with columns: <strong>email, firstname, lastname, password, activated (optional)</strong>
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
          <LoadingButton
            variant="contained"
            onClick={handleImportCSV}
            disabled={!importFile || importing}
            loading={importing}
            startIcon={importing ? <CircularProgress size={20} /> : <CloudUpload />}
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              "&:hover": {
                background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
              },
            }}
          >
            {importing ? 'Importing...' : 'Import'}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersEnhanced;