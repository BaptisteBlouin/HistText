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
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Autocomplete from '@mui/material/Autocomplete';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface RolePermission {
  role: string;
  permission: string;
  created_at: string;
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

const RolePermissions: React.FC = () => {
  const authAxios = useAuthAxios();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [formState, setFormState] = useState<Partial<RolePermission>>({});
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  useEffect(() => {
    fetchPermissions();
    fetchRoles();
    fetchAvailablePermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data } = await authAxios.get('/api/role_permissions');
      setPermissions(data);
    } catch (err) {
      console.error('Fetch role permissions failed', err);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data } = await authAxios.get('/api/user_roles');
      const roleList = [...new Set(data.map((item: any) => item.role))];
      setRoles(roleList);
      if (!formState.role && roleList.length > 0) {
        setFormState(prev => ({ ...prev, role: roleList[0] }));
      }
    } catch (err) {
      console.error('Fetch roles failed', err);
    }
  };

  const fetchAvailablePermissions = async () => {
    try {
      const { data } = await authAxios.get('/api/solr_database_permissions');
      const perms = [...new Set(data.map((item: any) => item.permission))];
      setAvailablePermissions(perms);
      if (!formState.permission && perms.length > 0) {
        setFormState(prev => ({ ...prev, permission: perms[0] }));
      }
    } catch (err) {
      console.error('Fetch permissions failed', err);
    }
  };

  const handleAdd = async () => {
    if (!formState.role || !formState.permission) {
      setSnackbar({ open: true, message: 'Role and Permission are required' });
      return;
    }
    try {
      await authAxios.post('/api/role_permissions', formState);
      setSnackbar({ open: true, message: 'Added successfully' });
      fetchPermissions();
    } catch {
      setSnackbar({ open: true, message: 'Failed to add role permission' });
    }
  };

  const handleDelete = async (role: string, permission: string) => {
    try {
      await authAxios.delete(
        `/api/role_permissions/${encodeURIComponent(role)}/${encodeURIComponent(permission)}`,
      );
      setSnackbar({ open: true, message: 'Deleted successfully' });
      fetchPermissions();
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete' });
    }
  };

  const filteredPermissions = permissions.filter(p =>
    `${p.role} ${p.permission}`.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: GridColDef[] = [
    { field: 'role', headerName: 'Role', width: 200 },
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
          onClick={() => handleDelete(params.row.role, params.row.permission)}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Role Permissions
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6">Assign Permission to Role</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={formState.role ?? ''}
              onChange={e => setFormState({ ...formState, role: e.target.value })}
              label="Role"
            >
              {roles.map(role => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Autocomplete
            freeSolo
            options={availablePermissions}
            value={formState.permission || ''}
            onInputChange={(_, value) => setFormState({ ...formState, permission: value })}
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
          label="Search role or permission"
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
          getRowId={row => `${row.role}-${row.permission}`}
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

export default RolePermissions;
