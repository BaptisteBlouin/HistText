import React from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography
} from '@mui/material';
import { Search, Close } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

interface SearchHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onClearSearch: () => void;
  resultsCount: number;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

const SearchHeader: React.FC<SearchHeaderProps> = React.memo(({
  searchTerm,
  onSearchChange,
  onClearSearch,
  resultsCount,
  searchInputRef
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
      <TextField
        ref={searchInputRef}
        fullWidth
        size="small"
        placeholder="Search collections..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search color="action" />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={onClearSearch}
                edge="end"
              >
                <Close />
              </IconButton>
            </InputAdornment>
          )
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
            }
          }
        }}
      />
      
      {searchTerm && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {resultsCount} result{resultsCount !== 1 ? 's' : ''} found
        </Typography>
      )}
    </Box>
  );
});

SearchHeader.displayName = 'SearchHeader';

export default SearchHeader;