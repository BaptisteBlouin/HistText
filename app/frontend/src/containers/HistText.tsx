// HistText.tsx

import React, { useEffect, useState, useRef } from 'react';
import axios, { AxiosHeaders } from 'axios';
import './css/HistText.css';
import MetadataForm from './components/MetadataForm';
import StatisticsDisplay from './components/StatisticsDisplay';
import DataGrid from './components/DataGrid';
import NERDisplay from './components/NERDisplay';
import enp from '../images/logo.png';
import useScrollPosition from './components/useScrollPosition';
import { buildQueryString } from './components/buildQueryString';
import SidebarMenu from './components/SidebarMenu';
import { useAuth } from '../hooks/useAuth';
import Cloud from './components/Cloud';

import config from '../../config.json';
import { STOP_WORDS_ARRAY } from './components/StopWords';

// Define the custom hook inside HistText.tsx
const useAuthAxios = () => {
  const { accessToken } = useAuth();

  const authAxios = React.useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(
      config => {
        if (accessToken) {
          // Ensure headers is an instance of AxiosHeaders; if not, wrap it
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

// Keep your tab constants
const TABS = {
  QUERY: 'QUERY',
  PARTIAL_RESULTS: 'PARTIAL_RESULTS',
  ALL_RESULTS: 'ALL_RESULTS',
  STATS: 'STATS',
  CLOUD: 'CLOUD',
  NER: 'NER',
};

const HistText: React.FC = () => {
  // Use the custom axios instance with auth
  const authAxios = useAuthAxios();

  // State variables
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

  const [isFormVisible, setIsFormVisible] = useState<boolean>(false);
  const [getNER, setGetNER] = useState<boolean>(false);
  const [downloadOnly, setdownloadOnly] = useState<boolean>(false);
  const [nerData, setNERData] = useState<any>(null);

  // Loading flags
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(false);
  const [isNERLoading, setIsNERLoading] = useState<boolean>(false);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(false);

  const [statsLevel, setStatsLevel] = useState<(typeof config.statsLevelOptions)[number]>(
    config.statsLevelOptions[0],
  );
  const [docLevel, setDocLevel] = useState<(typeof config.docLevelOptions)[number]>(
    config.docLevelOptions[0],
  );

  const [statsReady, setStatsReady] = useState<boolean>(false);
  const [nerReady, setNerReady] = useState<boolean>(false);
  const [statsPath, setStatsPath] = useState<string | null>(null);
  const [nerPath, setNerPath] = useState<string | null>(null);

  const [progress, setProgress] = useState<number>(0);

  // NEW: Tab states
  const [activeTab, setActiveTab] = useState<string>(TABS.QUERY);

  // Sidebar
  const sidebarTop = 0;
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { isAuthenticated } = useAuth();

  // Solr databases states
  const [solrDatabases, setSolrDatabases] = useState<any[]>([]);
  const [selectedSolrDatabase, setSelectedSolrDatabase] = useState<any>(null);

  // NER visibility & toggle
  const [isNERVisible, setIsNERVisible] = useState<boolean>(false);
  const [viewNER, setViewNER] = useState<boolean>(false);

  // Word cloud states
  const [wordFrequency, setWordFrequency] = useState<{ text: string; value: number }[]>([]);
  const stopWords = React.useMemo(
    () => new Set(STOP_WORDS_ARRAY.map(word => word.toLowerCase().trim())),
    [],
  );

  // Fetch Solr databases on component mount using authAxios
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
      .catch(error => console.error('Error fetching Solr databases:', error));
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
    setIsFormVisible(false);
    setActiveTab(TABS.QUERY);
  };

  // Fetch aliases when selectedSolrDatabase changes using authAxios
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
        .catch(error => console.error('Error fetching aliases:', error));
    } else {
      setAliases([]);
    }
  }, [selectedSolrDatabase, authAxios]);

  // ----------------------------------------------------------------------
  //  2) WORD CLOUD COMPUTATION WHEN allResults IS SET
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!allResults || allResults.length === 0) {
      setWordFrequency([]);
      return;
    }

    const computeCloud = async () => {
      console.log('Starting cloud computation via /api/tokenize…');
      setIsCloudLoading(true);

      // 1) Figure out which field holds the main text
      const columnContentLengths = Object.keys(allResults[0]).map(key => ({
        key,
        length: allResults.reduce((acc, curr) => acc + (curr[key]?.toString().length || 0), 0),
      }));
      const contentColumn = columnContentLengths.reduce((prev, current) =>
        current.length > prev.length ? current : prev,
      ).key;

      // 2) Tokenize (and stop-word filter) on the backend
      const wordMap: Record<string, number> = {};
      await Promise.all(
        allResults.map(async result => {
          const text = result[contentColumn]?.toString();
          if (!text) return;

          try {
            const { data } = await authAxios.post('/api/tokenize', {
              text,
              cloud: true, // tells the API "also strip stop-words"
            });
            const words: string[] = data.words;
            words.forEach(raw => {
              const w = raw.toLowerCase();
              //if (w.length > 3) {
              wordMap[w] = (wordMap[w] || 0) + 1;
              //}
            });
          } catch (err) {
            console.error('Tokenization error for document:', err);
          }
        }),
      );

      // 3) Build and sort your frequency array
      const wordFrequencyData = Object.entries(wordMap)
        .map(([text, value]) => ({ text, value }))
        .sort((a, b) => b.value - a.value);

      setWordFrequency(wordFrequencyData.slice(0, 100));
      setIsCloudLoading(false);
    };

    computeCloud();
  }, [allResults, authAxios]);

  const handleAliasChange = async (alias: string) => {
    setLoading(true);
    setSelectedAlias(alias);
    setFormData({});
    setDateRange(null);
    setStats(null);
    setSelectedStat('');
    setNERData(null);
    setIsFormVisible(true);
    setActiveTab(TABS.QUERY);

    setIsNERVisible(false);
    setViewNER(false);

    setPartialResults([]);
    setAllResults([]);
    setWordFrequency([]);

    if (alias && selectedSolrDatabase) {
      try {
        const solrDatabaseId = selectedSolrDatabase.id;

        // Fetch metadata using authAxios
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
      } catch (error) {
        console.error('Error fetching collection metadata or date range:', error);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  // Main fetch method using authAxios for all API calls
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
        return;
      }

      const batchSize = config.batch_size;
      const maxDocuments = Number(selectedDocLevel);
      let start = 0;
      let totalResults = 0;
      setProgress(0);
      const solrDatabaseId = selectedSolrDatabase.id;

      // (1) Fetch First Batch
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

      // (2) If more docs remain, fetch them all
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
          }
        }
      }

      // (3) Fetch Stats (parallel)
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
        });

      // (4) Fetch NER data (parallel if requested)
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
          });
      }
    } catch (error) {
      console.error('Error querying alias:', error);
      setLoading(false);
    }
  };

  // Handle form submission
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

  return (
    <div className="container">
      {/* Sidebar */}
      <div className="sidebar">
        <SidebarMenu
          aliases={aliases}
          selectedAlias={selectedAlias}
          onAliasChange={handleAliasChange}
          isStatsLoading={isStatsLoading}
          isNERLoading={isNERLoading}
          isDataLoading={isDataLoading}
          isCloudLoading={isCloudLoading}
          solrDatabases={solrDatabases}
          selectedSolrDatabase={selectedSolrDatabase}
          onSolrDatabaseChange={handleSolrDatabaseChange}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>

      {/* Main Content */}
      <div className="main-content">
        {loading && (
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div className="progress" style={{ width: `${progress}%` }} />
            </div>
            <div className="loading-spinner">
              <img src={enp} className="App-logo" alt="react-logo" />
            </div>
          </div>
        )}

        {activeTab === TABS.QUERY && isFormVisible && (
          <div className="metadata-form-container" style={{ paddingTop: '3vh' }}>
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
          </div>
        )}

        {activeTab === TABS.PARTIAL_RESULTS && (
          <div id="data-grid" style={{ position: 'relative' }}>
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
              <button
                onClick={() => setViewNER(!viewNER)}
                className="btn btn-primary base-button"
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '20px',
                }}
              >
                {viewNER ? 'Hide NER' : 'View NER'}
              </button>
            )}
          </div>
        )}

        {activeTab === TABS.ALL_RESULTS && (
          <div style={{ position: 'relative' }}>
            {allResults && allResults.length > 0 ? (
              <DataGrid
                results={allResults}
                formData={formData}
                nerData={nerData}
                viewNER={false}
                selectedAlias={selectedAlias}
                selectedSolrDatabase={selectedSolrDatabase}
                authAxios={authAxios}
              />
            ) : (
              <p>No full results found.</p>
            )}
          </div>
        )}

        {activeTab === TABS.CLOUD && (
          <div>
            {isCloudLoading ? (
              <p>Loading word cloud...</p>
            ) : wordFrequency && wordFrequency.length > 0 ? (
              <Cloud wordFrequency={wordFrequency} />
            ) : (
              <p>No data available to generate the word cloud.</p>
            )}
          </div>
        )}

        {activeTab === TABS.STATS && (
          <div>
            {stats ? (
              <StatisticsDisplay
                stats={stats}
                selectedStat={selectedStat}
                onStatChange={setSelectedStat}
              />
            ) : (
              <p>No statistics computed yet or still loading...</p>
            )}
          </div>
        )}

        {activeTab === TABS.NER && (
          <div>
            {nerData && Object.keys(nerData).length > 0 ? (
              <NERDisplay
                nerData={nerData}
                authAxios={authAxios}
                selectedAlias={selectedAlias}
                selectedSolrDatabase={selectedSolrDatabase}
                viewNER={viewNER}
              />
            ) : (
              <p>No NER data available or still loading...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistText;
