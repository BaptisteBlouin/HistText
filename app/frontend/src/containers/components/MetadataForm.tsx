import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  TextField,
  Grid,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Remove, Star } from '@mui/icons-material';
import axios from 'axios';
import config from '../../../config.json';
import { buildQueryString } from './buildQueryString';
import { useAuth } from '../../hooks/useAuth';

type StatsLevel = (typeof config.statsLevelOptions)[number];
type DocLevel = (typeof config.docLevelOptions)[number];

interface MetadataFormProps {
  metadata: any[];
  formData: {
    [key: string]: { value: string; operator: string; not?: boolean }[];
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      [key: string]: { value: string; operator: string; not?: boolean }[];
    }>
  >;
  dateRange: { min: string; max: string } | null;
  handleQuery: (
    e: React.FormEvent,
    onlyComputeStats: boolean,
    getNER: boolean,
    downloadOnly: boolean,
    statsLevel: StatsLevel,
    docLevel: DocLevel,
  ) => void;
  getNER: boolean;
  setGetNER: React.Dispatch<React.SetStateAction<boolean>>;
  downloadOnly: boolean;
  setdownloadOnly: React.Dispatch<React.SetStateAction<boolean>>;
  statsLevel: StatsLevel;
  setStatsLevel: React.Dispatch<React.SetStateAction<StatsLevel>>;
  docLevel: DocLevel;
  setDocLevel: React.Dispatch<React.SetStateAction<DocLevel>>;
  solrDatabaseId: number | null;
  selectedAlias: string;
}

interface CollectionInfo {
  solr_database_id: number;
  collection_name: string;
  description: string;
  embeddings: string;
  lang: string | null;
  text_field: string;
  tokenizer: string | null;
  to_not_display: string[];
}

