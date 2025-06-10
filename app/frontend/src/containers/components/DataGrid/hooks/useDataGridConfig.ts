import { useMemo, useCallback, useRef } from "react";
import { calculateColumnSizes, createColumnDefs } from "../utils";
import CellRenderer from "../components/CellRenderer";

const CONCORDANCE_THRESHOLD = 100;

/**
 * Custom hook to configure AG Grid for your data table, including:
 * - Columns, sizes, and rowData
 * - Concordance mode auto-detection
 * - Grid ready callback and component setup
 *
 * @param results - Data rows to display
 * @param nerData - NER data for rendering
 * @param viewNER - Whether to show NER
 * @param formData - Additional form data
 * @param selectedAlias - Selected alias/collection
 * @param selectedSolrDatabase - Selected Solr database
 * @param authAxios - Axios instance (if needed for column utils)
 * @param isAllResultsTab - True if this is the "all results" tab
 * @param onIdClick - Callback for clicking an ID cell
 * @returns AG Grid config object with refs, columns, etc.
 */
export const useDataGridConfig = (
  results: any[],
  nerData: any,
  viewNER: boolean,
  formData: any,
  selectedAlias: string,
  selectedSolrDatabase: any,
  authAxios: any,
  isAllResultsTab: boolean = false,
  onIdClick: (id: string) => void,
) => {
  const gridRef = useRef<any>(null);

  /**
   * Whether to enable concordance display mode.
   */
  const showConcordance =
    isAllResultsTab && results.length > CONCORDANCE_THRESHOLD;

  /**
   * Calculate main column and column sizes based on data.
   */
  const { mainTextColumn, columnSizes } = useMemo(
    () => calculateColumnSizes(results),
    [results],
  );

  /**
   * Process row data and ensure each row has an ID.
   */
  const rowData = useMemo(
    () => results.map((row, i) => ({ ...row, id: row.id || i })),
    [results],
  );

  /**
   * Generate AG Grid column definitions for current data and state.
   */
  const columnDefs = useMemo(
    () =>
      createColumnDefs(
        results,
        columnSizes,
        mainTextColumn,
        showConcordance,
        nerData,
        viewNER,
        formData,
        onIdClick,
      ),
    [
      results,
      columnSizes,
      mainTextColumn,
      showConcordance,
      nerData,
      viewNER,
      formData,
      onIdClick,
    ],
  );

  /**
   * Handler for AG Grid's onGridReady event.
   * Sets gridRef and refreshes cells.
   */
  const onGridReady = useCallback((params: any) => {
    gridRef.current = params;
    setTimeout(() => {
      params.api.refreshCells();
    }, 100);
  }, []);

  /**
   * Default column options for AG Grid columns.
   */
  const defaultColDef = useMemo(
    () => ({
      filter: true,
      resizable: true,
      sortable: true,
      suppressSizeToFit: false,
      // Performance optimizations
      suppressKeyboardEvent: (params: any) => {
        // Suppress some keyboard events for better performance
        return false;
      },
      // Reduce cell flash on data changes
      suppressCellFlash: true,
    }),
    [],
  );

  /**
   * Map cellRenderer to custom CellRenderer component.
   */
  const components = useMemo(
    () => ({
      cellRenderer: CellRenderer,
    }),
    [], // Empty dependency array since CellRenderer is stable
  );

  return {
    gridRef,
    rowData,
    columnDefs,
    defaultColDef,
    components,
    onGridReady,
    showConcordance,
    mainTextColumn,
    columnSizes,
  };
};
