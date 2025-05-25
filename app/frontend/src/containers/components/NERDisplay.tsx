import React, { useMemo, useCallback, useState, memo } from 'react';
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
  Slider,
  FormControlLabel,
  Switch,
  Collapse,
  Badge,
  Fade,
  LinearProgress,
  Alert
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
  Clear,
  TuneSharp,
  ExpandMore,
  Lightbulb,
  Speed,
  InsightsRounded
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

// Memoized entity processing for better performance
// Remove the memo wrapper and make it a regular memoized function
const processNERData = (nerData: Record<string, NerData>) => {
  const entities = [];
  const stats = {
    totalEntities: 0,
    byLabel: {} as Record<string, { count: number; originalLabel: string; color: string }>,
    byDocument: {} as Record<string, number>,
    avgConfidence: 0,
    confidenceDistribution: { high: 0, medium: 0, low: 0 }
  };

  // Process all entities with optimized loop
  for (const [docId, data] of Object.entries(nerData)) {
    if (!Array.isArray(data.t)) continue;
    
    const docEntityCount = data.t.length;
    stats.byDocument[docId] = docEntityCount;
    stats.totalEntities += docEntityCount;

    for (let idx = 0; idx < data.t.length; idx++) {
      const label = data.l[idx];
      const confidence = data.c[idx];
      const labelFull = config.NERLABELS2FULL[label] || label;
      const color = config.NER_LABELS_COLORS[label] || '#grey';

      entities.push({
        id: docId,
        text: data.t[idx],
        label,
        labelFull,
        start: data.s[idx],
        end: data.e[idx],
        confidence,
        color,
        // Pre-calculate for sorting
        textLower: data.t[idx].toLowerCase(),
        confidenceLevel: confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low'
      });

      // Update stats
      if (!stats.byLabel[labelFull]) {
        stats.byLabel[labelFull] = { count: 0, originalLabel: label, color };
      }
      stats.byLabel[labelFull].count++;

      // Confidence distribution
      if (confidence > 0.8) stats.confidenceDistribution.high++;
      else if (confidence > 0.6) stats.confidenceDistribution.medium++;
      else stats.confidenceDistribution.low++;
    }
  }

  // Calculate average confidence
  stats.avgConfidence = entities.length > 0 
    ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length 
    : 0;

  return { entities, stats };
};

