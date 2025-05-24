import React from 'react';
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
  return (
    <Card sx={{ mb: 3, overflow: 'visible', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <CardContent sx={{ color: 'white' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <Storage />
          Data Source Configuration
        </Typography>
        
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ opacity: 0.9 }}>
              Solr Database
            </Typography>
            <Box sx={{ minWidth: 200 }}>
              <select
                value={selectedSolrDatabase?.id || ''}
                onChange={(e) => {
                  const db = solrDatabases.find(db => db.id === Number(e.target.value));
                  onSolrDatabaseChange(db || null);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  color: '#333',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <option value="">Select a database...</option>
                {solrDatabases.map(db => (
                  <option key={db.id} value={db.id}>
                    {db.name}
                  </option>
                ))}
              </select>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ opacity: 0.9 }}>
              Collection
            </Typography>
            <Box sx={{ minWidth: 200 }}>
              <select
                value={selectedAlias}
                onChange={(e) => onAliasChange(e.target.value)}
                disabled={!selectedSolrDatabase}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: selectedSolrDatabase ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)',
                  color: selectedSolrDatabase ? '#333' : '#666',
                  cursor: selectedSolrDatabase ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease'
                }}
              >
                <option value="">Select a collection...</option>
                {aliases.map(alias => (
                  <option key={alias} value={alias}>
                    {alias}
                  </option>
                ))}
              </select>
            </Box>
          </Grid>
        </Grid>
        
        {selectedAlias && (
          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              label={`Database: ${selectedSolrDatabase?.name}`} 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.2)', 
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            />
            <Chip 
              label={`Collection: ${selectedAlias}`} 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.2)', 
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            />
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