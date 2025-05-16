import React, { useEffect, useState, useMemo } from 'react';
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
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

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

const Users: React.FC = () => {
  const authAxios = useAuthAxios();
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<Partial<User>>({});
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});
  const [search, setSearch] = useState('');
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await authAxios.get('/api/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch users failed:', err);
    }
  };

  const handleAdd = async () => {
    try {
      await authAxios.post('/api/users', newUser);
      setNewUser({});
      fetchUsers();
      setSnackbar({ open: true, message: 'User added successfully' });
    } catch (err) {
      console.error('Add user failed:', err);
      setSnackbar({ open: true, message: 'Failed to add user' });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await authAxios.put(`/api/users/${id}`, editingUser);
      setEditingUserId(null);
      setEditingUser({});
      fetchUsers();
      setSnackbar({ open: true, message: 'User updated successfully' });
    } catch (err) {
      console.error('Update user failed:', err);
      setSnackbar({ open: true, message: 'Failed to update user' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await authAxios.delete(`/api/users/${id}`);
      fetchUsers();
      setSnackbar({ open: true, message: 'User deleted successfully' });
    } catch (err) {
      console.error('Delete user failed:', err);
      setSnackbar({ open: true, message: 'Failed to delete user' });
    }
  };

  const handleDeleteDialogOpen = (user: User) => {
    setUserToDelete(user);
    setOpenDeleteDialog(true);
  };

  const filteredUsers = users.filter(u =>
    `${u.firstname} ${u.lastname} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'firstname', headerName: 'First Name', width: 150 },
    { field: 'lastname', headerName: 'Last Name', width: 150 },
    { field: 'email', headerName: 'Email', width: 250 },
    {
      field: 'activated',
      headerName: 'Activated',
      width: 130,
      renderCell: (params: GridRenderCellParams) => <Checkbox checked={params.value} disabled />,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={() => handleEditOpen(params.row)}
            sx={{ mr: 1 }}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            onClick={() => handleDeleteDialogOpen(params.row)}
          >
            Delete
          </Button>
        </Box>
      ),
    },
  ];

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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Users
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6">Add User</Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="First Name"
              value={newUser.firstname || ''}
              onChange={e => setNewUser({ ...newUser, firstname: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Last Name"
              value={newUser.lastname || ''}
              onChange={e => setNewUser({ ...newUser, lastname: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Email"
              value={newUser.email || ''}
              onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Password"
              type="password"
              value={newUser.hash_password || ''}
              onChange={e => setNewUser({ ...newUser, hash_password: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={newUser.activated || false}
                  onChange={e => setNewUser({ ...newUser, activated: e.target.checked })}
                />
              }
              label="Activated"
            />
          </Grid>
          <Grid item xs={12}>
            <Button variant="contained" onClick={handleAdd}>
              Add User
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search Users"
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
        />
      </Box>

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={filteredUsers}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          getRowId={row => row.id}
        />
      </Paper>

      <Dialog open={editingUserId !== null} onClose={handleEditClose}>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="First Name"
            value={editingUser.firstname || ''}
            onChange={e => setEditingUser({ ...editingUser, firstname: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Last Name"
            value={editingUser.lastname || ''}
            onChange={e => setEditingUser({ ...editingUser, lastname: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Email"
            value={editingUser.email || ''}
            onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={editingUser.hash_password || ''}
            onChange={e => setEditingUser({ ...editingUser, hash_password: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={editingUser.activated || false}
                onChange={e =>
                  setEditingUser({
                    ...editingUser,
                    activated: e.target.checked,
                  })
                }
              />
            }
            label="Activated"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancel</Button>
          <Button variant="contained" onClick={() => editingUserId && handleUpdate(editingUserId)}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete user "{userToDelete?.email}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              if (userToDelete) handleDelete(userToDelete.id);
              setOpenDeleteDialog(false);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
};

export default Users;
