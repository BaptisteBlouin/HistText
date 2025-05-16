import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Autocomplete,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

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

interface SolrDatabase {
  id: number;
  name: string;
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

const SolrDatabaseInfoComponent: React.FC = () => {
  const authAxios = useAuthAxios();
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
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  useEffect(() => {
    fetchSolrDatabaseInfos();
    fetchSolrDatabases();
  }, []);

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

  useEffect(() => {
    // Fetch collection metadata when collection name changes
    if (selectedSolrDatabase && newCollectionName) {
      fetchCollectionMetadata(selectedSolrDatabase.id, newCollectionName);
    } else {
      setAvailableFields([]);
    }
  }, [selectedSolrDatabase, newCollectionName]);

  const fetchCollectionMetadata = async (solrDatabaseId: number, collectionName: string) => {
    try {
      const metadataResponse = await authAxios.get(
        `/api/solr/collection_metadata?collection=${encodeURIComponent(collectionName)}&solr_database_id=${solrDatabaseId}`,
      );

      if (metadataResponse.data && Array.isArray(metadataResponse.data)) {
        const fields = metadataResponse.data;
        const fieldNames = fields.map((field: any) => field.name);
        setAvailableFields(fieldNames);

        // Only auto-populate fields if we're not editing an existing record
        if (!editingRecord) {
          // Don't override existing values when editing
          setNewTextField(null);
          setNewToNotDisplay(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch collection metadata:', error);
      setAvailableFields([]);
    }
  };

  const fetchSolrDatabaseInfos = async () => {
    try {
      const { data } = await authAxios.get('/api/solr_database_info');
      setSolrDatabaseInfos(data);
    } catch {
      setSolrDatabaseInfos([]);
    }
  };

  const fetchSolrDatabases = async () => {
    try {
      const { data } = await authAxios.get('/api/solr_databases');
      setSolrDatabases(data);
    } catch {
      setSolrDatabases([]);
    }
  };

  const handleAddOrUpdate = async () => {
    if (
      !selectedSolrDatabase ||
      !newCollectionName.trim() ||
      !newDescription.trim() ||
      !newEmbeddings.trim()
    ) {
      setSnackbar({ open: true, message: 'Required fields are missing' });
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
        setSnackbar({ open: true, message: 'Record updated successfully' });
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
        setSnackbar({ open: true, message: 'Record added successfully' });
      }
      fetchSolrDatabaseInfos();
      resetForm();
    } catch {
      setSnackbar({ open: true, message: 'Failed to save record' });
    }
  };

  const handleEdit = (record: SolrDatabaseInfo) => {
    const db = solrDatabases.find(db => db.id === record.solr_database_id) || null;
    setEditingRecord(record);
    setSelectedSolrDatabase(db);
    setNewCollectionName(record.collection_name);
    setNewDescription(record.description);
    setNewEmbeddings(record.embeddings);
    setNewLang(record.lang);
    setNewTextField(record.text_field);
    setNewTokenizer(record.tokenizer);
    setNewToNotDisplay(record.to_not_display);

    // Fetch collection metadata to populate available fields
    if (db) {
      fetchCollectionMetadata(db.id, record.collection_name);
    }
  };

  const handleDelete = async (solr_database_id: number, collection_name: string) => {
    try {
      await authAxios.delete(
        `/api/solr_database_info/${solr_database_id}/${encodeURIComponent(collection_name)}`,
      );
      fetchSolrDatabaseInfos();
      setSnackbar({ open: true, message: 'Record deleted successfully' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete record' });
    }
  };

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

  const filteredInfos = solrDatabaseInfos.filter(info =>
    `${info.collection_name} ${info.description} ${info.embeddings}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const handleToNotDisplayChange = (_: React.SyntheticEvent, newValue: string[]) => {
    // Convert string[] to (string | null)[]
    setNewToNotDisplay(newValue.map(v => v || null));
  };

  const columns: GridColDef[] = [
    { field: 'solr_database_id', headerName: 'Database ID', width: 120 },
    { field: 'collection_name', headerName: 'Collection Name', width: 180 },
    { field: 'description', headerName: 'Description', width: 200 },
    { field: 'embeddings', headerName: 'Embeddings', width: 150 },
    {
      field: 'lang',
      headerName: 'Language',
      width: 120,
      renderCell: params => params.value || '-',
    },
    {
      field: 'text_field',
      headerName: 'Text Field',
      width: 120,
      renderCell: params => params.value || '-',
    },
    {
      field: 'tokenizer',
      headerName: 'Tokenizer',
      width: 120,
      renderCell: params => params.value || '-',
    },
    {
      field: 'to_not_display',
      headerName: 'To Not Display',
      width: 200,
      renderCell: params => {
        const values = params.value as Array<string | null> | null;
        if (!values || values.length === 0) return '-';
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {values.map((value, index) => value && <Chip key={index} label={value} size="small" />)}
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={() => handleEdit(params.row)}
            sx={{ mr: 1 }}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            onClick={() => handleDelete(params.row.solr_database_id, params.row.collection_name)}
          >
            Delete
          </Button>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Solr Database Info
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6">{editingRecord ? 'Update Record' : 'Add New Record'}</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
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
                  {db.name} (ID: {db.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Autocomplete
            freeSolo
            options={aliases}
            value={newCollectionName}
            onChange={(_, value: string | null) => setNewCollectionName(value || '')}
            renderInput={params => <TextField {...params} label="Collection Name *" />}
            sx={{ minWidth: 200 }}
          />

          <TextField
            label="Description *"
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            sx={{ minWidth: 250 }}
          />

          <TextField
            label="Embeddings *"
            value={newEmbeddings}
            onChange={e => setNewEmbeddings(e.target.value)}
            sx={{ minWidth: 250 }}
          />

          <TextField
            label="Language"
            value={newLang || ''}
            onChange={e => setNewLang(e.target.value || null)}
            sx={{ minWidth: 150 }}
          />

          <FormControl sx={{ minWidth: 200 }}>
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

          <TextField
            label="Tokenizer"
            value={newTokenizer || ''}
            onChange={e => setNewTokenizer(e.target.value || null)}
            sx={{ minWidth: 150 }}
          />

          <FormControl sx={{ minWidth: 250 }}>
            <Autocomplete
              multiple
              options={availableFields}
              value={(newToNotDisplay || []).filter(Boolean) as string[]}
              onChange={handleToNotDisplayChange}
              renderInput={params => <TextField {...params} label="Fields To Not Display" />}
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
          </FormControl>

          <Box
            sx={{
              display: 'flex',
              width: '100%',
              justifyContent: 'flex-start',
              mt: 2,
            }}
          >
            <Button variant="contained" onClick={handleAddOrUpdate} sx={{ mr: 2 }}>
              {editingRecord ? 'Update' : 'Add'}
            </Button>
            {editingRecord && (
              <Button variant="outlined" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
        />
      </Box>

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={filteredInfos}
          columns={columns}
          pagination
          pageSize={10}
          rowsPerPageOptions={[5, 10, 20]}
          getRowId={row => `${row.solr_database_id}-${row.collection_name}`}
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

export default SolrDatabaseInfoComponent;
