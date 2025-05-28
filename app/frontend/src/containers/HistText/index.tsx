// app/frontend/src/containers/HistText/index.tsx
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

  // Memoized actions with proper dependencies including search history
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

  // Prepare available databases for search history
  const availableDatabases = useMemo(() => 
    data.solrDatabases.map(db => ({
      id: db.id,
      name: db.name
    }))
  , [data.solrDatabases]);

  // Enhanced collections mapping - fetch collections for all databases
  const [allCollections, setAllCollections] = React.useState<Record<number, string[]>>({});

  // Fetch collections for all databases to support cross-database search switching
  useEffect(() => {
    if (!data.authAxios || data.solrDatabases.length === 0) return;

    const fetchAllCollections = async () => {
      const collectionsMap: Record<number, string[]> = {};
      
      try {
        // Fetch collections for each database
        const promises = data.solrDatabases.map(async (database) => {
          try {
            const response = await data.authAxios.get(
              `/api/solr/aliases?solr_database_id=${database.id}`
            );
            
            if (Array.isArray(response.data)) {
              collectionsMap[database.id] = response.data;
            } else {
              console.warn(`Invalid response for database ${database.id}:`, response.data);
              collectionsMap[database.id] = [];
            }
          } catch (error) {
            console.error(`Error fetching collections for database ${database.id}:`, error);
            collectionsMap[database.id] = [];
          }
        });

        await Promise.all(promises);
        setAllCollections(collectionsMap);
        
      } catch (error) {
        console.error('Error fetching collections for all databases:', error);
      }
    };

    fetchAllCollections();
  }, [data.authAxios, data.solrDatabases]);

  // Enhanced database change handler that properly handles search history integration
  const handleSolrDatabaseChangeWithHistory = useCallback(async (database: any) => {
    if (!database) {
      // Handle null/undefined database selection
      data.setSelectedSolrDatabase(null);
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
      return;
    }

    // Ensure we have a proper database object with ID
    const databaseToSet = {
      id: database.id,
      name: database.name,
      ...database // preserve any other properties
    };

    console.log('Setting database:', databaseToSet);

    // Set the database first
    data.setSelectedSolrDatabase(databaseToSet);
    
    // Clear dependent state
    data.setSelectedAlias('');
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

    // Fetch aliases for the selected database
    if (data.authAxios && databaseToSet.id) {
      try {
        const response = await data.authAxios.get(
          `/api/solr/aliases?solr_database_id=${databaseToSet.id}`
        );
        
        if (Array.isArray(response.data)) {
          data.setAliases(response.data);
          console.log(`Loaded ${response.data.length} aliases for database ${databaseToSet.id}`);
        } else {
          console.error('Invalid aliases response:', response.data);
          data.setAliases([]);
        }
      } catch (error) {
        console.error('Error fetching aliases for database:', databaseToSet.id, error);
        data.setAliases([]);
        showNotification('Failed to fetch collections for selected database', 'error');
      }
    }
  }, [
    data.setSelectedSolrDatabase,
    data.setSelectedAlias,
    data.setAliases,
    data.setFormData,
    data.setDateRange,
    data.setStats,
    data.setSelectedStat,
    data.setNERData,
    data.setPartialResults,
    data.setAllResults,
    data.setWordFrequency,
    data.setStatsReady,
    data.setNerReady,
    data.authAxios,
    setActiveTab,
    resetHistTextState,
    showNotification
  ]);

  // Enhanced alias change handler for search history integration
  const handleAliasChangeWithHistory = useCallback(async (alias: string) => {
    console.log('Changing alias to:', alias, 'with database:', data.selectedSolrDatabase?.id);
    
    if (!data.selectedSolrDatabase?.id) {
      console.warn('No database selected when trying to change alias');
      showNotification('Please select a database first', 'warning');
      return;
    }

    // Use the existing alias change handler from actions
    await actions.handleAliasChange(alias);
  }, [data.selectedSolrDatabase?.id, actions.handleAliasChange, showNotification]);

  // Load Solr databases effect with better error handling
  useEffect(() => {
    if (!data.authAxios) return;

    let isMounted = true;
    
    const loadSolrDatabases = async () => {
      try {
        console.log('Loading Solr databases...');
        const response = await data.authAxios.get('/api/solr_databases');
        
        if (isMounted) {
          if (Array.isArray(response.data)) {
            console.log('Loaded databases:', response.data);
            data.setSolrDatabases(response.data);
          } else {
            console.error('Invalid database response:', response.data);
            data.setSolrDatabases([]);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching Solr databases:', error);
          data.setSolrDatabases([]);
          showNotification('Failed to fetch Solr databases', 'error');
        }
      }
    };

    loadSolrDatabases();

    return () => {
      isMounted = false;
    };
  }, [data.authAxios, data.setSolrDatabases, showNotification]);

  // Enhanced switch and apply function for search history
  const handleSwitchAndApplySearch = useCallback(async (search: any) => {
    try {
      console.log('Switching and applying search:', {
        targetDatabase: search.selectedSolrDatabase,
        targetAlias: search.selectedAlias,
        currentDatabase: data.selectedSolrDatabase?.id,
        currentAlias: data.selectedAlias
      });

      // Validate that the target database exists
      const targetDatabase = data.solrDatabases.find(db => db.id === search.selectedSolrDatabase.id);
      if (!targetDatabase) {
        throw new Error(`Database with ID ${search.selectedSolrDatabase.id} not found`);
      }

      // Validate that the target collection exists for that database
      const collectionsForDb = allCollections[search.selectedSolrDatabase.id] || [];
      if (!collectionsForDb.includes(search.selectedAlias)) {
        throw new Error(`Collection "${search.selectedAlias}" not found in database "${targetDatabase.name}"`);
      }

      // Switch database if different
      if (search.selectedSolrDatabase.id !== data.selectedSolrDatabase?.id) {
        console.log('Switching database from', data.selectedSolrDatabase?.id, 'to', search.selectedSolrDatabase.id);
        await handleSolrDatabaseChangeWithHistory(targetDatabase);
        
        // Wait for database change to propagate
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Switch collection if different
      if (search.selectedAlias !== data.selectedAlias) {
        console.log('Switching alias from', data.selectedAlias, 'to', search.selectedAlias);
        await handleAliasChangeWithHistory(search.selectedAlias);
        
        // Wait for alias change to propagate
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Apply the form data
      console.log('Applying form data:', search.formData);
      data.setFormData(search.formData);
      
      // Handle date range if present
      if (search.dateRange) {
        data.setDateRange(search.dateRange);
      }

      // Switch to query tab to show the applied search
      setActiveTab(0);
      
      showNotification(`Applied search "${search.name}" successfully`, 'success');
      
    } catch (error) {
      console.error('Error switching collection and applying search:', error);
      showNotification(
        `Failed to apply search: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        'error'
      );
      throw error; // Re-throw to let the panel handle the error
    }
  }, [
    data.solrDatabases,
    data.selectedSolrDatabase?.id,
    data.selectedAlias,
    data.setFormData,
    data.setDateRange,
    allCollections,
    handleSolrDatabaseChangeWithHistory,
    handleAliasChangeWithHistory,
    setActiveTab,
    showNotification
  ]);

  // Early return for unauthenticated users
  if (!isAuthenticated) {
    return <AuthenticationRequired />;
  }

  return (
    <ErrorBoundary>
      <HistTextLayout
        data={{
          ...data,
          // Add search history support data
          availableDatabases,
          allCollections
        }}
        actions={{
          ...actions,
          // Enhanced handlers with search history support
          handleSolrDatabaseChange: handleSolrDatabaseChangeWithHistory,
          handleAliasChange: handleAliasChangeWithHistory,
          handleSwitchAndApplySearch
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fullscreenMode={fullscreenMode}
        setFullscreenMode={setFullscreenMode}
        quickActions={quickActions}
        setQuickActions={setQuickActions}
        notification={notification}
        setNotification={setNotification}
        onSolrDatabaseChange={handleSolrDatabaseChangeWithHistory}
        showNotification={showNotification}
      />
    </ErrorBoundary>
  );
});

HistText.displayName = 'HistText';

export default HistText;