import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { StatusChip } from '../../../components/ui';

/**
 * Props for the StatusIndicators component, showing database/collection status and loading.
 */
interface StatusIndicatorsProps {
  selectedSolrDatabase: any;
  selectedAlias: string;
  collectionDescriptions: Record<string, string>;
  allResults: any[];
  isDataLoading: boolean;
  isStatsLoading: boolean;
  isCloudLoading: boolean;
  isNERLoading: boolean;
  statsReady: boolean;
  stats: any;
  totalEntities: number;
}

/**
 * Displays a row of status chips summarizing selection, loading, and stats status
 * for Solr database, collection, data results, and various loading stages.
 *
 * @param props - StatusIndicatorsProps
 * @returns Status chip row or null if nothing selected.
 */
const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  selectedSolrDatabase,
  selectedAlias,
  collectionDescriptions,
  allResults,
  isDataLoading,
  isStatsLoading,
  isCloudLoading,
  isNERLoading,
  statsReady,
  stats,
  totalEntities
}) => {
  if (!selectedAlias && !selectedSolrDatabase) {
    return null;
  }

  return (
    <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {selectedSolrDatabase && (
        <StatusChip 
          status="default"
          label={`Database: ${selectedSolrDatabase.name}`}
          sx={{ 
            bgcolor: 'rgba(255, 255, 255, 0.2)', 
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}
        />
      )}
      
      {selectedAlias && (
        <StatusChip 
          status="default"
          label={`Collection: ${selectedAlias}`}
          sx={{ 
            bgcolor: 'rgba(255, 255, 255, 0.2)', 
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}
        />
      )}
      
      {collectionDescriptions[selectedAlias] && (
        <StatusChip 
          status="success"
          label="Has Description"
          sx={{ 
            bgcolor: 'rgba(76, 175, 80, 0.2)', 
            color: 'white',
            border: '1px solid rgba(76, 175, 80, 0.3)'
          }}
        />
      )}
      
      {allResults.length > 0 && (
        <StatusChip 
          status="success"
          count={allResults.length}
          label="documents"
          sx={{ 
            bgcolor: 'rgba(76, 175, 80, 0.2)', 
            color: 'white',
            border: '1px solid rgba(76, 175, 80, 0.3)'
          }}
        />
      )}

      {isDataLoading && (
        <StatusChip
          status="loading"
          label="Loading Data"
          icon={<CircularProgress size={12} sx={{ color: 'white !important' }} />}
          sx={{
            bgcolor: 'rgba(25, 118, 210, 0.2)',
            color: 'white',
            border: '1px solid rgba(25, 118, 210, 0.3)',
            '& .MuiChip-icon': { color: 'white' }
          }}
        />
      )}

      {isStatsLoading && (
        <StatusChip
          status="loading"
          label="Computing Stats"
          icon={<CircularProgress size={12} sx={{ color: 'white !important' }} />}
          sx={{
            bgcolor: 'rgba(156, 39, 176, 0.2)',
            color: 'white',
            border: '1px solid rgba(156, 39, 176, 0.3)',
            '& .MuiChip-icon': { color: 'white' }
          }}
        />
      )}

      {isCloudLoading && (
        <StatusChip
          status="loading"
          label="Generating Cloud"
          icon={<CircularProgress size={12} sx={{ color: 'white !important' }} />}
          sx={{
            bgcolor: 'rgba(255, 152, 0, 0.2)',
            color: 'white',
            border: '1px solid rgba(255, 152, 0, 0.3)',
            '& .MuiChip-icon': { color: 'white' }
          }}
        />
      )}

      {isNERLoading && (
        <StatusChip
          status="loading"
          label="Processing NER"
          icon={<CircularProgress size={12} sx={{ color: 'white !important' }} />}
          sx={{
            bgcolor: 'rgba(244, 67, 54, 0.2)',
            color: 'white',
            border: '1px solid rgba(244, 67, 54, 0.3)',
            '& .MuiChip-icon': { color: 'white' }
          }}
        />
      )}

      {statsReady && stats?.corpus_overview?.total_documents != null && (
        <StatusChip
          status="info"
          label={`Maximum Docs: ${stats.corpus_overview.total_documents}`}
          sx={{
            bgcolor: 'rgba(25, 118, 210, 0.2)',
            color: 'white',
            border: '1px solid rgba(25, 118, 210, 0.3)'
          }}
        />
      )}

      {totalEntities > 0 && (
        <StatusChip
          status="info"
          count={totalEntities}
          label="Entities"
          sx={{
            bgcolor: 'rgba(123, 31, 162, 0.2)',
            color: 'white',
            border: '1px solid rgba(123, 31, 162, 0.3)'
          }}
        />
      )}
    </Box>
  );
};

export default React.memo(StatusIndicators);