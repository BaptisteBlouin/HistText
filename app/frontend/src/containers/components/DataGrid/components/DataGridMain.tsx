import React, { useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { Box, Paper, useTheme, useMediaQuery } from "@mui/material";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

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
  fullscreen,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  /**
   * Injects custom styles for main and ID columns with theme awareness.
   */
  useEffect(() => {
    const style = document.createElement("style");
    const isDark = theme.palette.mode === 'dark';
    
    style.innerHTML = `
      .main-column-header {
        background-color: ${isDark ? '#2a4a5a !important' : '#e8f4f8 !important'};
        font-weight: 700 !important;
        border-left: 3px solid ${theme.palette.primary.main} !important;
        color: ${isDark ? '#ffffff !important' : 'inherit !important'};
      }
      .main-column-cell {
        border-left: 2px solid ${isDark ? '#3a5a7a !important' : '#e3f2fd !important'};
        background-color: ${isDark ? '#2a2a2a !important' : '#fafffe !important'};
        color: ${isDark ? '#ffffff !important' : 'inherit !important'};
      }
      .id-column-header {
        background-color: ${isDark ? '#4a3a5a !important' : '#f3e5f5 !important'};
        font-weight: 600 !important;
        color: ${isDark ? '#ffffff !important' : 'inherit !important'};
      }
      .id-column-cell {
        background-color: ${isDark ? '#2a2a2a !important' : '#faf8ff !important'};
        color: ${isDark ? '#ffffff !important' : 'inherit !important'};
      }
      .ag-theme-alpine .ag-header-cell {
        font-weight: 600;
        background-color: ${isDark ? '#2d2d2d !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-row {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-row:hover {
        background-color: ${isDark ? 'rgba(255, 255, 255, 0.08) !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-cell {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        border-bottom-color: ${isDark ? 'rgba(255, 255, 255, 0.12) !important' : 'inherit'};
      }
      .ag-theme-alpine {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-root-wrapper {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-paging-panel {
        background-color: ${isDark ? '#2d2d2d !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        border-top-color: ${isDark ? 'rgba(255, 255, 255, 0.12) !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-paging-button {
        color: ${isDark ? '#ffffff !important' : 'inherit'};
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, [theme.palette.mode, theme.palette.primary.main]); // Re-run when theme changes

  return (
    <Paper
      elevation={2}
      sx={{
        height: fullscreen ? "90vh" : isMobile ? "50vh" : "70vh",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Box
        className="ag-theme-alpine main-data-grid"
        style={{ height: "100%", width: "100%" }}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          pagination={true}
          paginationPageSize={showConcordance ? 100 : isMobile ? 25 : 50}
          paginationPageSizeSelector={
            showConcordance ? [50, 100, 200] : [25, 50, 100]
          }
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
                id: "columns",
                labelDefault: "Columns",
                labelKey: "columns",
                iconKey: "columns",
                toolPanel: "agColumnsToolPanel",
              },
              {
                id: "filters",
                labelDefault: "Filters",
                labelKey: "filters",
                iconKey: "filter",
                toolPanel: "agFiltersToolPanel",
              },
            ],
            defaultToolPanel: "columns",
          }}
        />
      </Box>
    </Paper>
  );
};

export default React.memo(DataGridMain);
