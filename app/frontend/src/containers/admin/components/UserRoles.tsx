import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface UserRole {
  user_id: number;
  role: string;
  created_at: string;
}

interface User {
  id: number;
  email: string;
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

const UserRoles: React.FC = () => {
  const authAxios = useAuthAxios();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [formState, setFormState] = useState<Partial<UserRole>>({
    user_id: undefined,
    role: '',
  });
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  useEffect(() => {
    fetchUserRoles();
    fetchUsers();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data } = await authAxios.get('/api/user_roles');
      setUserRoles(data);
      const uniqueRoles = Array.from(new Set(data.map((ur: UserRole) => ur.role)));
      setRoles(uniqueRoles);
      if (!formState.role && uniqueRoles.length > 0) {
        setFormState(prev => ({ ...prev, role: uniqueRoles[0] }));
      }
    } catch (err) {
      console.error('Fetch user roles failed:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await authAxios.get('/api/users');
      setUsers(data);
      if (!formState.user_id && data.length > 0) {
        setFormState(prev => ({ ...prev, user_id: data[0].id }));
      }
    } catch (err) {
      console.error('Fetch users failed:', err);
    }
  };

  const handleAdd = async () => {
    if (!formState.user_id || !formState.role) {
      setSnackbar({ open: true, message: 'User and Role are required' });
      return;
    }
    try {
      await authAxios.post('/api/user_roles', formState);
      setFormState({ user_id: users[0]?.id, role: roles[0] || '' });
      fetchUserRoles();
      setSnackbar({ open: true, message: 'User role added successfully' });
    } catch (err) {
      console.error('Add user role failed:', err);
      setSnackbar({ open: true, message: 'Failed to add user role' });
    }
  };

  const handleDelete = async (userId: number, role: string) => {
    try {
      await authAxios.delete(`/api/user_roles/${userId}/${encodeURIComponent(role)}`);
      fetchUserRoles();
      setSnackbar({ open: true, message: 'User role deleted successfully' });
    } catch (err) {
      console.error('Delete user role failed:', err);
      setSnackbar({ open: true, message: 'Failed to delete user role' });
    }
  };

  const filteredUserRoles = userRoles.filter(ur => {
    const user = users.find(u => u.id === ur.user_id);
    return (
      user?.email.toLowerCase().includes(search.toLowerCase()) ||
      ur.role.toLowerCase().includes(search.toLowerCase())
    );
  });

  const columns: GridColDef[] = [
    { field: 'user_id', headerName: 'User ID', width: 120 },
    { field: 'role', headerName: 'Role', width: 200 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Button
          variant="contained"
          color="secondary"
          size="small"
          onClick={() => handleDelete(params.row.user_id, params.row.role)}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Roles
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6">Assign Role</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
          <FormControl sx={{ minWidth: 240 }}>
            <InputLabel>User</InputLabel>
            <Select
              value={formState.user_id ?? ''}
              onChange={e => setFormState({ ...formState, user_id: Number(e.target.value) })}
              label="User"
            >
              {users.map(user => (
                <MenuItem key={user.id} value={user.id}>
                  {user.email} (ID: {user.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Autocomplete
            freeSolo
            options={roles}
            value={formState.role || ''}
            onChange={(_, value) =>
              setFormState({
                ...formState,
                role: typeof value === 'string' ? value : '',
              })
            }
            onInputChange={(_, inputValue) => setFormState({ ...formState, role: inputValue })}
            renderInput={params => <TextField {...params} label="Role" />}
            sx={{ minWidth: 200 }}
          />

          <Button variant="contained" onClick={handleAdd}>
            Add
          </Button>
        </Box>
      </Paper>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search by user email or role"
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
        />
      </Box>

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={filteredUserRoles}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          getRowId={row => `${row.user_id}-${row.role}`}
        />
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
};

export default UserRoles;
