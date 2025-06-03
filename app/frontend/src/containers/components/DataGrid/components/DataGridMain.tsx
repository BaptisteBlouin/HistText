import React, { useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Box, Paper, useTheme, useMediaQuery } from '@mui/material';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

/**
 * Props for DataGridMain, the main AG Grid table wrapper.
 */
interface DataGridMainProps {
  rowData: any[];
  columnDefs: any[];
  defaultColDef: any;
  components: any;
  onGridReady: (params: any) => void;
  showConcordance: boolean;
  fullscreen: boolean;
}

/**
 * Main data grid component using AG Grid and MUI Paper.  
 * Dynamically applies column highlight styles, handles responsive height,
 * and sets up side panels and AG Grid options.
 *
 * @param props - DataGridMainProps
 * @returns Main data grid for the application.
 */
const DataGridMain: React.FC<DataGridMainProps> = ({
  rowData,
  columnDefs,
  defaultColDef,
  components,
  onGridReady,
  showConcordance,
  fullscreen
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  /**
   * Injects custom styles for main and ID columns.
   */
  useEffect(() => {
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

  return (
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
          rowData={rowData}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          pagination={true}
          paginationPageSize={showConcordance ? 100 : (isMobile ? 25 : 50)}
          paginationPageSizeSelector={showConcordance ? [50, 100, 200] : [25, 50, 100]}
          defaultColDef={defaultColDef}
          components={components}
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
            defaultToolPanel: 'columns', 
          }}
        />
      </Box>
    </Paper>
  );
};

export default React.memo(DataGridMain);