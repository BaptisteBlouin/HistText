import React, { useState, useEffect, useMemo } from 'react';
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
  Chip,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add,
  Edit,
  Delete,
  Search,
  Storage,
  Description,
  Language,
  Settings,
  Refresh,
  Save,
  Cancel,
  Info,
  DataObject
} from '@mui/icons-material';
import Autocomplete from '@mui/material/Autocomplete';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

/** Interface for a collection's metadata and configuration. */
interface SolrDatabaseInfo {
  solr_database_id: number;
  collection_name: string;
  description: string;
  embeddings: string;
  lang?: string | null;
  text_field?: string | null;
  tokenizer?: string | null;
  to_not_display?: Array<string | null> | null;
}

/** Interface for a Solr database entry. */
interface SolrDatabase {
  id: number;
  name: string;
}

/** Notification/snackbar state. */
interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Custom Axios instance with Authorization header attached.
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
 * Main component for Solr database collection metadata management.
 * Allows admin to add, edit, or delete collection-level metadata and settings.
 */
const SolrDatabaseInfoComponent: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // --- State variables ---
  const [solrDatabaseInfos, setSolrDatabaseInfos] = useState<SolrDatabaseInfo[]>([]);
  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [selectedSolrDatabase, setSelectedSolrDatabase] = useState<SolrDatabase | null>(null);
  const [aliases, setAliases] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEmbeddings, setNewEmbeddings] = useState('');
  const [newLang, setNewLang] = useState<string | null>(null);
  const [newTextField, setNewTextField] = useState<string | null>(null);
  const [newTokenizer, setNewTokenizer] = useState<string | null>(null);
  const [newToNotDisplay, setNewToNotDisplay] = useState<Array<string | null> | null>(null);
  const [editingRecord, setEditingRecord] = useState<SolrDatabaseInfo | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<SolrDatabaseInfo | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });

  /** Initial data fetch for Solr DBs and collection metadata info. */
  useEffect(() => {
    fetchSolrDatabaseInfos();
    fetchSolrDatabases();
  }, []);

  /** Fetch Solr collection aliases for the selected DB. */
  useEffect(() => {
    if (selectedSolrDatabase) {
      authAxios
        .get(`/api/solr/aliases?solr_database_id=${selectedSolrDatabase.id}`)
        .then(res => setAliases(Array.isArray(res.data) ? res.data : []))
        .catch(() => setAliases([]));
    } else {
      setAliases([]);
    }
    setNewCollectionName('');
    setAvailableFields([]);
  }, [selectedSolrDatabase]);

  /** When a collection is selected, fetch its field metadata. */
  useEffect(() => {
    if (selectedSolrDatabase && newCollectionName) {
      fetchCollectionMetadata(selectedSolrDatabase.id, newCollectionName);
    } else {
      setAvailableFields([]);
    }
  }, [selectedSolrDatabase, newCollectionName]);

  /**
   * Utility: show a snackbar notification.
   */
  const showNotification = (message: string, severity: NotificationState['severity'] = 'info') => {
    setNotification({ open: true, message, severity });
    setTimeout(() => setNotification(prev => ({ ...prev, open: false })), 5000);
  };

  /**
   * Fetch field names (metadata) for a Solr collection.
   */
  const fetchCollectionMetadata = async (solrDatabaseId: number, collectionName: string) => {
    try {
      const metadataResponse = await authAxios.get(
        `/api/solr/collection_metadata?collection=${encodeURIComponent(collectionName)}&solr_database_id=${solrDatabaseId}`,
      );
      if (metadataResponse.data && Array.isArray(metadataResponse.data)) {
        const fields = metadataResponse.data;
        const fieldNames = fields.map((field: any) => field.name);
        setAvailableFields(fieldNames);

        if (!editingRecord) {
          setNewTextField(null);
          setNewToNotDisplay(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch collection metadata:', error);
      setAvailableFields([]);
    }
  };

  /**
   * Load all Solr database info records (metadata/config for collections).
   */
  const fetchSolrDatabaseInfos = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get('/api/solr_database_info');
      setSolrDatabaseInfos(data);
    } catch (error) {
      console.error('Failed to fetch database info:', error);
      setSolrDatabaseInfos([]);
      showNotification('Failed to fetch database information', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load list of Solr databases for the dropdown.
   */
  const fetchSolrDatabases = async () => {
    try {
      const { data } = await authAxios.get('/api/solr_databases');
      setSolrDatabases(data);
    } catch (error) {
      console.error('Failed to fetch databases:', error);
      setSolrDatabases([]);
      showNotification('Failed to fetch databases', 'error');
    }
  };

  /**
   * Submit new or edited record (add/update).
   */
  const handleAddOrUpdate = async () => {
    if (
      !selectedSolrDatabase ||
      !newCollectionName.trim() ||
      !newDescription.trim() ||
      !newEmbeddings.trim()
    ) {
      showNotification('Required fields are missing', 'warning');
      return;
    }
    try {
      if (editingRecord) {
        await authAxios.put(
          `/api/solr_database_info/${selectedSolrDatabase.id}/${encodeURIComponent(newCollectionName)}`,
          {
            description: newDescription,
            embeddings: newEmbeddings,
            lang: newLang,
            text_field: newTextField,
            tokenizer: newTokenizer,
            to_not_display: newToNotDisplay,
          },
        );
        showNotification('Record updated successfully', 'success');
      } else {
        await authAxios.post('/api/solr_database_info', {
          solr_database_id: selectedSolrDatabase.id,
          collection_name: newCollectionName,
          description: newDescription,
          embeddings: newEmbeddings,
          lang: newLang,
          text_field: newTextField,
          tokenizer: newTokenizer,
          to_not_display: newToNotDisplay,
        });
        showNotification('Record added successfully', 'success');
      }
      fetchSolrDatabaseInfos();
      resetForm();
    } catch (error) {
      console.error('Failed to save record:', error);
      showNotification('Failed to save record', 'error');
    }
  };

  /**
   * Populate form fields for editing a record.
   */
  const handleEdit = (record: SolrDatabaseInfo) => {
    const db = solrDatabases.find(db => db.id === record.solr_database_id) || null;
    setEditingRecord(record);
    setSelectedSolrDatabase(db);
    setNewCollectionName(record.collection_name);
    setNewDescription(record.description);
    setNewEmbeddings(record.embeddings);
    setNewLang(record.lang ?? null);
    setNewTextField(record.text_field ?? null);
    setNewTokenizer(record.tokenizer ?? null);
    setNewToNotDisplay(record.to_not_display ?? null);

    if (db) {
      fetchCollectionMetadata(db.id, record.collection_name);
    }
  };

  /**
   * Delete a record by solr_database_id and collection_name.
   */
  const handleDelete = async (solr_database_id: number, collection_name: string) => {
    try {
      await authAxios.delete(
        `/api/solr_database_info/${solr_database_id}/${encodeURIComponent(collection_name)}`,
      );
      fetchSolrDatabaseInfos();
      setOpenDeleteDialog(false);
      setRecordToDelete(null);
      showNotification('Record deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete record:', error);
      showNotification('Failed to delete record', 'error');
    }
  };

  /** Resets the form and editing state to blank. */
  const resetForm = () => {
    setEditingRecord(null);
    setSelectedSolrDatabase(null);
    setNewCollectionName('');
    setNewDescription('');
    setNewEmbeddings('');
    setNewLang(null);
    setNewTextField(null);
    setNewTokenizer(null);
    setNewToNotDisplay(null);
    setAvailableFields([]);
  };

  /** Filters info records by search term. */
  const filteredInfos = solrDatabaseInfos.filter(info =>
    `${info.collection_name} ${info.description} ${info.embeddings}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  /** Handler for "Fields To Not Display" multiselect. */
  const handleToNotDisplayChange = (_: React.SyntheticEvent, newValue: string[]) => {
    setNewToNotDisplay(newValue.map(v => v || null));
  };

  // --- DataGrid columns definition ---
  const columns: GridColDef[] = [
    { 
      field: 'solr_database_id', 
      headerName: 'Database ID', 
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      )
    },
    { 
      field: 'collection_name', 
      headerName: 'Collection', 
      width: 180,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DataObject fontSize="small" color="primary" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'description', 
      headerName: 'Description', 
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value}
        </Typography>
      )
    },
    { 
      field: 'embeddings', 
      headerName: 'Embeddings', 
      width: 150,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="info" />
      )
    },
    {
      field: 'lang',
      headerName: 'Language',
      width: 120,
      renderCell: params => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Language fontSize="small" color="action" />
          <Typography variant="body2">
            {params.value || '-'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'text_field',
      headerName: 'Text Field',
      width: 120,
      renderCell: params => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'tokenizer',
      headerName: 'Tokenizer',
      width: 120,
      renderCell: params => (
        <Typography variant="body2">
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'to_not_display',
      headerName: 'Hidden Fields',
      width: 200,
      renderCell: params => {
        const values = params.value as Array<string | null> | null;
        if (!values || values.length === 0) return <Typography variant="body2">-</Typography>;
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {values.map((value, index) => value && <Chip key={index} label={value} size="small" variant="outlined" />)}
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit Record">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEdit(params.row)}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Record">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setRecordToDelete(params.row);
                setOpenDeleteDialog(true);
              }}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  // --- Render ---
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

        {/* Page header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Info color="primary" />
              Database Information
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage collection metadata and configuration settings
            </Typography>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchSolrDatabaseInfos} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Form Card */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {editingRecord ? <Edit /> : <Add />}
              {editingRecord ? 'Update Record' : 'Add New Record'}
            </Typography>
            <Grid container spacing={3}>
              {/* Solr DB selector */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Solr Database</InputLabel>
                  <Select
                    value={selectedSolrDatabase?.id || ''}
                    onChange={e =>
                      setSelectedSolrDatabase(
                        solrDatabases.find(db => db.id === Number(e.target.value)) || null,
                      )
                    }
                    label="Solr Database"
                  >
                    {solrDatabases.map(db => (
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
              {/* Collection name */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={aliases}
                  value={newCollectionName}
                  onChange={(_, value: string | null) => setNewCollectionName(value || '')}
                  renderInput={params => (
                    <TextField 
                      {...params} 
                      label="Collection Name *" 
                      required
                      error={!newCollectionName}
                      helperText={!newCollectionName && 'Required'}
                    />
                  )}
                />
              </Grid>
              {/* Description */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Description *"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  fullWidth
                  required
                  error={!newDescription}
                  helperText={!newDescription && 'Required'}
                />
              </Grid>
              {/* Embeddings */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Embeddings *"
                  value={newEmbeddings}
                  onChange={e => setNewEmbeddings(e.target.value)}
                  fullWidth
                  required
                  error={!newEmbeddings}
                  helperText={!newEmbeddings && 'Required'}
                />
              </Grid>
              {/* Language */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="Language"
                  value={newLang || ''}
                  onChange={e => setNewLang(e.target.value || null)}
                  fullWidth
                />
              </Grid>
              {/* Text field selector */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Text Field</InputLabel>
                  <Select
                    value={newTextField || ''}
                    onChange={e => setNewTextField(e.target.value || null)}
                    label="Text Field"
                    disabled={availableFields.length === 0}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {availableFields.map(field => (
                      <MenuItem key={field} value={field}>
                        {field}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {/* Tokenizer */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="Tokenizer"
                  value={newTokenizer || ''}
                  onChange={e => setNewTokenizer(e.target.value || null)}
                  fullWidth
                />
              </Grid>
              {/* Fields To Not Display multiselect */}
              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  options={availableFields}
                  value={(newToNotDisplay || []).filter(Boolean) as string[]}
                  onChange={handleToNotDisplayChange}
                  renderInput={params => (
                    <TextField {...params} label="Fields To Not Display" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        size="small"
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  disabled={availableFields.length === 0}
                />
              </Grid>
              {/* Action buttons */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={2}>
                  <Button 
                    variant="contained" 
                    onClick={handleAddOrUpdate}
                    startIcon={editingRecord ? <Save /> : <Add />}
                    disabled={!selectedSolrDatabase || !newCollectionName || !newDescription || !newEmbeddings}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                      }
                    }}
                  >
                    {editingRecord ? 'Update' : 'Add'} Record
                  </Button>
                  {editingRecord && (
                    <Button variant="outlined" onClick={resetForm} startIcon={<Cancel />}>
                      Cancel
                    </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Search/filter field */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by collection, description, or embeddings..."
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

        {/* Table of collection info */}
        <Paper sx={{ height: 600, borderRadius: 3, overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={filteredInfos}
              columns={columns}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              getRowId={row => `${row.solr_database_id}-${row.collection_name}`}
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
              Are you sure you want to delete the record for collection "{recordToDelete?.collection_name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => recordToDelete && handleDelete(recordToDelete.solr_database_id, recordToDelete.collection_name)}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default SolrDatabaseInfoComponent;
