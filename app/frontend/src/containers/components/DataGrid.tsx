import React, { useMemo, useRef, useCallback, useState, memo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { 
  Button, 
  Box, 
  Typography, 
  Paper, 
  Toolbar, 
  IconButton, 
  Tooltip, 
  Chip,
  Stack,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Alert
} from '@mui/material';
import { 
  Download, 
  Search, 
  FilterList, 
  MoreVert,
  Fullscreen,
  TableChart,
  Close,
  Info
} from '@mui/icons-material';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import config from '../../../config.json';
import DocumentDetailsModal from './DocumentDetailsModal';

const viewNERFields = config.viewNERFields;
const NER_LABELS_COLORS = config.NER_LABELS_COLORS;
const NERLABELS2FULL = config.NERLABELS2FULL;
const CONCORDANCE_THRESHOLD = 100; // Show concordance when more than 100 results

const ID_FIELD_NAMES = [
  'id', 'Id', 'ID', 'docId', 'DocId', 'documentId', 'DocumentId',
  'identifier', 'Identifier', 'doc_id', 'document_id', '_id',
];

// Simple cache for processed content
const contentCache = new Map();
const MAX_CACHE_SIZE = 1000;

// Helper function to clear cache when it gets too large
const manageCacheSize = () => {
  if (contentCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(contentCache.entries());
    contentCache.clear();
    entries.slice(-500).forEach(([key, value]) => {
      contentCache.set(key, value);
    });
  }
};

// Helper function to create concordance (snippet around search terms)
const createConcordance = (text, searchTerms, contextLength = 100) => {
  // FIXED: Ensure text is a string
  if (!text || typeof text !== 'string') return text?.toString() || '';
  if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) return text;
  
  const lowerText = text.toLowerCase();
  const matches = [];
  
  // Find all matches for all search terms
  searchTerms.forEach(term => {
    if (term && typeof term === 'string' && term.length > 1) {
      const lowerTerm = term.toLowerCase();
      let index = lowerText.indexOf(lowerTerm);
      while (index !== -1) {
        matches.push({
          start: index,
          end: index + lowerTerm.length,
          term: term
        });
        index = lowerText.indexOf(lowerTerm, index + 1);
      }
    }
  });
  
  if (matches.length === 0) {
    // No matches found, return beginning of text
    return text.length > contextLength * 2 
      ? text.substring(0, contextLength * 2) + '...'
      : text;
  }
  
  // Sort matches by position and merge overlapping contexts
  matches.sort((a, b) => a.start - b.start);
  
  const contexts = [];
  matches.forEach(match => {
    const start = Math.max(0, match.start - contextLength);
    const end = Math.min(text.length, match.end + contextLength);
    
    // Check if this context overlaps with the last one
    const lastContext = contexts[contexts.length - 1];
    if (lastContext && start <= lastContext.end + 20) {
      // Extend the last context
      lastContext.end = Math.max(lastContext.end, end);
    } else {
      contexts.push({ start, end });
    }
  });
  
  // Create concordance text
  let concordance = '';
  contexts.forEach((context, index) => {
    if (index > 0) concordance += ' ... ';
    if (context.start > 0) concordance += '...';
    concordance += text.substring(context.start, context.end);
    if (context.end < text.length) concordance += '...';
  });
  
  return concordance;
};

