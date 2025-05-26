import React from 'react';
import {
  Paper,
  Toolbar,
  Typography,
  Chip,
  Button,
  ButtonGroup,
  IconButton,
  TextField,
  InputAdornment,
  Stack,
  Menu,
  MenuItem,
  Box
} from '@mui/material';
import {
  TableChart,
  Download,
  Search,
  FilterList,
  Close,
  Fullscreen,
  MoreVert
} from '@mui/icons-material';

interface DataGridToolbarProps {
  resultsLength: number;
  showConcordance: boolean;
  mainTextColumn: string | null;
  cacheSize: number;
  searchText: string;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
  onExport: () => void;
  onFullscreen: () => void;
  menuAnchor: null | HTMLElement;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAutoSizeColumns: () => void;
  onClearCache: () => void;
}

const DataGridToolbar: React.FC<DataGridToolbarProps> = ({
  resultsLength,
  showConcordance,
  mainTextColumn,
  cacheSize,
  searchText,
  onSearchChange,
  onClearFilters,
  onExport,
  onFullscreen,
  menuAnchor,
  onMenuOpen,
  onMenuClose,
  onSelectAll,
  onDeselectAll,
  onAutoSizeColumns,
  onClearCache
}) => {
  return (
    <Paper elevation={1} sx={{ mb: 2 }}>
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <TableChart color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Data Grid {showConcordance && '(Concordance)'}
          </Typography>
          <Chip 
            label={`${resultsLength.toLocaleString()} records`} 
            size="small" 
            color={showConcordance ? "warning" : "primary"}
            variant="outlined"
          />
          {mainTextColumn && (
            <Chip 
              label={`Main: ${mainTextColumn}`}
              size="small" 
              color="secondary"
              variant="outlined"
            />
          )}
          <Chip 
            label={`Cache: ${cacheSize}`}
            size="small" 
            color="info"
            variant="outlined"
          />
        </Box>

        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: searchText && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={onClearFilters}>
                    <Close />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ minWidth: 200 }}
          />

          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={onExport}
            size="small"
          >
            Export
          </Button>

          <IconButton onClick={onClearFilters}>
            <FilterList />
          </IconButton>

          <IconButton onClick={onFullscreen}>
            <Fullscreen />
          </IconButton>

          <IconButton onClick={onMenuOpen}>
            <MoreVert />
          </IconButton>
        </Stack>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={onMenuClose}
        >
          <MenuItem onClick={() => { onSelectAll(); onMenuClose(); }}>
            Select All
          </MenuItem>
          <MenuItem onClick={() => { onDeselectAll(); onMenuClose(); }}>
            Deselect All
          </MenuItem>
          <MenuItem onClick={() => { onAutoSizeColumns(); onMenuClose(); }}>
            Auto-size Columns
          </MenuItem>
          <MenuItem onClick={() => { onClearCache(); onMenuClose(); }}>
            Clear Cache
          </MenuItem>
        </Menu>
      </Toolbar>
    </Paper>
  );
};

export default React.memo(DataGridToolbar);