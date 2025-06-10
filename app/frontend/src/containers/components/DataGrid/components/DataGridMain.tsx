import React, { useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { Box, Paper, useTheme } from "@mui/material";
import { useResponsive } from "../../../../lib/responsive-utils";
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
  const { isMobile, isTablet, getPaginationSize } = useResponsive();

  /**
   * Injects custom styles for main and ID columns with theme awareness and responsive design.
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
        font-size: ${isMobile ? '0.8125rem !important' : 'inherit'};
      }
      .main-column-cell {
        border-left: 2px solid ${isDark ? '#3a5a7a !important' : '#e3f2fd !important'};
        background-color: ${isDark ? '#2a2a2a !important' : '#fafffe !important'};
        color: ${isDark ? '#ffffff !important' : 'inherit !important'};
        font-size: ${isMobile ? '0.8125rem !important' : 'inherit'};
        padding: ${isMobile ? '8px 12px !important' : 'inherit'};
      }
      .id-column-header {
        background-color: ${isDark ? '#4a3a5a !important' : '#f3e5f5 !important'};
        font-weight: 600 !important;
        color: ${isDark ? '#ffffff !important' : 'inherit !important'};
        font-size: ${isMobile ? '0.8125rem !important' : 'inherit'};
      }
      .id-column-cell {
        background-color: ${isDark ? '#2a2a2a !important' : '#faf8ff !important'};
        color: ${isDark ? '#ffffff !important' : 'inherit !important'};
        font-size: ${isMobile ? '0.8125rem !important' : 'inherit'};
        padding: ${isMobile ? '8px 12px !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-header-cell {
        font-weight: 600;
        background-color: ${isDark ? '#2d2d2d !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        font-size: ${isMobile ? '0.8125rem !important' : 'inherit'};
        min-height: ${isMobile ? '40px !important' : '56px !important'};
      }
      .ag-theme-alpine .ag-row {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        min-height: ${isMobile ? '36px !important' : '42px !important'};
      }
      .ag-theme-alpine .ag-row:hover {
        background-color: ${isDark ? 'rgba(255, 255, 255, 0.08) !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-cell {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        border-bottom-color: ${isDark ? 'rgba(255, 255, 255, 0.12) !important' : 'inherit'};
        font-size: ${isMobile ? '0.8125rem !important' : 'inherit'};
        padding: ${isMobile ? '8px 12px !important' : '12px 16px !important'};
        line-height: ${isMobile ? '1.3 !important' : '1.5 !important'};
      }
      .ag-theme-alpine {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        font-size: ${isMobile ? '0.8125rem !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-root-wrapper {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-paging-panel {
        background-color: ${isDark ? '#2d2d2d !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        border-top-color: ${isDark ? 'rgba(255, 255, 255, 0.12) !important' : 'inherit'};
        min-height: ${isMobile ? '48px !important' : '60px !important'};
        font-size: ${isMobile ? '0.8125rem !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-paging-button {
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        min-width: ${isMobile ? '32px !important' : '40px !important'};
        font-size: ${isMobile ? '0.75rem !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-paging-page-summary-panel {
        font-size: ${isMobile ? '0.75rem !important' : 'inherit'};
      }
      .ag-theme-alpine .ag-side-bar {
        display: ${isMobile ? 'none !important' : 'block'};
      }
      .ag-theme-alpine .ag-icon {
        font-size: ${isMobile ? '0.875rem !important' : 'inherit'};
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, [theme.palette.mode, theme.palette.primary.main, isMobile]); // Re-run when theme or responsive state changes

  const getDataGridHeight = () => {
    if (fullscreen) return "90vh";
    if (isMobile) return "50vh";
    if (isTablet) return "60vh";
    return "70vh";
  };

  const getPageSize = () => {
    if (showConcordance) return 100;
    return getPaginationSize();
  };

  const getPageSizeOptions = () => {
    if (showConcordance) return [50, 100, 200];
    if (isMobile) return [10, 25, 50];
    if (isTablet) return [25, 50, 100];
    return [50, 100, 200];
  };

  return (
    <Paper
      elevation={2}
      className="responsive-table"
      sx={{
        height: getDataGridHeight(),
        borderRadius: { xs: 1, sm: 2 },
        overflow: "hidden",
        margin: { xs: 1, sm: 0 },
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
          paginationPageSize={getPageSize()}
          paginationPageSizeSelector={getPageSizeOptions()}
          defaultColDef={defaultColDef}
          components={components}
          suppressCellFocus={true}
          enableCellTextSelection={true}
          rowSelection={isMobile ? "single" : "multiple"}
          suppressRowClickSelection={true}
          animateRows={!showConcordance && !isMobile}
          rowBuffer={showConcordance ? 20 : isMobile ? 5 : 10}
          suppressScrollOnNewData={true}
          suppressColumnVirtualisation={isMobile}
        />
      </Box>
    </Paper>
  );
};

export default React.memo(DataGridMain);
