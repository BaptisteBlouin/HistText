import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Box,
  CircularProgress
} from '@mui/material';
import { Storage } from '@mui/icons-material';
import AliasSelector from './AliasSelector';
import SolrDatabaseSelector from './SolrDatabaseSelector';
import axios from 'axios';

interface DatabaseSelectorProps {
  solrDatabases: any[];
  selectedSolrDatabase: any;
  onSolrDatabaseChange: (database: any) => void;
  aliases: string[];
  selectedAlias: string;
  onAliasChange: (alias: string) => void;
  allResults: any[];
  isDataLoading: boolean;
  isStatsLoading: boolean;
  isCloudLoading: boolean;
  isNERLoading: boolean;
  statsReady: boolean;
  stats: any;
  totalEntities: number;
}

interface CollectionInfo {
  collection_name: string;
  description: string;
  embeddings: string;
  lang: string | null;
  text_field: string;
  tokenizer: string | null;
  to_not_display: string[];
}

const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({
  solrDatabases,
  selectedSolrDatabase,
  onSolrDatabaseChange,
  aliases,
  selectedAlias,
  onAliasChange,
  allResults,
  isDataLoading,
  isStatsLoading,
  isCloudLoading,
  isNERLoading,
  statsReady,
  stats,
  totalEntities
}) => {
  const [collectionDescriptions, setCollectionDescriptions] = useState<Record<string, string>>({});
  const [isLoadingDescriptions, setIsLoadingDescriptions] = useState(false);

  // Fetch collection descriptions when the selected Solr database changes
  useEffect(() => {
    if (selectedSolrDatabase && selectedSolrDatabase.id) {
      setIsLoadingDescriptions(true);
      console.log('Fetching descriptions for database ID:', selectedSolrDatabase.id);
      
      axios
        .get(`/api/solr_database_info?solr_database_id=${selectedSolrDatabase.id}`)
        .then(response => {
          console.log('Collection info response:', response.data);
          
          const mapping: Record<string, string> = {};
          if (Array.isArray(response.data)) {
            response.data.forEach((info: CollectionInfo) => {
              mapping[info.collection_name] = info.description || 'No description available';
            });
          }
          
          console.log('Created description mapping:', mapping);
          setCollectionDescriptions(mapping);
        })
        .catch(error => {
          console.error('Failed to fetch collection descriptions:', error);
          setCollectionDescriptions({});
        })
        .finally(() => {
          setIsLoadingDescriptions(false);
        });
    } else {
      setCollectionDescriptions({});
    }
  }, [selectedSolrDatabase]);

  return (
    <Card sx={{ mb: 3, overflow: 'visible', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <CardContent sx={{ color: 'white' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <Storage />
          Data Source Configuration
        </Typography>
        
        <Grid container spacing={3} alignItems="flex-start">
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ opacity: 0.9 }}>
              Solr Database
            </Typography>
            <SolrDatabaseSelector
              solrDatabases={solrDatabases}
              selectedSolrDatabase={selectedSolrDatabase}
              onSolrDatabaseChange={onSolrDatabaseChange}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ opacity: 0.9 }}>
              Collection
              {isLoadingDescriptions && (
                <CircularProgress 
                  size={12} 
                  sx={{ color: 'white', ml: 1 }} 
                />
              )}
            </Typography>
            <AliasSelector
              aliases={aliases}
              selectedAlias={selectedAlias}
              onAliasChange={onAliasChange}
              descriptions={collectionDescriptions}
            />
          </Grid>
        </Grid>
        
        {(selectedAlias || selectedSolrDatabase) && (
          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {selectedSolrDatabase && (
              <Chip 
                label={`Database: ${selectedSolrDatabase.name}`} 
                size="small" 
                sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.2)', 
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}
              />
            )}
            {selectedAlias && (
              <Chip 
                label={`Collection: ${selectedAlias}`} 
                size="small" 
                sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.2)', 
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}
              />
            )}
            {collectionDescriptions[selectedAlias] && (
              <Chip 
                label="Has Description" 
                size="small" 
                sx={{ 
                  bgcolor: 'rgba(76, 175, 80, 0.2)', 
                  color: 'white',
                  border: '1px solid rgba(76, 175, 80, 0.3)'
                }}
              />
            )}
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
            {/* Loading and status chips remain the same */}
            {isDataLoading && (
              <Chip
                icon={<CircularProgress size={12} sx={{ color: 'white !important' }} />}
                label="Loading Data"
                size="small"
                sx={{
                  bgcolor: 'rgba(25, 118, 210, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(25, 118, 210, 0.3)',
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
            )}
            {isStatsLoading && (
              <Chip
                icon={<CircularProgress size={12} sx={{ color: 'white !important' }} />}
                label="Computing Stats"
                size="small"
                sx={{
                  bgcolor: 'rgba(156, 39, 176, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(156, 39, 176, 0.3)',
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
            )}
            {isCloudLoading && (
              <Chip
                icon={<CircularProgress size={12} sx={{ color: 'white !important' }} />}
                label="Generating Cloud"
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 152, 0, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(255, 152, 0, 0.3)',
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
            )}
            {isNERLoading && (
              <Chip
                icon={<CircularProgress size={12} sx={{ color: 'white !important' }} />}
                label="Processing NER"
                size="small"
                sx={{
                  bgcolor: 'rgba(244, 67, 54, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(244, 67, 54, 0.3)',
                  '& .MuiChip-icon': { color: 'white' }
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
};

export default DatabaseSelector;