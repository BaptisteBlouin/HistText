import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Stack,
  FormControlLabel,
  Switch,
  Badge,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  AccountTree,
  Search,
  TuneSharp,
  Download,
  Clear,
  FilterList
} from '@mui/icons-material';
import { SearchField } from '../../../components/ui';

interface NERHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  displayEntitiesLength: number;
  totalEntities: number;
  selectedLabelsLength: number;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  onDownloadCSV: () => void;
  onClearAllFilters: () => void;
  quickFilterMode: string;
}

const NERHeader: React.FC<NERHeaderProps> = ({
  searchTerm,
  onSearchChange,
  displayEntitiesLength,
  totalEntities,
  selectedLabelsLength,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  onDownloadCSV,
  onClearAllFilters,
  quickFilterMode
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountTree />
            Named Entity Recognition
            {searchTerm && <Badge badgeContent="!" color="primary"><Search /></Badge>}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {displayEntitiesLength} of {totalEntities} entities
            {selectedLabelsLength > 0 && ` • ${selectedLabelsLength} types filtered`}
            {searchTerm && ` • "${searchTerm}"`}
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={1}>
          <Tooltip title="Advanced Filters">
            <IconButton onClick={onToggleAdvancedFilters}>
              <Badge badgeContent={showAdvancedFilters ? '!' : 0} color="primary">
                <TuneSharp />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Download CSV">
            <IconButton onClick={onDownloadCSV} disabled={displayEntitiesLength === 0}>
              <Download />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Search bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <SearchField
          value={searchTerm}
          onChange={onSearchChange}
          placeholder="Search entities, types, or documents..."
          size="small"
          sx={{ flexGrow: 1, maxWidth: 400 }}
        />
        
        <Button 
          variant="outlined" 
          onClick={onClearAllFilters}
          startIcon={<Clear />}
          color="error"
          size="small"
          disabled={!searchTerm && selectedLabelsLength === 0 && quickFilterMode === 'all'}
        >
          Clear All
        </Button>
      </Box>
    </Box>
  );
};

export default React.memo(NERHeader);