// Optimized NER and highlighting renderer
const CellRenderer = memo(({ 
  value, 
  colDef, 
  data, 
  nerData, 
  viewNER, 
  formData, 
  onIdClick, 
  showConcordance = false,
  mainTextColumn 
}) => {
  const field = colDef.field;
  const isId = useMemo(() => 
    ID_FIELD_NAMES.some(idName =>
      field === idName ||
      field.toLowerCase() === idName.toLowerCase() ||
      field.toLowerCase().includes('_id') ||
      field.toLowerCase().includes('id_')
    ), [field]);

  const processedContent = useMemo(() => {
    if (!value && value !== 0) return null;

    // FIXED: Ensure we have a string value
    let stringValue = '';
    if (typeof value === 'string') {
      stringValue = value;
    } else if (typeof value === 'number') {
      stringValue = value.toString();
    } else if (value !== null && value !== undefined) {
      stringValue = String(value);
    } else {
      return null;
    }

    const documentId = isId ? value : data.id;
    
    // Apply concordance for main text column when showing concordance mode
    const isMainTextColumn = field === mainTextColumn;
    if (showConcordance && isMainTextColumn) {
      const searchTerms = formData[field]?.map(e => e.value).filter(w => w && typeof w === 'string') || [];
      if (searchTerms.length > 0) {
        stringValue = createConcordance(stringValue, searchTerms);
      } else if (stringValue.length > 300) {
        // If no search terms but long text, show beginning
        stringValue = stringValue.substring(0, 300) + '...';
      }
    }
    
    // Create cache key
    const searchTerms = formData[field]?.map(e => e.value).filter(w => w && typeof w === 'string') || [];
    const cacheKey = `${documentId}_${field}_${stringValue.slice(0, 50)}_${viewNER}_${showConcordance}_${searchTerms.join('_')}`;
    
    // Check cache first
    if (contentCache.has(cacheKey)) {
      return contentCache.get(cacheKey);
    }

    let elements = [];
    let lastIndex = 0;

    // Process NER if applicable
    const shouldHighlightNER = viewNER &&
      viewNERFields.some(fieldValue => field === fieldValue || field.includes(fieldValue)) &&
      nerData?.[documentId]?.t &&
      Array.isArray(nerData[documentId].t);

    if (shouldHighlightNER && !showConcordance) { // Skip NER in concordance mode for performance
      try {
        const annotations = nerData[documentId].t.map((text, index) => ({
          s: nerData[documentId].s[index],
          e: nerData[documentId].e[index],
          l: nerData[documentId].l[index],
        })).sort((a, b) => a.s - b.s);

        annotations.forEach(({ s, e, l }) => {
          if (s > lastIndex && s < stringValue.length) {
            elements.push({ type: 'text', content: stringValue.slice(lastIndex, s) });
          }
          if (s < stringValue.length) {
            const endPos = Math.min(e, stringValue.length);
            const label = l[0];
            const color = NER_LABELS_COLORS[label] || '#gray';
            elements.push({
              type: 'ner',
              content: stringValue.slice(s, endPos),
              color: color,
              label: NERLABELS2FULL[label] || label,
              key: `${s}-${endPos}`
            });
            lastIndex = endPos;
          }
        });

        if (lastIndex < stringValue.length) {
          elements.push({ type: 'text', content: stringValue.slice(lastIndex) });
        }
      } catch (error) {
        console.error('Error processing NER annotations:', error);
        elements = [{ type: 'text', content: stringValue }];
      }
    } else {
      elements = [{ type: 'text', content: stringValue }];
    }

    // Apply search highlighting
    if (searchTerms.length > 0) {
      elements = elements.flatMap(element => {
        if (element.type === 'text') {
          let content = element.content;
          
          // FIXED: Ensure content is a string
          if (typeof content !== 'string') {
            content = String(content || '');
          }
          
          searchTerms.slice(0, 5).forEach(term => {
            if (term && typeof term === 'string' && term.length > 1) {
              const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`(${escapedTerm})`, 'gi');
              
              // FIXED: Check if content is still a string before splitting
              if (typeof content === 'string') {
                const parts = content.split(regex);
                const newElements = [];
                parts.forEach((part, index) => {
                  if (index % 2 === 1) {
                    newElements.push({ type: 'highlight', content: part, key: `${term}-${index}` });
                  } else if (part) {
                    newElements.push({ type: 'text', content: part });
                  }
                });
                if (newElements.length > 0) {
                  content = newElements;
                }
              }
            }
          });
          return Array.isArray(content) ? content : [{ type: 'text', content: String(content) }];
        }
        return [element];
      });
    }

    // Cache the result
    contentCache.set(cacheKey, elements);
    manageCacheSize();
    
    return elements;
  }, [value, field, data, nerData, viewNER, formData, isId, showConcordance, mainTextColumn]);

  if (!value && value !== 0) return null;

  if (isId) {
    return (
      <Box
        onClick={() => onIdClick(value)}
        sx={{
          cursor: 'pointer',
          color: 'primary.main',
          textDecoration: 'underline',
          fontWeight: 'bold',
          padding: '4px',
          '&:hover': {
            backgroundColor: 'primary.light',
            color: 'primary.contrastText',
            borderRadius: 1
          }
        }}
      >
        {String(value)}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        lineHeight: 1.4,
        width: '100%',
        padding: '6px 8px',
        fontSize: '0.875rem'
      }}
    >
      {processedContent?.map((element, index) => {
        if (element.type === 'ner') {
          return (
            <Chip
              key={element.key || `ner-${index}`}
              label={`${element.content} (${element.label})`}
              size="small"
              sx={{
                backgroundColor: element.color,
                color: 'white',
                margin: '2px',
                fontWeight: 500,
                fontSize: '0.75rem'
              }}
            />
          );
        } else if (element.type === 'highlight') {
          return (
            <Box
              key={element.key || `highlight-${index}`}
              component="span"
              sx={{
                backgroundColor: 'warning.light',
                color: 'warning.contrastText',
                padding: '2px 4px',
                borderRadius: 1,
                fontWeight: 600
              }}
            >
              {String(element.content)}
            </Box>
          );
        } else {
          return <span key={`text-${index}`}>{String(element.content)}</span>;
        }
      })}
    </Box>
  );
});