// Memoized filtering function
const useFilteredEntities = (
  entities: any[], 
  searchTerm: string, 
  selectedLabels: string[], 
  minConfidence: number,
  sortBy: string,
  sortOrder: 'asc' | 'desc'
) => {
  return useMemo(() => {
    let filtered = entities;

    // Apply filters only if needed
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(entity => 
        entity.textLower.includes(searchLower) ||
        entity.labelFull.toLowerCase().includes(searchLower) ||
        entity.id.toLowerCase().includes(searchLower)
      );
    }

    if (selectedLabels.length > 0) {
      const labelSet = new Set(selectedLabels);
      filtered = filtered.filter(entity => labelSet.has(entity.label));
    }

    if (minConfidence > 0) {
      filtered = filtered.filter(entity => entity.confidence >= minConfidence);
    }

    // Optimized sorting
    if (sortBy && filtered.length > 0) {
      filtered.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'text':
            comparison = a.textLower.localeCompare(b.textLower);
            break;
          case 'label':
            comparison = a.labelFull.localeCompare(b.labelFull);
            break;
          case 'confidence':
            comparison = a.confidence - b.confidence;
            break;
          case 'id':
            comparison = a.id.localeCompare(b.id);
            break;
          default:
            comparison = 0;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [entities, searchTerm, selectedLabels, minConfidence, sortBy, sortOrder]);
};

const NERDisplay: React.FC<NERDisplayProps> = ({
  nerData,
  authAxios,
  selectedAlias,
  selectedSolrDatabase,
  viewNER = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [highlightMode, setHighlightMode] = useState<'confidence' | 'type' | 'frequency'>('confidence');
  const [showStats, setShowStats] = useState<boolean>(true);
  const [quickFilterMode, setQuickFilterMode] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Memoized data processing
  const { entities, stats } = useMemo(() => 
    processNERData(nerData), [nerData]
  );

  // Memoized unique labels
  const uniqueLabels = useMemo(() => 
    Array.from(new Set(entities.map(e => e.label))), [entities]
  );

  // Memoized filtered data
  const filteredEntities = useFilteredEntities(
    entities, searchTerm, selectedLabels, minConfidence, sortBy, sortOrder
  );

  // Quick filter effect
  const displayEntities = useMemo(() => {
    if (quickFilterMode === 'all') return filteredEntities;
    
    const confidenceMap = {
      'high': (e: any) => e.confidence > 0.8,
      'medium': (e: any) => e.confidence > 0.6 && e.confidence <= 0.8,
      'low': (e: any) => e.confidence <= 0.6
    };
    
    return filteredEntities.filter(confidenceMap[quickFilterMode]);
  }, [filteredEntities, quickFilterMode]);

  // Grid configuration
  const containerStyle = useMemo(() => ({ width: '100%', height: '70vh' }), []);
  const gridStyle = useMemo(() => ({ height: '70vh', width: '100%' }), []);

  // Memoized handlers
  const handleLabelToggle = useCallback((label: string) => {
    setSelectedLabels(prev => 
      prev.includes(label) 
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedLabels([]);
    setSearchTerm('');
    setMinConfidence(0);
    setQuickFilterMode('all');
  }, []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  }, []);

  // Enhanced download with filtering info
  const downloadCSV = useCallback(() => {
    if (!displayEntities.length) {
      alert('No data to download');
      return;
    }
    
    const headers = ['Document ID', 'Entity Text', 'Entity Type', 'Start Position', 'End Position', 'Confidence', 'Confidence Level'];
    const csvRows = [headers.join(',')];

    displayEntities.forEach(row => {
      const values = [
        `"${row.id}"`,
        `"${row.text.replace(/"/g, '""')}"`,
        `"${row.labelFull}"`,
        row.start,
        row.end,
        row.confidence.toFixed(3),
        row.confidenceLevel
      ];
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ner_entities_filtered_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [displayEntities]);

  // Optimized column definitions
  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: 'id',
        headerName: 'Document ID',
        minWidth: 150,
        flex: 1,
        cellRenderer: (params: any) => (
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
              padding: '4px',
              '&:hover': {
                backgroundColor: 'primary.light',
                color: 'primary.contrastText',
                borderRadius: 1
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
        cellRenderer: (params: any) => (
          <Box sx={{ 
            fontWeight: 600, 
            color: 'text.primary',
            backgroundColor: `${params.data.color}20`,
            padding: '4px 8px',
            borderRadius: 1,
            border: `1px solid ${params.data.color}40`,
            display: 'inline-block'
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
        cellRenderer: (params: any) => (
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
        headerName: 'Start', 
        minWidth: 80, 
        flex: 0.5,
        type: 'numericColumn'
      },
      { 
        field: 'end', 
        headerName: 'End', 
        minWidth: 80, 
        flex: 0.5,
        type: 'numericColumn'
      },
      { 
        field: 'confidence', 
        headerName: 'Confidence', 
        minWidth: 120, 
        flex: 0.8,
        type: 'numericColumn',
        cellRenderer: (params: any) => {
          const confidence = params.value;
          const percentage = (confidence * 100).toFixed(1);
          const level = confidence > 0.8 ? 'success' : confidence > 0.6 ? 'warning' : 'error';
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress
                variant="determinate"
                value={confidence * 100}
                color={level}
                sx={{ width: 60, height: 6, borderRadius: 3 }}
              />
              <Chip
                label={`${percentage}%`}
                size="small"
                color={level}
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
      sortable: true,
      suppressMenu: true // Faster rendering
    }),
    [],
  );

  // Enhanced statistics display
  const renderAdvancedStats = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">{displayEntities.length}</Typography>
            <Typography variant="caption">Shown</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">{Object.keys(stats.byDocument).length}</Typography>
            <Typography variant="caption">Documents</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">{Object.keys(stats.byLabel).length}</Typography>
            <Typography variant="caption">Types</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">{(stats.avgConfidence * 100).toFixed(1)}%</Typography>
            <Typography variant="caption">Avg Confidence</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Enhanced filtering controls
  const renderAdvancedFilters = () => (
    <Collapse in={showAdvancedFilters}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TuneSharp />
            Advanced Filters
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>Confidence Filter</Typography>
              <Box sx={{ px: 2 }}>
                <Typography variant="caption">
                  Min Confidence: {(minConfidence * 100).toFixed(0)}%
                </Typography>
                <Slider
                  value={minConfidence * 100}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(_, v) => setMinConfidence((v as number) / 100)}
                  valueLabelDisplay="auto"
                  size="small"
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>Sort Options</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Sort By</InputLabel>
                  <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <MenuItem value="text">Entity Text</MenuItem>
                    <MenuItem value="label">Entity Type</MenuItem>
                    <MenuItem value="confidence">Confidence</MenuItem>
                    <MenuItem value="id">Document ID</MenuItem>
                  </Select>
                </FormControl>
                
                <ButtonGroup size="small">
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
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Collapse>
  );

  // Enhanced entity type filter with visual improvements
  // Enhanced entity type filter with integrated quick filters
const renderEntityTypeFilter = () => (
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
          onClick={() => setSelectedLabels(uniqueLabels)}
          disabled={selectedLabels.length === uniqueLabels.length}
        >
          All
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setSelectedLabels([])}
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
              onClick={() => handleLabelToggle(originalLabel)}
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
          onClick={() => setQuickFilterMode('all')}
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
          onClick={() => setQuickFilterMode('high')}
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
          onClick={() => setQuickFilterMode('medium')}
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
          onClick={() => setQuickFilterMode('low')}
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Enhanced Header */}
      <Box sx={{ mb: 3 }}>
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccountTree />
        Named Entity Recognition
        {searchTerm && <Badge badgeContent="!" color="primary"><Search /></Badge>}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {displayEntities.length} of {stats.totalEntities} entities
        {selectedLabels.length > 0 && ` • ${selectedLabels.length} types filtered`}
        {searchTerm && ` • "${searchTerm}"`}
      </Typography>
    </Box>
    
    <Stack direction="row" spacing={1}>
      <FormControlLabel
        control={<Switch checked={showStats} onChange={(e) => setShowStats(e.target.checked)} />}
        label="Stats"
      />
      <Tooltip title="Advanced Filters">
        <IconButton onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
          <Badge badgeContent={minConfidence > 0 ? '!' : 0} color="primary">
            <TuneSharp />
          </Badge>
        </IconButton>
      </Tooltip>
      <Tooltip title="Download CSV">
        <IconButton onClick={downloadCSV} disabled={displayEntities.length === 0}>
          <Download />
        </IconButton>
      </Tooltip>
    </Stack>
  </Box>

  {/* Search bar */}
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
    <TextField
      size="small"
      placeholder="Search entities, types, or documents..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Search />
          </InputAdornment>
        ),
        endAdornment: searchTerm && (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => setSearchTerm('')}>
              <Clear />
            </IconButton>
          </InputAdornment>
        )
      }}
      sx={{ flexGrow: 1, maxWidth: 400 }}
    />
    
    <Button 
      variant="outlined" 
      onClick={clearAllFilters}
      startIcon={<Clear />}
      color="error"
      size="small"
      disabled={!searchTerm && selectedLabels.length === 0 && minConfidence === 0 && quickFilterMode === 'all'}
    >
      Clear All
    </Button>
  </Box>
</Box>

      {/* Statistics */}
      {showStats && renderAdvancedStats()}

      

      {/* Advanced Filters */}
      {renderAdvancedFilters()}

      {/* Entity Type Distribution */}
      {renderEntityTypeFilter()}

      {/* Data Grid with virtual scrolling */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableChart />
            Entity Details
            <Chip 
              label={`${displayEntities.length} entities`} 
              size="small" 
              color="primary" 
            />
            {displayEntities.length !== stats.totalEntities && (
              <Chip 
                label={`${((displayEntities.length / stats.totalEntities) * 100).toFixed(1)}% shown`} 
                size="small" 
                color="secondary"
                variant="outlined"
              />
            )}
          </Typography>
        </Box>
        
        <Box id="NerTable" style={containerStyle}>
          <div style={gridStyle} className="ag-theme-quartz">
            <AgGridReact
              rowData={displayEntities}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onGridReady={onGridReady}
              pagination
              paginationPageSize={isMobile ? 50 : 100}
              paginationPageSizeSelector={[50, 100, 200, 500]}
              animateRows={false} // Disabled for better performance
              enableRangeSelection={true}
              rowSelection="multiple"
              suppressRowClickSelection={true}
              headerHeight={44}
              rowHeight={48}
              suppressColumnVirtualisation={false} // Enable column virtualization
              rowBuffer={10} // Optimize row rendering
            />
          </div>
        </Box>
      </Paper>

      {/* Performance hint */}
      {stats.totalEntities > 1000 && (
        <Alert severity="info" sx={{ mt: 2 }} icon={<Lightbulb />}>
          <Typography variant="body2">
            <strong>Performance Tip:</strong> With {stats.totalEntities} entities, use filters to improve responsiveness. 
            The grid uses virtual scrolling for optimal performance.
          </Typography>
        </Alert>
      )}

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