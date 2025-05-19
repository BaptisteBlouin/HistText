// src/components/ComputeWordEmbeddings.tsx
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
  'compute-word-embeddings': 'Command to compute word embeddings from a collection',
  collection: 'Solr collection name',
  'output-file': 'Output file path for the embeddings',
  'text-field': 'Solr field containing plain text',
  'auto-config': 'Automatically configure the embedding parameters',
  'no-header': 'Skip header in output file',
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

const ComputeWordEmbeddings: React.FC = () => {
  const authAxios = useAuthAxios();

  // --- Solr DB + aliases + selected collection
  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedSolrDb, setSelectedSolrDb] = useState<SolrDatabase | null>(null);
  const [collectionName, setCollectionName] = useState('');

  // --- host / port / output
  const [solrHost, setSolrHost] = useState('localhost');
  const [solrPort, setSolrPort] = useState<number | ''>(8983);
  const [outputDir, setOutputDir] = useState('');
  const [outputName, setOutputName] = useState('');

  // --- Embeddings specific fields
  const [textField, setTextField] = useState('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [autoConfig, setAutoConfig] = useState(true);
  const [noHeader, setNoHeader] = useState(true);

  // --- Command storage
  const [embeddingsCommand, setEmbeddingsCommand] = useState('');
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
    setOutputName('');
  }, [selectedSolrDb, authAxios]);

  // When collection changes, fetch available text fields and set output name
  useEffect(() => {
    if (!collectionName) {
      setAvailableFields([]);
      return;
    }

    // Set output name to collection name by default
    setOutputName(collectionName);

    if (!selectedSolrDb) {
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
      !!textField &&
      !!outputDir &&
      !!outputName &&
      !!solrHost &&
      solrPort !== ''
    );
  }, [collectionName, textField, outputDir, outputName, solrHost, solrPort]);

  const handleGenerate = () => {
    // Generate Embeddings command
    let embeddingsCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} compute-word-embeddings "${collectionName}" "${outputDir}/${outputName}" --text-field "${textField}"`;

    // Add flags
    if (autoConfig) embeddingsCmd += ` --auto-config`;
    if (noHeader) embeddingsCmd += ` --no-header`;

    setEmbeddingsCommand(embeddingsCmd);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Compute Word Embeddings Command
      </Typography>

      <Typography paragraph color="textSecondary">
        Generate commands to compute word embeddings from texts in a Solr collection.
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

          {/* Host / Port */}
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

          {/* Output location */}
          <TextField
            label="Output Directory"
            value={outputDir}
            onChange={e => setOutputDir(e.target.value)}
            sx={{ minWidth: 200 }}
            required
            error={!outputDir}
            helperText={!outputDir && 'Required'}
          />
          <TextField
            label="Output Name"
            value={outputName}
            onChange={e => setOutputName(e.target.value)}
            sx={{ minWidth: 200 }}
            required
            error={!outputName}
            helperText={!outputName ? 'Required' : 'Default: same as Collection Name'}
          />

          {/* Embeddings specific fields */}
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

          <FormControlLabel
            control={
              <Checkbox checked={autoConfig} onChange={e => setAutoConfig(e.target.checked)} />
            }
            label="Auto Config"
          />

          <FormControlLabel
            control={<Checkbox checked={noHeader} onChange={e => setNoHeader(e.target.checked)} />}
            label="No Header"
          />

          <Button
            variant="contained"
            sx={{ alignSelf: 'center', mt: 1 }}
            onClick={handleGenerate}
            disabled={!isFormValid}
          >
            Generate Command
          </Button>
        </Box>
      </Paper>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>compute-word-embeddings — Command‐Line Arguments</DialogTitle>
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

      {embeddingsCommand && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Word Embeddings Command
            </Typography>
            <Box>
              <Tooltip title="Copy Word Embeddings command">
                <IconButton onClick={() => navigator.clipboard.writeText(embeddingsCommand)}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Save to file">
                <IconButton
                  onClick={() => {
                    const blob = new Blob([embeddingsCommand], {
                      type: 'text/plain',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `word_embeddings_command_${collectionName}.sh`;
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
            value={embeddingsCommand}
            InputProps={{ readOnly: true }}
          />

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                const fullScript = `#!/bin/bash\n\n# Word Embeddings Command\n${embeddingsCommand}\n\nif [ $? -eq 0 ]; then\n  echo "Word embeddings computation completed successfully."\nelse\n  echo "Word embeddings computation failed."\n  exit 1\nfi\n\necho "Output saved to ${outputDir}/${outputName}"`;

                const blob = new Blob([fullScript], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `run_word_embeddings_${collectionName}.sh`;
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

export default ComputeWordEmbeddings;
