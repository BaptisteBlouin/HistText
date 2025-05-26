import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from '@ag-grid-community/core';
import {
  Paper,
  Box,
  Typography,
  Chip,
  LinearProgress
} from '@mui/material';
import { TableChart } from '@mui/icons-material';

interface NERDataGridProps {
  displayEntities: any[];
  stats: any;
  isMobile: boolean;
  onGridReady: (params: any) => void;
  onIdClick: (id: string) => void;
}

const NERDataGrid: React.FC<NERDataGridProps> = ({
  displayEntities,
  stats,
  isMobile,
  onGridReady,
  onIdClick
}) => {
  const containerStyle = useMemo(() => ({ width: '100%', height: '70vh' }), []);
  const gridStyle = useMemo(() => ({ height: '70vh', width: '100%' }), []);

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
            onClick={() => onIdClick(params.value)}
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
    [onIdClick],
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

  return (
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
  );
};

export default React.memo(NERDataGrid);