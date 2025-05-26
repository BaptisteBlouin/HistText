import { useMemo, useCallback, useRef } from 'react';
import { calculateColumnSizes, createColumnDefs } from '../utils';
import CellRenderer from '../components/CellRenderer';

const CONCORDANCE_THRESHOLD = 100;

export const useDataGridConfig = (
  results: any[],
  nerData: any,
  viewNER: boolean,
  formData: any,
  selectedAlias: string,
  selectedSolrDatabase: any,
  authAxios: any,
  isAllResultsTab: boolean = false,
  onIdClick: (id: string) => void // Add this parameter
) => {
  const gridRef = useRef<any>(null);

  // Determine if we should show concordance mode
  const showConcordance = isAllResultsTab && results.length > CONCORDANCE_THRESHOLD;

  // Calculate column configuration
  const { mainTextColumn, columnSizes } = useMemo(() => 
    calculateColumnSizes(results), [results]
  );

  // Row data
  const rowData = useMemo(() => 
    results.map((row, i) => ({ ...row, id: row.id || i })), 
    [results]
  );

  // Column definitions
  const columnDefs = useMemo(() => 
    createColumnDefs(
      results,
      columnSizes,
      mainTextColumn,
      showConcordance,
      nerData,
      viewNER,
      formData,
      onIdClick // Pass onIdClick here
    ), [results, columnSizes, mainTextColumn, showConcordance, nerData, viewNER, formData, onIdClick]
  );

  // Grid ready handler with auto-sizing
  const onGridReady = useCallback((params: any) => {
    gridRef.current = params;
    
    // Initial column sizing
    setTimeout(() => {
      // Don't use sizeColumnsToFit as it overrides our calculated widths
      // Instead, just ensure the grid is properly displayed
      params.api.refreshCells();
    }, 100);
  }, []);

  // Default column definition
  const defaultColDef = useMemo(() => ({
    filter: true,
    resizable: true,
    sortable: true,
    suppressSizeToFit: false,
  }), []);

  // Cell renderer components
  const components = useMemo(() => ({
    cellRenderer: CellRenderer,
  }), []);

  return {
    gridRef,
    rowData,
    columnDefs,
    defaultColDef,
    components,
    onGridReady,
    showConcordance,
    mainTextColumn,
    columnSizes
  };
};