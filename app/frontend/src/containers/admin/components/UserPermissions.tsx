import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Stack,
  Alert,
  useTheme,
  useMediaQuery,
  Fade,
  CircularProgress,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add,
  Delete,
  Search,
  Security,
  Person,
  VpnKey,
  Refresh,
  Email,
  Badge
} from '@mui/icons-material';
import Autocomplete from '@mui/material/Autocomplete';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface UserPermission {
  user_id: number;
  permission: string;
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
  severity: 'success' | 'error' | 'warning' | 'info';
}

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

const UserPermissions: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [formState, setFormState] = useState<Partial<UserPermission>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState<UserPermission | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    fetchPermissions();
    fetchUsers();
  }, []);

  const showNotification = (message: string, severity: NotificationState['severity'] = 'info') => {
    setNotification({ open: true, message, severity });
    setTimeout(() => setNotification(prev => ({ ...prev, open: false })), 5000);
  };

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get('/api/user_permissions');
      const valid = data.filter(
        (item: UserPermission) => item.user_id !== undefined && item.permission,
      );
      setPermissions(valid);
      const perms = Array.from(new Set(valid.map(item => item.permission)));
      setAvailablePermissions(perms);
    } catch (err) {
      console.error('Fetch permissions failed:', err);
      setPermissions([]);
      showNotification('Failed to fetch permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await authAxios.get('/api/users');
      setUsers(data);
    } catch (err) {
      console.error('Fetch users failed:', err);
      setUsers([]);
      showNotification('Failed to fetch users', 'error');
    }
  };

  const handleAdd = async () => {
    if (!formState.user_id || !formState.permission) {
      showNotification('User and permission are required', 'warning');
      return;
    }
    try {
      await authAxios.post('/api/user_permissions', formState);
      setFormState({});
      fetchPermissions();
      showNotification('Permission added successfully', 'success');
    } catch (err) {
      console.error('Add permission failed:', err);
      showNotification('Failed to add permission', 'error');
    }
  };

  const handleDelete = async (userId: number, permission: string) => {
    try {
      await authAxios.delete(`/api/user_permissions/${userId}/${encodeURIComponent(permission)}`);
      fetchPermissions();
      setOpenDeleteDialog(false);
      setPermissionToDelete(null);
      showNotification('Permission deleted successfully', 'success');
    } catch (err) {
      console.error('Delete permission failed:', err);
      showNotification('Failed to delete permission', 'error');
    }
  };

  const getUserDisplayName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return `User ${userId}`;
    const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim();
    return fullName || user.email;
  };

  const getUserInitials = (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return '?';
    if (user.firstname && user.lastname) {
      return `${user.firstname.charAt(0)}${user.lastname.charAt(0)}`;
    }
    return user.email.charAt(0).toUpperCase();
  };

  const getPermissionColor = (permission: string) => {
    if (permission.includes('read') || permission.includes('view')) return 'info';
    if (permission.includes('write') || permission.includes('create')) return 'success';
    if (permission.includes('delete') || permission.includes('remove')) return 'error';
    if (permission.includes('admin')) return 'warning';
    return 'default';
  };

  const filteredPermissions = permissions.filter(p => {
    const user = users.find(u => u.id === p.user_id);
    const searchTerm = search.toLowerCase();
    return (
      user?.email.toLowerCase().includes(searchTerm) ||
      user?.firstname?.toLowerCase().includes(searchTerm) ||
      user?.lastname?.toLowerCase().includes(searchTerm) ||
      p.permission.toLowerCase().includes(searchTerm)
    );
  });

  const columns: GridColDef[] = [
    {
      field: 'avatar',
      headerName: '',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          {getUserInitials(params.row.user_id)}
        </Avatar>
      ),
    },
    { 
      field: 'user_id', 
      headerName: 'User ID', 
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      )
    },
    {
      field: 'user_name',
      headerName: 'User',
      width: 250,
      renderCell: (params) => {
        const user = users.find(u => u.id === params.row.user_id);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person fontSize="small" color="action" />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {getUserDisplayName(params.row.user_id)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Email fontSize="inherit" />
                {user?.email}
              </Typography>
            </Box>
          </Box>
        );
      },
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
        <Tooltip title="Delete Permission">
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              setPermissionToDelete(params.row);
              setOpenDeleteDialog(true);
            }}
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
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          >
            {notification.message}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security color="primary" />
              User Permissions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Assign and manage individual user permissions
            </Typography>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchPermissions} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Add />
              Assign Permission to User
            </Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Select User</InputLabel>
                  <Select
                    value={formState.user_id ?? ''}
                    onChange={e => setFormState({ ...formState, user_id: Number(e.target.value) })}
                    label="Select User"
                  >
                    {users.map(user => (
                      <MenuItem key={user.id} value={user.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                            {user.firstname?.charAt(0) || user.email.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2">
                              {`${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {user.id}
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={availablePermissions}
                  inputValue={formState.permission || ''}
                  onInputChange={(_, val) => setFormState({ ...formState, permission: val })}
                  renderInput={params => (
                    <TextField 
                      {...params} 
                      label="Permission" 
                      placeholder="Enter or select permission..."
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Button 
                  variant="contained" 
                  onClick={handleAdd}
                  disabled={!formState.user_id || !formState.permission}
                  startIcon={<Add />}
                  fullWidth={isMobile}
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

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by user name, email, or permission..."
              value={search}
              onChange={e => setSearch(e.target.value)}
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
              getRowId={row => `${row.user_id}-${row.permission}`}
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

        <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
          <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Delete />
            Confirm Delete
          </DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to remove the permission "{permissionToDelete?.permission}" 
              from user {permissionToDelete && getUserDisplayName(permissionToDelete.user_id)}? 
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => 
                permissionToDelete && handleDelete(permissionToDelete.user_id, permissionToDelete.permission)
              }
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default UserPermissions;