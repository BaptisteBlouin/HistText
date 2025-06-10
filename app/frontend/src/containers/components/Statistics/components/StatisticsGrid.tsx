import React, { useCallback, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { Card, CardContent, Box, useTheme } from "@mui/material";
import { COLUMN_DEFS } from "../constants/columnDefs";

interface StatisticsGridProps {
  rowData: any[];
  selectedStat: string;
  isMobile: boolean;
  onGridReady: (params: any) => void;
}

const StatisticsGrid: React.FC<StatisticsGridProps> = ({
  rowData,
  selectedStat,
  isMobile,
  onGridReady,
}) => {
  const theme = useTheme();
  
  // Inject theme-aware styles for AG Grid
  useEffect(() => {
    const style = document.createElement("style");
    const isDark = theme.palette.mode === 'dark';
    
    style.innerHTML = `
      .statistics-grid .ag-theme-alpine {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
      }
      .statistics-grid .ag-theme-alpine .ag-header-cell {
        background-color: ${isDark ? '#2d2d2d !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
      }
      .statistics-grid .ag-theme-alpine .ag-row {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
      }
      .statistics-grid .ag-theme-alpine .ag-row:hover {
        background-color: ${isDark ? 'rgba(255, 255, 255, 0.08) !important' : 'inherit'};
      }
      .statistics-grid .ag-theme-alpine .ag-cell {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        border-bottom-color: ${isDark ? 'rgba(255, 255, 255, 0.12) !important' : 'inherit'};
      }
      .statistics-grid .ag-theme-alpine .ag-root-wrapper {
        background-color: ${isDark ? '#1e1e1e !important' : 'inherit'};
      }
      .statistics-grid .ag-theme-alpine .ag-paging-panel {
        background-color: ${isDark ? '#2d2d2d !important' : 'inherit'};
        color: ${isDark ? '#ffffff !important' : 'inherit'};
        border-top-color: ${isDark ? 'rgba(255, 255, 255, 0.12) !important' : 'inherit'};
      }
      .statistics-grid .ag-theme-alpine .ag-paging-button {
        color: ${isDark ? '#ffffff !important' : 'inherit'};
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, [theme.palette.mode]);

  const getColumnDef = useCallback(() => {
    switch (selectedStat) {
      case "corpus_overview":
      case "document_length_stats":
        return COLUMN_DEFS.overview;
      case "word_length_distribution":
        return COLUMN_DEFS.wordLength;
      case "languages_detected":
        return COLUMN_DEFS.languages;
      case "most_common_punctuation":
        return COLUMN_DEFS.punctuation;
      case "field_completeness_percentage":
        return COLUMN_DEFS.completeness;
      case "most_frequent_words":
      case "most_frequent_bigrams":
      case "most_frequent_trigrams":
        return COLUMN_DEFS.ngram;
      default:
        return COLUMN_DEFS.otherStats;
    }
  }, [selectedStat]);

  const isOverviewStat =
    selectedStat === "corpus_overview" ||
    selectedStat === "document_length_stats";
  const gridHeight = isOverviewStat ? (isMobile ? "50vh" : "70vh") : "60vh";

  return (
    <Card sx={{ height: gridHeight }}>
      <CardContent sx={{ height: "100%", p: 0 }}>
        <Box
          className="ag-theme-alpine statistics-grid"
          style={{ height: "100%", width: "100%" }}
        >
          <AgGridReact
            columnDefs={getColumnDef()}
            rowData={rowData}
            pagination={true}
            paginationPageSize={
              isOverviewStat ? (isMobile ? 10 : 15) : isMobile ? 25 : 50
            }
            paginationPageSizeSelector={
              isOverviewStat ? [10, 15, 25] : [25, 50, 100, 200]
            }
            onGridReady={onGridReady}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              ...(isOverviewStat && {
                minWidth: isMobile ? 120 : 150,
                flex: 1,
              }),
            }}
            animateRows={true}
            enableRangeSelection={true}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            rowHeight={isOverviewStat ? 60 : undefined}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default React.memo(StatisticsGrid);
