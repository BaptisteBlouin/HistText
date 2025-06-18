import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  Alert,
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
  useTheme,
  alpha,
  Collapse,
  AppBar,
  Toolbar,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Checkbox,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { DataGrid, GridColDef, GridRenderCellParams, GridSelectionModel } from "@mui/x-data-grid";
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
  ExpandMore,
  ExpandLess,
  Clear,
  PersonAdd,
  Assignment,
  Group,
  FilterList,
  ViewModule,
  ViewList,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";
import { useResponsive } from "../../../lib/responsive-utils";

interface UserRole {
  user_id: number;
  role: string;
  created_at: string;
}

interface User {
  id: number;
  email: string;
  firstname?: string;
  lastname?: string;
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

// Enhanced UserRole Card Component
interface UserRoleCardProps {
  userRole: UserRole;
  user: User | undefined;
  selected: boolean;
  searchTerm: string;
  expanded: boolean;
  onSelect: (userRole: UserRole) => void;
  onToggleExpand: (userRole: UserRole) => void;
  onDelete: (userRole: UserRole) => void;
}

const UserRoleCard: React.FC<UserRoleCardProps> = ({
  userRole,
  user,
  selected,
  searchTerm,
  expanded,
  onSelect,
  onToggleExpand,
  onDelete,
}) => {
  const theme = useTheme();

  const getUserDisplayName = (user?: User) => {
    if (!user) return `User ${userRole.user_id}`;
    if (user.firstname && user.lastname) {
      return `${user.firstname} ${user.lastname}`;
    }
    return user.email;
  };

  const getRoleColor = (role: string) => {
    const colors = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];
    return colors[role.length % colors.length] as any;
  };

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
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            <Checkbox
              checked={selected}
              onChange={() => onSelect(userRole)}
              size="small"
            />
            <Avatar
              sx={{
                bgcolor: `${getRoleColor(userRole.role)}.main`,
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
              }}
            >
              {user?.firstname?.charAt(0) || user?.email?.charAt(0) || userRole.user_id.toString().charAt(0)}
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
                {highlightSearchTerm(getUserDisplayName(user), searchTerm)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.875rem', sm: '0.95rem' } }}
              >
                {user?.email && highlightSearchTerm(user.email, searchTerm)}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<Badge />}
              label={userRole.role}
              color={getRoleColor(userRole.role)}
              size="small"
              variant="outlined"
            />
            <IconButton
              size="small"
              onClick={() => onToggleExpand(userRole)}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Quick Info */}
        <Stack direction="row" spacing={1} sx={{ mb: expanded ? 2 : 0 }}>
          <Chip
            icon={<Person />}
            label={`User ID: ${userRole.user_id}`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`Assigned: ${new Date(userRole.created_at).toLocaleDateString()}`}
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
                  Role Assignment Date
                </Typography>
                <Typography variant="body2">
                  {new Date(userRole.created_at).toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  User Details
                </Typography>
                <Typography variant="body2">
                  ID: {userRole.user_id}
                  {user && (
                    <>
                      <br />
                      Name: {getUserDisplayName(user)}
                      <br />
                      Email: {user.email}
                    </>
                  )}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Role Information
                </Typography>
                <Typography variant="body2">
                  This user has been assigned the "{userRole.role}" role, which grants specific permissions within the system.
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
          startIcon={<Delete />}
          onClick={() => onDelete(userRole)}
          color="error"
          variant="outlined"
        >
          Remove Role
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
  totalCount: number;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onAddAssignment: () => void;
  onBulkDelete?: () => void;
  onClearSelection?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  selectedCount,
  totalCount,
  autoRefresh,
  onToggleAutoRefresh,
  onAddAssignment,
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
              <Security color="primary" fontSize="small" />
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
              {selectedCount} of {totalCount} selected
            </Typography>
            <Stack direction="row" spacing={1}>
              {onBulkDelete && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<Delete />}
                  onClick={onBulkDelete}
                >
                  Remove
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
          {totalCount} role assignments total
          {autoRefresh && " • Auto-refresh enabled"}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

const UserRolesEnhanced: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();

  // State management
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
  const [selectedRows, setSelectedRows] = useState<UserRole[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<UserRole | null>(null);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [filterRole, setFilterRole] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    fetchUserRoles();
    fetchUsers();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchUserRoles();
      }, 30000);
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
      const user = users.find(u => u.id === ur.user_id);
      const searchText = search.toLowerCase();
      const matchesSearch = !searchText || 
        ur.role.toLowerCase().includes(searchText) ||
        user?.email.toLowerCase().includes(searchText) ||
        user?.firstname?.toLowerCase().includes(searchText) ||
        user?.lastname?.toLowerCase().includes(searchText);
      
      const matchesRole = !filterRole || ur.role === filterRole;
      
      return matchesSearch && matchesRole;
    }), [userRoles, users, search, filterRole]);

  const fetchUserRoles = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/user_roles");
      setUserRoles(Array.isArray(data) ? data : []);
      
      // Extract unique roles
      const uniqueRoles = Array.from(new Set(data.map((ur: UserRole) => ur.role)));
      setRoles(uniqueRoles);
    } catch (err) {
      console.error("Fetch user roles failed:", err);
      showNotification("Failed to fetch user roles", "error");
    } finally {
      setLoading(false);
    }
  }, [authAxios]);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await authAxios.get("/api/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch users failed:", err);
      showNotification("Failed to fetch users", "error");
    }
  }, [authAxios]);

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

  const getUserDisplayName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.firstname} ${user.lastname}` : `User ${userId}`;
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
          console.error(`Failed to import user role:`, err);
          
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
          
          errors.push(`User${ur.user_id}/${ur.role}: ${specificError}`);
        }
      }

      // Show detailed results
      if (successCount > 0 && errors.length === 0) {
        showNotification(`Successfully imported all ${successCount} user role assignments`, "success");
        fetchUserRoles();
      } else if (successCount > 0 && errors.length > 0) {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Imported ${successCount} assignments successfully. ${errors.length} failed: ${errorSummary}`, "warning", 10000);
        fetchUserRoles();
      } else {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Import failed for all assignments: ${errorSummary}`, "error", 15000);
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

  const handleAddAssignments = async () => {
    if (selectedUsers.length === 0 || selectedRoles.length === 0) {
      showNotification("Please select at least one user and one role", "warning");
      return;
    }

    // Validate for existing assignments
    const conflicts: string[] = [];
    selectedUsers.forEach(userId => {
      selectedRoles.forEach(role => {
        const exists = userRoles.some(ur => ur.user_id === userId && ur.role === role);
        if (exists) {
          const user = users.find(u => u.id === userId);
          const userName = user ? `${user.firstname} ${user.lastname}`.trim() || user.email : `User ${userId}`;
          conflicts.push(`${userName} already has role "${role}"`);
        }
      });
    });

    if (conflicts.length > 0) {
      const displayConflicts = conflicts.length <= 3 ? 
        conflicts.join(', ') : 
        `${conflicts.slice(0, 3).join(', ')} and ${conflicts.length - 3} more`;
      showNotification(`Cannot assign roles: ${displayConflicts}`, "warning", 10000);
      return;
    }

    setAdding(true);
    try {
      const assignments = [];
      for (const userId of selectedUsers) {
        for (const role of selectedRoles) {
          assignments.push({ user_id: userId, role });
        }
      }

      await Promise.all(
        assignments.map(assignment => 
          authAxios.post("/api/user_roles", assignment)
        )
      );

      showNotification(
        `Successfully assigned ${selectedRoles.length} role(s) to ${selectedUsers.length} user(s)`,
        "success"
      );

      setSelectedUsers([]);
      setSelectedRoles([]);
      setOpenAddDialog(false);
      fetchUserRoles();
    } catch (err: any) {
      console.error("Add assignments failed:", err);
      showNotification(`Failed to assign roles: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteAssignment = async (userRole: UserRole) => {
    try {
      await authAxios.delete(`/api/user_roles/${userRole.user_id}/${userRole.role}`);
      const user = users.find(u => u.id === userRole.user_id);
      const userName = user ? `${user.firstname} ${user.lastname}`.trim() || user.email : `User ${userRole.user_id}`;
      
      showNotification(`Removed role "${userRole.role}" from ${userName}`, "success");
      fetchUserRoles();
      setOpenDeleteDialog(false);
      setRoleToDelete(null);
    } catch (err: any) {
      console.error("Delete assignment failed:", err);
      showNotification(`Failed to remove role: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;

    try {
      await Promise.all(
        selectedRows.map(userRole => 
          authAxios.delete(`/api/user_roles/${userRole.user_id}/${userRole.role}`)
        )
      );

      showNotification(
        `Successfully removed ${selectedRows.length} role assignment(s)`,
        "success"
      );

      setSelectedRows([]);
      fetchUserRoles();
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      showNotification(`Failed to remove some assignments: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleSelectAssignment = (userRole: UserRole) => {
    const isSelected = selectedRows.some(row => 
      row.user_id === userRole.user_id && row.role === userRole.role
    );
    
    if (isSelected) {
      setSelectedRows(selectedRows.filter(row => 
        !(row.user_id === userRole.user_id && row.role === userRole.role)
      ));
    } else {
      setSelectedRows([...selectedRows, userRole]);
    }
  };

  const handleToggleCardExpansion = (userRole: UserRole) => {
    const key = `${userRole.user_id}-${userRole.role}`;
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCards(newExpanded);
  };

  const handleSelectAll = () => {
    setSelectedRows([...filteredUserRoles]);
  };

  const handleClearSelection = () => {
    setSelectedRows([]);
  };

  // DataGrid columns for table view
  const columns: GridColDef[] = [
    {
      field: "user_id",
      headerName: "User ID",
      width: 80,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: "user_name",
      headerName: "User",
      flex: 1,
      renderCell: (params: GridRenderCellParams) => {
        const userRole = params.row as UserRole;
        const user = users.find(u => u.id === userRole.user_id);
        const getRoleColor = (role: string) => {
          const colors = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];
          return colors[role.length % colors.length] as any;
        };
        
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar
              sx={{
                bgcolor: `${getRoleColor(userRole.role)}.main`,
                width: 32,
                height: 32,
                fontSize: '0.875rem'
              }}
            >
              {user?.firstname?.charAt(0) || user?.email?.charAt(0) || userRole.user_id.toString().charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.firstname && user?.lastname ? `${user.firstname} ${user.lastname}` : user?.email || `User ${userRole.user_id}`}
              </Typography>
              {user?.email && user?.firstname && user?.lastname && (
                <Typography variant="caption" color="text.secondary">
                  {user.email}
                </Typography>
              )}
            </Box>
          </Box>
        );
      },
    },
    {
      field: "role",
      headerName: "Role",
      flex: 1,
      renderCell: (params) => {
        const role = params.value as string;
        const getRoleColor = (role: string) => {
          const colors = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];
          return colors[role.length % colors.length] as any;
        };
        
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Badge color="primary" fontSize="small" />
            <Chip
              label={role}
              color={getRoleColor(role)}
              size="small"
              variant="outlined"
            />
          </Box>
        );
      },
    },
    {
      field: "created_at",
      headerName: "Assigned",
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
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Remove Role">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setRoleToDelete(params.row as UserRole);
                setOpenDeleteDialog(true);
              }}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  // Speed Dial Actions for Mobile
  const speedDialActions = [
    {
      icon: <Add />,
      name: 'Assign Roles',
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
      onClick: fetchUserRoles,
    },
  ];

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
          title="User Roles"
          subtitle="Manage user role assignments"
          selectedCount={selectedRows.length}
          totalCount={filteredUserRoles.length}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
          onAddAssignment={() => setOpenAddDialog(true)}
          onBulkDelete={selectedRows.length > 0 ? handleBulkDelete : undefined}
          onClearSelection={selectedRows.length > 0 ? handleClearSelection : undefined}
        />
      ) : (
        // Desktop Header
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
              <Security color="primary" />
              User Role Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Assign and manage user roles and permissions
            </Typography>
            {selectedRows.length > 0 && (
              <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                {selectedRows.length} assignment{selectedRows.length !== 1 ? 's' : ''} selected
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title={`Switch to ${viewMode === 'cards' ? 'Table' : 'Cards'} View`}>
              <IconButton
                onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                color="primary"
              >
                {viewMode === 'cards' ? <ViewList /> : <ViewModule />}
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
              startIcon={<Add />}
              onClick={() => setOpenAddDialog(true)}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Assign Roles
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
                placeholder="Search by user name, email, or role..."
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
                <Autocomplete
                  size="small"
                  options={['', ...roles]}
                  value={filterRole}
                  onChange={(_, value) => setFilterRole(value || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Filter by role"
                      sx={{ minWidth: 150 }}
                    />
                  )}
                  getOptionLabel={(option) => option || 'All Roles'}
                />
              </Stack>
            </Grid>
          </Grid>
          
          {/* Results summary */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color={selectedRows.length > 0 ? "primary" : "text.secondary"}>
              {selectedRows.length > 0 
                ? `${selectedRows.length} assignment${selectedRows.length !== 1 ? 's' : ''} selected`
                : `Showing ${filteredUserRoles.length} of ${userRoles.length} assignments`
              }
            </Typography>
            {!isMobile && (
              <Stack direction="row" spacing={1}>
                {selectedRows.length > 0 ? (
                  <>
                    <Button
                      size="small"
                      startIcon={<SelectAll />}
                      onClick={handleSelectAll}
                      disabled={filteredUserRoles.length === 0}
                    >
                      Select All
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Clear />}
                      onClick={handleClearSelection}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<Delete />}
                      onClick={handleBulkDelete}
                    >
                      Remove ({selectedRows.length})
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
                          disabled={filteredUserRoles.length === 0}
                        >
                          Export All
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Select All Assignments">
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<SelectAll />}
                          onClick={handleSelectAll}
                          disabled={filteredUserRoles.length === 0}
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
            {filteredUserRoles.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Security sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {search || filterRole ? 'No role assignments found' : 'No role assignments yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {search || filterRole
                    ? 'No assignments match your current filters. Try adjusting your search criteria.'
                    : 'Get started by assigning roles to users in your system.'
                  }
                </Typography>
                {!search && !filterRole && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenAddDialog(true)}
                    sx={{ mt: 2 }}
                  >
                    Assign First Role
                  </Button>
                )}
              </Paper>
            ) : viewMode === 'cards' ? (
              <Grid container spacing={2}>
                {filteredUserRoles.map((userRole) => {
                  const user = users.find(u => u.id === userRole.user_id);
                  const key = `${userRole.user_id}-${userRole.role}`;
                  return (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      <UserRoleCard
                        userRole={userRole}
                        user={user}
                        selected={selectedRows.some(row => 
                          row.user_id === userRole.user_id && row.role === userRole.role
                        )}
                        searchTerm={search}
                        expanded={expandedCards.has(key)}
                        onSelect={handleSelectAssignment}
                        onToggleExpand={handleToggleCardExpansion}
                        onDelete={(userRole) => {
                          setRoleToDelete(userRole);
                          setOpenDeleteDialog(true);
                        }}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <Paper sx={{ height: 600, borderRadius: 3, overflow: "hidden" }}>
                <DataGrid
                  rows={filteredUserRoles}
                  columns={columns}
                  initialState={{
                    pagination: {
                      page: 0,
                      pageSize: 10,
                    },
                  }}
                  pageSize={100}
                  getRowId={(row) => `${row.user_id}-${row.role}`}
                  checkboxSelection
                  selectionModel={selectedRows.map(row => `${row.user_id}-${row.role}`)}
                  onSelectionModelChange={(newSelection: GridSelectionModel) => {
                    const selectedKeys = newSelection as string[];
                    const newSelectedRows = filteredUserRoles.filter(ur => 
                      selectedKeys.includes(`${ur.user_id}-${ur.role}`)
                    );
                    setSelectedRows(newSelectedRows);
                  }}
                  disableSelectionOnClick={false}
                  sx={{
                    border: "none",
                    "& .MuiDataGrid-cell": {
                      outline: "none",
                      borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                    },
                    "& .MuiDataGrid-columnHeaders": {
                      backgroundColor: "rgba(156, 39, 176, 0.08)",
                      borderBottom: "2px solid rgba(156, 39, 176, 0.2)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    },
                    "& .MuiDataGrid-row": {
                      transition: "background-color 0.2s ease, transform 0.1s ease",
                      "&:hover": {
                        backgroundColor: "rgba(156, 39, 176, 0.08)",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 12px rgba(156, 39, 176, 0.15)",
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
          ariaLabel="Role assignment actions"
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

      {/* Add Role Assignment Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Assignment />
          Assign Roles to Users
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person color="primary" />
                Select Users
              </Typography>
              <Autocomplete
                multiple
                options={users}
                value={users.filter(u => selectedUsers.includes(u.id))}
                onChange={(_, value) => setSelectedUsers(value.map(u => u.id))}
                getOptionLabel={(user) => getUserDisplayName(user)}
                renderOption={(props, user) => (
                  <Box component="li" {...props}>
                    <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                      {user.firstname?.charAt(0) || user.email?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{getUserDisplayName(user)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((user, index) => (
                    <Chip
                      avatar={<Avatar>{user.firstname?.charAt(0) || user.email?.charAt(0)}</Avatar>}
                      label={getUserDisplayName(user)}
                      {...getTagProps({ index })}
                      key={user.id}
                      size="small"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Choose users..."
                    helperText={`${selectedUsers.length} user(s) selected`}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Badge color="primary" />
                Select Roles
              </Typography>
              <Autocomplete
                multiple
                options={roles}
                value={selectedRoles}
                onChange={(_, value) => setSelectedRoles(value)}
                renderTags={(value, getTagProps) =>
                  value.map((role, index) => (
                    <Chip
                      label={role}
                      {...getTagProps({ index })}
                      key={role}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Choose roles..."
                    helperText={`${selectedRoles.length} role(s) selected`}
                  />
                )}
              />
            </Grid>
          </Grid>

          {selectedUsers.length > 0 && selectedRoles.length > 0 && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Assignment Preview:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedRoles.length} role(s) will be assigned to {selectedUsers.length} user(s), 
                creating {selectedUsers.length * selectedRoles.length} total assignment(s).
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenAddDialog(false)} disabled={adding}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddAssignments}
            disabled={selectedUsers.length === 0 || selectedRoles.length === 0 || adding}
            startIcon={adding ? <CircularProgress size={20} /> : <Add />}
          >
            {adding ? 'Assigning...' : 'Assign Roles'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Role Removal</DialogTitle>
        <DialogContent>
          {roleToDelete && (
            <Typography>
              Are you sure you want to remove the role "{roleToDelete.role}" from user {roleToDelete.user_id}? 
              This action cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => roleToDelete && handleDeleteAssignment(roleToDelete)}
          >
            Remove Role
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

export default UserRolesEnhanced;