import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  Chip,
  Stack,
  Badge,
  useTheme
} from '@mui/material';
import { Category, FilterList, Speed } from '@mui/icons-material';

interface NEREntityTypesProps {
  stats: any;
  uniqueLabels: string[];
  selectedLabels: string[];
  onLabelToggle: (label: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  filteredEntities: any[];
  quickFilterMode: 'all' | 'high' | 'medium' | 'low';
  onQuickFilterChange: (mode: 'all' | 'high' | 'medium' | 'low') => void;
}

const NEREntityTypes: React.FC<NEREntityTypesProps> = ({
  stats,
  uniqueLabels,
  selectedLabels,
  onLabelToggle,
  onSelectAll,
  onSelectNone,
  filteredEntities,
  quickFilterMode,
  onQuickFilterChange
}) => {
  const theme = useTheme();

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Category />
          Entity Types
          {selectedLabels.length > 0 && (
            <Badge badgeContent={selectedLabels.length} color="primary">
              <FilterList />
            </Badge>
          )}
        </Typography>
        
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={onSelectAll}
            disabled={selectedLabels.length === uniqueLabels.length}
          >
            All
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={onSelectNone}
            disabled={selectedLabels.length === 0}
          >
            None
          </Button>
        </Stack>
      </Box>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {Object.entries(stats.byLabel)
          .sort(([,a], [,b]) => b.count - a.count)
          .map(([labelFull, { count, originalLabel, color }]) => {
            const isSelected = selectedLabels.includes(originalLabel);
            
            return (
              <Chip
                key={labelFull}
                label={`${labelFull} (${count})`}
                clickable
                variant={isSelected ? 'filled' : 'outlined'}
                sx={{
                  backgroundColor: isSelected ? color : 'transparent',
                  borderColor: color,
                  color: isSelected ? 'white' : color,
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: isSelected ? `${color}dd` : `${color}20`,
                    transform: 'translateY(-1px)',
                    boxShadow: theme.shadows[2]
                  },
                  transition: 'all 0.2s ease'
                }}
                onClick={() => onLabelToggle(originalLabel)}
              />
            );
          })}
      </Box>
      
      {/* Integrated Confidence Distribution with Quick Filters */}
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Speed />
          Confidence Quick Filters
          {quickFilterMode !== 'all' && (
            <Badge badgeContent="!" color="primary">
              <FilterList />
            </Badge>
          )}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip 
            label={`All (${filteredEntities.length})`}
            clickable
            variant={quickFilterMode === 'all' ? 'filled' : 'outlined'}
            color="primary"
            onClick={() => onQuickFilterChange('all')}
            sx={{
              fontWeight: 600,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: theme.shadows[2]
              },
              transition: 'all 0.2s ease'
            }}
          />
          <Chip 
            label={`High Confidence (${stats.confidenceDistribution.high})`}
            clickable
            variant={quickFilterMode === 'high' ? 'filled' : 'outlined'}
            color="success"
            onClick={() => onQuickFilterChange('high')}
            sx={{
              fontWeight: 600,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: theme.shadows[2]
              },
              transition: 'all 0.2s ease'
            }}
          />
          <Chip 
            label={`Medium Confidence (${stats.confidenceDistribution.medium})`}
            clickable
            variant={quickFilterMode === 'medium' ? 'filled' : 'outlined'}
            color="warning"
            onClick={() => onQuickFilterChange('medium')}
            sx={{
              fontWeight: 600,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: theme.shadows[2]
              },
              transition: 'all 0.2s ease'
            }}
          />
          <Chip 
            label={`Low Confidence (${stats.confidenceDistribution.low})`}
            clickable
            variant={quickFilterMode === 'low' ? 'filled' : 'outlined'}
            color="error"
            onClick={() => onQuickFilterChange('low')}
            sx={{
              fontWeight: 600,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: theme.shadows[2]
              },
              transition: 'all 0.2s ease'
            }}
          />
        </Stack>
        
        {/* Show percentage breakdown */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
          <Typography variant="caption">
            Distribution: {((stats.confidenceDistribution.high / stats.totalEntities) * 100).toFixed(1)}% high, {' '}
            {((stats.confidenceDistribution.medium / stats.totalEntities) * 100).toFixed(1)}% medium, {' '}
            {((stats.confidenceDistribution.low / stats.totalEntities) * 100).toFixed(1)}% low
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default React.memo(NEREntityTypes);