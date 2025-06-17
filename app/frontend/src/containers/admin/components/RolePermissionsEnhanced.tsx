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
  ListItemText,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams, GridSelectionModel } from "@mui/x-data-grid";
import {
  Add,
  Delete,
  Search,
  Security,
  VpnKey,
  Shield,
  Refresh,
  GetApp,
  DeleteSweep,
  SelectAll,
  CloudUpload,
  ExpandMore,
  ExpandLess,
  Clear,
  Assignment,
  Lock,
  FilterList,
  ViewModule,
  ViewList,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";
import { useResponsive } from "../../../lib/responsive-utils";

interface RolePermission {
  role: string;
  permission: string;
  created_at: string;
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

// Enhanced Role Permission Card Component
interface RolePermissionCardProps {
  rolePermission: RolePermission;
  selected: boolean;
  searchTerm: string;
  expanded: boolean;
  onSelect: (rolePermission: RolePermission) => void;
  onToggleExpand: (rolePermission: RolePermission) => void;
  onDelete: (rolePermission: RolePermission) => void;
}

const RolePermissionCard: React.FC<RolePermissionCardProps> = ({
  rolePermission,
  selected,
  searchTerm,
  expanded,
  onSelect,
  onToggleExpand,
  onDelete,
}) => {
  const theme = useTheme();

  const getRoleColor = (role: string) => {
    const colors = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];
    return colors[role.length % colors.length] as any;
  };

  const getPermissionColor = (permission: string) => {
    const colors = ['info', 'success', 'warning', 'error', 'primary', 'secondary'];
    return colors[permission.length % colors.length] as any;
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
              onChange={() => onSelect(rolePermission)}
              size="small"
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.25rem' },
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Shield color="primary" fontSize="small" />
                {highlightSearchTerm(rolePermission.role, searchTerm)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ 
                  fontSize: { xs: '0.875rem', sm: '0.95rem' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mt: 0.5,
                }}
              >
                <VpnKey fontSize="small" />
                {highlightSearchTerm(rolePermission.permission, searchTerm)}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => onToggleExpand(rolePermission)}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Quick Info */}
        <Stack direction="row" spacing={1} sx={{ mb: expanded ? 2 : 0, flexWrap: 'wrap', gap: 1 }}>
          <Chip
            icon={<Shield />}
            label={rolePermission.role}
            color={getRoleColor(rolePermission.role)}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<VpnKey />}
            label={rolePermission.permission}
            color={getPermissionColor(rolePermission.permission)}
            size="small"
            variant="filled"
          />
          <Chip
            label={`Granted: ${new Date(rolePermission.created_at).toLocaleDateString()}`}
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
                  Role Details
                </Typography>
                <Typography variant="body2">
                  <strong>Role:</strong> {rolePermission.role}
                  <br />
                  <strong>Type:</strong> System Role
                  <br />
                  <strong>Scope:</strong> Application-wide
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Permission Details
                </Typography>
                <Typography variant="body2">
                  <strong>Permission:</strong> {rolePermission.permission}
                  <br />
                  <strong>Granted:</strong> {new Date(rolePermission.created_at).toLocaleString()}
                  <br />
                  <strong>Status:</strong> Active
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Permission Description
                </Typography>
                <Typography variant="body2">
                  This permission grants the "{rolePermission.role}" role specific access rights within the system. 
                  Users with this role can perform actions related to "{rolePermission.permission}".
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
          onClick={() => onDelete(rolePermission)}
          color="error"
          variant="outlined"
        >
          Revoke
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
  onAddPermission: () => void;
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
  onAddPermission,
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
                  Revoke
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
          {totalCount} role permissions total
          {autoRefresh && " • Auto-refresh enabled"}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