const DataGridComponent = memo(({
  results,
  formData,
  nerData,
  viewNER,
  selectedAlias,
  selectedSolrDatabase,
  authAxios,
  isAllResultsTab = false, // New prop to indicate if this is the "All Results" tab
}) => {
  const gridRef = useRef();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [fullscreen, setFullscreen] = useState(false);

  // Determine if we should show concordance mode
  const showConcordance = isAllResultsTab && results.length > CONCORDANCE_THRESHOLD;

  // Find the main text column and calculate optimized column sizes
  const { mainTextColumn, columnSizes } = useMemo(() => {
    if (results.length === 0) return { mainTextColumn: null, columnSizes: {} };
    
    // Sample first 20 rows for performance
    const sample = results.slice(0, Math.min(20, results.length));
    const fields = Object.keys(results[0])
      .filter(key => !(key.startsWith('_') && key.endsWith('_')))
      .filter(key => !key.startsWith('score'));

    // Calculate average content length for each field
    const fieldStats = {};
    fields.forEach(field => {
      const lengths = sample.map(row => {
        const value = row[field];
        // FIXED: Handle non-string values
        const stringValue = value ? String(value) : '';
        return stringValue.length;
      });
      
      const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
      const maxLength = Math.max(...lengths);
      
      fieldStats[field] = {
        avgLength,
        maxLength,
        totalChars: lengths.reduce((sum, len) => sum + len, 0)
      };
    });

    // Find the main text column (highest total character count)
    const mainTextColumn = fields.reduce((max, field) => 
      fieldStats[field].totalChars > (fieldStats[max]?.totalChars || 0) ? field : max
    );

    // Calculate column sizes
    const sizes = {};
    const totalAvailableWidth = 100; // percentage
    let usedWidth = 0;

    // First pass: assign widths to non-main columns based on content
    fields.forEach(field => {
      if (field === mainTextColumn) return;
      
      const { avgLength, maxLength } = fieldStats[field];
      const isId = ID_FIELD_NAMES.some(idName =>
        field === idName ||
        field.toLowerCase() === idName.toLowerCase() ||
        field.toLowerCase().includes('_id') ||
        field.toLowerCase().includes('id_')
      );

      let width;
      if (isId) {
        // ID columns: just fit the content
        width = Math.min(15, Math.max(8, avgLength * 0.6));
      } else if (maxLength <= 10) {
        // Very short content
        width = Math.max(6, Math.min(12, maxLength * 0.8));
      } else if (avgLength <= 20) {
        // Short content
        width = Math.max(8, Math.min(15, avgLength * 0.7));
      } else if (avgLength <= 50) {
        // Medium content
        width = Math.max(12, Math.min(20, avgLength * 0.4));
      } else {
        // Long content (but not the main column)
        width = Math.max(15, Math.min(25, avgLength * 0.3));
      }

      sizes[field] = width;
      usedWidth += width;
    });

    // Second pass: assign remaining width to main text column
    if (mainTextColumn) {
      const remainingWidth = Math.max(30, totalAvailableWidth - usedWidth);
      sizes[mainTextColumn] = remainingWidth;
    }

    return { mainTextColumn, columnSizes: sizes };
  }, [results]);

  const handleIdClick = useCallback((documentId) => {
    setSelectedDocumentId(documentId);
    setIsModalOpen(true);
  }, []);

  const rowData = useMemo(() => 
    results.map((row, i) => ({ ...row, id: row.id || i })), 
    [results]
  );

  const columnDefs = useMemo(() => {
    if (results.length === 0) return [];

    return Object.keys(results[0])
      .filter(key => !(key.startsWith('_') && key.endsWith('_')))
      .filter(key => !key.startsWith('score'))
      .map(key => {
        const isMainColumn = key === mainTextColumn;
        const isId = ID_FIELD_NAMES.some(idName =>
          key === idName ||
          key.toLowerCase() === idName.toLowerCase() ||
          key.toLowerCase().includes('_id') ||
          key.toLowerCase().includes('id_')
        );

        return {
          field: key,
          headerName: key.length > 20 ? `${key.slice(0, 20)}...` : key,
          width: columnSizes[key] ? Math.round(columnSizes[key] * 8) : 120,
          sortable: true,
          filter: true,
          wrapText: isMainColumn,
          autoHeight: isMainColumn && !showConcordance, // Don't use autoHeight in concordance mode
          resizable: true,
          minWidth: isId ? 80 : (isMainColumn ? 200 : 100),
          maxWidth: isMainColumn ? undefined : (isId ? 150 : 300),
          headerTooltip: key,
          cellRenderer: CellRenderer,
          cellRendererParams: {
            nerData,
            viewNER,
            formData,
            onIdClick: handleIdClick,
            showConcordance,
            mainTextColumn,
          },
          headerClass: isMainColumn ? 'main-column-header' : (isId ? 'id-column-header' : ''),
          cellClass: isMainColumn ? 'main-column-cell' : (isId ? 'id-column-cell' : ''),
        };
      });
  }, [results, columnSizes, mainTextColumn, nerData, viewNER, formData, handleIdClick, showConcordance]);

  const onGridReady = useCallback(() => {
    setTimeout(() => {
      gridRef.current?.api?.sizeColumnsToFit();
    }, 100);
  }, []);

  const downloadCSV = useCallback(() => {
    if (results.length === 0) return;

    const headers = Object.keys(results[0]).filter(
      key => !(key.startsWith('_') && key.endsWith('_'))
    );
    const csvRows = [headers.join(',')];

    results.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        // FIXED: Handle non-string values properly
        const stringValue = value !== null && value !== undefined ? String(value) : '';
        return `"${stringValue.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `histtext-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const handleSearch = useCallback((event) => {
    const value = event.target.value;
    setSearchText(value);
    gridRef.current?.api?.setQuickFilter(value);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchText('');
    gridRef.current?.api?.setQuickFilter('');
    gridRef.current?.api?.setFilterModel(null);
    contentCache.clear();
  }, []);

  const defaultColDef = useMemo(() => ({
    filter: true,
    resizable: true,
    sortable: true,
    suppressSizeToFit: false,
  }), []);

  // Add custom styles for main column
  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .main-column-header {
        background-color: #e8f4f8 !important;
        font-weight: 700 !important;
        border-left: 3px solid #1976d2 !important;
      }
      .main-column-cell {
        border-left: 2px solid #e3f2fd !important;
        background-color: #fafffe !important;
      }
      .id-column-header {
        background-color: #f3e5f5 !important;
        font-weight: 600 !important;
      }
      .id-column-cell {
        background-color: #faf8ff !important;
      }
      .ag-theme-alpine .ag-header-cell {
        font-weight: 600;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  if (results.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <TableChart sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" color="text.secondary">
          No data to display
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%' }}>
      {showConcordance && (
        <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Concordance Mode:</strong> Showing text snippets around search terms for {results.length} results. 
            NER highlighting is disabled for performance. Click document IDs to view full content.
          </Typography>
        </Alert>
      )}

      <Paper elevation={1} sx={{ mb: 2 }}>
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <TableChart color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Data Grid {showConcordance && '(Concordance)'}
            </Typography>
            <Chip 
              label={`${results.length.toLocaleString()} records`} 
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
              label={`Cache: ${contentCache.size}`}
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
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
                endAdornment: searchText && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={clearFilters}>
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
              onClick={() => setExportDialogOpen(true)}
              size="small"
            >
              Export
            </Button>

            <IconButton onClick={clearFilters}>
              <FilterList />
            </IconButton>

            <IconButton onClick={() => setFullscreen(!fullscreen)}>
              <Fullscreen />
            </IconButton>

            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVert />
            </IconButton>
          </Stack>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem onClick={() => { gridRef.current?.api?.selectAll(); setMenuAnchor(null); }}>
              Select All
            </MenuItem>
            <MenuItem onClick={() => { gridRef.current?.api?.deselectAll(); setMenuAnchor(null); }}>
              Deselect All
            </MenuItem>
            <MenuItem onClick={() => { gridRef.current?.api?.autoSizeAllColumns(); setMenuAnchor(null); }}>
              Auto-size Columns
            </MenuItem>
            <MenuItem onClick={() => { contentCache.clear(); setMenuAnchor(null); }}>
              Clear Cache
            </MenuItem>
          </Menu>
        </Toolbar>
      </Paper>
      
      <Paper 
        elevation={2} 
        sx={{ 
          height: fullscreen ? '90vh' : (isMobile ? '50vh' : '70vh'),
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Box className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            onGridReady={onGridReady}
            pagination={true}
            paginationPageSize={showConcordance ? 100 : (isMobile ? 25 : 50)}
            paginationPageSizeSelector={showConcordance ? [50, 100, 200] : [25, 50, 100]}
            defaultColDef={defaultColDef}
            suppressCellFocus={true}
            enableCellTextSelection={true}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            enableRangeSelection={true}
            animateRows={!showConcordance}
            rowBuffer={showConcordance ? 20 : 10}
            suppressScrollOnNewData={true}
            suppressColumnVirtualisation={false}
            sideBar={{
              toolPanels: [
                {
                  id: 'columns',
                  labelDefault: 'Columns',
                  toolPanel: 'agColumnsToolPanel',
                },
                {
                  id: 'filters',
                  labelDefault: 'Filters',
                  toolPanel: 'agFiltersToolPanel',
                },
              ],
            }}
          />
        </Box>
      </Paper>

      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Data</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Format</InputLabel>
            <Select
              value={exportFormat}
              label="Format"
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button onClick={downloadCSV} variant="contained">Export</Button>
        </DialogActions>
      </Dialog>

      <DocumentDetailsModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentId={selectedDocumentId}
        collectionName={selectedAlias}
        solrDatabaseId={selectedSolrDatabase?.id}
        authAxios={authAxios}
        nerData={nerData}
        viewNER={viewNER}
      />
    </Box>
  );
});

export default DataGridComponent;
