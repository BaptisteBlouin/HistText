import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Snackbar,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface SolrDatabase {
  id: number;
  name: string;
  url: string;
  server_port: number;
  local_port: number;
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

const SolrDatabaseComponent: React.FC = () => {
  const authAxios = useAuthAxios();
  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [newDatabase, setNewDatabase] = useState<Partial<SolrDatabase>>({});
  const [editingDatabase, setEditingDatabase] = useState<SolrDatabase | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectingSSH, setConnectingSSH] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  useEffect(() => {
    fetchSolrDatabases();
  }, []);

  const fetchSolrDatabases = async () => {
    setLoading(true);
    try {
      const { data } = await authAxios.get('/api/solr_databases');
      const filtered = data.filter((db: SolrDatabase) => db.id !== undefined && db.name);
      setSolrDatabases(filtered);
    } catch (error) {
      console.error('Fetch Solr databases failed:', error);
      setSolrDatabases([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingDatabase(null);
    setNewDatabase({});
  };

  const handleAddOrUpdate = async () => {
    // Validate required fields
    if (
      !newDatabase.name ||
      !newDatabase.url ||
      newDatabase.server_port == null ||
      newDatabase.local_port == null
    ) {
      setSnackbar({ open: true, message: 'All fields are required' });
      return;
    }

    try {
      if (editingDatabase) {
        // Update existing
        await authAxios.put(`/api/solr_databases/${editingDatabase.id}`, newDatabase);
        setSnackbar({
          open: true,
          message: 'Solr database updated successfully',
        });
      } else {
        // Create new
        await authAxios.post('/api/solr_databases', newDatabase);
        setSnackbar({
          open: true,
          message: 'Solr database added successfully',
        });
      }
      resetForm();
      fetchSolrDatabases();
    } catch (err) {
      console.error(
        editingDatabase ? 'Update Solr database failed:' : 'Add Solr database failed:',
        err,
      );
      setSnackbar({
        open: true,
        message: editingDatabase ? 'Failed to update Solr database' : 'Failed to add Solr database',
      });
    }
  };

  const handleEdit = (db: SolrDatabase) => {
    setEditingDatabase(db);
    setNewDatabase({
      name: db.name,
      url: db.url,
      server_port: db.server_port,
      local_port: db.local_port,
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await authAxios.delete(`/api/solr_databases/${id}`);
      setSnackbar({
        open: true,
        message: 'Solr database deleted successfully',
      });
      // If we were editing this record, reset form
      if (editingDatabase?.id === id) resetForm();
      fetchSolrDatabases();
    } catch (err) {
      console.error('Delete Solr database failed:', err);
      setSnackbar({ open: true, message: 'Failed to delete Solr database' });
    }
  };

  // New function to handle SSH connection
  const handleConnectSSH = async (id: number) => {
    setConnectingSSH(id);
    try {
      const response = await authAxios.post(`/api/solr_databases/${id}/connect_ssh`);
      setSnackbar({
        open: true,
        message: 'SSH connection established successfully',
      });
    } catch (err) {
      console.error('SSH connection failed:', err);
      setSnackbar({
        open: true,
        message: `Failed to establish SSH connection: ${
          err.response?.data || err.message || 'Unknown error'
        }`,
      });
    } finally {
      setConnectingSSH(null);
    }
  };

  const filteredDatabases = solrDatabases.filter(db =>
    `${db.name} ${db.url}`.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'url', headerName: 'URL', flex: 1 },
    { field: 'server_port', headerName: 'Server Port', width: 130 },
    { field: 'local_port', headerName: 'Local Port', width: 130 },
    { field: 'created_at', headerName: 'Created At', width: 200 },
    { field: 'updated_at', headerName: 'Updated At', width: 200 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 280,
      renderCell: (params: GridRenderCellParams) => {
        const db = params.row as SolrDatabase;
        const isConnecting = connectingSSH === db.id;

        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" color="primary" size="small" onClick={() => handleEdit(db)}>
              Edit
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={() => handleDelete(db.id)}
            >
              Delete
            </Button>
            <Tooltip title="Establish an SSH tunnel to this Solr database">
              <Button
                variant="contained"
                color="success"
                size="small"
                onClick={() => handleConnectSSH(db.id)}
                disabled={isConnecting}
                startIcon={isConnecting ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isConnecting ? 'Connecting...' : 'Connect SSH'}
              </Button>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Solr Databases
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6">
          {editingDatabase ? 'Update Solr Database' : 'Add Solr Database'}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
          <TextField
            label="Name"
            value={newDatabase.name ?? ''}
            onChange={e => setNewDatabase({ ...newDatabase, name: e.target.value })}
          />
          <TextField
            label="URL"
            value={newDatabase.url ?? ''}
            onChange={e => setNewDatabase({ ...newDatabase, url: e.target.value })}
          />
          <TextField
            label="Server Port"
            type="number"
            value={newDatabase.server_port ?? ''}
            onChange={e =>
              setNewDatabase({
                ...newDatabase,
                server_port: parseInt(e.target.value, 10),
              })
            }
          />
          <TextField
            label="Local Port"
            type="number"
            value={newDatabase.local_port ?? ''}
            onChange={e =>
              setNewDatabase({
                ...newDatabase,
                local_port: parseInt(e.target.value, 10),
              })
            }
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleAddOrUpdate}
              sx={{ height: '56px' }}
            >
              {editingDatabase ? 'Update' : 'Add'}
            </Button>
            {editingDatabase && (
              <Button variant="outlined" onClick={resetForm} sx={{ height: '56px' }}>
                Cancel
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          SSH Connection Management
        </Typography>
        <Typography variant="body1">
          When you add a new Solr database, you need to establish an SSH tunnel to connect to it.
          You can establish this connection by clicking the "Connect SSH" button next to each
          database.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Note: This avoids the need to restart the application when adding new Solr databases.
        </Typography>
      </Paper>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search by name or URL"
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
        />
      </Box>

      <Paper sx={{ height: 600 }}>
        {loading ? (
          <Box p={2} sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={filteredDatabases}
            columns={columns}
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            getRowId={row => row.id}
            disableSelectionOnClick
            sx={{ '& .MuiDataGrid-cell': { outline: 'none' } }}
          />
        )}
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

export default SolrDatabaseComponent;
