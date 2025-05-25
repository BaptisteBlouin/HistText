import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useHistTextData } from '../hooks/useHistTextData';
import { useHistTextActions } from '../hooks/useHistTextActions';
import { useWordCloudProcessor } from '../hooks/useWordCloudProcessor';
import HistTextLayout from './components/HistTextLayout';
import { FullscreenMode } from './components/TabNavigation';
import { Container, Paper, Typography } from '@mui/material';

// Memoized notification state interface
interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

// Constants to prevent inline object creation
const INITIAL_NOTIFICATION_STATE: NotificationState = {
  open: false,
  message: '',
  severity: 'info'
};

const AUTH_REQUIRED_STYLES = {
  mt: 8,
  textAlign: 'center' as const
} as const;

const AUTH_PAPER_STYLES = {
  p: 6,
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white'
} as const;

const HistText: React.FC = React.memo(() => {
  const { isAuthenticated } = useAuth();
  const data = useHistTextData();
  
  // Local state with optimized initial values
  const [activeTab, setActiveTab] = useState<number>(0);
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>('normal');
  const [quickActions, setQuickActions] = useState<boolean>(false);
  const [notification, setNotification] = useState<NotificationState>(INITIAL_NOTIFICATION_STATE);

  // Memoized notification handler
  const showNotification = useCallback((
    message: string, 
    severity: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    setNotification({ open: true, message, severity });
  }, []);

  // Memoized actions with proper dependencies
  const actions = useMemo(() => {
    return useHistTextActions({
      ...data,
      showNotification,
      setActiveTab
    });
  }, [data, showNotification]);

  // Optimized word cloud processor with dependency control
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
  }, [data]);

  // Optimized effect for loading Solr databases
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

  // Optimized effect for loading aliases
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

  // Memoized authentication check
  const authenticationContent = useMemo(() => {
    if (isAuthenticated) return null;

    return (
      <Container maxWidth="sm" sx={AUTH_REQUIRED_STYLES}>
        <Paper sx={AUTH_PAPER_STYLES}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            Authentication Required
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            Please log in to access HistText features.
          </Typography>
        </Paper>
      </Container>
    );
  }, [isAuthenticated]);

  // Early return for unauthenticated users
  if (!isAuthenticated) {
    return authenticationContent;
  }

  return (
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
  );
});

// Add display name for debugging
HistText.displayName = 'HistText';

export default HistText;