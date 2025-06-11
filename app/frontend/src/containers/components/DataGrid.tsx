import React, { useState, useCallback } from "react";
import { Box, Typography, Alert } from "@mui/material";
import { TableChart, Info } from "@mui/icons-material";
import { useDataGridConfig } from "./DataGrid/hooks/useDataGridConfig";
import { useDataGridActions } from "./DataGrid/hooks/useDataGridActions";
import { contentCache } from "./DataGrid/utils";
import { useResponsive } from "../../lib/responsive-utils";
import DataGridToolbar from "./DataGrid/components/DataGridToolbar";
import DataGridMain from "./DataGrid/components/DataGridMain";
import ExportDialog from "./DataGrid/components/ExportDialog";
import DocumentDetailsModal from "./DocumentDetailsModal";

interface DataGridComponentProps {
  results: any[];
  formData: any;
  nerData: any;
  viewNER: boolean;
  selectedAlias: string;
  selectedSolrDatabase: any;
  authAxios: any;
  isAllResultsTab?: boolean;
  isLoading?: boolean;
}

const DataGridComponent: React.FC<DataGridComponentProps> = React.memo(
  ({
    results,
    formData,
    nerData,
    viewNER,
    selectedAlias,
    selectedSolrDatabase,
    authAxios,
    isAllResultsTab = false,
    isLoading = false,
  }) => {
    const { isMobile } = useResponsive();

    // Local state
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
      null,
    );
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState("csv");

    // Handle ID click
    const handleIdClick = useCallback((documentId: string) => {
      setSelectedDocumentId(documentId);
      setIsModalOpen(true);
    }, []);

    // Custom hooks
    const {
      gridRef,
      rowData,
      columnDefs,
      defaultColDef,
      components,
      onGridReady,
      showConcordance,
      mainTextColumn,
    } = useDataGridConfig(
      results,
      nerData,
      viewNER,
      formData,
      selectedAlias,
      selectedSolrDatabase,
      authAxios,
      isAllResultsTab,
      handleIdClick, // Pass handleIdClick here
    );

    const {
      searchText,
      menuAnchor,
      fullscreen,
      setMenuAnchor,
      setFullscreen,
      downloadCSV,
      handleSearch,
      clearFilters,
      selectAll,
      deselectAll,
      autoSizeColumns,
      clearCache,
    } = useDataGridActions(results, gridRef);

    // Early return for empty results
    if (results.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: "center" }}>
          <TableChart
            sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.5 }}
          />
          <Typography variant="h6" color="text.secondary">
            No data to display
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2, height: "100%" }}>
        {showConcordance && (
          <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Concordance Mode:</strong> Showing text snippets around
              search terms for {results.length} results. NER highlighting is
              disabled for performance. Click document IDs to view full content.
            </Typography>
          </Alert>
        )}

        <DataGridToolbar
          resultsLength={results.length}
          showConcordance={showConcordance}
          mainTextColumn={mainTextColumn}
          cacheSize={contentCache.size}
          searchText={searchText}
          onSearchChange={handleSearch}
          onClearFilters={clearFilters}
          onExport={() => setExportDialogOpen(true)}
          onFullscreen={() => setFullscreen(!fullscreen)}
          menuAnchor={menuAnchor}
          onMenuOpen={(e) => setMenuAnchor(e.currentTarget)}
          onMenuClose={() => setMenuAnchor(null)}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onAutoSizeColumns={autoSizeColumns}
          onClearCache={clearCache}
        />

        <DataGridMain
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          components={components}
          onGridReady={onGridReady}
          showConcordance={showConcordance}
          fullscreen={fullscreen}
          onIdClick={handleIdClick}
          searchText={searchText}
          onSearchChange={handleSearch}
          isLoading={isLoading}
        />

        <ExportDialog
          open={exportDialogOpen}
          exportFormat={exportFormat}
          onClose={() => setExportDialogOpen(false)}
          onFormatChange={setExportFormat}
          onExport={() => {
            downloadCSV();
            setExportDialogOpen(false);
          }}
        />

        <DocumentDetailsModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          documentId={selectedDocumentId || ""}
          collectionName={selectedAlias}
          solrDatabaseId={selectedSolrDatabase?.id}
          authAxios={authAxios}
          nerData={nerData}
          viewNER={viewNER}
        />
      </Box>
    );
  },
);

DataGridComponent.displayName = "DataGridComponent";

export default DataGridComponent;
