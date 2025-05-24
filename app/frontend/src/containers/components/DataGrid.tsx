import React, { useMemo, useRef, useCallback, useState } from 'react';
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
  Card,
  CardContent,
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
  Fade,
  useTheme,
  useMediaQuery,
  Grid
} from '@mui/material';
import { 
  Download, 
  Search, 
  FilterList, 
  ViewColumn, 
  Refresh,
  MoreVert,
  Fullscreen,
  VisibilityOff,
  Visibility,
  TableChart,
  GetApp,
  Share,
  Print,
  Settings,
  Close
} from '@mui/icons-material';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import config from '../../../config.json';
import DocumentDetailsModal from './DocumentDetailsModal';

const viewNERFields = config.viewNERFields;
const NER_LABELS_COLORS = config.NER_LABELS_COLORS;
const NERLABELS2FULL = config.NERLABELS2FULL;

const ID_FIELD_NAMES = [
  'id', 'Id', 'ID', 'docId', 'DocId', 'documentId', 'DocumentId',
  'identifier', 'Identifier', 'doc_id', 'document_id', '_id',
];

const DataGridComponent = ({
  results,
  formData,
  nerData,
  viewNER,
  selectedAlias,
  selectedSolrDatabase,
  authAxios,
}) => {
  const gridRef = useRef();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [gridHeight, setGridHeight] = useState(isMobile ? '50vh' : '70vh');
  const [fullscreen, setFullscreen] = useState(false);

  const isIdField = fieldName => {
    return ID_FIELD_NAMES.some(
      idName =>
        fieldName === idName ||
        fieldName.toLowerCase() === idName.toLowerCase() ||
        fieldName.toLowerCase().includes('_id') ||
        fieldName.toLowerCase().includes('id_'),
    );
  };

  const getColumnSizes = useCallback(() => {
    if (results.length === 0) return {};

    const columnSizes = {};
    const fields = Object.keys(results[0])
      .filter(key => !(key.startsWith('_') && key.endsWith('_')))
      .filter(key => !key.startsWith('score'));

    fields.forEach(field => {
      const maxLength = Math.max(
        field.length,
        ...results.map(row => String(row[field] || '').length),
      );

      if (maxLength < 20) {
        columnSizes[field] = 0.4;
      } else if (maxLength < 40) {
        columnSizes[field] = 0.8;
      } else if (maxLength < 60) {
        columnSizes[field] = 1.2;
      } else {
        columnSizes[field] = 3;
      }
    });

    return columnSizes;
  }, [results]);

  const onGridReady = useCallback(() => {
    if (gridRef.current) {
      setTimeout(() => {
        gridRef.current.api.autoSizeAllColumns();
        gridRef.current.api.sizeColumnsToFit();
      }, 0);
    }
  }, []);

  const handleIdClick = documentId => {
    setSelectedDocumentId(documentId);
    setIsModalOpen(true);
  };

  const rowData = useMemo(() => results.map((row, i) => ({ id: i, ...row })), [results]);
  
  const columnDefs = useMemo(() => {
    if (results.length === 0) return [];

    const columnSizes = getColumnSizes();

    return Object.keys(results[0])
      .filter(key => !(key.startsWith('_') && key.endsWith('_')))
      .filter(key => !key.startsWith('score'))
      .map(key => {
        const isId = isIdField(key);

        return {
          field: key,
          headerName: key.length > 20 ? `${key.slice(0, 20)}...` : key,
          flex: columnSizes[key],
          sortable: true,
          filter: true,
          wrapText: true,
          autoHeight: true,
          minWidth: 80 * columnSizes[key],
          maxWidth: columnSizes[key] === 1 ? 150 : undefined,
          headerClass: isId ? 'id-column-header' : '',
          cellClass: isId ? 'id-column-cell' : '',
          headerTooltip: key,
          cellRenderer: params => {
            const field = params.colDef.field;
            const value = params.value;
            const documentId = isId ? value : params.data.id;

            if (!value) return null;

            if (isId) {
              return (
                <Box
                  onClick={() => handleIdClick(value)}
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
                  {value}
                </Box>
              );
            }

            let elements = [];
            let lastIndex = 0;

            if (
              viewNER &&
              viewNERFields.some(
                fieldValue => field === fieldValue || field.includes(fieldValue),
              ) &&
              nerData &&
              nerData[documentId] &&
              Array.isArray(nerData[documentId].t)
            ) {
              const annotations = nerData[documentId].t.map((text, index) => ({
                t: text,
                l: nerData[documentId].l[index],
                s: nerData[documentId].s[index],
                e: nerData[documentId].e[index],
                c: nerData[documentId].c[index],
              }));

              const sortedAnnotations = annotations.sort((a, b) => {
                if (a.s !== b.s) {
                  return a.s - b.s;
                }
                return b.e - b.s - (a.e - a.s);
              });

              sortedAnnotations.forEach(({ s, e, l }) => {
                if (s > lastIndex) {
                  elements.push(value.slice(lastIndex, s));
                }
                const label = l[0];
                const color = NER_LABELS_COLORS[label] || 'lightgray';
                elements.push(
                  <Chip
                    key={`${s}-${e}`}
                    label={`${value.slice(s, e)} (${NERLABELS2FULL[label]})`}
                    size="small"
                    sx={{
                      backgroundColor: color,
                      color: 'white',
                      margin: '2px',
                      fontWeight: 500
                    }}
                  />
                );
                lastIndex = e;
              });

              if (lastIndex < value.length) {
                elements.push(value.slice(lastIndex));
              }
            } else {
              elements = [value];
            }

            function escapeRegex(s: string) {
              return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            const wordsToHighlight = formData[field]
              .map(e => e.value)
              .filter(w => w)    
            wordsToHighlight.forEach(word => {
              elements = elements.flatMap(element => {
                if (typeof element === 'string') {
                  const regex = new RegExp(`(${word})`, 'gi');
                  const parts = element.split(regex);
                  return parts.map((part, index) =>
                    index % 2 === 1 ? (
                      <Box
                        key={`${word}-${index}`}
                        component="span"
                        sx={{
                          backgroundColor: 'warning.light',
                          color: 'warning.contrastText',
                          padding: '2px 4px',
                          borderRadius: 1,
                          fontWeight: 600
                        }}
                      >
                        {part}
                      </Box>
                    ) : (
                      part
                    ),
                  );
                }
                return element;
              });
            });

            return (
              <Box
                sx={{
                  whiteSpace: 'normal',
                  overflowWrap: 'break-word',
                  lineHeight: 1.5,
                  width: '100%',
                  height: '100%',
                  padding: '8px',
                }}
              >
                {elements}
              </Box>
            );
          },
        };
      });
  }, [results, formData, nerData, viewNER, getColumnSizes]);

  const downloadCSV = () => {
    if (results.length === 0) {
      alert('No data to download');
      return;
    }

    const headers = Object.keys(results[0]).filter(
      key => !(key.startsWith('_') && key.endsWith('_')),
    );
    const csvRows = [headers.join(',')];

    results.forEach(row => {
      const values = headers.map(header => JSON.stringify(row[header] || ''));
      csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `histtext-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    window.URL.revokeObjectURL(url);
  };

  const exportData = () => {
    switch (exportFormat) {
      case 'csv':
        downloadCSV();
        break;
      case 'json':
        exportJSON();
        break;
      case 'excel':
        exportExcel();
        break;
      default:
        downloadCSV();
    }
    setExportDialogOpen(false);
  };

  const exportJSON = () => {
    const jsonString = JSON.stringify(results, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `histtext-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = Object.keys(results[0]).filter(
      key => !(key.startsWith('_') && key.endsWith('_')),
    );
    const csvRows = [headers.join('\t')];

    results.forEach(row => {
      const values = headers.map(header => String(row[header] || '').replace(/\t/g, ' '));
      csvRows.push(values.join('\t'));
    });

    const tsvString = csvRows.join('\n');
    const blob = new Blob([tsvString], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `histtext-data-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSearch = (event) => {
    setSearchText(event.target.value);
    if (gridRef.current?.api) {
      gridRef.current.api.setQuickFilter(event.target.value);
    }
  };

  const clearFilters = () => {
    setSearchText('');
    setColumnFilters({});
    if (gridRef.current?.api) {
      gridRef.current.api.setQuickFilter('');
      gridRef.current.api.setFilterModel(null);
    }
  };

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
    setGridHeight(fullscreen ? (isMobile ? '50vh' : '70vh') : '90vh');
  };

  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .id-column-header {
        background-color: #e3f2fd !important;
        font-weight: 600 !important;
      }
      .id-column-cell {
        background-color: #f3e5f5 !important;
      }
      .ag-theme-alpine .ag-header-cell {
        font-weight: 600;
      }
      .ag-theme-alpine .ag-row:hover {
        background-color: rgba(102, 126, 234, 0.05);
      }
      .ag-theme-alpine .ag-row-selected {
        background-color: rgba(102, 126, 234, 0.1);
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const renderToolbar = () => (
    <Paper elevation={1} sx={{ mb: 2 }}>
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap', minHeight: { xs: 'auto', sm: 64 }, py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <TableChart color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Data Grid
          </Typography>
          <Chip 
            label={`${results.length} records`} 
            size="small" 
            color="primary" 
            variant="outlined"
          />
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search all columns..."
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
                  <IconButton size="small" onClick={() => handleSearch({ target: { value: '' } })}>
                    <Close />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ minWidth: 200 }}
          />

          <Tooltip title="Export Data">
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => setExportDialogOpen(true)}
              size="small"
            >
              Export
            </Button>
          </Tooltip>

          <Tooltip title="Clear Filters">
            <IconButton onClick={clearFilters}>
              <FilterList />
            </IconButton>
          </Tooltip>

          <Tooltip title={fullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            <IconButton onClick={toggleFullscreen}>
              <Fullscreen />
            </IconButton>
          </Tooltip>

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
          <MenuItem onClick={() => { gridRef.current?.api?.sizeColumnsToFit(); setMenuAnchor(null); }}>
            Fit Columns to Screen
          </MenuItem>
        </Menu>
      </Toolbar>
    </Paper>
  );


  return (
    <Box sx={{ p: 2, height: '100%' }}>
      {renderToolbar()}
      
      <Paper 
        elevation={2} 
        sx={{ 
          height: gridHeight, 
          width: '100%',
          position: 'relative',
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box
          className="ag-theme-alpine"
          style={{
            height: '100%',
            width: '100%',
          }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            onGridReady={onGridReady}
            pagination={true}
            paginationPageSize={isMobile ? 10 : 25}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            suppressCellFocus={true}
            defaultColDef={{
              resizable: true,
              sortable: true,
              filter: true,
            }}
            domLayout="normal"
            rowHeight={undefined}
            suppressRowTransform={true}
            enableCellTextSelection={true}
            suppressScrollOnNewData={true}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            enableRangeSelection={true}
            animateRows={true}
            headerHeight={44}
            floatingFiltersHeight={35}
            pivotHeaderHeight={44}
            groupHeaderHeight={44}
            suppressMenuHide={false}
            sideBar={{
              toolPanels: [
                {
                  id: 'columns',
                  labelDefault: 'Columns',
                  labelKey: 'columns',
                  iconKey: 'columns',
                  toolPanel: 'agColumnsToolPanel',
                },
                {
                  id: 'filters',
                  labelDefault: 'Filters',
                  labelKey: 'filters',
                  iconKey: 'filter',
                  toolPanel: 'agFiltersToolPanel',
                },
              ],
              defaultToolPanel: '',
            }}
          />
        </Box>
      </Paper>

      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose the format for exporting your data ({results.length} records)
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={exportFormat}
              label="Export Format"
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <MenuItem value="csv">CSV (Comma Separated Values)</MenuItem>
              <MenuItem value="json">JSON (JavaScript Object Notation)</MenuItem>
              <MenuItem value="excel">Excel (Tab Separated)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button onClick={exportData} variant="contained" startIcon={<Download />}>
            Export
          </Button>
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
};

export default DataGridComponent;