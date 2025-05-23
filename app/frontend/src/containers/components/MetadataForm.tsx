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
  Chip,
  Typography,
} from '@mui/material';
import { Remove, Star, AutoAwesome } from '@mui/icons-material';
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

interface NeighborsResponse {
  neighbors: Array<{
    word: string;
    similarity?: number;
  }>;
  has_embeddings: boolean;
  query_word: string;
  k: number;
  threshold: number;
}

interface SimilarityResponse {
  word1: string;
  word2: string;
  similarity: number;
  metric: string;
  both_found: boolean;
}

interface AnalogyResponse {
  analogy: string;
  candidates: Array<{
    word: string;
    similarity?: number;
  }>;
  all_words_found: boolean;
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
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [similarityWord1, setSimilarityWord1] = useState('');
  const [similarityWord2, setSimilarityWord2] = useState('');
  const [analogyWordA, setAnalogyWordA] = useState('');
  const [analogyWordB, setAnalogyWordB] = useState('');
  const [analogyWordC, setAnalogyWordC] = useState('');
  const [similarityResult, setSimilarityResult] = useState<SimilarityResponse | null>(null);
  const [analogyResult, setAnalogyResult] = useState<AnalogyResponse | null>(null);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
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
      const response = await axios.post<NeighborsResponse>('/api/embeddings/neighbors', {
        word: inputValue,
        solr_database_id: solrDatabaseId,
        collection_name: selectedAlias,
        k: 10,
        threshold: 0.3,
        include_scores: true,
        metric: 'cosine',
      }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.data.has_embeddings && response.data.neighbors.length > 0) {
        setNeighbors(prev => ({
          ...prev,
          [fieldName]: response.data.neighbors.map(n => n.word),
        }));
      } else {
        console.warn('No embeddings available or no neighbors found');
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

  const computeSimilarity = async () => {
    if (!similarityWord1 || !similarityWord2 || !solrDatabaseId || !hasEmbeddings) return;
    setEmbeddingLoading(true);
    try {
      const response = await axios.post<SimilarityResponse>('/api/embeddings/similarity', {
        word1: similarityWord1,
        word2: similarityWord2,
        solr_database_id: solrDatabaseId,
        collection_name: selectedAlias,
        metric: 'cosine',
      }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSimilarityResult(response.data);
    } catch (error) {
      console.error('Error computing similarity:', error);
    } finally {
      setEmbeddingLoading(false);
    }
  };

  const computeAnalogy = async () => {
    if (!analogyWordA || !analogyWordB || !analogyWordC || !solrDatabaseId || !hasEmbeddings) return;
    setEmbeddingLoading(true);
    try {
      const response = await axios.post<AnalogyResponse>('/api/embeddings/analogy', {
        word_a: analogyWordA,
        word_b: analogyWordB,
        word_c: analogyWordC,
        solr_database_id: solrDatabaseId,
        collection_name: selectedAlias,
        k: 5,
      }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setAnalogyResult(response.data);
    } catch (error) {
      console.error('Error computing analogy:', error);
    } finally {
      setEmbeddingLoading(false);
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
        {/* Embedding Tools Banner */}
        {hasEmbeddings && (
          <Box sx={{ 
            p: 2, 
            backgroundColor: 'primary.main', 
            color: 'white', 
            borderRadius: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesome />
              <Typography variant="subtitle1">
                Embeddings Available - Use the ⭐ button for semantic search
              </Typography>
            </Box>
            <Button 
              variant="outlined" 
              sx={{ color: 'white', borderColor: 'white' }}
              onClick={() => setEmbeddingModalOpen(true)}
            >
              Embedding Tools
            </Button>
          </Box>
        )}

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
                                    title="Find similar words using embeddings"
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
                          <Typography variant="subtitle2" gutterBottom>
                            Similar words:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                            {neighbors[field.name].map((neighbor, index) => (
                              <Chip
                                key={index}
                                label={neighbor}
                                size="small"
                                clickable
                                onClick={() => handleSelectChange(field.name, neighbor)}
                                sx={{ cursor: 'pointer' }}
                              />
                            ))}
                          </Box>
                          <Button 
                            size="small" 
                            onClick={() => removeNeighborDropdown(field.name)}
                          >
                            Hide Similar Words
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

      {/* Code Generation Modal */}
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

      {/* Embedding Tools Modal */}
      <Dialog 
        open={embeddingModalOpen} 
        onClose={() => setEmbeddingModalOpen(false)} 
        fullWidth 
        maxWidth="md"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome />
            Embedding Tools
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Word Similarity */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Word Similarity
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <TextField
                  label="Word 1"
                  value={similarityWord1}
                  onChange={(e) => setSimilarityWord1(e.target.value)}
                  size="small"
                />
                <TextField
                  label="Word 2"
                  value={similarityWord2}
                  onChange={(e) => setSimilarityWord2(e.target.value)}
                  size="small"
                />
                <Button
                  variant="contained"
                  onClick={computeSimilarity}
                  disabled={!similarityWord1 || !similarityWord2 || embeddingLoading}
                >
                  {embeddingLoading ? <CircularProgress size={20} /> : 'Compare'}
                </Button>
              </Box>
              {similarityResult && (
                <Box sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                  <Typography>
                    Similarity between "{similarityResult.word1}" and "{similarityResult.word2}": 
                    <strong> {(similarityResult.similarity * 100).toFixed(1)}%</strong>
                  </Typography>
                  {!similarityResult.both_found && (
                    <Typography color="warning.main">
                      Note: One or both words were not found in the embeddings
                    </Typography>
                  )}
                </Box>
              )}
            </Grid>

            {/* Word Analogy */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Word Analogy (A is to B as C is to ?)
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Word A"
                  value={analogyWordA}
                  onChange={(e) => setAnalogyWordA(e.target.value)}
                  size="small"
                />
                <Typography>is to</Typography>
                <TextField
                  label="Word B"
                  value={analogyWordB}
                  onChange={(e) => setAnalogyWordB(e.target.value)}
                  size="small"
                />
                <Typography>as</Typography>
                <TextField
                  label="Word C"
                  value={analogyWordC}
                  onChange={(e) => setAnalogyWordC(e.target.value)}
                  size="small"
                />
                <Typography>is to ?</Typography>
                <Button
                  variant="contained"
                  onClick={computeAnalogy}
                  disabled={!analogyWordA || !analogyWordB || !analogyWordC || embeddingLoading}
                >
                  {embeddingLoading ? <CircularProgress size={20} /> : 'Solve'}
                </Button>
              </Box>
              {analogyResult && (
                <Box sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {analogyResult.analogy}
                  </Typography>
                  {analogyResult.candidates.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {analogyResult.candidates.map((candidate, index) => (
                        <Chip
                          key={index}
                          label={`${candidate.word}${candidate.similarity ? ` (${(candidate.similarity * 100).toFixed(1)}%)` : ''}`}
                          variant={index === 0 ? 'filled' : 'outlined'}
                          color={index === 0 ? 'primary' : 'default'}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography color="warning.main">
                      No analogies found or words not in embeddings
                    </Typography>
                  )}
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmbeddingModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MetadataForm;