import React, { useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useHistTextData } from '../../hooks/useHistTextData';
import { useHistTextActions } from '../../hooks/useHistTextActions';
import { useWordCloudProcessor } from '../../hooks/useWordCloudProcessor';
import HistTextLayout from '../components/HistTextLayout';
import AuthenticationRequired from './components/AuthenticationRequired';
import { useHistTextState } from './hooks/useHistTextState';
import ErrorBoundary from '../components/ErrorBoundary';

const HistText: React.FC = React.memo(() => {
  const { isAuthenticated } = useAuth();
  const data = useHistTextData();
  
  const {
    activeTab,
    setActiveTab,
    fullscreenMode,
    setFullscreenMode,
    quickActions,
    setQuickActions,
    notification,
    setNotification,
    showNotification,
    resetHistTextState
  } = useHistTextState();

  // Memoized actions with proper dependencies
  const actions = useMemo(() => {
    return useHistTextActions({
      ...data,
      showNotification,
      setActiveTab
    });
  }, [data, showNotification, setActiveTab]);

  // Optimized word cloud processor
  useWordCloudProcessor({
    allResults: data.allResults,
    authAxios: data.authAxios,
    setWordFrequency: data.setWordFrequency,
    setIsCloudLoading: data.setIsCloudLoading,
    setCloudProgress: data.setCloudProgress,
    showNotification
  });

  // Memoized database change handler
  const handleSolrDatabaseChange = useCallback((database: any) => {
    data.setSelectedSolrDatabase(database);
    data.setSelectedAlias('');
    data.setAliases([]);
    data.setFormData({});
    data.setDateRange(null);
    data.setStats(null);
    data.setSelectedStat('');
    data.setNERData(null);
    setActiveTab(0);
    data.setPartialResults([]);
    data.setAllResults([]);
    data.setWordFrequency([]);
    data.setStatsReady(false);
    data.setNerReady(false);
    resetHistTextState();
  }, [data, setActiveTab, resetHistTextState]);

  // Load Solr databases effect
  useEffect(() => {
    if (!data.authAxios) return;

    let isMounted = true;
    
    const loadSolrDatabases = async () => {
      try {
        const response = await data.authAxios.get('/api/solr_databases');
        if (isMounted && Array.isArray(response.data)) {
          data.setSolrDatabases(response.data);
        } else if (isMounted && !Array.isArray(response.data)) {
          console.error('Response data is not an array:', response.data);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching Solr databases:', error);
          showNotification('Failed to fetch Solr databases', 'error');
        }
      }
    };

    loadSolrDatabases();

    return () => {
      isMounted = false;
    };
  }, [data.authAxios, data.setSolrDatabases, showNotification]);

  // Load aliases effect
  useEffect(() => {
    if (!data.selectedSolrDatabase || !data.authAxios) {
      data.setAliases([]);
      return;
    }

    let isMounted = true;

    const loadAliases = async () => {
      try {
        const response = await data.authAxios.get(
          `/api/solr/aliases?solr_database_id=${data.selectedSolrDatabase.id}`
        );
        if (isMounted && Array.isArray(response.data)) {
          data.setAliases(response.data);
        } else if (isMounted && !Array.isArray(response.data)) {
          console.error('Response data is not an array:', response.data);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching aliases:', error);
          showNotification('Failed to fetch collections', 'error');
        }
      }
    };

    loadAliases();

    return () => {
      isMounted = false;
    };
  }, [data.selectedSolrDatabase, data.authAxios, data.setAliases, showNotification]);

  // Early return for unauthenticated users
  if (!isAuthenticated) {
    return <AuthenticationRequired />;
  }

  return (
    <ErrorBoundary>
      <HistTextLayout
        data={data}
        actions={actions}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fullscreenMode={fullscreenMode}
        setFullscreenMode={setFullscreenMode}
        quickActions={quickActions}
        setQuickActions={setQuickActions}
        notification={notification}
        setNotification={setNotification}
        onSolrDatabaseChange={handleSolrDatabaseChange}
        showNotification={showNotification}
      />
    </ErrorBoundary>
  );
});

HistText.displayName = 'HistText';

export default HistText;