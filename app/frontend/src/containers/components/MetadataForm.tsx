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
  Paper,
  Card,
  CardContent,
  Switch,
  Tooltip,
  Fab,
  Zoom,
  Alert,
  Collapse,
  Divider,
  Stack,
  ButtonGroup,
  MenuItem,
  Select
} from '@mui/material';
import { 
  Remove, 
  Star, 
  AutoAwesome, 
  Code, 
  GetApp,
  PlayArrow,
  Settings,
  Add,
  Close,
  Lightbulb,
  QueryStats
} from '@mui/icons-material';
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
  setFormData: React.Dispatch<React.SetStateAction<{
    [key: string]: { value: string; operator: string; not?: boolean }[];
  }>>;
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEmbeddingAlert, setShowEmbeddingAlert] = useState(false);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (solrDatabaseId && selectedAlias) {
      axios
        .get(`/api/solr_database_info/${solrDatabaseId}/${selectedAlias}`)
        .then(response => {
          setCollectionInfo(response.data);
          setHasEmbeddings(response.data.embeddings !== 'none');
          if (response.data.embeddings !== 'none') {
            setShowEmbeddingAlert(true);
          }
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
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>,
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
   handleQuery(e, false, getNER, downloadOnly, statsLevel, docLevel);
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
   openCodeModal('cURL Command', curlCommand);
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
headers = {"Authorization": "Bearer " + token}
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
   if (
     fieldName.toLowerCase().includes('date') ||
     fieldName.toLowerCase().includes('year') ||
     fieldName.toLowerCase().includes('month') ||
     fieldName.toLowerCase().includes('day')
   ) {
     return true;
   }

   if (collectionInfo?.to_not_display && collectionInfo.to_not_display.includes(fieldName)) {
     return true;
   }

   return false;
 };

 const isTextField = (fieldName: string) => {
   return collectionInfo?.text_field === fieldName;
 };

 return (
   <Box sx={{ width: '100%' }}>
     <Collapse in={hasEmbeddings && showEmbeddingAlert}>
       <Alert 
         severity="info" 
         icon={<AutoAwesome />}
         action={
           <Box sx={{ display: 'flex', gap: 1 }}>
             <Button 
               color="inherit" 
               size="small" 
               onClick={() => setEmbeddingModalOpen(true)}
               startIcon={<Lightbulb />}
             >
               Explore
             </Button>
             <IconButton
               aria-label="close"
               color="inherit"
               size="small"
               onClick={() => setShowEmbeddingAlert(false)}
             >
               <Close fontSize="inherit" />
             </IconButton>
           </Box>
         }
         sx={{ mb: 3 }}
       >
         <Typography variant="subtitle2" gutterBottom>
           Semantic Search Available
         </Typography>
         <Typography variant="body2">
           This collection has word embeddings enabled. Use the ⭐ button next to text fields for semantic search and explore advanced tools.
         </Typography>
       </Alert>
     </Collapse>

     <Card sx={{ mb: 3 }}>
       <CardContent>
         <Box component="form" onSubmit={handleSubmit}>
           <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <QueryStats />
             Search Fields
           </Typography>
           
           <Grid container spacing={3} sx={{ mb: 3 }}>
             {metadata
               .filter(field => !shouldExcludeField(field.name))
               .map(field => (
                 <Grid item xs={12} md={6} lg={4} key={field.name}>
                   <Paper 
                     variant="outlined" 
                     sx={{ 
                       p: 2, 
                       height: '100%',
                       border: isTextField(field.name) ? '2px solid' : '1px solid',
                       borderColor: isTextField(field.name) ? 'primary.main' : 'divider',
                       position: 'relative'
                     }}
                   >
                     {isTextField(field.name) && (
                       <Chip 
                         label="Primary Text Field" 
                         size="small" 
                         color="primary" 
                         sx={{ position: 'absolute', top: -10, left: 8, bgcolor: 'background.paper' }}
                       />
                     )}
                     
                     <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                       {field.name}
                     </Typography>

                     {field.possible_values?.length > 0 ? (
                       <Box>
                         {formData[field.name]?.map((entry, idx) => (
                           <Box key={`${field.name}-${idx}`} sx={{ mb: idx < formData[field.name].length - 1 ? 2 : 0 }}>
                             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                               <Tooltip title={entry.not ? "Exclude this value" : "Include this value"}>
                                 <Button
                                   variant={entry.not ? "contained" : "outlined"}
                                   color={entry.not ? "error" : "inherit"}
                                   size="small"
                                   onClick={() => toggleNotCondition(field.name, idx)}
                                   sx={{ minWidth: 60 }}
                                 >
                                   NOT
                                 </Button>
                               </Tooltip>
                               
                               <Box sx={{ flexGrow: 1 }}>
                                 <Autocomplete
                                   options={field.possible_values}
                                   value={entry.value || null}
                                   onChange={(_, newValue) => handleSelectChange(field.name, newValue, idx)}
                                   renderInput={(params) => (
                                     <TextField
                                       {...params}
                                       size="small"
                                       placeholder={`Select ${field.name}...`}
                                       sx={{
                                         '& .MuiOutlinedInput-root': {
                                           borderColor: entry.operator === 'AND' ? 'success.main' : 
                                                       entry.operator === 'OR' ? 'info.main' : 'inherit',
                                           borderWidth: entry.operator ? 2 : 1,
                                         }
                                       }}
                                     />
                                   )}
                                 />
                               </Box>

                               {idx > 0 && (
                                 <IconButton 
                                   onClick={() => removeBooleanField(field.name, idx)}
                                   size="small"
                                   color="error"
                                 >
                                   <Remove />
                                 </IconButton>
                               )}
                             </Box>

                             {idx === formData[field.name].length - 1 && (
                               <ButtonGroup size="small" variant="outlined">
                                 <Button
                                   onClick={() => addBooleanField(field.name, 'AND')}
                                   color="success"
                                   startIcon={<Add />}
                                 >
                                   AND
                                 </Button>
                                 <Button
                                   onClick={() => addBooleanField(field.name, 'OR')}
                                   color="info"
                                   startIcon={<Add />}
                                 >
                                   OR
                                 </Button>
                               </ButtonGroup>
                             )}
                           </Box>
                         ))}
                       </Box>
                     ) : (
                       <Box>
                         {formData[field.name]?.map((entry, idx) => (
                           <Box key={`${field.name}-${idx}`} sx={{ mb: idx < formData[field.name].length - 1 ? 2 : 0 }}>
                             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                               <Tooltip title={entry.not ? "Exclude this value" : "Include this value"}>
                                 <Button
                                   variant={entry.not ? "contained" : "outlined"}
                                   color={entry.not ? "error" : "inherit"}
                                   size="small"
                                   onClick={() => toggleNotCondition(field.name, idx)}
                                   sx={{ minWidth: 60 }}
                                 >
                                   NOT
                                 </Button>
                               </Tooltip>
                               
                               <Box sx={{ flexGrow: 1 }}>
                                 <TextField
                                   name={field.name}
                                   value={entry.value}
                                   onChange={e => handleFormChange(e, idx)}
                                   size="small"
                                   fullWidth
                                   placeholder={`Enter ${field.name}...`}
                                   InputProps={{
                                     endAdornment: idx === 0 && hasEmbeddings && (
                                       <Tooltip title="Find similar words using AI embeddings">
                                         <IconButton
                                           onClick={() => fetchNeighbors(entry.value, field.name)}
                                           disabled={loadingNeighbors[field.name] || !entry.value}
                                           size="small"
                                           color="primary"
                                         >
                                           {loadingNeighbors[field.name] ? (
                                             <CircularProgress size={16} />
                                           ) : (
                                             <Star />
                                           )}
                                         </IconButton>
                                       </Tooltip>
                                     ),
                                   }}
                                   sx={{
                                     '& .MuiOutlinedInput-root': {
                                       borderColor: entry.operator === 'AND' ? 'success.main' : 
                                                   entry.operator === 'OR' ? 'info.main' : 'inherit',
                                       borderWidth: entry.operator ? 2 : 1,
                                       fontWeight: isTextField(field.name) ? 600 : 'inherit',
                                     }
                                   }}
                                 />
                               </Box>

                               {idx > 0 && (
                                 <IconButton 
                                   onClick={() => removeBooleanField(field.name, idx)}
                                   size="small"
                                   color="error"
                                 >
                                   <Remove />
                                 </IconButton>
                               )}
                             </Box>

                             {neighbors[field.name] && idx === 0 && (
                               <Box sx={{ mb: 2 }}>
                                 <Typography variant="caption" color="text.secondary" gutterBottom display="block">
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
                                       sx={{ fontSize: '0.75rem' }}
                                     />
                                   ))}
                                 </Box>
                                 <Button 
                                   size="small" 
                                   variant="text"
                                   onClick={() => removeNeighborDropdown(field.name)}
                                 >
                                   Hide suggestions
                                 </Button>
                               </Box>
                             )}

                             {idx === formData[field.name].length - 1 && (
                               <ButtonGroup size="small" variant="outlined">
                                 <Button
                                   onClick={() => addBooleanField(field.name, 'AND')}
                                   color="success"
                                   startIcon={<Add />}
                                 >
                                   AND
                                 </Button>
                                 <Button
                                   onClick={() => addBooleanField(field.name, 'OR')}
                                   color="info"
                                   startIcon={<Add />}
                                 >
                                   OR
                                 </Button>
                               </ButtonGroup>
                             )}
                           </Box>
                         ))}
                       </Box>
                     )}
                   </Paper>
                 </Grid>
               ))}
           </Grid>

           {dateRange && (
             <Card variant="outlined" sx={{ mb: 3 }}>
               <CardContent>
                 <Typography variant="subtitle2" gutterBottom>
                   Date Range Filter
                 </Typography>
                 <Grid container spacing={2}>
                   <Grid item xs={12} md={6}>
                     <TextField
                       label="Start Date"
                       type="date"
                       name="min_date"
                       value={formData.min_date?.[0]?.value || dateRange.min.split('T')[0]}
                       onChange={e => handleFormChange(e, 0)}
                       InputLabelProps={{ shrink: true }}
                       fullWidth
                       size="small"
                     />
                   </Grid>
                   <Grid item xs={12} md={6}>
                     <TextField
                       label="End Date"
                       type="date"
                       name="max_date"
                       value={formData.max_date?.[0]?.value || dateRange.max.split('T')[0]}
                       onChange={e => handleFormChange(e, 0)}
                       InputLabelProps={{ shrink: true }}
                       fullWidth
                       size="small"
                     />
                   </Grid>
                 </Grid>
               </CardContent>
             </Card>
           )}

           <Card variant="outlined" sx={{ mb: 3 }}>
             <CardContent>
               <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                 <Typography variant="subtitle2">
                   Query Options
                 </Typography>
                 <Button
                   startIcon={<Settings />}
                   onClick={() => setShowAdvanced(!showAdvanced)}
                   size="small"
                 >
                   {showAdvanced ? 'Hide' : 'Show'} Advanced
                 </Button>
               </Box>

               <Grid container spacing={3}>
                 <Grid item xs={12} md={6}>
                   <FormControlLabel
                     control={
                       <Switch 
                         checked={getNER} 
                         onChange={e => setGetNER(e.target.checked)}
                         color="primary"
                       />
                     }
                     label="Named Entity Recognition"
                   />
                 </Grid>
                 <Grid item xs={12} md={6}>
                   <FormControlLabel
                     control={
                       <Switch
                         checked={downloadOnly}
                         onChange={e => setdownloadOnly(e.target.checked)}
                         color="secondary"
                       />
                     }
                     label="Download Only"
                   />
                 </Grid>

                 <Collapse in={showAdvanced} sx={{ width: '100%' }}>
                   <Grid container spacing={2} sx={{ mt: 1 }}>
                     <Grid item xs={12} md={6}>
                       <FormControl fullWidth size="small">
                         <InputLabel>Statistics Level</InputLabel>
                         <Select
                           value={statsLevel}
                           label="Statistics Level"
                           onChange={(e) => setStatsLevel(e.target.value as StatsLevel)}
                         >
                           {config.statsLevelOptions.map(option => (
                             <MenuItem key={option} value={option}>{option}</MenuItem>
                           ))}
                         </Select>
                       </FormControl>
                     </Grid>
                     <Grid item xs={12} md={6}>
                       <FormControl fullWidth size="small">
                         <InputLabel>Document Limit</InputLabel>
                         <Select
                           value={docLevel}
                           label="Document Limit"
                           onChange={(e) => setDocLevel(e.target.value as DocLevel)}
                         >
                           {config.docLevelOptions.map(option => (
                             <MenuItem key={option} value={option}>{option}</MenuItem>
                           ))}
                         </Select>
                       </FormControl>
                     </Grid>
                   </Grid>
                 </Collapse>
               </Grid>
             </CardContent>
           </Card>

           <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
             <Button 
               variant="contained" 
               color="primary" 
               type="submit"
               size="large"
               startIcon={<PlayArrow />}
               sx={{ minWidth: 120 }}
             >
               Execute Query
             </Button>
             
             <ButtonGroup variant="outlined">
               <Button onClick={handleCreateCurl} startIcon={<Code />}>
                 cURL
               </Button>
               <Button onClick={handleBuildPython} startIcon={<Code />}>
                 Python
               </Button>
               <Button onClick={handleBuildR} startIcon={<Code />}>
                 R
               </Button>
             </ButtonGroup>
           </Box>
         </Box>
       </CardContent>
     </Card>

     {hasEmbeddings && (
       <Zoom in={true}>
         <Fab
           color="secondary"
           aria-label="embedding tools"
           onClick={() => setEmbeddingModalOpen(true)}
           sx={{
             position: 'fixed',
             bottom: 24,
             right: 24,
             zIndex: 1000,
           }}
         >
           <AutoAwesome />
         </Fab>
       </Zoom>
     )}

     <Dialog open={codeModalOpen} onClose={() => setCodeModalOpen(false)} fullWidth maxWidth="md">
       <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
         <Code />
         {codeModalTitle}
       </DialogTitle>
       <DialogContent dividers>
         <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
           <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.875rem', overflow: 'auto' }}>
             <code>{codeModalContent}</code>
           </pre>
         </Paper>
       </DialogContent>
       <DialogActions>
         <Button onClick={() => navigator.clipboard.writeText(codeModalContent)}>
           Copy to Clipboard
         </Button>
         <Button onClick={() => setCodeModalOpen(false)}>Close</Button>
       </DialogActions>
     </Dialog>

     <Dialog 
       open={embeddingModalOpen} 
       onClose={() => setEmbeddingModalOpen(false)} 
       fullWidth 
       maxWidth="md"
     >
       <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
         <AutoAwesome />
         Semantic Analysis Tools
       </DialogTitle>
       <DialogContent dividers>
         <Stack spacing={3}>
           <Card variant="outlined">
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                 Word Similarity Analysis
               </Typography>
               <Grid container spacing={2} alignItems="center">
                 <Grid item xs={12} sm={4}>
                   <TextField
                     label="First Word"
                     value={similarityWord1}
                     onChange={(e) => setSimilarityWord1(e.target.value)}
                     size="small"
                     fullWidth
                   />
                 </Grid>
                 <Grid item xs={12} sm={4}>
                   <TextField
                     label="Second Word"
                     value={similarityWord2}
                     onChange={(e) => setSimilarityWord2(e.target.value)}
                     size="small"
                     fullWidth
                   />
                 </Grid>
                 <Grid item xs={12} sm={4}>
                   <Button
                     variant="contained"
                     onClick={computeSimilarity}
                     disabled={!similarityWord1 || !similarityWord2 || embeddingLoading}
                     fullWidth
                     startIcon={embeddingLoading ? <CircularProgress size={16} /> : <PlayArrow />}
                   >
                     Compare
                   </Button>
                 </Grid>
               </Grid>
               {similarityResult && (
                 <Alert severity="info" sx={{ mt: 2 }}>
                   <Typography variant="body2">
                     Similarity between <strong>"{similarityResult.word1}"</strong> and <strong>"{similarityResult.word2}"</strong>: 
                     <strong> {(similarityResult.similarity * 100).toFixed(1)}%</strong>
                   </Typography>
                   {!similarityResult.both_found && (
                     <Typography variant="caption" color="warning.main">
                       Note: One or both words were not found in the embeddings
                     </Typography>
                   )}
                 </Alert>
               )}
             </CardContent>
           </Card>

           <Card variant="outlined">
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Word Analogy Solver
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Find relationships: A is to B as C is to ?
               </Typography>
               <Grid container spacing={2} alignItems="center">
                 <Grid item xs={6} sm={2}>
                   <TextField
                     label="A"
                     value={analogyWordA}
                     onChange={(e) => setAnalogyWordA(e.target.value)}
                     size="small"
                     fullWidth
                   />
                 </Grid>
                 <Grid item xs={6} sm={2}>
                   <TextField
                     label="B"
                     value={analogyWordB}
                     onChange={(e) => setAnalogyWordB(e.target.value)}
                     size="small"
                     fullWidth
                   />
                 </Grid>
                 <Grid item xs={6} sm={2}>
                   <TextField
                     label="C"
                     value={analogyWordC}
                     onChange={(e) => setAnalogyWordC(e.target.value)}
                     size="small"
                     fullWidth
                   />
                 </Grid>
                 <Grid item xs={6} sm={2}>
                   <Typography variant="body2" sx={{ textAlign: 'center' }}>?</Typography>
                 </Grid>
                 <Grid item xs={12} sm={4}>
                   <Button
                     variant="contained"
                     onClick={computeAnalogy}
                     disabled={!analogyWordA || !analogyWordB || !analogyWordC || embeddingLoading}
                     fullWidth
                     startIcon={embeddingLoading ? <CircularProgress size={16} /> : <PlayArrow />}
                   >
                     Solve
                   </Button>
                 </Grid>
               </Grid>
               {analogyResult && (
                 <Box sx={{ mt: 2 }}>
                   <Typography variant="body2" gutterBottom>
                     <strong>{analogyResult.analogy}</strong>
                   </Typography>
                   {analogyResult.candidates.length > 0 ? (
                     <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                       {analogyResult.candidates.map((candidate, index) => (
                         <Chip
                           key={index}
                           label={`${candidate.word}${candidate.similarity ? ` (${(candidate.similarity * 100).toFixed(1)}%)` : ''}`}
                           variant={index === 0 ? 'filled' : 'outlined'}
                           color={index === 0 ? 'primary' : 'default'}
                           size="small"
                         />
                       ))}
                     </Box>
                   ) : (
                     <Alert severity="warning" sx={{ mt: 1 }}>
                       No analogies found or words not in embeddings
                     </Alert>
                   )}
                 </Box>
               )}
             </CardContent>
           </Card>
         </Stack>
       </DialogContent>
       <DialogActions>
         <Button onClick={() => setEmbeddingModalOpen(false)}>Close</Button>
       </DialogActions>
     </Dialog>
   </Box>
 );
};

export default MetadataForm;