const MetadataForm: React.FC<MetadataFormProps> = ({
  metadata,
  formData,
  setFormData,
  dateRange,
  handleQuery,
  getNER,
  setGetNER,
  downloadOnly,
  setdownloadOnly,
  statsLevel,
  setStatsLevel,
  docLevel,
  setDocLevel,
  solrDatabaseId,
  selectedAlias,
}) => {
  const [onlyComputeStats, setOnlyComputeStats] = useState<boolean>(false);
  const [neighbors, setNeighbors] = useState<{ [key: string]: string[] }>({});
  const [loadingNeighbors, setLoadingNeighbors] = useState<{
    [key: string]: boolean;
  }>({});
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeModalTitle, setCodeModalTitle] = useState('');
  const [codeModalContent, setCodeModalContent] = useState('');
  const [collectionInfo, setCollectionInfo] = useState<CollectionInfo | null>(null);
  const [hasEmbeddings, setHasEmbeddings] = useState<boolean>(false);
  const { accessToken } = useAuth();

  // Fetch collection info when solrDatabaseId and selectedAlias are available
  useEffect(() => {
    if (solrDatabaseId && selectedAlias) {
      axios
        .get(`/api/solr_database_info/${solrDatabaseId}/${selectedAlias}`)
        .then(response => {
          setCollectionInfo(response.data);
          setHasEmbeddings(response.data.embeddings !== 'none');
        })
        .catch(error => {
          console.error('Failed to fetch collection info:', error);
          setCollectionInfo(null);
          setHasEmbeddings(false);
        });
    } else {
      setCollectionInfo(null);
      setHasEmbeddings(false);
    }
  }, [solrDatabaseId, selectedAlias]);

  useEffect(() => {
    const initializedFormData: any = {};
    metadata.forEach((field: any) => {
      if (!formData[field.name]) {
        initializedFormData[field.name] = [{ value: '', operator: '', not: false }];
      }
    });
    setFormData((prevData: any) => ({ ...prevData, ...initializedFormData }));
  }, [metadata, setFormData, formData]);

  const fetchNeighbors = async (inputValue: string, fieldName: string) => {
    if (!inputValue || !solrDatabaseId || !hasEmbeddings) return;
    setLoadingNeighbors(prev => ({ ...prev, [fieldName]: true }));
    try {
      const response = await axios.post('/api/compute-neighbors', {
        word: inputValue,
        solr_database_id: solrDatabaseId,
        collection_name: selectedAlias,
      });

      if (response.data.has_embeddings) {
        setNeighbors(prev => ({
          ...prev,
          [fieldName]: response.data.top_neighbors,
        }));
      } else {
        console.warn('No embeddings available for this collection');
        setNeighbors(prev => {
          const newNeighbors = { ...prev };
          delete newNeighbors[fieldName];
          return newNeighbors;
        });
      }
    } catch (error) {
      console.error('Error fetching neighbors:', error);
    } finally {
      setLoadingNeighbors(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const handleFormChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }
    >,
    index: number,
  ) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name!]: (prev[name!] || []).map((entry, i) =>
        i === index ? { ...entry, value: value.toString() } : entry,
      ),
    }));
  };

  const handleSelectChange = (fieldName: string, newValue: string | null, index: number = 0) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: (prev[fieldName] || []).map((entry, i) =>
        i === index ? { ...entry, value: newValue || '' } : entry,
      ),
    }));
  };

  const removeNeighborDropdown = (fieldName: string) => {
    setNeighbors(prev => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  };

  const addBooleanField = (name: string, operator: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: [...(prev[name] || []), { value: '', operator, not: false }],
    }));
  };

  const removeBooleanField = (name: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [name]: (prev[name] || []).filter((_, i) => i !== index),
    }));
  };

  const toggleNotCondition = (name: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [name]: (prev[name] || []).map((entry, i) =>
        i === index ? { ...entry, not: !entry.not } : entry,
      ),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(e, onlyComputeStats, getNER, downloadOnly, statsLevel, docLevel);
  };

  const openCodeModal = (title: string, code: string) => {
    setCodeModalTitle(title);
    setCodeModalContent(code);
    setCodeModalOpen(true);
  };

  const handleCreateCurl = (e: React.MouseEvent) => {
    e.preventDefault();
    const queryString = buildQueryString(formData, dateRange);
    if (!queryString) {
      alert('Query string is empty.');
      return;
    }
    const batchSize = config.batch_size;
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(queryString)}&start=0&rows=${batchSize}&get_ner=${getNER}&download_only=${downloadOnly}&stats_level=${statsLevel}&solr_database_id=${solrDatabaseId}&is_first=true`;
    const curlCommand = `curl -H "Authorization: Bearer ${accessToken}" "${url}"`;
    openCodeModal('Curl Command', curlCommand);
  };

  const handleBuildPython = (e: React.MouseEvent) => {
    e.preventDefault();
    const queryString = buildQueryString(formData, dateRange);
    const batchSize = config.batch_size;
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(queryString)}&start=0&rows=${batchSize}&get_ner=${getNER}&download_only=${downloadOnly}&stats_level=${statsLevel}&solr_database_id=${solrDatabaseId}&is_first=true`;
    const pythonScript = `
import requests
import pandas as pd

url = "${url}"
token = "${accessToken}"
headers = {"Authorization": "Bearer "+token}
response = requests.get(url, headers=headers)
data = response.json()
docs = data.get("solr_response", {}).get("response", {}).get("docs", [])
df = pd.DataFrame(docs)
print(df)
    `.trim();
    openCodeModal('Python Script', pythonScript);
  };

  const handleBuildR = (e: React.MouseEvent) => {
    e.preventDefault();
    const queryString = buildQueryString(formData, dateRange);
    const batchSize = config.batch_size;
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(queryString)}&start=0&rows=${batchSize}&get_ner=${getNER}&download_only=${downloadOnly}&stats_level=${statsLevel}&solr_database_id=${solrDatabaseId}&is_first=true`;
    const rScript = `
library(httr)
library(jsonlite)

