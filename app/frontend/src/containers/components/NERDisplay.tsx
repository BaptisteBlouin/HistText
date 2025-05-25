import React, { useMemo, useCallback, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ModuleRegistry, ColDef, GridReadyEvent } from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import '../css/HistText.css';
import config from '../../../config.json';
import DocumentDetailsModal from './DocumentDetailsModal';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  useTheme,
  useMediaQuery,
  Slider
} from '@mui/material';
import {
  AccountTree,
  Download,
  Search,
  FilterList,
  Visibility,
  VisibilityOff,
  Category,
  Label,
  Analytics,
  TableChart,
  GetApp,
  Clear
} from '@mui/icons-material';

ModuleRegistry.registerModules([ClientSideRowModelModule]);

interface Annotation {
  t: string;
  l: string[];
  s: number;
  e: number;
  c: number;
}

interface NerData {
  id: string;
  t: string[];
  l: string[];
  s: number[];
  e: number[];
  c: number[];
}

interface NERDisplayProps {
  nerData: Record<string, NerData>;
  authAxios: any;
  selectedAlias: string;
  selectedSolrDatabase: { id: number } | null;
  viewNER?: boolean;
}

const NERDisplay: React.FC<NERDisplayProps> = ({
  nerData,
  authAxios,
  selectedAlias,
  selectedSolrDatabase,
  viewNER = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const containerStyle = useMemo(() => ({ width: '100%', height: '70vh' }), []);
  const gridStyle = useMemo(() => ({ height: '70vh', width: '100%' }), []);

  const uniqueLabels = useMemo(() => {
    return Array.from(new Set(Object.values(nerData).flatMap(data => data.l || [])));
  }, [nerData]);

  const processedData = useMemo(() => {
    const allEntities = Object.entries(nerData).flatMap(([id, data]) => {
      if (!Array.isArray(data.t)) return [];
      return data.t.map((_, idx) => ({
        id,
        text: data.t[idx],
        label: data.l[idx],
        labelFull: config.NERLABELS2FULL[data.l[idx]] || data.l[idx],
        start: data.s[idx],
        end: data.e[idx],
        confidence: data.c[idx],
        color: config.NER_LABELS_COLORS[data.l[idx]] || '#grey',
      }));
    });

    return allEntities
      .filter(entity => {
        const matchesSearch = !searchTerm || 
          entity.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entity.labelFull.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLabel = selectedLabels.length === 0 || selectedLabels.includes(entity.label);
        const matchesConfidence = entity.confidence >= minConfidence;
        return matchesSearch && matchesLabel && matchesConfidence;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'text':
            comparison = a.text.localeCompare(b.text);
            break;
          case 'label':
            comparison = a.labelFull.localeCompare(b.labelFull);
            break;
          case 'confidence':
            comparison = a.confidence - b.confidence;
            break;
          default:
            comparison = 0;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
  }, [nerData, searchTerm, selectedLabels, minConfidence, sortBy, sortOrder]);

  const entityStats = useMemo(() => {
    const allEntities = Object.entries(nerData).flatMap(([id, data]) => {
      if (!Array.isArray(data.t)) return [];
      return data.t.map((_, idx) => ({
        id,
        text: data.t[idx],
        label: data.l[idx],
        labelFull: config.NERLABELS2FULL[data.l[idx]] || data.l[idx],
        start: data.s[idx],
        end: data.e[idx],
        confidence: data.c[idx],
        color: config.NER_LABELS_COLORS[data.l[idx]] || '#grey',
      }));
    });

    const stats = {
      total: processedData.length,
      byLabel: {} as Record<string, { count: number; originalLabel: string }>,
      avgConfidence: 0,
      uniqueDocuments: new Set(processedData.map(e => e.id)).size
    };

    allEntities.forEach(entity => {
      if (!stats.byLabel[entity.labelFull]) {
        stats.byLabel[entity.labelFull] = { count: 0, originalLabel: entity.label };
      }
      stats.byLabel[entity.labelFull].count++;
    });

    stats.avgConfidence = processedData.length > 0 
      ? processedData.reduce((sum, e) => sum + e.confidence, 0) / processedData.length 
      : 0;

    return stats;
  }, [nerData, processedData]);

  const handleLabelToggle = (label: string) => {
    console.log('Toggling label:', label);
    console.log('Current selectedLabels:', selectedLabels);
    
    setSelectedLabels(prev => {
      const newLabels = prev.includes(label) 
        ? prev.filter(l => l !== label)
        : [...prev, label];
      
      console.log('New selectedLabels:', newLabels);
      return newLabels;
    });
  };

  const clearAllFilters = () => {
    setSelectedLabels([]);
    setSearchTerm('');
    setMinConfidence(0);
  };

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: 'id',
        headerName: 'Document ID',
        minWidth: 150,
        flex: 1,
        cellRenderer: params => (
          <Box
            onClick={() => {
              setSelectedDocumentId(params.value);
              setIsModalOpen(true);
            }}
            sx={{
              cursor: 'pointer',
              color: 'primary.main',
              textDecoration: 'underline',
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: 'primary.light',
                color: 'primary.contrastText',
                borderRadius: 1,
                padding: '2px 4px'
              }
            }}
          >
            {params.value}
          </Box>
        ),
      },
      { 
        field: 'text', 
        headerName: 'Entity Text', 
        minWidth: 200, 
        flex: 2,
        cellRenderer: params => (
          <Box sx={{ 
            fontWeight: 600, 
            color: 'text.primary',
            backgroundColor: `${params.data.color}20`,
            padding: '4px 8px',
            borderRadius: 1,
            border: `1px solid ${params.data.color}40`
          }}>
            {params.value}
          </Box>
        )
      },
      { 
        field: 'labelFull', 
        headerName: 'Entity Type', 
        minWidth: 150, 
        flex: 1,
        cellRenderer: params => (
          <Chip
            label={params.value}
            size="small"
            sx={{
              backgroundColor: params.data.color,
              color: 'white',
              fontWeight: 600
            }}
          />
        )
      },
      { 
        field: 'start', 
        headerName: 'Start Position', 
        minWidth: 120, 
        flex: 0.5,
        type: 'numericColumn'
      },
      { 
        field: 'end', 
        headerName: 'End Position', 
        minWidth: 120, 
        flex: 0.5,
        type: 'numericColumn'
      },
      { 
        field: 'confidence', 
        headerName: 'Confidence', 
        minWidth: 120, 
        flex: 0.8,
        type: 'numericColumn',
        cellRenderer: params => {
          const confidence = params.value;
          const percentage = (confidence * 100).toFixed(1);
          const color = confidence > 0.8 ? 'success' : confidence > 0.6 ? 'warning' : 'error';
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={`${percentage}%`}
                size="small"
                color={color}
                variant="outlined"
              />
            </Box>
          );
        }
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({ 
      filter: true, 
      resizable: true, 
      editable: false,
      sortable: true
    }),
    [],
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  }, []);

  const downloadCSV = () => {
    if (!processedData.length) {
      alert('No data to download');
      return;
    }
    
    const headers = ['Document ID', 'Entity Text', 'Entity Type', 'Start Position', 'End Position', 'Confidence'];
    const csvRows = [headers.join(',')];

    processedData.forEach(row => {
      const values = [
        `"${row.id}"`,
        `"${row.text.replace(/"/g, '""')}"`,
        `"${row.labelFull}"`,
        row.start,
        row.end,
        row.confidence.toFixed(3)
      ];
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ner_entities_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderControls = () => (
    <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FilterList />
        Filter & Search Controls
      </Typography>
      
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value)}
            >
              <MenuItem value="text">Entity Text</MenuItem>
              <MenuItem value="label">Entity Type</MenuItem>
              <MenuItem value="confidence">Confidence</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <ButtonGroup size="small" fullWidth>
            <Button
              variant={sortOrder === 'asc' ? 'contained' : 'outlined'}
              onClick={() => setSortOrder('asc')}
            >
              ASC
            </Button>
            <Button
              variant={sortOrder === 'desc' ? 'contained' : 'outlined'}
              onClick={() => setSortOrder('desc')}
            >
              DESC
            </Button>
          </ButtonGroup>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Box>
            <Typography variant="caption" gutterBottom display="block">
              Min Confidence: {(minConfidence * 100).toFixed(0)}%
            </Typography>
            <Slider
              value={minConfidence * 100}
              min={0}
              max={100}
              step={1}
              onChange={(_, v) => setMinConfidence((v as number) / 100)}
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <Button 
            variant="outlined" 
            onClick={clearAllFilters}
            startIcon={<Clear />}
            color="error"
            size="small"
            fullWidth
          >
            Clear All
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );

  const renderStatistics = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6">{entityStats.total}</Typography>
            <Typography variant="body2">Total Entities</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6">{entityStats.uniqueDocuments}</Typography>
            <Typography variant="body2">Documents</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6">{Object.keys(entityStats.byLabel).length}</Typography>
            <Typography variant="body2">Entity Types</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6">{(entityStats.avgConfidence * 100).toFixed(1)}%</Typography>
            <Typography variant="body2">Avg Confidence</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderEntityTypeBreakdown = () => (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Category />
        Entity Type Distribution
        {selectedLabels.length > 0 && (
          <Chip 
            label={`${selectedLabels.length} selected`} 
            size="small" 
            color="primary"
          />
        )}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {Object.entries(entityStats.byLabel)
          .sort(([,a], [,b]) => b.count - a.count)
          .map(([labelFull, { count, originalLabel }]) => {
            const color = config.NER_LABELS_COLORS[originalLabel] || '#grey';
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
                    boxShadow: theme.shadows[4]
                  }
                }}
                onClick={() => handleLabelToggle(originalLabel)}
              />
            );
          })}
      </Box>
      {selectedLabels.length > 0 && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Selected filters: {selectedLabels.map(label => config.NERLABELS2FULL[label] || label).join(', ')}
          </Typography>
        </Box>
      )}
    </Paper>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountTree />
            Named Entity Recognition
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Extracted and classified entities from your text data
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={1}>
          <Tooltip title="Download CSV">
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={downloadCSV}
              disabled={processedData.length === 0}
            >
              Export
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {renderStatistics()}
      {renderEntityTypeBreakdown()}
      {renderControls()}

      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableChart />
            Entity Details
            <Chip label={`${processedData.length} entities`} size="small" color="primary" />
          </Typography>
        </Box>
        
        <Box id="NerTable" style={containerStyle}>
          <div style={gridStyle} className="ag-theme-quartz">
            <AgGridReact
              rowData={processedData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onGridReady={onGridReady}
              pagination
              paginationPageSize={isMobile ? 25 : 50}
              paginationPageSizeSelector={[25, 50, 100]}
              animateRows={true}
              enableRangeSelection={true}
              rowSelection="multiple"
              suppressRowClickSelection={true}
              headerHeight={44}
              rowHeight={48}
            />
          </div>
        </Box>
      </Paper>

      <DocumentDetailsModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentId={selectedDocumentId || ''}
        collectionName={selectedAlias}
        solrDatabaseId={selectedSolrDatabase?.id || null}
        authAxios={authAxios}
        nerData={nerData}
        viewNER={viewNER}
      />
    </Box>
  );
};

export default NERDisplay;