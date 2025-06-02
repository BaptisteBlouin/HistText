import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Alert,
  useTheme,
  useMediaQuery,
  Fade,
  InputAdornment,
  IconButton
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add,
  Edit,
  Delete,
  Storage,
  Link as LinkIcon,
  NetworkCheck,
  Search,
  Refresh,
  Save,
  Cancel,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

/** Represents a Solr Database connection entry. */
interface SolrDatabase {
  id: number;
  name: string;
  url: string;
  server_port: number;
  local_port: number;
  created_at: string;
  updated_at: string;
}

/** For feedback/snackbar notification state */
interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Returns an Axios instance with Authorization header set for the current user session.
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
 * SolrDatabaseComponent
 *
 * Admin panel for managing Solr database connections, ports, and SSH tunnels.
 * Allows add/edit/delete, SSH connect, and search.
 */
const SolrDatabaseComponent: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ------------- State variables -------------
  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [newDatabase, setNewDatabase] = useState<Partial<SolrDatabase>>({});
  const [editingDatabase, setEditingDatabase] = useState<SolrDatabase | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectingSSH, setConnectingSSH] = useState<number | null>(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [databaseToDelete, setDatabaseToDelete] = useState<SolrDatabase | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });

  // ------------- Data loading -------------
  useEffect(() => {
    fetchSolrDatabases();
  }, []);

  /**
   * Displays a notification (snackbar/alert).
   */
  const showNotification = (message: string, severity: NotificationState['severity'] = 'info') => {
    setNotification({ open: true, message, severity });
    setTimeout(() => setNotification(prev => ({ ...prev, open: false })), 5000);
  };

  /**
   * Loads all Solr databases from the backend.
   */
  const fetchSolrDatabases = async () => {
    setLoading(true);
    try {
      const { data } = await authAxios.get('/api/solr_databases');
      const filtered = data.filter((db: SolrDatabase) => db.id !== undefined && db.name);
      setSolrDatabases(filtered);
    } catch (error) {
      console.error('Fetch Solr databases failed:', error);
      setSolrDatabases([]);
      showNotification('Failed to fetch Solr databases', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resets the add/edit form and closes dialog.
   */
  const resetForm = () => {
    setEditingDatabase(null);
    setNewDatabase({});
    setOpenAddDialog(false);
  };

  /**
   * Handles form submit for adding or updating a database.
   */
  const handleAddOrUpdate = async () => {
    if (
      !newDatabase.name ||
      !newDatabase.url ||
      newDatabase.server_port == null ||
      newDatabase.local_port == null
    ) {
      showNotification('All fields are required', 'warning');
      return;
    }

    try {
      if (editingDatabase) {
        await authAxios.put(`/api/solr_databases/${editingDatabase.id}`, newDatabase);
        showNotification('Solr database updated successfully', 'success');
      } else {
        await authAxios.post('/api/solr_databases', newDatabase);
        showNotification('Solr database added successfully', 'success');
      }
      resetForm();
      fetchSolrDatabases();
    } catch (err) {
      console.error(editingDatabase ? 'Update Solr database failed:' : 'Add Solr database failed:', err);
      showNotification(editingDatabase ? 'Failed to update Solr database' : 'Failed to add Solr database', 'error');
    }
  };

  /**
   * Loads a database into edit form.
   */
  const handleEdit = (db: SolrDatabase) => {
    setEditingDatabase(db);
    setNewDatabase({
      name: db.name,
      url: db.url,
      server_port: db.server_port,
      local_port: db.local_port,
    });
    setOpenAddDialog(true);
  };

  /**
   * Calls API to delete a database by ID.
   */
  const handleDelete = async (id: number) => {
    try {
      await authAxios.delete(`/api/solr_databases/${id}`);
      showNotification('Solr database deleted successfully', 'success');
      if (editingDatabase?.id === id) resetForm();
      fetchSolrDatabases();
      setOpenDeleteDialog(false);
      setDatabaseToDelete(null);
    } catch (err) {
      console.error('Delete Solr database failed:', err);
      showNotification('Failed to delete Solr database', 'error');
    }
  };

  /**
   * Calls API to open an SSH tunnel for a Solr database.
   */
  const handleConnectSSH = async (id: number) => {
    setConnectingSSH(id);
    try {
      await authAxios.post(`/api/solr_databases/${id}/connect_ssh`);
      showNotification('SSH connection established successfully', 'success');
    } catch (err) {
      console.error('SSH connection failed:', err);
      let msg = 'Unknown error';
      if (axios.isAxiosError(err)) {
        msg = err.response?.data
          ? (typeof err.response.data === 'string'
              ? err.response.data
              : JSON.stringify(err.response.data))
          : err.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      showNotification(`Failed to establish SSH connection: ${msg}`, 'error');
    } finally {
      setConnectingSSH(null);
    }
  };

  // ------------- Filtering for search -------------
  const filteredDatabases = solrDatabases.filter(db =>
    `${db.name} ${db.url}`.toLowerCase().includes(search.toLowerCase()),
  );

  // ------------- DataGrid columns -------------
  const columns: GridColDef[] = [
    { 
      field: 'id', 
      headerName: 'ID', 
      width: 80,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      )
    },
    { 
      field: 'name', 
      headerName: 'Name', 
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Storage fontSize="small" color="primary" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'url', 
      headerName: 'URL', 
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon fontSize="small" color="action" />
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {params.value}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'server_port', 
      headerName: 'Server Port', 
      width: 130,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="info" />
      )
    },
    { 
      field: 'local_port', 
      headerName: 'Local Port', 
      width: 130,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="success" />
      )
    },
    { 
      field: 'created_at', 
      headerName: 'Created', 
      width: 120,
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 280,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => {
        const db = params.row as SolrDatabase;
        const isConnecting = connectingSSH === db.id;

        return (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Edit Database">
              <IconButton size="small" color="primary" onClick={() => handleEdit(db)}>
                <Edit />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Database">
              <IconButton size="small" color="error" onClick={() => {
                setDatabaseToDelete(db);
                setOpenDeleteDialog(true);
              }}>
                <Delete />
              </IconButton>
            </Tooltip>
            <Tooltip title="Establish SSH tunnel">
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleConnectSSH(db.id)}
                disabled={isConnecting}
                startIcon={isConnecting ? <CircularProgress size={16} /> : <NetworkCheck />}
                sx={{ minWidth: 120 }}
              >
                {isConnecting ? 'Connecting...' : 'Connect SSH'}
              </Button>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  // ------------- Render main UI -------------
  return (
    <Fade in={true} timeout={600}>
      <Box>
        {/* Feedback / notification snackbar */}
        {notification.open && (
          <Alert 
            severity={notification.severity} 
            sx={{ mb: 3 }}
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          >
            {notification.message}
          </Alert>
        )}

        {/* Page header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Storage color="primary" />
              Solr Databases
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage Solr database connections and configurations
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Databases">
              <IconButton onClick={fetchSolrDatabases} color="primary">
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenAddDialog(true)}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                }
              }}
            >
              Add Database
            </Button>
          </Stack>
        </Box>

        {/* SSH help info */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NetworkCheck />
              SSH Connection Management
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              When you add a new Solr database, you need to establish an SSH tunnel to connect to it.
              You can establish this connection by clicking the "Connect SSH" button next to each database.
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Note:</strong> This avoids the need to restart the application when adding new Solr databases.
              </Typography>
            </Alert>
          </CardContent>
        </Card>

        {/* Search input */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by database name or URL..."
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

        {/* Data table */}
        <Paper sx={{ height: 600, borderRadius: 3, overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
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

        {/* Add/edit dialog */}
        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {editingDatabase ? <Edit /> : <Add />}
            {editingDatabase ? 'Edit Solr Database' : 'Add New Solr Database'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Database Name"
                  value={newDatabase.name ?? ''}
                  onChange={e => setNewDatabase({ ...newDatabase, name: e.target.value })}
                  fullWidth
                  required
                  placeholder="Enter a descriptive name"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Database URL"
                  value={newDatabase.url ?? ''}
                  onChange={e => setNewDatabase({ ...newDatabase, url: e.target.value })}
                  fullWidth
                  required
                  placeholder="e.g., example.com"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Server Port"
                  type="number"
                  value={newDatabase.server_port ?? ''}
                  onChange={e => setNewDatabase({ ...newDatabase, server_port: parseInt(e.target.value, 10) })}
                  fullWidth
                  required
                  placeholder="8983"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Local Port"
                  type="number"
                  value={newDatabase.local_port ?? ''}
                  onChange={e => setNewDatabase({ ...newDatabase, local_port: parseInt(e.target.value, 10) })}
                  fullWidth
                  required
                  placeholder="8984"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenAddDialog(false)} startIcon={<Cancel />}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleAddOrUpdate}
              startIcon={<Save />}
              disabled={!newDatabase.name || !newDatabase.url || !newDatabase.server_port || !newDatabase.local_port}
            >
              {editingDatabase ? 'Update' : 'Add'} Database
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirm dialog */}
        <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
          <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <ErrorIcon />
            Confirm Delete
          </DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the database "{databaseToDelete?.name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => databaseToDelete && handleDelete(databaseToDelete.id)}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default SolrDatabaseComponent;