url <- "${url}"
token <- "${accessToken}"
response <- GET(url, add_headers(Authorization = paste("Bearer", token)))
data <- content(response, "text", encoding = "UTF-8")
parsed <- fromJSON(data)
df <- as.data.frame(parsed$solr_response$response$docs)
print(df)
    `.trim();
    openCodeModal('R Script', rScript);
  };

  const shouldExcludeField = (fieldName: string) => {
    // Exclude date fields
    if (
      fieldName.toLowerCase().includes('date') ||
      fieldName.toLowerCase().includes('year') ||
      fieldName.toLowerCase().includes('month') ||
      fieldName.toLowerCase().includes('day')
    ) {
      return true;
    }

    // Exclude fields in to_not_display array from collectionInfo
    if (collectionInfo?.to_not_display && collectionInfo.to_not_display.includes(fieldName)) {
      return true;
    }

    return false;
  };

  // Check if the field is the text_field from collectionInfo
  const isTextField = (fieldName: string) => {
    return collectionInfo?.text_field === fieldName;
  };

  return (
    <>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 2,
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Grid container spacing={2}>
          {metadata
            .filter(field => !shouldExcludeField(field.name))
            .map(field => (
              <Grid item xs={12} sm={6} md={4} key={field.name}>
                <FormControl fullWidth>
                  {field.possible_values?.length > 0 ? (
                    <Box>
                      {formData[field.name]?.map((entry, idx) => (
                        <Box
                          key={`${field.name}-${idx}`}
                          sx={{
                            mt: idx > 0 ? 1 : 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => toggleNotCondition(field.name, idx)}
                            sx={{
                              borderColor: entry.not ? 'red' : 'grey',
                              color: entry.not ? 'red' : 'grey',
                              minWidth: '50px',
                            }}
                          >
                            NOT
                          </Button>
                          <Box
                            sx={{
                              flexGrow: 1,
                              ...(entry.operator === 'AND' && {
                                border: '2px solid green',
                              }),
                              ...(entry.operator === 'OR' && {
                                border: '2px solid blue',
                              }),
                              ...(entry.not && { border: '2px solid red' }),
                              borderRadius: '4px',
                            }}
                          >
                            <Autocomplete
                              options={field.possible_values}
                              value={entry.value || null}
                              onChange={(_, newValue) =>
                                handleSelectChange(field.name, newValue, idx)
                              }
                              renderInput={params => (
                                <TextField
                                  {...params}
                                  label={field.name}
                                  InputLabelProps={{
                                    shrink: true,
                                    sx: isTextField(field.name)
                                      ? {
                                          fontWeight: 'bold',
                                          color: 'primary.main',
                                        }
                                      : {},
                                  }}
                                />
                              )}
                            />
                          </Box>
                          {idx > 0 && (
                            <Button onClick={() => removeBooleanField(field.name, idx)}>
                              <Remove />
                            </Button>
                          )}
                          {idx === formData[field.name].length - 1 && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="outlined"
                                onClick={() => addBooleanField(field.name, 'AND')}
                                sx={{ borderColor: 'green', color: 'green' }}
                              >
                                AND
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={() => addBooleanField(field.name, 'OR')}
                                sx={{ borderColor: 'blue', color: 'blue' }}
                              >
                                OR
                              </Button>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Box>
                      {formData[field.name]?.map((entry, idx) => (
                        <Box
                          key={`${field.name}-${idx}`}
                          sx={{
                            mt: idx > 0 ? 1 : 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => toggleNotCondition(field.name, idx)}
                            sx={{
                              borderColor: entry.not ? 'red' : 'grey',
                              color: entry.not ? 'red' : 'grey',
                              minWidth: '50px',
                            }}
                          >
                            NOT
                          </Button>
                          <Box
                            sx={{
                              flexGrow: 1,
                              ...(entry.operator === 'AND' && {
                                border: '2px solid green',
                              }),
                              ...(entry.operator === 'OR' && {
                                border: '2px solid blue',
                              }),
                              ...(entry.not && { border: '2px solid red' }),
                              borderRadius: '4px',
                            }}
                          >
                            <TextField
                              name={field.name}
                              value={entry.value}
                              label={field.name}
                              onChange={e => handleFormChange(e, idx)}
                              fullWidth
                              InputLabelProps={{
                                shrink: true,
                                sx: isTextField(field.name)
                                  ? {
                                      fontWeight: 'bold',
                                      color: 'primary.main',
                                    }
                                  : {},
                              }}
                              InputProps={{
                                sx: isTextField(field.name)
                                  ? {
                                      fontWeight: 'bold',
                                    }
                                  : {},
                                endAdornment: idx === 0 && hasEmbeddings && (
                                  <IconButton
                                    onClick={() => fetchNeighbors(entry.value, field.name)}
                                    disabled={loadingNeighbors[field.name] || !entry.value}
                                  >
                                    {loadingNeighbors[field.name] ? (
                                      <CircularProgress size={20} />
                                    ) : (
                                      <Star />
                                    )}
                                  </IconButton>
                                ),
                              }}
                            />
                          </Box>
                          {idx > 0 && (
                            <Button onClick={() => removeBooleanField(field.name, idx)}>
                              <Remove />
                            </Button>
                          )}
                          {idx === formData[field.name].length - 1 && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="outlined"
                                onClick={() => addBooleanField(field.name, 'AND')}
                                sx={{ borderColor: 'green', color: 'green' }}
                              >
                                AND
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={() => addBooleanField(field.name, 'OR')}
                                sx={{ borderColor: 'blue', color: 'blue' }}
                              >
                                OR
                              </Button>
                            </Box>
                          )}
                        </Box>
                      ))}
                      {neighbors[field.name] && (
                        <Box sx={{ mt: 1 }}>
                          <Autocomplete
                            options={neighbors[field.name]}
                            onChange={(_, newValue) => handleSelectChange(field.name, newValue)}
                            renderInput={params => (
                              <TextField
                                {...params}
                                label="Select a neighbor"
                                InputLabelProps={{ shrink: true }}
                              />
                            )}
                          />
                          <Button onClick={() => removeNeighborDropdown(field.name)} sx={{ mt: 1 }}>
                            Remove Neighbors
                          </Button>
                        </Box>
                      )}
                    </Box>
                  )}
                </FormControl>
              </Grid>
            ))}
          {dateRange && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Start Date"
                  type="date"
                  name="min_date"
                  value={formData.min_date?.[0]?.value || dateRange.min.split('T')[0]}
                  onChange={e => handleFormChange(e, 0)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="End Date"
                  type="date"
                  name="max_date"
                  value={formData.max_date?.[0]?.value || dateRange.max.split('T')[0]}
                  onChange={e => handleFormChange(e, 0)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>
            </Grid>
          )}
          <Grid item xs={12}>
            <FormControlLabel
              control={<Checkbox checked={getNER} onChange={e => setGetNER(e.target.checked)} />}
              label="Apply Named Entity Recognition"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={downloadOnly}
                  onChange={e => setdownloadOnly(e.target.checked)}
                />
              }
              label="Only download the content"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={config.statsLevelOptions}
              value={statsLevel}
              onChange={(_, newValue) => newValue && setStatsLevel(newValue)}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Statistics Level"
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={config.docLevelOptions}
              value={docLevel}
              onChange={(_, newValue) => newValue && setDocLevel(newValue)}
              renderInput={params => (
                <TextField {...params} label="Document Level" InputLabelProps={{ shrink: true }} />
              )}
            />
          </Grid>
          <Grid
            item
            xs={12}
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Button variant="contained" color="primary" type="submit">
              Query
            </Button>
            <Button variant="outlined" onClick={handleCreateCurl}>
              Create Curl
            </Button>
            <Button variant="outlined" onClick={handleBuildPython}>
              Build Python
            </Button>
            <Button variant="outlined" onClick={handleBuildR}>
              Build R
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Dialog open={codeModalOpen} onClose={() => setCodeModalOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{codeModalTitle}</DialogTitle>
        <DialogContent dividers>
          <pre
            style={{
              backgroundColor: '#f6f8fa',
              padding: '16px',
              borderRadius: '6px',
              overflowX: 'auto',
              fontFamily: 'monospace',
            }}
          >
            <code>{codeModalContent}</code>
          </pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCodeModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MetadataForm;
