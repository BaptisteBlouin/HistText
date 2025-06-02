import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
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
  Tooltip,
  IconButton,
  Grid,
  Paper
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add,
  Delete,
  Search,
  Security,
  VpnKey,
  Shield,
  Refresh
} from '@mui/icons-material';
import Autocomplete from '@mui/material/Autocomplete';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

/** Role-permission mapping record */
interface RolePermission {
  role: string;
  permission: string;
  created_at: string;
}

/** Snackbar/alert notification state */
interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Returns an Axios instance with Authorization header set.
 */
const useAuthAxios = () => {
  const { accessToken } = useAuth();
  return useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(config => {
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
 * RolePermissions
 *
 * Admin UI for managing role-permission assignments.
 * - Lists all role-permission pairs.
 * - Lets admins add and remove permissions for roles.
 * - Inline search/filter.
 */
const RolePermissions: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Main data and UI state
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [formState, setFormState] = useState<Partial<RolePermission>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });

  // On mount, fetch all required data for dropdowns and grid
  useEffect(() => {
    fetchPermissions();
    fetchRoles();
    fetchAvailablePermissions();
  }, []);

  /** Show a notification/alert (auto-hides after 5s) */
  const showNotification = (message: string, severity: NotificationState['severity'] = 'info') => {
    setNotification({ open: true, message, severity });
    setTimeout(() => setNotification(prev => ({ ...prev, open: false })), 5000);
  };

  /** Fetch all role-permission pairs */
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get('/api/role_permissions');
      setPermissions(data);
    } catch (err) {
      console.error('Fetch role permissions failed', err);
      showNotification('Failed to fetch role permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  /** Fetch all unique roles in the system */
  const fetchRoles = async () => {
    try {
      const { data } = await authAxios.get('/api/user_roles');
      const roleList = [...new Set((data as {role: string}[]).map(item => item.role))];
      setRoles(roleList);
      if (!formState.role && roleList.length > 0) {
        setFormState(prev => ({ ...prev, role: roleList[0] }));
      }
    } catch (err) {
      console.error('Fetch roles failed', err);
      showNotification('Failed to fetch roles', 'error');
    }
  };

  /** Fetch all unique permissions in the system */
  const fetchAvailablePermissions = async () => {
    try {
      const { data } = await authAxios.get('/api/solr_database_permissions');
      const perms = [...new Set((data as {permission: string}[]).map(item => item.permission))];
      setAvailablePermissions(perms);
      if (!formState.permission && perms.length > 0) {
        setFormState(prev => ({ ...prev, permission: perms[0] }));
      }
    } catch (err) {
      console.error('Fetch permissions failed', err);
      showNotification('Failed to fetch available permissions', 'error');
    }
  };

  /** Assign a permission to a role (calls API, reloads grid) */
  const handleAdd = async () => {
    if (!formState.role || !formState.permission) {
      showNotification('Role and Permission are required', 'warning');
      return;
    }
    try {
      await authAxios.post('/api/role_permissions', formState);
      showNotification('Permission added to role successfully', 'success');
      fetchPermissions();
      setFormState({ role: formState.role, permission: '' });
    } catch (err) {
      showNotification('Failed to add role permission', 'error');
    }
  };

  /** Remove a permission from a role (calls API, reloads grid) */
  const handleDelete = async (role: string, permission: string) => {
    try {
      await authAxios.delete(
        `/api/role_permissions/${encodeURIComponent(role)}/${encodeURIComponent(permission)}`,
      );
      showNotification('Permission removed from role successfully', 'success');
      fetchPermissions();
    } catch (err) {
      showNotification('Failed to remove permission', 'error');
    }
  };

  // Filter the table rows according to current search
  const filteredPermissions = permissions.filter(p =>
    `${p.role} ${p.permission}`.toLowerCase().includes(search.toLowerCase()),
  );

  // Utility for consistent coloring of role chips
  const getRoleColor = (role: string) => {
    const colors = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];
    const index = role.length % colors.length;
    return colors[index] as any;
  };

  // Utility for consistent coloring of permission chips
  const getPermissionColor = (permission: string) => {
    if (permission.includes('read') || permission.includes('view')) return 'info';
    if (permission.includes('write') || permission.includes('create')) return 'success';
    if (permission.includes('delete') || permission.includes('remove')) return 'error';
    if (permission.includes('admin')) return 'warning';
    return 'default';
  };

  // Table columns for the DataGrid
  const columns: GridColDef[] = [
    { 
      field: 'role', 
      headerName: 'Role', 
      width: 200,
      renderCell: (params) => (
        <Chip
          icon={<Shield />}
          label={params.value}
          color={getRoleColor(params.value)}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      )
    },
    { 
      field: 'permission', 
      headerName: 'Permission', 
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VpnKey fontSize="small" color="action" />
          <Chip
            label={params.value}
            color={getPermissionColor(params.value)}
            variant="outlined"
            size="small"
          />
        </Box>
      )
    },
    {
      field: 'created_at',
      headerName: 'Created Date',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title="Remove Permission">
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(params.row.role, params.row.permission)}
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
        {/* Inline notification (alert) */}
        {notification.open && (
          <Alert 
            severity={notification.severity} 
            sx={{ mb: 3 }}
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          >
            {notification.message}
          </Alert>
        )}

        {/* Page Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security color="primary" />
              Role Permissions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure permissions for each role in the system
            </Typography>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchPermissions} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Assign permission to role */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Add />
              Assign Permission to Role
            </Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Select Role</InputLabel>
                  <Select
                    value={formState.role ?? ''}
                    onChange={e => setFormState({ ...formState, role: e.target.value })}
                    label="Select Role"
                  >
                    {roles.map(role => (
                      <MenuItem key={role} value={role}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Shield fontSize="small" />
                          {role}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo
                  options={availablePermissions}
                  value={formState.permission || ''}
                  onInputChange={(_, value) => setFormState({ ...formState, permission: value })}
                  renderInput={params => (
                    <TextField 
                      {...params} 
                      label="Permission" 
                      placeholder="Enter or select permission..."
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Button
                  variant="contained"
                  onClick={handleAdd}
                  disabled={!formState.role || !formState.permission}
                  startIcon={<Add />}
                  fullWidth
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    }
                  }}
                >
                  Add Permission
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Search field */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by role or permission..."
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
          </CardContent>
        </Card>

        {/* Permissions grid */}
        <Paper sx={{ height: 600, borderRadius: 3, overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={filteredPermissions}
              columns={columns}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              getRowId={row => `${row.role}-${row.permission}`}
              disableSelectionOnClick
              sx={{
                border: 'none',
                '& .MuiDataGrid-cell': { outline: 'none' },
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: 'rgba(102, 126, 234, 0.05)',
                },
              }}
            />
          )}
        </Paper>
      </Box>
    </Fade>
  );
};

export default RolePermissions;
