import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useHistTextData } from '../hooks/useHistTextData';
import { useHistTextActions } from '../hooks/useHistTextActions';
import { useWordCloudProcessor } from '../hooks/useWordCloudProcessor';
import HistTextLayout from './components/HistTextLayout';
import { FullscreenMode } from './components/TabNavigation'; // Import the type
import { Container, Paper, Typography } from '@mui/material';

const HistText: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const data = useHistTextData();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>('normal'); // Updated state
  const [quickActions, setQuickActions] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const actions = useHistTextActions({
    ...data,
    showNotification,
    setActiveTab
  });

  useWordCloudProcessor({
    allResults: data.allResults,
    authAxios: data.authAxios,
    setWordFrequency: data.setWordFrequency,
    setIsCloudLoading: data.setIsCloudLoading,
    setCloudProgress: data.setCloudProgress,
    showNotification
  });

  // Load Solr databases on mount
  useEffect(() => {
    data.authAxios
      .get('/api/solr_databases')
      .then(response => {
        if (Array.isArray(response.data)) {
          data.setSolrDatabases(response.data);
        } else {
          console.error('Response data is not an array:', response.data);
        }
      })
      .catch(error => {
        console.error('Error fetching Solr databases:', error);
        showNotification('Failed to fetch Solr databases', 'error');
      });
  }, [data.authAxios]);

  // Load aliases when database changes
  useEffect(() => {
    if (data.selectedSolrDatabase) {
      data.authAxios
        .get(`/api/solr/aliases?solr_database_id=${data.selectedSolrDatabase.id}`)
        .then(response => {
          if (Array.isArray(response.data)) {
            data.setAliases(response.data);
          } else {
            console.error('Response data is not an array:', response.data);
          }
        })
        .catch(error => {
          console.error('Error fetching aliases:', error);
          showNotification('Failed to fetch collections', 'error');
        });
    } else {
      data.setAliases([]);
    }
  }, [data.selectedSolrDatabase, data.authAxios]);

  const handleSolrDatabaseChange = (database: any) => {
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
  };

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
    <HistTextLayout
      data={data}
      actions={actions}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      fullscreenMode={fullscreenMode} // Updated prop
      setFullscreenMode={setFullscreenMode} // Updated prop
      quickActions={quickActions}
      setQuickActions={setQuickActions}
      notification={notification}
      setNotification={setNotification}
      onSolrDatabaseChange={handleSolrDatabaseChange}
      showNotification={showNotification}
    />
  );
};

export default HistText;