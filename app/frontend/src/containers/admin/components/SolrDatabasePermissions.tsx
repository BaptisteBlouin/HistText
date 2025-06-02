import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
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
  Storage,
  VpnKey,
  Refresh,
  CheckBox,
  CheckBoxOutlineBlank
} from '@mui/icons-material';
import Autocomplete from '@mui/material/Autocomplete';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

/** Represents a collection permission entry. */
interface SolrDatabasePermission {
  solr_database_id: number;
  collection_name: string;
  permission: string;
  created_at: string;
}

/** Represents a Solr database object. */
interface SolrDatabase {
  id: number;
  name: string;
}

/** Snackbar notification state. */
interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Custom axios instance with auth header.
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
 * SolrDatabasePermissions:
 * Admin UI to assign or revoke permissions for collections in Solr databases.
 */
const SolrDatabasePermissions: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ----------------
  // State management
  // ----------------
  const [permissions, setPermissions] = useState<SolrDatabasePermission[]>([]);
  const [databases, setDatabases] = useState<SolrDatabase[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<SolrDatabase | null>(null);
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [newPermission, setNewPermission] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState<SolrDatabasePermission | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });

  // --------
  // Effects
  // --------

  /** Initial load of all permissions and database options. */
  useEffect(() => {
    fetchPermissions();
    fetchDatabases();
  }, []);

  /** When DB changes, load collections (aliases) for that DB. */
  useEffect(() => {
    if (selectedDatabase) {
      authAxios
        .get(`/api/solr/aliases?solr_database_id=${selectedDatabase.id}`)
        .then(res => setAliases(Array.isArray(res.data) ? res.data : []))
        .catch(() => setAliases([]));
    } else {
      setAliases([]);
    }
    setSelectedCollections([]);
  }, [selectedDatabase]);

  // -----------
  // Functions
  // -----------

  /**
   * Snackbar notification helper.
   */
  const showNotification = (message: string, severity: NotificationState['severity'] = 'info') => {
    setNotification({ open: true, message, severity });
    setTimeout(() => setNotification(prev => ({ ...prev, open: false })), 5000);
  };

  /**
   * Fetch all permission assignments.
   */
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get('/api/solr_database_permissions');
      setPermissions(data);
      const perms = Array.from(
        new Set((data as SolrDatabasePermission[]).map((item) => item.permission))
      ) as string[];
      setAvailablePermissions(perms);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setPermissions([]);
      showNotification('Failed to fetch permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch all databases for selection.
   */
  const fetchDatabases = async () => {
    try {
      const { data } = await authAxios.get('/api/solr_databases');
      setDatabases(data);
    } catch (error) {
      console.error('Failed to fetch databases:', error);
      setDatabases([]);
      showNotification('Failed to fetch databases', 'error');
    }
  };

  /**
   * Select/deselect all collections for the selected DB.
   */
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedCollections(e.target.checked ? aliases : []);
  };

  /**
   * Assign the selected permission to all chosen collections.
   */
  const handleAdd = async () => {
    if (!selectedDatabase || !newPermission.trim() || selectedCollections.length === 0) {
      showNotification('All fields are required', 'warning');
      return;
    }
    try {
      await Promise.all(
        selectedCollections.map(collection =>
          authAxios.post('/api/solr_database_permissions', {
            solr_database_id: selectedDatabase.id,
            collection_name: collection,
            permission: newPermission.trim(),
          }),
        ),
      );
      showNotification(`Permissions added successfully to ${selectedCollections.length} collection(s)`, 'success');
      setSelectedCollections([]);
      setNewPermission('');
      fetchPermissions();
    } catch (error) {
      console.error('Failed to add permissions:', error);
      showNotification('Failed to add permissions', 'error');
    }
  };

  /**
   * Delete a permission assignment for a collection.
   */
  const handleDelete = async (id: number, collection: string, permission: string) => {
    try {
      await authAxios.delete(
        `/api/solr_database_permissions/${id}/${encodeURIComponent(collection)}/${encodeURIComponent(permission)}`,
      );
      showNotification('Permission deleted successfully', 'success');
      setOpenDeleteDialog(false);
      setPermissionToDelete(null);
      fetchPermissions();
    } catch (error) {
      console.error('Failed to delete permission:', error);
      showNotification('Failed to delete permission', 'error');
    }
  };

  /** Filter permissions by search term. */
  const filteredPermissions = permissions.filter(p =>
    `${p.collection_name} ${p.permission}`.toLowerCase().includes(search.toLowerCase()),
  );

  /** Helper: get DB name by ID. */
  const getDatabaseName = (id: number) => {
    const db = databases.find(d => d.id === id);
    return db ? db.name : `Database ${id}`;
  };

  /** Helper: choose a Chip color for permission. */
  const getPermissionColor = (permission: string) => {
    if (permission.includes('read') || permission.includes('view')) return 'info';
    if (permission.includes('write') || permission.includes('create')) return 'success';
    if (permission.includes('delete') || permission.includes('remove')) return 'error';
    if (permission.includes('admin')) return 'warning';
    return 'default';
  };

  // -------------------
  // DataGrid columns
  // -------------------
  const columns: GridColDef[] = [
    { 
      field: 'solr_database_id', 
      headerName: 'Database', 
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Storage fontSize="small" color="primary" />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {getDatabaseName(params.value)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {params.value}
            </Typography>
          </Box>
        </Box>
      )
    },
    { 
      field: 'collection_name', 
      headerName: 'Collection', 
      width: 200,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          size="small" 
          variant="outlined"
          sx={{ fontFamily: 'monospace' }}
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
            size="small"
          />
        </Box>
      )
    },
    { 
      field: 'created_at', 
      headerName: 'Created', 
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      )
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

  // ------
  // Render
  // ------
  return (
    <Fade in={true} timeout={600}>
      <Box>
        {/* Snackbar notification */}
        {notification.open && (
          <Alert 
            severity={notification.severity} 
            sx={{ mb: 3 }}
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          >
            {notification.message}
          </Alert>
        )}

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security color="primary" />
              Database Permissions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage access permissions for Solr collections
            </Typography>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchPermissions} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Permission assignment form */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Add />
              Assign Permissions
            </Typography>
            <Grid container spacing={3}>
              {/* Database selection */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Database</InputLabel>
                  <Select
                    value={selectedDatabase?.id ?? ''}
                    onChange={e =>
                      setSelectedDatabase(databases.find(db => db.id === Number(e.target.value)) || null)
                    }
                    label="Database"
                  >
                    {databases.map(db => (
                      <MenuItem key={db.id} value={db.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Storage fontSize="small" />
                          {db.name}
                          <Chip label={`ID: ${db.id}`} size="small" variant="outlined" />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {/* Collections (multi) */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Collections</InputLabel>
                  <Select
                    multiple
                    value={selectedCollections}
                    onChange={e => setSelectedCollections(e.target.value as string[])}
                    input={<OutlinedInput label="Collections" />}
                    renderValue={selected => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                    disabled={aliases.length === 0}
                  >
                    <MenuItem value="all">
                      <Checkbox
                        checked={aliases.length > 0 && selectedCollections.length === aliases.length}
                        indeterminate={selectedCollections.length > 0 && selectedCollections.length < aliases.length}
                        onChange={handleSelectAll}
                        icon={<CheckBoxOutlineBlank fontSize="small" />}
                        checkedIcon={<CheckBox fontSize="small" />}
                      />
                      <ListItemText primary="Select All" />
                    </MenuItem>
                    {aliases.map(alias => (
                      <MenuItem key={alias} value={alias}>
                        <Checkbox 
                          checked={selectedCollections.includes(alias)} 
                          icon={<CheckBoxOutlineBlank fontSize="small" />}
                          checkedIcon={<CheckBox fontSize="small" />}
                        />
                        <ListItemText primary={alias} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {/* Permission name */}
              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo
                  options={availablePermissions}
                  inputValue={newPermission}
                  onInputChange={(_, val) => setNewPermission(val)}
                  renderInput={params => (
                    <TextField 
                      {...params} 
                      label="Permission" 
                      placeholder="Enter permission name..."
                    />
                  )}
                />
              </Grid>
              {/* Add button */}
              <Grid item xs={12}>
                <Button 
                  variant="contained" 
                  onClick={handleAdd}
                  disabled={!selectedDatabase || !newPermission.trim() || selectedCollections.length === 0}
                  startIcon={<Add />}
                  fullWidth={isMobile}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    }
                  }}
                >
                  Add Permission to {selectedCollections.length || 0} Collection{selectedCollections.length !== 1 ? 's' : ''}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Search */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by collection or permission..."
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

        {/* Permissions table */}
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
              getRowId={row => `${row.solr_database_id}-${row.collection_name}-${row.permission}`}
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

        {/* Confirm delete dialog */}
        <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
          <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Delete />
            Confirm Delete
          </DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the permission "{permissionToDelete?.permission}" 
              for collection "{permissionToDelete?.collection_name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => 
                permissionToDelete && handleDelete(
                  permissionToDelete.solr_database_id, 
                  permissionToDelete.collection_name, 
                  permissionToDelete.permission
                )
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

export default SolrDatabasePermissions;
