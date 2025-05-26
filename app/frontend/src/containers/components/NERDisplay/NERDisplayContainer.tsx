import React, { useState, useCallback, useRef } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { ModuleRegistry } from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
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
import { useNERData } from './hooks/useNERData';
import { useNERFilters } from './hooks/useNERFilters';

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
  
  // Local state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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

  const onGridReady = useCallback((params: any) => {
    params.api.sizeColumnsToFit();
  }, []);

  const downloadCSV = useCallback(() => {
    if (!displayEntities.length) {
      alert('No data to download');
      return;
    }
    
    const headers = ['Document ID', 'Entity Text', 'Entity Type', 'Start Position', 'End Position', 'Confidence', 'Confidence Level'];
    const csvRows = [headers.join(',')];

    displayEntities.forEach(row => {
      const values = [
        `"${row.id}"`,
        `"${row.text.replace(/"/g, '""')}"`,
        `"${row.labelFull}"`,
        row.start,
        row.end,
        row.confidence.toFixed(3),
        row.confidenceLevel
      ];
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ner_entities_filtered_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [displayEntities]);

  return (
    <Box sx={{ p: 3 }}>
      <NERHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        displayEntitiesLength={displayEntities.length}
        totalEntities={stats.totalEntities}
        selectedLabelsLength={selectedLabels.length}
        showAdvancedFilters={showAdvancedFilters}
        onToggleAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
        onDownloadCSV={downloadCSV}
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
    </Box>
  );
};

export default React.memo(NERDisplayContainer);