import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Snackbar,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
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
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [formState, setFormState] = useState<Partial<UserPermission>>({});
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  useEffect(() => {
    fetchPermissions();
    fetchUsers();
  }, []);

  const fetchPermissions = async () => {
    try {
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
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await authAxios.get('/api/users');
      setUsers(data);
    } catch (err) {
      console.error('Fetch users failed:', err);
      setUsers([]);
    }
  };

  const handleAdd = async () => {
    if (!formState.user_id || !formState.permission) {
      setSnackbar({ open: true, message: 'User and permission are required' });
      return;
    }
    try {
      await authAxios.post('/api/user_permissions', formState);
      setFormState({});
      fetchPermissions();
      setSnackbar({ open: true, message: 'Permission added successfully' });
    } catch (err) {
      console.error('Add permission failed:', err);
      setSnackbar({ open: true, message: 'Failed to add permission' });
    }
  };

  const handleDelete = async (userId: number, permission: string) => {
    try {
      await authAxios.delete(`/api/user_permissions/${userId}/${encodeURIComponent(permission)}`);
      fetchPermissions();
      setSnackbar({ open: true, message: 'Permission deleted successfully' });
    } catch (err) {
      console.error('Delete permission failed:', err);
      setSnackbar({ open: true, message: 'Failed to delete permission' });
    }
  };

  const filteredPermissions = permissions.filter(p => {
    const user = users.find(u => u.id === p.user_id);
    return (
      user?.email.toLowerCase().includes(search.toLowerCase()) ||
      p.permission.toLowerCase().includes(search.toLowerCase())
    );
  });

  const columns: GridColDef[] = [
    { field: 'user_id', headerName: 'User ID', width: 150 },
    { field: 'permission', headerName: 'Permission', flex: 1 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Button
          variant="contained"
          color="secondary"
          size="small"
          onClick={() => handleDelete(params.row.user_id, params.row.permission)}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Permissions
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6">Assign Permission</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
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
            options={availablePermissions}
            inputValue={formState.permission || ''}
            onInputChange={(_, val) => setFormState({ ...formState, permission: val })}
            renderInput={params => <TextField {...params} label="Permission" />}
            sx={{ minWidth: 200 }}
          />

          <Button variant="contained" onClick={handleAdd}>
            Add
          </Button>
        </Box>
      </Paper>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search by email or permission"
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
        />
      </Box>

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={filteredPermissions}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          getRowId={row => `${row.user_id}-${row.permission}`}
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

export default UserPermissions;
