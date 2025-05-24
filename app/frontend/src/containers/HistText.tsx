import React, { useEffect, useState, useRef } from 'react';
import axios, { AxiosHeaders } from 'axios';
import './css/HistText.css';
import MetadataForm from './components/MetadataForm';
import StatisticsDisplay from './components/StatisticsDisplay';
import DataGrid from './components/DataGrid';
import NERDisplay from './components/NERDisplay';
import { buildQueryString } from './components/buildQueryString';
import { useAuth } from '../hooks/useAuth';
import Cloud from './components/Cloud';
import config from '../../config.json';
import { STOP_WORDS_ARRAY } from './components/StopWords';
import { 
  Box, 
  Container, 
  Paper, 
  Tabs, 
  Tab, 
  Typography, 
  LinearProgress, 
  Fade, 
  Chip,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { 
  Search, 
  Analytics, 
  Cloud as CloudIcon, 
  TableChart, 
  AccountTree,
  Storage,
  Refresh,
  Download,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

const useAuthAxios = () => {
  const { accessToken } = useAuth();

  const authAxios = React.useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(
      config => {
        if (accessToken) {
          if (config.headers instanceof AxiosHeaders) {
            config.headers.set('Authorization', `Bearer ${accessToken}`);
          } else {
            config.headers = new AxiosHeaders({
              ...config.headers,
              Authorization: `Bearer ${accessToken}`,
            });
          }
        }
        return config;
      },
      error => Promise.reject(error),
    );
    return instance;
  }, [accessToken]);

  return authAxios;
};

type StatsLevel = (typeof config.statsLevelOptions)[number];
type DocLevel = (typeof config.docLevelOptions)[number];

const TABS = {
  QUERY: 0,
  PARTIAL_RESULTS: 1,
  ALL_RESULTS: 2,
  STATS: 3,
  CLOUD: 4,
  NER: 5,
};

const TabPanel = ({ children, value, index, ...other }) => (
  <div role="tabpanel" hidden={value !== index} {...other}>
    {value === index && (
      <Fade in={true} timeout={300}>
        <Box sx={{ p: 3 }}>{children}</Box>
      </Fade>
    )}
  </div>
);

