import React, { useEffect, useState, useMemo } from 'react';
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
  Grid
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add,
  Delete,
  Search,
  Security,
  Person,
  Badge,
  Refresh
} from '@mui/icons-material';
import Autocomplete from '@mui/material/Autocomplete';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

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
  severity: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Axios instance with Authorization from useAuth.
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
 * Role management interface for users. Assign and remove user roles.
 */
const UserRoles: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [formState, setFormState] = useState<Partial<UserRole>>({
    user_id: undefined,
    role: '',
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    fetchUserRoles();
    fetchUsers();
  }, []);

  /**
   * Display feedback notification to the user.
   */
  const showNotification = (message: string, severity: NotificationState['severity'] = 'info') => {
    setNotification({ open: true, message, severity });
    setTimeout(() => setNotification(prev => ({ ...prev, open: false })), 5000);
  };

  /**
   * Load all user-role assignments and available roles.
   */
  const fetchUserRoles = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get('/api/user_roles');
      setUserRoles(data);
      const uniqueRoles = Array.from(new Set((data as UserRole[]).map(ur => ur.role)))
        .filter((r): r is string => typeof r === 'string');
      setRoles(uniqueRoles);
      if (!formState.role && uniqueRoles.length > 0) {
        setFormState(prev => ({ ...prev, role: uniqueRoles[0] }));
      }
    } catch (err) {
      console.error('Fetch user roles failed:', err);
      showNotification('Failed to fetch user roles', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load all users.
   */
  const fetchUsers = async () => {
    try {
      const { data } = await authAxios.get('/api/users');
      setUsers(data);
      if (!formState.user_id && data.length > 0) {
        setFormState(prev => ({ ...prev, user_id: data[0].id }));
      }
    } catch (err) {
      console.error('Fetch users failed:', err);
      showNotification('Failed to fetch users', 'error');
    }
  };

  /**
   * Assign a role to a user.
   */
  const handleAdd = async () => {
    if (!formState.user_id || !formState.role) {
      showNotification('User and Role are required', 'warning');
      return;
    }
    try {
      await authAxios.post('/api/user_roles', formState);
      setFormState({ user_id: users[0]?.id, role: roles[0] || '' });
      fetchUserRoles();
      showNotification('User role assigned successfully', 'success');
    } catch (err) {
      console.error('Add user role failed:', err);
      showNotification('Failed to assign user role', 'error');
    }
  };

  /**
   * Remove a role from a user.
   */
  const handleDelete = async (userId: number, role: string) => {
    try {
      await authAxios.delete(`/api/user_roles/${userId}/${encodeURIComponent(role)}`);
      fetchUserRoles();
      showNotification('User role removed successfully', 'success');
    } catch (err) {
      console.error('Delete user role failed:', err);
      showNotification('Failed to remove user role', 'error');
    }
  };

  /**
   * Format user full name or fallback to email.
   */
  const getUserDisplayName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return `User ${userId}`;
    const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim();
    return fullName || user.email;
  };

  /**
   * Initials for user avatar display.
   */
  const getUserInitials = (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return '?';
    if (user.firstname && user.lastname) {
      return `${user.firstname.charAt(0)}${user.lastname.charAt(0)}`;
    }
    return user.email.charAt(0).toUpperCase();
  };

  const filteredUserRoles = userRoles.filter(ur => {
    const user = users.find(u => u.id === ur.user_id);
    const searchTerm = search.toLowerCase();
    return (
      user?.email.toLowerCase().includes(searchTerm) ||
      user?.firstname?.toLowerCase().includes(searchTerm) ||
      user?.lastname?.toLowerCase().includes(searchTerm) ||
      ur.role.toLowerCase().includes(searchTerm)
    );
  });

  /**
   * Deterministically color roles for visual variety.
   */
  const getRoleColor = (role: string) => {
    const colors = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];
    const index = role.length % colors.length;
    return colors[index] as any;
  };

  const columns: GridColDef[] = [
    {
      field: 'avatar',
      headerName: '',
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
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person fontSize="small" color="action" />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {getUserDisplayName(params.row.user_id)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {users.find(u => u.id === params.row.user_id)?.email}
            </Typography>
          </Box>
        </Box>
      ),
    },
    { 
      field: 'role', 
      headerName: 'Role', 
      width: 200,
      renderCell: (params) => (
        <Chip
          icon={<Badge />}
          label={params.value}
          color={getRoleColor(params.value)}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      )
    },
    {
      field: 'created_at',
      headerName: 'Assigned Date',
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
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          >
            {notification.message}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security color="primary" />
              User Roles
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Assign and manage user roles and permissions
            </Typography>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchUserRoles} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Add />
              Assign Role to User
            </Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
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
              
              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo
                  options={roles}
                  value={formState.role || ''}
                  onChange={(_, value) => setFormState({ ...formState, role: typeof value === 'string' ? value : '' })}
                  onInputChange={(_, inputValue) => setFormState({ ...formState, role: inputValue })}
                  renderInput={params => (
                    <TextField 
                      {...params} 
                      label="Role Name" 
                      placeholder="Enter or select role..."
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Button
                  variant="contained"
                  onClick={handleAdd}
                  disabled={!formState.user_id || !formState.role}
                  startIcon={<Add />}
                  fullWidth
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    }
                  }}
                >
                  Assign Role
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
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
          </CardContent>
        </Card>

        <Paper sx={{ height: 600, borderRadius: 3, overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={filteredUserRoles}
              columns={columns}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              getRowId={row => `${row.user_id}-${row.role}`}
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

export default UserRoles;
