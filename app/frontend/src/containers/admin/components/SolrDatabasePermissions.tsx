import React, { useEffect, useState, useMemo } from 'react';
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
  OutlinedInput,
  Checkbox,
  ListItemText,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface SolrDatabasePermission {
  solr_database_id: number;
  collection_name: string;
  permission: string;
  created_at: string;
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

const SolrDatabasePermissions: React.FC = () => {
  const authAxios = useAuthAxios();
  const [permissions, setPermissions] = useState<SolrDatabasePermission[]>([]);
  const [databases, setDatabases] = useState<SolrDatabase[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<SolrDatabase | null>(null);
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [newPermission, setNewPermission] = useState('');
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  useEffect(() => {
    fetchPermissions();
    fetchDatabases();
  }, []);

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

  const fetchPermissions = async () => {
    try {
      const { data } = await authAxios.get('/api/solr_database_permissions');
      setPermissions(data);
      const perms = Array.from(
        new Set(data.map((item: SolrDatabasePermission) => item.permission)),
      );
      setAvailablePermissions(perms);
    } catch {
      setPermissions([]);
    }
  };

  const fetchDatabases = async () => {
    try {
      const { data } = await authAxios.get('/api/solr_databases');
      setDatabases(data);
    } catch {
      setDatabases([]);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedCollections(e.target.checked ? aliases : []);
  };

  const handleAdd = async () => {
    if (!selectedDatabase || !newPermission.trim() || selectedCollections.length === 0) {
      setSnackbar({ open: true, message: 'All fields are required' });
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
      setSnackbar({ open: true, message: 'Permissions added successfully' });
      setSelectedCollections([]);
      setNewPermission('');
      fetchPermissions();
    } catch {
      setSnackbar({ open: true, message: 'Failed to add permissions' });
    }
  };

  const handleDelete = async (id: number, collection: string, permission: string) => {
    try {
      await authAxios.delete(
        `/api/solr_database_permissions/${id}/${encodeURIComponent(collection)}/${encodeURIComponent(permission)}`,
      );
      setSnackbar({ open: true, message: 'Permission deleted successfully' });
      fetchPermissions();
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete permission' });
    }
  };

  const filteredPermissions = permissions.filter(p =>
    `${p.collection_name} ${p.permission}`.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: GridColDef[] = [
    { field: 'solr_database_id', headerName: 'Database ID', width: 150 },
    { field: 'collection_name', headerName: 'Collection', width: 200 },
    { field: 'permission', headerName: 'Permission', flex: 1 },
    { field: 'created_at', headerName: 'Created At', width: 200 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Button
          variant="contained"
          color="secondary"
          size="small"
          onClick={() =>
            handleDelete(
              params.row.solr_database_id,
              params.row.collection_name,
              params.row.permission,
            )
          }
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Solr Database Permissions
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6">Assign Permissions</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Database</InputLabel>
            <Select
              value={selectedDatabase?.id ?? ''}
              onChange={e =>
                setSelectedDatabase(databases.find(db => db.id === Number(e.target.value)) || null)
              }
              label="Database"
            >
              {databases.map(db => (
                <MenuItem key={db.id} value={db.id}>{`${db.name} (ID: ${db.id})`}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Collections</InputLabel>
            <Select
              multiple
              value={selectedCollections}
              onChange={e => setSelectedCollections(e.target.value as string[])}
              input={<OutlinedInput label="Collections" />}
              renderValue={selected => selected.join(', ')}
            >
              <MenuItem value="all">
                <Checkbox
                  checked={aliases.length > 0 && selectedCollections.length === aliases.length}
                  onChange={handleSelectAll}
                />
                <ListItemText primary="Select All" />
              </MenuItem>
              {aliases.map(alias => (
                <MenuItem key={alias} value={alias}>
                  <Checkbox checked={selectedCollections.includes(alias)} />
                  <ListItemText primary={alias} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Autocomplete
            freeSolo
            options={availablePermissions}
            inputValue={newPermission}
            onInputChange={(_, val) => setNewPermission(val)}
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
          label="Search by collection or permission"
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
          getRowId={row => `${row.solr_database_id}-${row.collection_name}-${row.permission}`}
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

export default SolrDatabasePermissions;
