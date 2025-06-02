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

/**
 * Props for the SearchHeader component.
 * 
 * @property searchTerm - The current value of the search input.
 * @property onSearchChange - Handler called on search input change.
 * @property onClearSearch - Handler called when the clear ("X") button is pressed.
 * @property resultsCount - Number of results to display.
 * @property searchInputRef - Ref for focusing or controlling the search input externally.
 */
interface SearchHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onClearSearch: () => void;
  resultsCount: number;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

/**
 * SearchHeader is a search bar with a search icon, clear button, and live results count.
 * Used above collection lists and similar views.
 */
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
      
      {/* Results count is shown only when searching */}
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