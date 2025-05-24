import { useCallback } from 'react';
import config from '../../config.json';
import { buildQueryString } from '../containers/components/buildQueryString';

type StatsLevel = (typeof config.statsLevelOptions)[number];
type DocLevel = (typeof config.docLevelOptions)[number];

interface UseHistTextActionsProps {
  authAxios: any;
  selectedAlias: string;
  selectedSolrDatabase: any;
  formData: any;
  dateRange: any;
  showNotification: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
  setLoading: (loading: boolean) => void;
  setIsStatsLoading: (loading: boolean) => void;
  setIsNERLoading: (loading: boolean) => void;
  setIsDataLoading: (loading: boolean) => void;
  setStatsReady: (ready: boolean) => void;
  setNerReady: (ready: boolean) => void;
  setIsNERVisible: (visible: boolean) => void;
  setProgress: (progress: number) => void;
  setPartialResults: (results: any[]) => void;
  setAllResults: (results: any[]) => void;
  setStats: (stats: any) => void;
  setNERData: (data: any) => void;
  setMetadata: (metadata: any[]) => void;
  setAliases: (aliases: string[]) => void;
  setFormData: (formData: any) => void;
  setDateRange: (range: any) => void;
  setSelectedStat: (stat: string) => void;
  setWordFrequency: (frequency: any[]) => void;
  setActiveTab: (tab: number) => void;
  setViewNER: (view: boolean) => void;
  setSelectedAlias: (alias: string) => void; // Add this missing parameter
}

export const useHistTextActions = ({
  authAxios,
  selectedAlias,
  selectedSolrDatabase,
  formData,
  dateRange,
  showNotification,
  setLoading,
  setIsStatsLoading,
  setIsNERLoading,
  setIsDataLoading,
  setStatsReady,
  setNerReady,
  setIsNERVisible,
  setProgress,
  setPartialResults,
  setAllResults,
  setStats,
  setNERData,
  setMetadata,
  setAliases,
  setFormData,
  setDateRange,
  setSelectedStat,
  setWordFrequency,
  setActiveTab,
  setViewNER,
  setSelectedAlias // Add this to the destructuring
}: UseHistTextActionsProps) => {

  const handleAliasChange = useCallback(async (alias: string) => {
    setLoading(true);
    setSelectedAlias(alias); // Now this will work
    setFormData({});
    setDateRange(null);
    setStats(null);
    setSelectedStat('');
    setNERData(null);
    setActiveTab(0); // TABS.QUERY
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
  }, [selectedSolrDatabase, authAxios, showNotification, setLoading, setSelectedAlias, setFormData, setDateRange, setStats, setSelectedStat, setNERData, setActiveTab, setIsNERVisible, setViewNER, setPartialResults, setAllResults, setWordFrequency, setStatsReady, setNerReady, setMetadata]);

  const fetchAllDocuments = useCallback(async (
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
      setActiveTab(1); // TABS.PARTIAL_RESULTS
      setLoading(false);
      start += batchSize;
      setProgress((start / totalResults) * 100);

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
  }, [selectedAlias, selectedSolrDatabase, formData, dateRange, authAxios, showNotification, setLoading, setIsStatsLoading, setStatsReady, setNerReady, setIsDataLoading, setIsNERLoading, setIsNERVisible, setProgress, setPartialResults, setActiveTab, setAllResults, setStats, setNERData]);

  const handleQuery = useCallback((
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
  }, [fetchAllDocuments]);

  const exportAllData = useCallback(() => {
    showNotification('Export functionality coming soon', 'info');
  }, [showNotification]);

  const refreshData = useCallback(() => {
    if (selectedAlias) {
      handleAliasChange(selectedAlias);
    }
  }, [selectedAlias, handleAliasChange]);

  const shareQuery = useCallback(() => {
    const queryString = buildQueryString(formData, dateRange);
    navigator.clipboard.writeText(window.location.href + '?query=' + encodeURIComponent(queryString));
    showNotification('Query URL copied to clipboard', 'success');
  }, [formData, dateRange, showNotification]);

  const openSettings = useCallback(() => {
    showNotification('Settings panel coming soon', 'info');
  }, [showNotification]);

  return {
    handleAliasChange,
    handleQuery,
    exportAllData,
    refreshData,
    shareQuery,
    openSettings
  };
};