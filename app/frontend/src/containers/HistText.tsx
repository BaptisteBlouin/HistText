import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  useMediaQuery,
  Backdrop,
  CircularProgress,
  Fab,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Badge,
  Avatar,
  Stack,
  Divider,
  Button
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
  VisibilityOff,
  TrendingUp,
  InsertChart,
  DataUsage,
  Speed,
  Timeline,
  Assessment,
  FilterList,
  TableRows,
  ShowChart,
  BarChart,
  PieChart,
  Close,
  CheckCircle,
  Error,
  Warning,
  Info,
  Fullscreen,
  FullscreenExit,
  Settings,
  Share
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
  <div role="tabpanel" hidden={value !== index} {...other} style={{ height: value === index ? 'auto' : 0 }}>
    {value === index && (
      <Fade in={true} timeout={300}>
        <Box sx={{ height: '100%' }}>{children}</Box>
      </Fade>
    )}
  </div>
);

const HistText: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
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
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [quickActions, setQuickActions] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const { isAuthenticated } = useAuth();
  const stopWords = React.useMemo(
    () => new Set(STOP_WORDS_ARRAY.map(word => word.toLowerCase().trim())),
    [],
  );
  const totalEntities = useMemo(() => 
    nerData
      ? Object.values(nerData).flatMap(d => d.t || []).length
      : 0
  , [nerData])
  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const getTabInfo = (tabIndex: number) => {
    const tabsInfo = {
      [TABS.QUERY]: { 
        icon: <Search />, 
        label: 'Query Builder', 
        color: 'primary',
        description: 'Build and execute search queries'
      },
      [TABS.PARTIAL_RESULTS]: { 
        icon: <TableRows />, 
        label: isMobile ? 'Partial' : 'Partial Results', 
        color: 'secondary',
        count: partialResults.length,
        description: 'Quick preview of results'
      },
      [TABS.ALL_RESULTS]: { 
        icon: <TableChart />, 
        label: isMobile ? 'All' : 'All Results', 
        color: 'success',
        count: allResults.length,
        description: 'Complete dataset'
      },
      [TABS.STATS]: { 
        icon: <Analytics />, 
        label: 'Analytics', 
        color: 'info',
        description: 'Statistical analysis'
      },
      [TABS.CLOUD]: { 
        icon: <CloudIcon />, 
        label: isMobile ? 'Cloud' : 'Word Cloud', 
        color: 'warning',
        description: 'Visual word frequency'
      },
      [TABS.NER]: { 
        icon: <AccountTree />, 
        label: 'Entities', 
        color: 'error',
        description: 'Named entity recognition'
      }
    };
    return tabsInfo[tabIndex];
  };

  const quickActionItems = [
    { icon: <Download />, name: 'Export Data', action: () => exportAllData() },
    { icon: <Refresh />, name: 'Refresh', action: () => refreshData() },
    { icon: <Share />, name: 'Share Query', action: () => shareQuery() },
    { icon: <Settings />, name: 'Settings', action: () => openSettings() }
  ];

  const exportAllData = () => {
    showNotification('Export functionality coming soon', 'info');
  };

  const refreshData = () => {
    if (selectedAlias) {
      handleAliasChange(selectedAlias);
    }
  };

  const shareQuery = () => {
    const queryString = buildQueryString(formData, dateRange);
    navigator.clipboard.writeText(window.location.href + '?query=' + encodeURIComponent(queryString));
    showNotification('Query URL copied to clipboard', 'success');
  };

  const openSettings = () => {
    showNotification('Settings panel coming soon', 'info');
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
    setStatsReady(false);
    setNerReady(false);
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
          setWordFrequency([]);
          setIsCloudLoading(false);
          return;
        }

        setCloudProgress(25);

        const batchSize = 100;
        const wordMap: Record<string, number> = {};
        
        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          
          try {
            const { data } = await authAxios.post('/api/tokenize/batch', {
              texts: batch,
              cloud: true,
              max_tokens_per_text: 200,
            }, {
              
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
    setStatsReady(false);
    setNerReady(false);

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
        setProgress(100);
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

  const renderDatabaseSelector = () => (
    <Card sx={{ mb: 3, overflow: 'visible', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <CardContent sx={{ color: 'white' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <Storage />
          Data Source Configuration
        </Typography>
        
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ opacity: 0.9 }}>
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
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  color: '#333',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
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
            <Typography variant="subtitle2" gutterBottom sx={{ opacity: 0.9 }}>
              Collection
            </Typography>
            <Box sx={{ minWidth: 200 }}>
              <select
                value={selectedAlias}
                onChange={(e) => handleAliasChange(e.target.value)}
                disabled={!selectedSolrDatabase}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: selectedSolrDatabase ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)',
                  color: selectedSolrDatabase ? '#333' : '#666',
                  cursor: selectedSolrDatabase ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease'
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
          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              label={`Database: ${selectedSolrDatabase?.name}`} 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.2)', 
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            />
            <Chip 
              label={`Collection: ${selectedAlias}`} 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.2)', 
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            />
            {allResults.length > 0 && (
              <Chip 
                label={`${allResults.length} documents`} 
                size="small" 
                sx={{ 
                  bgcolor: 'rgba(76, 175, 80, 0.2)', 
                  color: 'white',
                  border: '1px solid rgba(76, 175, 80, 0.3)'
                }}
              />
            )}
            {statsReady && stats?.corpus_overview?.total_documents != null && (
              <Chip
                label={`Maximum Docs: ${stats.corpus_overview.total_documents}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(25, 118, 210, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(25, 118, 210, 0.3)'
                }}
              />
            )}
            {totalEntities > 0 && (
              <Chip
                label={`Entities: ${totalEntities}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(123, 31, 162, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(123, 31, 162, 0.3)'
                }}
              />
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderLoadingOverlay = () => (
    <Backdrop open={loading} sx={{ zIndex: theme.zIndex.drawer + 1, color: '#fff' }}>
      <Card sx={{ p: 4, textAlign: 'center', minWidth: 300 }}>
        <CircularProgress size={60} sx={{ mb: 3 }} />
        <Typography variant="h6" gutterBottom>
          Processing Query
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {progress > 0 ? `${progress.toFixed(0)}% complete` : 'Initializing...'}
        </Typography>
        {progress > 0 && (
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        )}
      </Card>
    </Backdrop>
  );



 if (!isAuthenticated) {
   return (
     <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
       <Paper sx={{ p: 6, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
         <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
           Authentication Required
         </Typography>
         <Typography variant="h6" sx={{ opacity: 0.9 }}>
           Please log in to access HistText features.
         </Typography>
       </Paper>
     </Container>
   );
 }

 return (
   <Box sx={{ 
     width: '100%', 
     bgcolor: 'background.default', 
     minHeight: '100vh',
     position: 'relative'
   }}>
     {renderLoadingOverlay()}
     
     <Container maxWidth="xl" sx={{ py: 3 }}>


       {renderDatabaseSelector()}

       <Paper 
         sx={{ 
           width: '100%', 
           bgcolor: 'background.paper',
           borderRadius: 3,
           overflow: 'hidden',
           boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
           minHeight: fullscreen ? '90vh' : 'auto'
         }}
       >
         <Box sx={{ 
           borderBottom: 1, 
           borderColor: 'divider',
           background: 'linear-gradient(90deg, #f8fafc 0%, #e2e8f0 100%)',
           position: 'relative'
         }}>
           <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
             <Tabs 
               value={activeTab} 
               onChange={handleTabChange}
               variant={isMobile ? "scrollable" : "fullWidth"}
               scrollButtons={isMobile ? "auto" : false}
               sx={{
                 flex: 1,
                 '& .MuiTab-root': {
                   textTransform: 'none',
                   fontWeight: 600,
                   fontSize: isMobile ? '0.8rem' : '0.9rem',
                   minHeight: 56,
                   transition: 'all 0.2s ease',
                   '&:hover': {
                     backgroundColor: 'rgba(102, 126, 234, 0.1)',
                   }
                 },
                 '& .Mui-selected': {
                   color: '#667eea !important',
                 },
                 '& .MuiTabs-indicator': {
                   backgroundColor: '#667eea',
                   height: 3,
                 }
               }}
             >
               {Array.from({ length: 6 }, (_, index) => {
                 const tabInfo = getTabInfo(index);
                 const isDisabled = 
                   (index === TABS.PARTIAL_RESULTS && partialResults.length === 0) ||
                   (index === TABS.ALL_RESULTS && allResults.length === 0) ||
                   (index === TABS.STATS && !statsReady) ||
                   (index === TABS.CLOUD && wordFrequency.length === 0) ||
                   (index === TABS.NER && !nerReady);

                 return (
                   <Tab
                     key={index}
                     icon={
                       <Badge 
                         badgeContent={tabInfo.count || 0} 
                         color={tabInfo.color as any}
                         invisible={!tabInfo.count || tabInfo.count === 0}
                         max={999}
                       >
                         {tabInfo.icon}
                       </Badge>
                     }
                     label={tabInfo.label}
                     iconPosition="start"
                     disabled={isDisabled}
                     sx={{
                       opacity: isDisabled ? 0.5 : 1,
                       '&.Mui-disabled': {
                         color: 'text.disabled'
                       }
                     }}
                   />
                 );
               })}
             </Tabs>
             
             <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
               {!isMobile && (
                 <Tooltip title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                   <IconButton 
                     onClick={() => setFullscreen(!fullscreen)}
                     size="small"
                     sx={{ color: 'text.secondary' }}
                   >
                     {fullscreen ? <FullscreenExit /> : <Fullscreen />}
                   </IconButton>
                 </Tooltip>
               )}
             </Box>
           </Box>
         </Box>

         <Box sx={{ position: 'relative', minHeight: fullscreen ? '80vh' : '60vh' }}>
           <TabPanel value={activeTab} index={TABS.QUERY}>
             {selectedAlias && metadata.length > 0 ? (
               <Box sx={{ p: 3 }}>
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
               </Box>
             ) : (
               <Box sx={{ 
                 textAlign: 'center', 
                 py: 12,
                 background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
               }}>
                 <Storage sx={{ fontSize: 80, color: 'text.secondary', mb: 3, opacity: 0.5 }} />
                 <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                   Get Started
                 </Typography>
                 <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
                   Select a database and collection from above to begin your text analysis journey
                 </Typography>
                 <Button 
                   variant="outlined" 
                   startIcon={<Search />}
                   sx={{ 
                     borderColor: '#667eea',
                     color: '#667eea',
                     '&:hover': { 
                       borderColor: '#5a6fd8',
                       backgroundColor: 'rgba(102, 126, 234, 0.1)'
                     }
                   }}
                 >
                   Choose Data Source
                 </Button>
               </Box>
             )}
           </TabPanel>

           <TabPanel value={activeTab} index={TABS.PARTIAL_RESULTS}>
             <Box sx={{ position: 'relative', height: '100%' }}>
               {partialResults.length > 0 ? (
                 <>
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
                       <Fab
                         onClick={() => setViewNER(!viewNER)}
                         size="medium"
                         sx={{
                           position: 'absolute',
                           bottom: 24,
                           right: 24,
                           bgcolor: viewNER ? 'error.main' : 'primary.main',
                           '&:hover': { bgcolor: viewNER ? 'error.dark' : 'primary.dark' },
                         }}
                       >
                         {viewNER ? <VisibilityOff /> : <Visibility />}
                       </Fab>
                     </Tooltip>
                   )}
                 </>
               ) : (
                 <Box sx={{ textAlign: 'center', py: 8 }}>
                   <TableRows sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                   <Typography variant="h6" color="text.secondary">
                     No partial results available
                   </Typography>
                   <Typography variant="body2" color="text.secondary">
                     Execute a query to see results
                   </Typography>
                 </Box>
               )}
             </Box>
           </TabPanel>

           <TabPanel value={activeTab} index={TABS.ALL_RESULTS}>
             <Box sx={{ position: 'relative', height: '100%' }}>
               {allResults.length > 0 ? (
                 <>
                   {isDataLoading ? (
                     <Box sx={{ textAlign: 'center', py: 8 }}>
                       <CircularProgress size={60} sx={{ mb: 3 }} />
                       <Typography variant="h6" gutterBottom>
                         Loading complete dataset...
                       </Typography>
                       <LinearProgress sx={{ width: 300, mx: 'auto' }} />
                     </Box>
                   ) : (
                     <DataGrid
                       results={allResults}
                       formData={formData}
                       nerData={nerData}
                       viewNER={false}
                       selectedAlias={selectedAlias}
                       selectedSolrDatabase={selectedSolrDatabase}
                       authAxios={authAxios}
                     />
                   )}
                 </>
               ) : (
                 <Box sx={{ textAlign: 'center', py: 8 }}>
                   <TableChart sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                   <Typography variant="h6" color="text.secondary">
                     No complete results available
                   </Typography>
                   <Typography variant="body2" color="text.secondary">
                     Execute a query to see the full dataset
                   </Typography>
                 </Box>
               )}
             </Box>
           </TabPanel>

           <TabPanel value={activeTab} index={TABS.STATS}>
             {stats ? (
               <>
                 <StatisticsDisplay
                   stats={stats}
                   selectedStat={selectedStat}
                   onStatChange={setSelectedStat}
                 />
               </>
             ) : (
               <Box sx={{ textAlign: 'center', py: 8 }}>
                 {isStatsLoading ? (
                   <>
                     <CircularProgress size={60} sx={{ mb: 3 }} />
                     <Typography variant="h6" gutterBottom>
                       Generating statistics...
                     </Typography>
                     <Typography variant="body2" color="text.secondary">
                       This may take a moment for large datasets
                     </Typography>
                   </>
                 ) : (
                   <>
                     <Analytics sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                     <Typography variant="h6" color="text.secondary">
                       No statistics available
                     </Typography>
                     <Typography variant="body2" color="text.secondary">
                       Execute a query to generate statistical analysis
                     </Typography>
                   </>
                 )}
               </Box>
             )}
           </TabPanel>

           <TabPanel value={activeTab} index={TABS.CLOUD}>
             {isCloudLoading ? (
               <Box sx={{ textAlign: 'center', py: 8 }}>
                 <CircularProgress size={60} sx={{ mb: 3 }} />
                 <Typography variant="h6" gutterBottom>
                   Generating Word Cloud...
                 </Typography>
                 {cloudProgress > 0 && (
                   <Box sx={{ mt: 3, mx: 'auto', maxWidth: 400 }}>
                     <LinearProgress 
                       variant="determinate" 
                       value={cloudProgress} 
                       sx={{ height: 8, borderRadius: 4, mb: 1 }}
                     />
                     <Typography variant="body2" color="text.secondary">
                       {Math.round(cloudProgress)}% complete
                     </Typography>
                   </Box>
                 )}
               </Box>
             ) : wordFrequency && wordFrequency.length > 0 ? (
               <>
                 <Box sx={{ p: 3, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Cloud wordFrequency={wordFrequency} />
                 </Box>
               </>
             ) : (
               <Box sx={{ textAlign: 'center', py: 8 }}>
                 <CloudIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                 <Typography variant="h6" color="text.secondary">
                   No word cloud data available
                 </Typography>
                 <Typography variant="body2" color="text.secondary">
                   Execute a query with text data to generate word cloud
                 </Typography>
               </Box>
             )}
           </TabPanel>

           <TabPanel value={activeTab} index={TABS.NER}>
             {nerData && Object.keys(nerData).length > 0 ? (
               <>
                 <NERDisplay
                   nerData={nerData}
                   authAxios={authAxios}
                   selectedAlias={selectedAlias}
                   selectedSolrDatabase={selectedSolrDatabase}
                   viewNER={viewNER}
                 />
               </>
             ) : (
               <Box sx={{ textAlign: 'center', py: 8 }}>
                 {isNERLoading ? (
                   <>
                     <CircularProgress size={60} sx={{ mb: 3 }} />
                     <Typography variant="h6" gutterBottom>
                       Processing NER data...
                     </Typography>
                     <Typography variant="body2" color="text.secondary">
                       Analyzing entities in your text
                     </Typography>
                   </>
                 ) : (
                   <>
                     <AccountTree sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                     <Typography variant="h6" color="text.secondary">
                       No NER data available
                     </Typography>
                     <Typography variant="body2" color="text.secondary">
                       Enable NER in query options to extract named entities
                     </Typography>
                   </>
                 )}
               </Box>
             )}
           </TabPanel>
         </Box>
       </Paper>
     </Container>

     <SpeedDial
       ariaLabel="Quick Actions"
       sx={{ position: 'fixed', bottom: 24, right: 24 }}
       icon={<SpeedDialIcon />}
       open={quickActions}
       onOpen={() => setQuickActions(true)}
       onClose={() => setQuickActions(false)}
     >
       {quickActionItems.map((action, index) => (
         <SpeedDialAction
           key={index}
           icon={action.icon}
           tooltipTitle={action.name}
           onClick={() => {
             action.action();
             setQuickActions(false);
           }}
         />
       ))}
     </SpeedDial>

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
         iconMapping={{
           success: <CheckCircle fontSize="inherit" />,
           error: <Error fontSize="inherit" />,
           warning: <Warning fontSize="inherit" />,
           info: <Info fontSize="inherit" />
         }}
       >
         {notification.message}
       </Alert>
     </Snackbar>
   </Box>
 );
};

export default HistText;