const HistText: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedAlias, setSelectedAlias] = useState<string>('');
  const [partialResults, setPartialResults] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedStat, setSelectedStat] = useState<string>('');
  const [metadata, setMetadata] = useState<any[]>([]);
  const [formData, setFormData] = useState<{
    [key: string]: { value: string; operator: string }[];
  }>({});
  const [dateRange, setDateRange] = useState<{
    min: string;
    max: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [getNER, setGetNER] = useState<boolean>(false);
  const [downloadOnly, setdownloadOnly] = useState<boolean>(false);
  const [nerData, setNERData] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(false);
  const [isNERLoading, setIsNERLoading] = useState<boolean>(false);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(false);
  const [statsLevel, setStatsLevel] = useState<StatsLevel>(config.statsLevelOptions[0]);
  const [docLevel, setDocLevel] = useState<DocLevel>(config.docLevelOptions[0]);
  const [statsReady, setStatsReady] = useState<boolean>(false);
  const [nerReady, setNerReady] = useState<boolean>(false);
  const [statsPath, setStatsPath] = useState<string | null>(null);
  const [nerPath, setNerPath] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<number>(TABS.QUERY);
  const [solrDatabases, setSolrDatabases] = useState<any[]>([]);
  const [selectedSolrDatabase, setSelectedSolrDatabase] = useState<any>(null);
  const [isNERVisible, setIsNERVisible] = useState<boolean>(false);
  const [viewNER, setViewNER] = useState<boolean>(false);
  const [wordFrequency, setWordFrequency] = useState<{ text: string; value: number }[]>([]);
  const [cloudProgress, setCloudProgress] = useState<number>(0);
  const [notification, setNotification] = useState<{open: boolean, message: string, severity: 'success' | 'error' | 'warning' | 'info'}>({
    open: false,
    message: '',
    severity: 'info'
  });

  const { isAuthenticated } = useAuth();
  const stopWords = React.useMemo(
    () => new Set(STOP_WORDS_ARRAY.map(word => word.toLowerCase().trim())),
    [],
  );

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  useEffect(() => {
    authAxios
      .get('/api/solr_databases')
      .then(response => {
        if (Array.isArray(response.data)) {
          setSolrDatabases(response.data);
        } else {
          console.error('Response data is not an array:', response.data);
        }
      })
      .catch(error => {
        console.error('Error fetching Solr databases:', error);
        showNotification('Failed to fetch Solr databases', 'error');
      });
  }, [authAxios]);

  const handleSolrDatabaseChange = (database: any) => {
    setSelectedSolrDatabase(database);
    setSelectedAlias('');
    setAliases([]);
    setFormData({});
    setDateRange(null);
    setStats(null);
    setSelectedStat('');
    setNERData(null);
    setActiveTab(TABS.QUERY);
    setPartialResults([]);
    setAllResults([]);
    setWordFrequency([]);
  };

  useEffect(() => {
    if (selectedSolrDatabase) {
      authAxios
        .get(`/api/solr/aliases?solr_database_id=${selectedSolrDatabase.id}`)
        .then(response => {
          if (Array.isArray(response.data)) {
            setAliases(response.data);
          } else {
            console.error('Response data is not an array:', response.data);
          }
        })
        .catch(error => {
          console.error('Error fetching aliases:', error);
          showNotification('Failed to fetch collections', 'error');
        });
    } else {
      setAliases([]);
    }
  }, [selectedSolrDatabase, authAxios]);

  useEffect(() => {
    if (!allResults || allResults.length === 0) {
      setWordFrequency([]);
      return;
    }

    const computeCloudOptimized = async () => {
      console.log('Starting optimized cloud computation via batch tokenization…');
      setIsCloudLoading(true);
      setCloudProgress(0);

      try {
        const sampleSize = Math.min(allResults.length, 10);
        const columnContentLengths = Object.keys(allResults[0]).map(key => ({
          key,
          length: allResults.slice(0, sampleSize).reduce(
            (acc, curr) => acc + (curr[key]?.toString().length || 0), 0
          ),
        }));
        
        const contentColumn = columnContentLengths.reduce((prev, current) =>
          current.length > prev.length ? current : prev,
        ).key;

        console.log(`Using column '${contentColumn}' for word cloud analysis`);

        const maxTextLength = 5000;
        const maxTexts = Math.min(allResults.length, 2000);
        
        const texts = allResults
          .slice(0, maxTexts)
          .map(result => {
            const text = result[contentColumn]?.toString();
            if (!text) return '';
            return text.length > maxTextLength ? text.substring(0, maxTextLength) : text;
          })
          .filter(text => text.length > 10);

        if (texts.length === 0) {
          console.log('No valid texts found for word cloud');
          setWordFrequency([]);
          setIsCloudLoading(false);
          return;
        }

        console.log(`Processing ${texts.length} texts for word cloud`);
        setCloudProgress(25);

        const batchSize = 100;
        const wordMap: Record<string, number> = {};
        
        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
          
          try {
            const { data } = await authAxios.post('/api/tokenize/batch', {
              texts: batch,
              cloud: true,
              max_tokens_per_text: 200,
            });

            data.results.forEach((result: any) => {
              result.words.forEach((word: string) => {
                const normalizedWord = word.toLowerCase().trim();
                if (normalizedWord.length > 2 && normalizedWord.length < 25) {
                  wordMap[normalizedWord] = (wordMap[normalizedWord] || 0) + 1;
                }
              });
            });

            const progressPercent = 25 + ((i + batch.length) / texts.length) * 65;
            setCloudProgress(Math.min(progressPercent, 90));

          } catch (err) {
            console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, err);
          }
        }

        setCloudProgress(95);

        const wordFrequencyData = Object.entries(wordMap)
          .map(([text, value]) => ({ text, value }))
          .filter(item => item.value > 1)
          .sort((a, b) => b.value - a.value)
          .slice(0, 150);

        console.log(`Generated word cloud with ${wordFrequencyData.length} unique words`);
        setWordFrequency(wordFrequencyData);
        setCloudProgress(100);

      } catch (error) {
        console.error('Error in word cloud computation:', error);
        setWordFrequency([]);
        showNotification('Failed to generate word cloud', 'error');
      } finally {
        setIsCloudLoading(false);
        setTimeout(() => setCloudProgress(0), 1000);
      }
    };

    computeCloudOptimized();
  }, [allResults, authAxios]);

  const handleAliasChange = async (alias: string) => {
    setLoading(true);
    setSelectedAlias(alias);
    setFormData({});
    setDateRange(null);
    setStats(null);
    setSelectedStat('');
    setNERData(null);
    setActiveTab(TABS.QUERY);
    setIsNERVisible(false);
    setViewNER(false);
    setPartialResults([]);
    setAllResults([]);
    setWordFrequency([]);

    if (alias && selectedSolrDatabase) {
      try {
        const solrDatabaseId = selectedSolrDatabase.id;

        const metadataResponse = await authAxios.get(
          `/api/solr/collection_metadata?collection=${encodeURIComponent(alias)}&solr_database_id=${solrDatabaseId}`,
        );
        if (metadataResponse.data && Array.isArray(metadataResponse.data)) {
          const fields = metadataResponse.data;
          setMetadata(fields);

          if (fields.some((field: any) => field.name === config.default_date_name)) {
            const dateRangeResponse = await authAxios.get(
              `/api/solr/date_range?collection=${encodeURIComponent(alias)}&solr_database_id=${solrDatabaseId}`,
            );
            if (dateRangeResponse.data?.min && dateRangeResponse.data?.max) {
              setDateRange({
                min: dateRangeResponse.data.min.split('T')[0],
                max: dateRangeResponse.data.max.split('T')[0],
              });
              setFormData(prevData => ({
                ...prevData,
                min_date: [
                  {
                    value: dateRangeResponse.data.min.split('T')[0],
                    operator: 'AND',
                  },
                ],
                max_date: [
                  {
                    value: dateRangeResponse.data.max.split('T')[0],
                    operator: 'AND',
                  },
                ],
              }));
            }
          }
        } else {
          console.error('Unexpected response structure:', metadataResponse.data);
          setMetadata([]);
        }
        showNotification(`Collection "${alias}" loaded successfully`, 'success');
      } catch (error) {
        console.error('Error fetching collection metadata or date range:', error);
        showNotification('Failed to load collection metadata', 'error');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  const fetchAllDocuments = async (
    onlyComputeStats: boolean,
    wantNER: boolean,
    wantDownload: boolean,
    selectedStatsLevel: string = config.statsLevelOptions[0],
    selectedDocLevel: string = config.docLevelOptions[0],
  ) => {
    if (!selectedAlias || !selectedSolrDatabase) return;

    setLoading(true);
    setIsStatsLoading(true);
    setStatsReady(false);
    setNerReady(false);
    setIsDataLoading(true);
    setNerReady(false);

    if (wantNER) {
      setIsNERLoading(true);
      setIsNERVisible(false);
    }

    try {
      const queryString = buildQueryString(formData, dateRange);
      if (!queryString) {
        console.error('Query string is empty.');
        setLoading(false);
        showNotification('Query string is empty', 'warning');
        return;
      }

      const batchSize = config.batch_size;
      const maxDocuments = Number(selectedDocLevel);
      let start = 0;
      let totalResults = 0;
      setProgress(0);
      const solrDatabaseId = selectedSolrDatabase.id;

      const is_first = true;
      const firstResponse = await authAxios.get(
        `/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(
          queryString,
        )}&start=${start}&rows=${batchSize}&get_ner=${wantNER}&download_only=${wantDownload}&stats_level=${selectedStatsLevel}&solr_database_id=${solrDatabaseId}&is_first=${is_first}`,
      );

      const firstSolrResponse = firstResponse.data.solr_response;
      const firstDocs = firstSolrResponse.response.docs;

      totalResults = firstSolrResponse.total_results;
      if (totalResults > maxDocuments) {
        totalResults = maxDocuments;
      }

      setPartialResults([...firstDocs]);
      setActiveTab(TABS.PARTIAL_RESULTS);
      setLoading(false);
      start += batchSize;
      setProgress((start / totalResults) * 100);

      setStatsPath(firstSolrResponse.stats_path);
      setNerPath(firstSolrResponse.ner_path);

      if (totalResults > batchSize) {
        const allResponse = await authAxios.get(
          `/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(
            queryString,
          )}&start=0&rows=${totalResults}&get_ner=${wantNER}&download_only=${wantDownload}&stats_level=${selectedStatsLevel}&solr_database_id=${solrDatabaseId}`,
        );
        const solrResponseAll = allResponse.data.solr_response;
        const docsAll = solrResponseAll.response.docs;
        setAllResults([...docsAll]);
        setProgress((start / totalResults) * 100);
        setIsDataLoading(false);

        if (wantDownload) {
          const csvPath = solrResponseAll.csv_path;
          if (csvPath) {
            const filename = csvPath.split('/').pop();
            const downloadUrl = `/api/solr/download_csv/${filename}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename || 'data.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification('Download started', 'success');
          }
        }
      } else {
        setAllResults([...firstDocs]);
        setIsDataLoading(false);
        setLoading(false);

        if (wantDownload) {
          const csvPath = firstSolrResponse.csv_path;
          if (csvPath) {
            const filename = csvPath.split('/').pop();
            const downloadUrl = `/api/solr/download_csv/${filename}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename || 'data.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification('Download started', 'success');
          }
        }
      }

      authAxios
        .get(
          `/api/solr/stats?path=${encodeURIComponent(firstSolrResponse.stats_path)}&solr_database_id=${solrDatabaseId}`,
        )
        .then(response_stats => {
          setStats(response_stats.data);
          setIsStatsLoading(false);
          setStatsReady(true);
        })
        .catch(error => {
          console.error('Error fetching stats:', error);
          setIsStatsLoading(false);
          showNotification('Failed to load statistics', 'error');
        });

      if (wantNER) {
        authAxios
          .get(
            `/api/solr/ner?path=${encodeURIComponent(firstSolrResponse.ner_path)}&solr_database_id=${solrDatabaseId}`,
          )
          .then(response_ner => {
            setNERData(response_ner.data);
            setIsNERLoading(false);
            setIsNERVisible(true);
            setNerReady(true);
          })
          .catch(error => {
            console.error('Error fetching NER:', error);
            setIsNERLoading(false);
            showNotification('Failed to load NER data', 'error');
          });
      }

      showNotification(`Found ${totalResults} documents`, 'success');

    } catch (error) {
      console.error('Error querying alias:', error);
      setLoading(false);
      showNotification('Query failed', 'error');
    }
  };

  const handleQuery = (
    e: React.FormEvent,
    onlyComputeStats: boolean,
    wantNER: boolean,
    wantDownload: boolean,
    selectedStatsLevel: string,
    selectedDocLevel: string,
  ) => {
    e.preventDefault();
    fetchAllDocuments(
      onlyComputeStats,
      wantNER,
      wantDownload,
      selectedStatsLevel,
      selectedDocLevel,
    );
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getTabIcon = (tabIndex: number) => {
    const icons = [
      <Search />,
      <TableChart />,
      <TableChart />,
      <Analytics />,
      <CloudIcon />,
      <AccountTree />
    ];
    return icons[tabIndex];
  };

  const getTabLabel = (tabIndex: number) => {
    const labels = ['Query', 'Partial Results', 'All Results', 'Statistics', 'Word Cloud', 'NER'];
    return labels[tabIndex];
  };

  const renderDatabaseSelector = () => (
    <Card sx={{ mb: 2, overflow: 'visible' }}>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              <Storage sx={{ mr: 1, verticalAlign: 'middle' }} />
              Solr Database
            </Typography>
            <Box sx={{ minWidth: 200 }}>
              <select
                value={selectedSolrDatabase?.id || ''}
                onChange={(e) => {
                  const db = solrDatabases.find(db => db.id === Number(e.target.value));
                  handleSolrDatabaseChange(db || null);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Select a database...</option>
                {solrDatabases.map(db => (
                  <option key={db.id} value={db.id}>
                    {db.name}
                  </option>
                ))}
              </select>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Collection
            </Typography>
            <Box sx={{ minWidth: 200 }}>
              <select
                value={selectedAlias}
                onChange={(e) => handleAliasChange(e.target.value)}
                disabled={!selectedSolrDatabase}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: selectedSolrDatabase ? 'white' : '#f5f5f5'
                }}
              >
                <option value="">Select a collection...</option>
                {aliases.map(alias => (
                  <option key={alias} value={alias}>
                    {alias}
                  </option>
                ))}
              </select>
            </Box>
          </Grid>
        </Grid>
        
        {selectedAlias && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={`Database: ${selectedSolrDatabase?.name}`} 
              size="small" 
              color="primary" 
              variant="outlined"
            />
            <Chip 
              label={`Collection: ${selectedAlias}`} 
              size="small" 
              color="secondary" 
              variant="outlined"
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );

  if (!isAuthenticated) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Authentication Required
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Please log in to access HistText features.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ width: '100%', bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
            HistText Analysis
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Advanced text analysis and document search platform
          </Typography>
        </Box>

        {renderDatabaseSelector()}

        {loading && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" sx={{ mr: 2 }}>
                  Processing query...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {progress.toFixed(0)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
            </CardContent>
          </Card>
        )}

        <Paper sx={{ width: '100%', bgcolor: 'background.paper' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              variant={isMobile ? "scrollable" : "fullWidth"}
              scrollButtons={isMobile ? "auto" : false}
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  minHeight: 64,
                },
              }}
            >
              {Array.from({ length: 6 }, (_, index) => (
                <Tab
                  key={index}
                  icon={getTabIcon(index)}
                  label={getTabLabel(index)}
                  iconPosition="start"
                  sx={{
                    opacity: index === TABS.PARTIAL_RESULTS && partialResults.length === 0 ? 0.5 :
                           index === TABS.ALL_RESULTS && allResults.length === 0 ? 0.5 :
                           index === TABS.STATS && !statsReady ? 0.5 :
                           index === TABS.CLOUD && wordFrequency.length === 0 ? 0.5 :
                           index === TABS.NER && !nerReady ? 0.5 : 1,
                  }}
                  disabled={
                    (index === TABS.PARTIAL_RESULTS && partialResults.length === 0) ||
                    (index === TABS.ALL_RESULTS && allResults.length === 0) ||
                    (index === TABS.STATS && !statsReady) ||
                    (index === TABS.CLOUD && wordFrequency.length === 0) ||
                    (index === TABS.NER && !nerReady)
                  }
                />
              ))}
            </Tabs>
          </Box>

          <TabPanel value={activeTab} index={TABS.QUERY}>
            {selectedAlias && metadata.length > 0 && (
              <MetadataForm
                metadata={metadata}
                formData={formData}
                setFormData={setFormData}
                dateRange={dateRange}
                handleQuery={handleQuery}
                getNER={getNER}
                setGetNER={setGetNER}
                downloadOnly={downloadOnly}
                setdownloadOnly={setdownloadOnly}
                statsLevel={statsLevel}
                setStatsLevel={setStatsLevel}
                docLevel={docLevel}
                setDocLevel={setDocLevel}
                solrDatabaseId={selectedSolrDatabase?.id || null}
                selectedAlias={selectedAlias}
              />
            )}
            {!selectedAlias && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Select a database and collection to get started
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose from the available Solr databases and collections above
                </Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={TABS.PARTIAL_RESULTS}>
            <Box sx={{ position: 'relative' }}>
              <DataGrid
                results={partialResults}
                formData={formData}
                nerData={nerData}
                viewNER={viewNER}
                selectedAlias={selectedAlias}
                selectedSolrDatabase={selectedSolrDatabase}
                authAxios={authAxios}
              />
              {isNERVisible && (
                <Tooltip title={viewNER ? 'Hide NER highlighting' : 'Show NER highlighting'}>
                  <IconButton
                    onClick={() => setViewNER(!viewNER)}
                    sx={{
                      position: 'absolute',
                      bottom: 16,
                      right: 16,
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                    }}
                  >
                    {viewNER ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={TABS.ALL_RESULTS}>
            <DataGrid
              results={allResults}
              formData={formData}
              nerData={nerData}
              viewNER={false}
              selectedAlias={selectedAlias}
              selectedSolrDatabase={selectedSolrDatabase}
              authAxios={authAxios}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={TABS.STATS}>
            {stats ? (
              <StatisticsDisplay
                stats={stats}
                selectedStat={selectedStat}
                onStatChange={setSelectedStat}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  {isStatsLoading ? 'Loading statistics...' : 'No statistics available'}
                </Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={TABS.CLOUD}>
            {isCloudLoading ? ( 
              <Box sx={{ textAlign: 'center', py: 8 }}>
               <Typography variant="h6" gutterBottom>
                 Generating Word Cloud...
               </Typography>
               {cloudProgress > 0 && (
                 <Box sx={{ mt: 2, mx: 'auto', maxWidth: 400 }}>
                   <LinearProgress 
                     variant="determinate" 
                     value={cloudProgress} 
                     sx={{ height: 8, borderRadius: 4 }}
                   />
                   <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                     {Math.round(cloudProgress)}% complete
                   </Typography>
                 </Box>
               )}
             </Box>
           ) : wordFrequency && wordFrequency.length > 0 ? (
             <Cloud wordFrequency={wordFrequency} />
           ) : (
             <Box sx={{ textAlign: 'center', py: 8 }}>
               <CloudIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
               <Typography variant="h6" color="text.secondary">
                 No data available for word cloud
               </Typography>
             </Box>
           )}
         </TabPanel>

         <TabPanel value={activeTab} index={TABS.NER}>
           {nerData && Object.keys(nerData).length > 0 ? (
             <NERDisplay
               nerData={nerData}
               authAxios={authAxios}
               selectedAlias={selectedAlias}
               selectedSolrDatabase={selectedSolrDatabase}
               viewNER={viewNER}
             />
           ) : (
             <Box sx={{ textAlign: 'center', py: 8 }}>
               <AccountTree sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
               <Typography variant="h6" color="text.secondary">
                 {isNERLoading ? 'Processing NER data...' : 'No NER data available'}
               </Typography>
             </Box>
           )}
         </TabPanel>
       </Paper>
     </Container>

     <Snackbar
       open={notification.open}
       autoHideDuration={6000}
       onClose={() => setNotification(prev => ({ ...prev, open: false }))}
       anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
     >
       <Alert 
         onClose={() => setNotification(prev => ({ ...prev, open: false }))} 
         severity={notification.severity}
         variant="filled"
         sx={{ width: '100%' }}
       >
         {notification.message}
       </Alert>
     </Snackbar>
   </Box>
 );
};

export default HistText;