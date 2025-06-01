// app/frontend/src/containers/components/NERDisplay/NERDisplayContainer.tsx (updated to use new components)
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Box, useTheme, useMediaQuery, Tabs, Tab, Badge, CircularProgress, Typography } from '@mui/material';
import { ModuleRegistry } from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { 
  TableChart, 
  Insights, 
  Analytics, 
  TrendingUp
} from '@mui/icons-material';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import '../../css/HistText.css';

import DocumentDetailsModal from '../DocumentDetailsModal';
import NERHeader from './NERHeader';
import NERStats from './NERStats';
import NERFilters from './NERFilters';
import NEREntityTypes from './NEREntityTypes';
import NERDataGrid from './NERDataGrid';
import NERPerformanceHint from './NERPerformanceHint';
import NERInsights from './NERInsights'; // Updated modular component
import { useNERData } from './hooks/useNERData';
import { useNERFilters } from './hooks/useNERFilters';
import NERAnalyticsLimitDialog from './NERAnalyticsLimitDialog';
import config from '../../../../config.json';

ModuleRegistry.registerModules([ClientSideRowModelModule]);

interface NERDisplayContainerProps {
  nerData: Record<string, any>;
  authAxios: any;
  selectedAlias: string;
  selectedSolrDatabase: { id: number } | null;
  viewNER?: boolean;
}

