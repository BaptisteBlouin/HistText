import { useCallback, useState } from 'react';
import { contentCache } from '../utils';

/**
 * Custom hook providing actions and state for AG Grid data table:
 * - Handles search/filter, fullscreen, export CSV, selection, and cache control.
 *
 * @param results - Array of result objects displayed in the grid.
 * @param gridRef - Mutable ref to the AG Grid React instance.
 * @returns Actions and state for toolbar/grid control.
 */
export const useDataGridActions = (
  results: any[],
  gridRef: React.MutableRefObject<any>
) => {
  const [searchText, setSearchText] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  /**
   * Download current results as a CSV file.
   */
  const downloadCSV = useCallback(() => {
    if (results.length === 0) return;

    const headers = Object.keys(results[0]).filter(
      key => !(key.startsWith('_') && key.endsWith('_'))
    );
    const csvRows = [headers.join(',')];

    results.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        const stringValue = value !== null && value !== undefined ? String(value) : '';
        return `"${stringValue.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `histtext-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  /**
   * Set the quick filter (search) in the grid.
   */
  const handleSearch = useCallback((value: string) => {
    setSearchText(value);
    if (gridRef.current?.api) {
      gridRef.current.api.setQuickFilter(value);
    }
  }, [gridRef]);

  /**
   * Clear all filters and search text in the grid.
   */
  const clearFilters = useCallback(() => {
    setSearchText('');
    if (gridRef.current?.api) {
      gridRef.current.api.setQuickFilter('');
      gridRef.current.api.setFilterModel(null);
    }
    contentCache.clear();
  }, [gridRef]);

  /**
   * Select all rows in the grid.
   */
  const selectAll = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.selectAll();
    }
  }, [gridRef]);

  /**
   * Deselect all rows in the grid.
   */
  const deselectAll = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.deselectAll();
    }
  }, [gridRef]);

  /**
   * Auto-size all columns in the grid.
   */
  const autoSizeColumns = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.autoSizeAllColumns();
    }
  }, [gridRef]);

  /**
   * Clear the content cache (used for cell rendering).
   */
  const clearCache = useCallback(() => {
    contentCache.clear();
  }, []);

  return {
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
    clearCache
  };
};