const RolePermissionsEnhanced: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();

  // State management
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<RolePermission[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState<RolePermission | null>(null);
  const [openBulkDeleteDialog, setOpenBulkDeleteDialog] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterPermission, setFilterPermission] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    fetchPermissions();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchPermissions();
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

  const filteredPermissions = useMemo(() => 
    permissions.filter((rp) => {
      const searchText = search.toLowerCase();
      const matchesSearch = !searchText || 
        rp.role.toLowerCase().includes(searchText) ||
        rp.permission.toLowerCase().includes(searchText);
      
      const matchesRole = !filterRole || rp.role === filterRole;
      const matchesPermission = !filterPermission || rp.permission === filterPermission;
      
      return matchesSearch && matchesRole && matchesPermission;
    }), [permissions, search, filterRole, filterPermission]);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const [permissionsRes, userRolesRes, dbPermissionsRes] = await Promise.all([
        authAxios.get("/api/role_permissions"),
        authAxios.get("/api/user_roles"),
        authAxios.get("/api/solr_database_permissions"),
      ]);

      setPermissions(Array.isArray(permissionsRes.data) ? permissionsRes.data : []);

      // Extract unique roles and permissions
      const uniqueRoles = Array.from(new Set([
        ...permissionsRes.data.map((rp: RolePermission) => rp.role),
        ...userRolesRes.data.map((ur: any) => ur.role)
      ]));
      setRoles(uniqueRoles);

      const uniquePermissions = Array.from(new Set([
        ...permissionsRes.data.map((rp: RolePermission) => rp.permission),
        ...dbPermissionsRes.data.map((dp: any) => dp.permission)
      ]));
      setAvailablePermissions(uniquePermissions);

    } catch (err) {
      console.error("Fetch permissions failed:", err);
      showNotification("Failed to fetch role permissions", "error");
    } finally {
      setLoading(false);
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

  const handleAddPermissions = async () => {
    if (selectedRoles.length === 0 || selectedPermissions.length === 0) {
      showNotification("Please select at least one role and one permission", "warning");
      return;
    }

    // Validate for existing assignments
    const conflicts: string[] = [];
    selectedRoles.forEach(role => {
      selectedPermissions.forEach(permission => {
        const exists = permissions.some(rp => rp.role === role && rp.permission === permission);
        if (exists) {
          conflicts.push(`${role} already has permission "${permission}"`);
        }
      });
    });

    if (conflicts.length > 0) {
      const displayConflicts = conflicts.length <= 3 ? 
        conflicts.join(', ') : 
        `${conflicts.slice(0, 3).join(', ')} and ${conflicts.length - 3} more`;
      showNotification(`Cannot assign permissions: ${displayConflicts}`, "warning", 10000);
      return;
    }

    setAdding(true);
    try {
      const assignments = [];
      for (const role of selectedRoles) {
        for (const permission of selectedPermissions) {
          assignments.push({ role, permission });
        }
      }

      await Promise.all(
        assignments.map(assignment => 
          authAxios.post("/api/role_permissions", assignment)
        )
      );

      showNotification(
        `Successfully granted ${selectedPermissions.length} permission(s) to ${selectedRoles.length} role(s)`,
        "success"
      );

      setSelectedRoles([]);
      setSelectedPermissions([]);
      setOpenAddDialog(false);
      fetchPermissions();
    } catch (err: any) {
      console.error("Add permissions failed:", err);
      showNotification(`Failed to grant permissions: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDeletePermission = async (rolePermission: RolePermission) => {
    try {
      await authAxios.delete(`/api/role_permissions/${rolePermission.role}/${rolePermission.permission}`);
      
      showNotification(`Revoked permission "${rolePermission.permission}" from role "${rolePermission.role}"`, "success");
      fetchPermissions();
      setOpenDeleteDialog(false);
      setPermissionToDelete(null);
    } catch (err: any) {
      console.error("Delete permission failed:", err);
      showNotification(`Failed to revoke permission: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRolePermissions.length === 0) return;

    try {
      await Promise.all(
        selectedRolePermissions.map(rp => 
          authAxios.delete(`/api/role_permissions/${rp.role}/${rp.permission}`)
        )
      );

      showNotification(
        `Successfully revoked ${selectedRolePermissions.length} permission(s)`,
        "success"
      );

      setSelectedRolePermissions([]);
      setOpenBulkDeleteDialog(false);
      fetchPermissions();
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      showNotification(`Failed to revoke some permissions: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleSelectPermission = (rolePermission: RolePermission) => {
    const isSelected = selectedRolePermissions.some(rp => 
      rp.role === rolePermission.role && rp.permission === rolePermission.permission
    );
    
    if (isSelected) {
      setSelectedRolePermissions(selectedRolePermissions.filter(rp => 
        !(rp.role === rolePermission.role && rp.permission === rolePermission.permission)
      ));
    } else {
      setSelectedRolePermissions([...selectedRolePermissions, rolePermission]);
    }
  };

  const handleToggleCardExpansion = (rolePermission: RolePermission) => {
    const key = `${rolePermission.role}-${rolePermission.permission}`;
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCards(newExpanded);
  };

  const handleSelectAll = () => {
    setSelectedRolePermissions([...filteredPermissions]);
  };

  const handleClearSelection = () => {
    setSelectedRolePermissions([]);
  };

  // DataGrid columns for table view
  const columns: GridColDef[] = [
    {
      field: "role",
      headerName: "Role",
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Shield fontSize="small" color="primary" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: "permission",
      headerName: "Permission",
      flex: 1,
      renderCell: (params) => {
        const permission = params.value as string;
        const getPermissionColor = (permissionName: string) => {
          if (permissionName.includes("read") || permissionName.includes("view"))
            return "info";
          if (permissionName.includes("write") || permissionName.includes("create"))
            return "success";
          if (permissionName.includes("delete") || permissionName.includes("remove"))
            return "error";
          if (permissionName.includes("admin")) return "warning";
          return "default";
        };
        
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <VpnKey fontSize="small" color="action" />
            <Typography variant="body2">{permission}</Typography>
            <Chip
              label={getPermissionColor(permission).toUpperCase()}
              color={getPermissionColor(permission) as any}
              size="small"
              variant="outlined"
            />
          </Box>
        );
      },
    },
    {
      field: "created_at",
      headerName: "Granted",
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
          <Tooltip title="Revoke Permission">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setPermissionToDelete(params.row as RolePermission);
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
      name: 'Grant Permissions',
      onClick: () => setOpenAddDialog(true),
    },
    {
      icon: <CloudUpload />,
      name: 'Import CSV',
      onClick: () => {/* handleImportCSV */},
    },
    {
      icon: <GetApp />,
      name: 'Export All',
      onClick: () => {/* handleExportCSV */},
    },
    {
      icon: <Refresh />,
      name: 'Refresh',
      onClick: fetchPermissions,
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
          title="Role Permissions"
          subtitle="Manage role-based permissions"
          selectedCount={selectedRolePermissions.length}
          totalCount={filteredPermissions.length}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
          onAddPermission={() => setOpenAddDialog(true)}
          onBulkDelete={selectedRolePermissions.length > 0 ? () => setOpenBulkDeleteDialog(true) : undefined}
          onClearSelection={selectedRolePermissions.length > 0 ? handleClearSelection : undefined}
        />
      ) : (
        // Desktop Header
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
              <Security color="primary" />
              Role Permission Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure permissions for user roles
            </Typography>
            {selectedRolePermissions.length > 0 && (
              <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                {selectedRolePermissions.length} permission{selectedRolePermissions.length !== 1 ? 's' : ''} selected
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
              Grant Permissions
            </Button>
          </Stack>
        </Box>
      )}

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search roles and permissions..."
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
            <Grid item xs={12} md={8}>
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
                <Autocomplete
                  size="small"
                  options={['', ...availablePermissions]}
                  value={filterPermission}
                  onChange={(_, value) => setFilterPermission(value || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Filter by permission"
                      sx={{ minWidth: 150 }}
                    />
                  )}
                  getOptionLabel={(option) => option || 'All Permissions'}
                />
              </Stack>
            </Grid>
          </Grid>
          
          {/* Results summary */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredPermissions.length} of {permissions.length} permissions
            </Typography>
            {!isMobile && selectedRolePermissions.length > 0 && (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<SelectAll />}
                  onClick={handleSelectAll}
                  disabled={filteredPermissions.length === 0}
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
                  onClick={() => setOpenBulkDeleteDialog(true)}
                >
                  Revoke ({selectedRolePermissions.length})
                </Button>
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
            {filteredPermissions.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Security sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {search || filterRole || filterPermission ? 'No permissions found' : 'No role permissions yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {search || filterRole || filterPermission
                    ? 'No permissions match your current filters. Try adjusting your search criteria.'
                    : 'Get started by granting permissions to roles in your system.'
                  }
                </Typography>
                {!search && !filterRole && !filterPermission && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenAddDialog(true)}
                    sx={{ mt: 2 }}
                  >
                    Grant First Permission
                  </Button>
                )}
              </Paper>
            ) : viewMode === 'cards' ? (
              <Grid container spacing={2}>
                {filteredPermissions.map((rolePermission) => {
                  const key = `${rolePermission.role}-${rolePermission.permission}`;
                  return (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      <RolePermissionCard
                        rolePermission={rolePermission}
                        selected={selectedRolePermissions.some(rp => 
                          rp.role === rolePermission.role && rp.permission === rolePermission.permission
                        )}
                        searchTerm={search}
                        expanded={expandedCards.has(key)}
                        onSelect={handleSelectPermission}
                        onToggleExpand={handleToggleCardExpansion}
                        onDelete={(rolePermission) => {
                          setPermissionToDelete(rolePermission);
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
                  rows={filteredPermissions}
                  columns={columns}
                  initialState={{
                    pagination: {
                      page: 0,
                      pageSize: 10,
                    },
                  }}
                  pageSize={100}
                  getRowId={(row) => `${row.role}-${row.permission}`}
                  checkboxSelection
                  selectionModel={selectedRolePermissions.map(rp => `${rp.role}-${rp.permission}`)}
                  onSelectionModelChange={(newSelection: GridSelectionModel) => {
                    const selectedKeys = newSelection as string[];
                    const newSelectedPermissions = filteredPermissions.filter(rp => 
                      selectedKeys.includes(`${rp.role}-${rp.permission}`)
                    );
                    setSelectedRolePermissions(newSelectedPermissions);
                  }}
                  disableSelectionOnClick={false}
                  sx={{
                    border: "none",
                    "& .MuiDataGrid-cell": {
                      outline: "none",
                      borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                    },
                    "& .MuiDataGrid-columnHeaders": {
                      backgroundColor: "rgba(255, 152, 0, 0.08)",
                      borderBottom: "2px solid rgba(255, 152, 0, 0.2)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    },
                    "& .MuiDataGrid-row": {
                      transition: "background-color 0.2s ease, transform 0.1s ease",
                      "&:hover": {
                        backgroundColor: "rgba(255, 152, 0, 0.08)",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 12px rgba(255, 152, 0, 0.15)",
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
          ariaLabel="Permission actions"
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

      {/* Grant Permissions Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Assignment />
          Grant Permissions to Roles
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Shield color="primary" />
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
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VpnKey color="primary" />
                Select Permissions
              </Typography>
              <Autocomplete
                multiple
                options={availablePermissions}
                value={selectedPermissions}
                onChange={(_, value) => setSelectedPermissions(value)}
                renderTags={(value, getTagProps) =>
                  value.map((permission, index) => (
                    <Chip
                      label={permission}
                      {...getTagProps({ index })}
                      key={permission}
                      size="small"
                      color="secondary"
                      variant="filled"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Choose permissions..."
                    helperText={`${selectedPermissions.length} permission(s) selected`}
                  />
                )}
              />
            </Grid>
          </Grid>

          {selectedRoles.length > 0 && selectedPermissions.length > 0 && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Permission Grant Preview:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedPermissions.length} permission(s) will be granted to {selectedRoles.length} role(s), 
                creating {selectedRoles.length * selectedPermissions.length} total permission assignment(s).
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
            onClick={handleAddPermissions}
            disabled={selectedRoles.length === 0 || selectedPermissions.length === 0 || adding}
            startIcon={adding ? <CircularProgress size={20} /> : <Add />}
          >
            {adding ? 'Granting...' : 'Grant Permissions'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Permission Revocation</DialogTitle>
        <DialogContent>
          {permissionToDelete && (
            <Typography>
              Are you sure you want to revoke the permission "{permissionToDelete.permission}" from role "{permissionToDelete.role}"? 
              This action cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => permissionToDelete && handleDeletePermission(permissionToDelete)}
          >
            Revoke Permission
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={openBulkDeleteDialog} onClose={() => setOpenBulkDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Bulk Permission Revocation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revoke {selectedRolePermissions.length} selected permission{selectedRolePermissions.length !== 1 ? 's' : ''}? 
            This action cannot be undone.
          </Typography>
          {selectedRolePermissions.length > 0 && (
            <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Permissions to be revoked:
              </Typography>
              {selectedRolePermissions.slice(0, 5).map((rp, index) => (
                <Typography key={index} variant="body2" sx={{ ml: 2 }}>
                  • {rp.role} → {rp.permission}
                </Typography>
              ))}
              {selectedRolePermissions.length > 5 && (
                <Typography variant="body2" sx={{ ml: 2, fontStyle: 'italic' }}>
                  ... and {selectedRolePermissions.length - 5} more
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
            Revoke {selectedRolePermissions.length} Permission{selectedRolePermissions.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RolePermissionsEnhanced;