const NERDisplayContainer: React.FC<NERDisplayContainerProps> = ({
  nerData,
  authAxios,
  selectedAlias,
  selectedSolrDatabase,
  viewNER = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false); 
  
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [entityLimit, setEntityLimit] = useState<number | undefined>(undefined);
  const [hasUserConfirmed, setHasUserConfirmed] = useState(false);

  // Local state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const totalEntities = useMemo(() => {
    return Object.values(nerData).reduce((total, data: any) => {
      return total + (Array.isArray(data.t) ? data.t.length : 0);
    }, 0);
  }, [nerData]);

  // Estimate processing time based on entity count
  const getEstimatedTime = (entityCount: number): string => {
    if (entityCount < 5000) return "< 1 second";
    if (entityCount < 15000) return "1-3 seconds";
    if (entityCount < 25000) return "3-8 seconds";
    if (entityCount < 50000) return "8-20 seconds";
    return "> 30 seconds";
  };

  // Process NER data
  const { entities, stats, processedData } = useNERData(nerData);

  // Filter state and logic
  const {
    searchTerm,
    setSearchTerm,
    selectedLabels,
    setSelectedLabels,
    minConfidence,
    setMinConfidence,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    showAdvancedFilters,
    setShowAdvancedFilters,
    quickFilterMode,
    setQuickFilterMode,
    filteredEntities,
    displayEntities,
    uniqueLabels,
    clearAllFilters
  } = useNERFilters(entities, stats);

  // Handlers
  const handleIdClick = useCallback((documentId: string) => {
    setSelectedDocumentId(documentId);
    setIsModalOpen(true);
  }, []);

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    if (newValue === 1 && activeTab !== 1) { // Switching to Advanced Analytics
      const maxEntities = config.NER_ANALYTICS_MAX_ENTITIES || 25000;
      
      if (totalEntities > maxEntities && !hasUserConfirmed) {
        setShowLimitDialog(true);
        return; // Don't switch tabs yet
      }
      
      setIsAnalyticsLoading(true);
      setTimeout(() => {
        setActiveTab(newValue);
        setTimeout(() => {
          setIsAnalyticsLoading(false);
        }, 100);
      }, 50);
    } else {
      setActiveTab(newValue);
    }
  }, [activeTab, totalEntities, hasUserConfirmed]);

  const handleLimitDialogResponse = useCallback((useLimited: boolean) => {
    const maxEntities = config.NER_ANALYTICS_MAX_ENTITIES || 25000;
    
    setShowLimitDialog(false);
    setHasUserConfirmed(true);
    
    if (useLimited) {
      setEntityLimit(maxEntities);
    } else {
      setEntityLimit(undefined); // Process all
    }
    
    // Now proceed to analytics tab
    setIsAnalyticsLoading(true);
    setTimeout(() => {
      setActiveTab(1);
      setTimeout(() => {
        setIsAnalyticsLoading(false);
      }, 100);
    }, 50);
  }, []);

  const handleLimitDialogClose = useCallback(() => {
    setShowLimitDialog(false);
    // Stay on current tab
  }, []);

  const onGridReady = useCallback((params: any) => {
    params.api.sizeColumnsToFit();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      {/* Enhanced Header with Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant={isMobile ? "scrollable" : "fullWidth"}
          scrollButtons={isMobile ? "auto" : false}
        >
          <Tab 
            icon={<TableChart />} 
            label="Entity Data" 
            iconPosition="start"
          />
           <Tab 
            icon={
              <Badge 
                badgeContent={
                  totalEntities > (config.NER_ANALYTICS_WARNING_THRESHOLD || 15000) ? "!" : "NEW"
                } 
                color={totalEntities > (config.NER_ANALYTICS_MAX_ENTITIES || 25000) ? "error" : "warning"}
                variant="dot"
              >
                {isAnalyticsLoading ? (
                  <CircularProgress size={20} sx={{ color: 'inherit' }} />
                ) : (
                  <Insights />
                )}
              </Badge>
            } 
            label={
              isAnalyticsLoading ? "Loading..." : 
              totalEntities > (config.NER_ANALYTICS_MAX_ENTITIES || 25000) ? "Advanced Analytics (!)" :
              "Advanced Analytics"
            }
            iconPosition="start"
            disabled={isAnalyticsLoading}
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <>
          <NERHeader
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            displayEntitiesLength={displayEntities.length}
            totalEntities={stats.totalEntities}
            selectedLabelsLength={selectedLabels.length}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
            onDownloadCSV={() => {}} // Implement download CSV
            onClearAllFilters={clearAllFilters}
            quickFilterMode={quickFilterMode}
          />

          <NERStats
            stats={stats}
            displayEntitiesLength={displayEntities.length}
            searchTerm={searchTerm}
          />

          <NERFilters
            showAdvancedFilters={showAdvancedFilters}
            searchTerm={searchTerm}
            minConfidence={minConfidence}
            onMinConfidenceChange={setMinConfidence}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />

          <NEREntityTypes
            stats={stats}
            uniqueLabels={uniqueLabels}
            selectedLabels={selectedLabels}
            onLabelToggle={(label) => {
              setSelectedLabels(prev => 
                prev.includes(label) 
                  ? prev.filter(l => l !== label)
                  : [...prev, label]
              );
            }}
            onSelectAll={() => setSelectedLabels(uniqueLabels)}
            onSelectNone={() => setSelectedLabels([])}
            filteredEntities={filteredEntities}
            quickFilterMode={quickFilterMode}
            onQuickFilterChange={setQuickFilterMode}
          />

          <NERDataGrid
            displayEntities={displayEntities}
            stats={stats}
            isMobile={isMobile}
            onGridReady={onGridReady}
            onIdClick={handleIdClick}
          />

          <NERPerformanceHint totalEntities={stats.totalEntities} />
        </>
      )}

      {activeTab === 1 && (
        <>
          {isAnalyticsLoading ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              minHeight: '400px',
              gap: 2 
            }}>
              <CircularProgress size={60} />
              <Typography variant="h6" color="text.secondary">
                Computing Advanced Analytics...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Analyzing {entityLimit ? `${entityLimit.toLocaleString()} of ${totalEntities.toLocaleString()}` : totalEntities.toLocaleString()} entities
              </Typography>
            </Box>
          ) : (
            <NERInsights 
              nerData={nerData}
              selectedAlias={selectedAlias}
              onDocumentClick={handleIdClick}
              entityLimit={entityLimit}
              entities={entities}
            />
          )}
        </>
      )}

      <DocumentDetailsModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentId={selectedDocumentId || ''}
        collectionName={selectedAlias}
        solrDatabaseId={selectedSolrDatabase?.id || null}
        authAxios={authAxios}
        nerData={nerData}
        viewNER={viewNER}
      />

      <NERAnalyticsLimitDialog
        open={showLimitDialog}
        onClose={handleLimitDialogClose}
        onProceed={handleLimitDialogResponse}
        totalEntities={totalEntities}
        maxEntities={config.NER_ANALYTICS_MAX_ENTITIES || 25000}
        estimatedTime={getEstimatedTime(totalEntities)}
      />
    </Box>
  );
};

export default React.memo(NERDisplayContainer);