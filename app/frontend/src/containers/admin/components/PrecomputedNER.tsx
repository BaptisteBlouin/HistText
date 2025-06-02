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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  IconButton,
  Card,
  CardContent,
  Grid,
  Stack,
  Alert,
  useTheme,
  useMediaQuery,
  Fade,
  Chip,
  LinearProgress
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {
  ContentCopy,
  Download,
  Help,
  Psychology,
  Settings,
  PlayArrow,
  GetApp,
  Code,
  Memory,
  SmartToy
} from '@mui/icons-material';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

interface SolrDatabase {
  id: number;
  name: string;
}

/**
 * Maps CLI arguments to their descriptions for the help dialog.
 */
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

/**
 * useAuthAxios
 * 
 * Returns an Axios instance with Authorization header set.
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
 * PrecomputeNER
 * 
 * UI to generate command lines for precomputing and uploading NER data from a Solr collection.
 * Allows the user to configure all relevant options, get the full CLI, and download a script.
 */
const PrecomputeNER: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedSolrDb, setSelectedSolrDb] = useState<SolrDatabase | null>(null);
  const [collectionName, setCollectionName] = useState('');

  const [solrHost, setSolrHost] = useState('localhost');
  const [solrPort, setSolrPort] = useState<number | ''>(8983);
  const [cacheDir, setCacheDir] = useState('');

  const [modelName, setModelName] = useState('');
  const [cacheModelName, setCacheModelName] = useState('');
  const [modelType, setModelType] = useState('');
  const [textField, setTextField] = useState('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);

  const [filterQuery, setFilterQuery] = useState('');
  const [batchSize, setBatchSize] = useState<number | ''>(1000);
  const [nbatches, setNbatches] = useState<number | ''>('');

  const [nerCommand, setNerCommand] = useState('');
  const [uploadCommand, setUploadCommand] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sets the cache model name based on modelName when modelName is updated
  useEffect(() => {
    if (modelName && !cacheModelName) {
      setCacheModelName(modelName);
    }
  }, [modelName, cacheModelName]);

  // Load available Solr databases
  useEffect(() => {
    authAxios
      .get('/api/solr_databases')
      .then(({ data }) => setSolrDatabases(data))
      .catch(() => setSolrDatabases([]));
  }, [authAxios]);

  // Load aliases when a database is selected
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

  // Load available fields when a collection is chosen
  useEffect(() => {
    if (!selectedSolrDb || !collectionName) {
      setAvailableFields([]);
      return;
    }

    setLoading(true);
    authAxios
      .get(
        `/api/solr/collection_metadata?collection=${encodeURIComponent(collectionName)}&solr_database_id=${selectedSolrDb.id}`,
      )
      .then(({ data }) => {
        if (data && Array.isArray(data)) {
          const fieldNames = data.map((field: any) => field.name);
          setAvailableFields(fieldNames);

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
      })
      .finally(() => setLoading(false));
  }, [selectedSolrDb, collectionName, authAxios, textField]);

  /**
   * Returns true if the form is valid and a command can be generated.
   */
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

  /**
   * Generates the NER and upload command lines and saves them in state.
   */
  const handleGenerate = () => {
    const nerCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} --cache-dir "${cacheDir}" precompute-ner "${collectionName}" --model-name "${modelName}" --cache-model-name "${cacheModelName}" --model-type "${modelType}" --text-field "${textField}"`;

    setNerCommand(nerCmd);

    const uploadCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} upload ${collectionName}-ner "${cacheDir}/${cacheModelName}/${collectionName}/${textField}/"*.jsonl --schema "${cacheDir}/${collectionName}.yaml"`;

    setUploadCommand(uploadCmd);
  };

  return (
    <Fade in={true} timeout={600}>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartToy color="primary" />
              Named Entity Recognition
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Generate commands to precompute NER for texts in a Solr collection
            </Typography>
          </Box>
          <Tooltip title="Show CLI Help">
            <IconButton onClick={() => setHelpOpen(true)} color="primary">
              <Help />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Configuration Form */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Settings />
              Configuration
            </Typography>
            {loading && <LinearProgress sx={{ mb: 2 }} />}
            <Grid container spacing={3}>
              {/* Solr Database Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required error={!selectedSolrDb}>
                  <InputLabel>Solr Database</InputLabel>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Memory fontSize="small" />
                          {db.name}
                          <Chip label={`ID: ${db.id}`} size="small" variant="outlined" />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Collection Name (alias) Selection */}
              <Grid item xs={12} md={6}>
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
                />
              </Grid>

              {/* Solr Host */}
              <Grid item xs={12} md={3}>
                <TextField
                  label="Solr Host"
                  value={solrHost}
                  onChange={e => setSolrHost(e.target.value)}
                  fullWidth
                  required
                  error={!solrHost}
                  helperText={!solrHost && 'Required'}
                />
              </Grid>

              {/* Solr Port */}
              <Grid item xs={12} md={3}>
                <TextField
                  label="Solr Port"
                  type="number"
                  value={solrPort}
                  onChange={e => setSolrPort(e.target.value === '' ? '' : +e.target.value)}
                  fullWidth
                  required
                  error={solrPort === ''}
                  helperText={solrPort === '' && 'Required'}
                />
              </Grid>

              {/* Cache Output Directory */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Cache Output Directory"
                  value={cacheDir}
                  onChange={e => setCacheDir(e.target.value)}
                  fullWidth
                  required
                  error={!cacheDir}
                  helperText={!cacheDir && 'Required'}
                />
              </Grid>

              {/* Model Name */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Model Name"
                  value={modelName}
                  onChange={e => {
                    setModelName(e.target.value);
                    if (!cacheModelName || cacheModelName === modelName) {
                      setCacheModelName(e.target.value);
                    }
                  }}
                  fullWidth
                  required
                  error={!modelName}
                  helperText={!modelName && 'Required'}
                />
              </Grid>

              {/* Cache Model Name */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Cache Model Name"
                  value={cacheModelName}
                  onChange={e => setCacheModelName(e.target.value)}
                  fullWidth
                  required
                  error={!cacheModelName}
                  helperText={!cacheModelName ? 'Required' : 'Default: same as Model Name'}
                />
              </Grid>

              {/* Model Type Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required error={!modelType}>
                  <InputLabel>Model Type</InputLabel>
                  <Select
                    value={modelType}
                    label="Model Type"
                    onChange={e => setModelType(e.target.value)}
                  >
                    <MenuItem value="spacy">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SmartToy fontSize="small" />
                        spaCy
                      </Box>
                    </MenuItem>
                    <MenuItem value="transformers">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SmartToy fontSize="small" />
                        Transformers
                      </Box>
                    </MenuItem>
                    <MenuItem value="gliner">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SmartToy fontSize="small" />
                        GLiNER
                      </Box>
                    </MenuItem>
                    <MenuItem value="stanza">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SmartToy fontSize="small" />
                        Stanza
                      </Box>
                    </MenuItem>
                    <MenuItem value="flair">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SmartToy fontSize="small" />
                        Flair
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Text Field Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
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
              </Grid>

              {/* Generate Button */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleGenerate}
                  disabled={!isFormValid}
                  startIcon={<PlayArrow />}
                  fullWidth
                  size="large"
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    }
                  }}
                >
                  Generate NER Commands
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Help Dialog */}
        <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Help />
            histtext_toolkit.main — Command‐Line Arguments
          </DialogTitle>
          <DialogContent dividers>
            <List dense>
              {Object.entries(ARG_DESCRIPTIONS).map(([arg, desc]) => (
                <ListItem key={arg} alignItems="flex-start">
                  <ListItemText 
                    primary={
                      <Chip 
                        label={arg} 
                        variant="outlined" 
                        size="small" 
                        sx={{ fontFamily: 'monospace' }} 
                      />
                    } 
                    secondary={desc} 
                  />
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHelpOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* NER & Upload Command Output */}
        {nerCommand && (
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Code />
                    NER Command
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Copy NER Command">
                      <IconButton onClick={() => navigator.clipboard.writeText(nerCommand)}>
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Save to File">
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
                        <Download />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                <Paper sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
                  <TextField
                    multiline
                    fullWidth
                    minRows={3}
                    value={nerCommand}
                    InputProps={{ 
                      readOnly: true,
                      sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                    }}
                    variant="outlined"
                  />
                </Paper>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Code />
                    Upload Command
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Copy Upload Command">
                      <IconButton onClick={() => navigator.clipboard.writeText(uploadCommand)}>
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Save to File">
                      <IconButton
                        onClick={() => {
                          const blob = new Blob([uploadCommand], { type: 'text/plain' });
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
                        <Download />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                <Paper sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
                  <TextField
                    multiline
                    fullWidth
                    minRows={3}
                    value={uploadCommand}
                    InputProps={{ 
                      readOnly: true,
                      sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                    }}
                    variant="outlined"
                  />
                </Paper>
              </CardContent>
            </Card>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<GetApp />}
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
                size="large"
              >
                Download Complete Shell Script
              </Button>
            </Box>
          </Stack>
        )}
      </Box>
    </Fade>
  );
};

export default PrecomputeNER;
