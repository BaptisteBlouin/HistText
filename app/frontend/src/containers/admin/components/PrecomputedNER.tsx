// src/components/PrecomputeNER.tsx
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
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  IconButton,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface SolrDatabase {
  id: number;
  name: string;
}

const ARG_DESCRIPTIONS: Record<string, string> = {
  'solr-host': 'Solr host (default: localhost)',
  'solr-port': 'Solr port (default: 8983)',
  'cache-dir': 'Root directory where JSONL will be cached',
  'precompute-ner': 'Command to precompute NER for a collection',
  collection: 'Solr collection name',
  'model-name': 'Model name or path to use for NER',
  'cache-model-name': 'Short name used inside cache hierarchy',
  'model-type': 'Type of model to use (spacy, transformers, etc.)',
  'text-field': 'Solr field containing plain text',
  'filter-query': 'Additional Solr fq to restrict documents',
  'batch-size': 'Number of Solr docs per batch',
  nbatches: 'Limit number of batches (None = all)',
  upload: 'Command to upload processed files to Solr',
  schema: 'Schema file to use for upload',
};

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

const PrecomputeNER: React.FC = () => {
  const authAxios = useAuthAxios();

  // --- Solr DB + aliases + selected collection
  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedSolrDb, setSelectedSolrDb] = useState<SolrDatabase | null>(null);
  const [collectionName, setCollectionName] = useState('');

  // --- host / port / cache dir
  const [solrHost, setSolrHost] = useState('localhost');
  const [solrPort, setSolrPort] = useState<number | ''>(8983);
  const [cacheDir, setCacheDir] = useState('');

  // --- NER specific fields
  const [modelName, setModelName] = useState('');
  const [cacheModelName, setCacheModelName] = useState('');
  const [modelType, setModelType] = useState('');
  const [textField, setTextField] = useState('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);

  // Update cache model name when model name changes
  useEffect(() => {
    if (modelName && !cacheModelName) {
      setCacheModelName(modelName);
    }
  }, [modelName, cacheModelName]);

  // --- Optional arguments
  const [filterQuery, setFilterQuery] = useState('');
  const [batchSize, setBatchSize] = useState<number | ''>(1000);
  const [nbatches, setNbatches] = useState<number | ''>('');

  // --- Command storage
  const [nerCommand, setNerCommand] = useState('');
  const [uploadCommand, setUploadCommand] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  // fetch DB list once
  useEffect(() => {
    authAxios
      .get('/api/solr_databases')
      .then(({ data }) => setSolrDatabases(data))
      .catch(() => setSolrDatabases([]));
  }, [authAxios]);

  // when DB changes, reload aliases & clear collectionName
  useEffect(() => {
    if (!selectedSolrDb) {
      setAliases([]);
      setCollectionName('');
      setAvailableFields([]);
      return;
    }
    authAxios
      .get<string[]>(`/api/solr/aliases?solr_database_id=${selectedSolrDb.id}`)
      .then(({ data }) => setAliases(Array.isArray(data) ? data : []))
      .catch(() => setAliases([]));
    setCollectionName('');
    setAvailableFields([]);
  }, [selectedSolrDb, authAxios]);

  // When collection changes, fetch available text fields
  useEffect(() => {
    if (!selectedSolrDb || !collectionName) {
      setAvailableFields([]);
      return;
    }

    // Fetch collection metadata to get field names
    authAxios
      .get(
        `/api/solr/collection_metadata?collection=${encodeURIComponent(collectionName)}&solr_database_id=${selectedSolrDb.id}`,
      )
      .then(({ data }) => {
        if (data && Array.isArray(data)) {
          // Extract field names from the metadata
          const fieldNames = data.map((field: any) => field.name);
          setAvailableFields(fieldNames);

          // Try to auto-detect a suitable text field if none is selected
          if (!textField) {
            const textFieldCandidates = fieldNames.filter(
              field =>
                field.includes('text') ||
                field.includes('content') ||
                field.includes('body') ||
                field.includes('description'),
            );

            if (textFieldCandidates.length > 0) {
              setTextField(textFieldCandidates[0]);
            }
          }
        }
      })
      .catch(error => {
        console.error('Failed to fetch collection metadata:', error);
        setAvailableFields([]);
      });
  }, [selectedSolrDb, collectionName, authAxios, textField]);

  // form validation
  const isFormValid = useMemo(() => {
    return (
      !!collectionName &&
      !!modelName &&
      !!cacheModelName &&
      !!modelType &&
      !!textField &&
      !!cacheDir &&
      !!solrHost &&
      solrPort !== ''
    );
  }, [
    collectionName,
    modelName,
    cacheModelName,
    modelType,
    textField,
    cacheDir,
    solrHost,
    solrPort,
  ]);

  const handleGenerate = () => {
    // Generate NER command
    const nerCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} --cache-dir "${cacheDir}" precompute-ner "${collectionName}" --model-name "${modelName}" --cache-model-name "${cacheModelName}" --model-type "${modelType}" --text-field "${textField}"`;

    setNerCommand(nerCmd);

    // Generate Upload command
    const uploadCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} upload ${collectionName}-ner "${cacheDir}/${cacheModelName}/${collectionName}/${textField}/"*.jsonl --schema "${cacheDir}/${collectionName}.yaml"`;

    setUploadCommand(uploadCmd);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Precompute NER Command
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={() => setHelpOpen(true)}>
          Show CLI Help
        </Button>
      </Box>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {/* Solr DB selector */}
          <FormControl sx={{ minWidth: 200 }} required error={!selectedSolrDb}>
            <InputLabel required>Solr Database</InputLabel>
            <Select
              value={selectedSolrDb?.id ?? ''}
              label="Solr Database"
              onChange={e =>
                setSelectedSolrDb(
                  solrDatabases.find(db => db.id === Number(e.target.value)) || null,
                )
              }
            >
              {solrDatabases.map(db => (
                <MenuItem key={db.id} value={db.id}>
                  {db.name} (ID: {db.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Collection Autocomplete */}
          <Autocomplete
            freeSolo
            options={aliases}
            value={collectionName}
            inputValue={collectionName}
            onInputChange={(_, v) => setCollectionName(v)}
            onChange={(_, v) => setCollectionName(v || '')}
            renderInput={params => (
              <TextField
                {...params}
                label="Collection Name"
                required
                error={!collectionName}
                helperText={!collectionName && 'Required'}
              />
            )}
            sx={{ minWidth: 200 }}
          />

          {/* Host / Port / Cache Dir */}
          <TextField
            label="Solr Host"
            value={solrHost}
            onChange={e => setSolrHost(e.target.value)}
            sx={{ minWidth: 150 }}
            required
            error={!solrHost}
            helperText={!solrHost && 'Required'}
          />
          <TextField
            label="Solr Port"
            type="number"
            value={solrPort}
            onChange={e => setSolrPort(e.target.value === '' ? '' : +e.target.value)}
            sx={{ minWidth: 150 }}
            required
            error={solrPort === ''}
            helperText={solrPort === '' && 'Required'}
          />
          <TextField
            label="Cache Output Dir"
            value={cacheDir}
            onChange={e => setCacheDir(e.target.value)}
            sx={{ minWidth: 200 }}
            required
            error={!cacheDir}
            helperText={!cacheDir && 'Required'}
          />

          {/* NER specific fields */}
          <TextField
            label="Model Name"
            value={modelName}
            onChange={e => {
              setModelName(e.target.value);
              // If cache model name is empty or was previously matching the model name, update it
              if (!cacheModelName || cacheModelName === modelName) {
                setCacheModelName(e.target.value);
              }
            }}
            sx={{ minWidth: 200 }}
            required
            error={!modelName}
            helperText={!modelName && 'Required'}
          />
          <TextField
            label="Cache Model Name"
            value={cacheModelName}
            onChange={e => setCacheModelName(e.target.value)}
            sx={{ minWidth: 200 }}
            required
            error={!cacheModelName}
            helperText={!cacheModelName ? 'Required' : 'Default: same as Model Name'}
          />
          <FormControl sx={{ minWidth: 200 }} required error={!modelType}>
            <InputLabel required>Model Type</InputLabel>
            <Select
              value={modelType}
              label="Model Type"
              onChange={e => setModelType(e.target.value)}
            >
              <MenuItem value="spacy">spaCy</MenuItem>
              <MenuItem value="transformers">Transformers</MenuItem>
              <MenuItem value="gliner">GLiNER</MenuItem>
              <MenuItem value="stanza">Stanza</MenuItem>
              <MenuItem value="flair">Flair</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Text Field</InputLabel>
            <Select
              value={textField || ''}
              onChange={e => setTextField(e.target.value)}
              label="Text Field"
              disabled={availableFields.length === 0}
              required
              error={!textField}
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

          <Button
            variant="contained"
            sx={{ alignSelf: 'center', mt: 1 }}
            onClick={handleGenerate}
            disabled={!isFormValid}
          >
            Generate Commands
          </Button>
        </Box>
      </Paper>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>histtext_toolkit.main — Command‐Line Arguments</DialogTitle>
        <DialogContent dividers>
          <List dense>
            {Object.entries(ARG_DESCRIPTIONS).map(([arg, desc]) => (
              <ListItem key={arg} alignItems="flex-start">
                <ListItemText primary={<code>{arg}</code>} secondary={desc} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {nerCommand && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              NER Command
            </Typography>
            <Box>
              <Tooltip title="Copy NER command">
                <IconButton onClick={() => navigator.clipboard.writeText(nerCommand)}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Save to file">
                <IconButton
                  onClick={() => {
                    const blob = new Blob([nerCommand], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ner_command_${collectionName}.sh`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="24"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <path d="M0 0h24v24H0z" fill="none" />
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                  </svg>
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <TextField
            multiline
            fullWidth
            minRows={2}
            value={nerCommand}
            InputProps={{ readOnly: true }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Upload Command
            </Typography>
            <Box>
              <Tooltip title="Copy Upload command">
                <IconButton onClick={() => navigator.clipboard.writeText(uploadCommand)}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Save to file">
                <IconButton
                  onClick={() => {
                    const blob = new Blob([uploadCommand], {
                      type: 'text/plain',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `upload_command_${collectionName}.sh`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="24"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <path d="M0 0h24v24H0z" fill="none" />
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                  </svg>
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <TextField
            multiline
            fullWidth
            minRows={2}
            value={uploadCommand}
            InputProps={{ readOnly: true }}
          />

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                const fullScript = `#!/bin/bash\n\n# NER Command\n${nerCommand}\n\n# Check if NER command was successful\nif [ $? -eq 0 ]; then\n  echo "NER processing completed successfully. Starting upload..."\n  # Upload Command\n  ${uploadCommand}\nelse\n  echo "NER processing failed. Upload skipped."\n  exit 1\nfi`;

                const blob = new Blob([fullScript], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `run_ner_pipeline_${collectionName}.sh`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            >
              Download Complete Shell Script
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default PrecomputeNER;
