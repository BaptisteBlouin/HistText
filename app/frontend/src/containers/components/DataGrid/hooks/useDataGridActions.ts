import { useCallback, useState } from 'react';
import { contentCache } from '../utils';

export const useDataGridActions = (
  results: any[],
  gridRef: React.MutableRefObject<any>
) => {
  const [searchText, setSearchText] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Download CSV
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

  // Search handler
  const handleSearch = useCallback((value: string) => {
    setSearchText(value);
    if (gridRef.current?.api) {
      gridRef.current.api.setQuickFilter(value);
    }
  }, [gridRef]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchText('');
    if (gridRef.current?.api) {
      gridRef.current.api.setQuickFilter('');
      gridRef.current.api.setFilterModel(null);
    }
    contentCache.clear();
  }, [gridRef]);

  // Grid actions
  const selectAll = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.selectAll();
    }
  }, [gridRef]);

  const deselectAll = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.deselectAll();
    }
  }, [gridRef]);

  const autoSizeColumns = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.autoSizeAllColumns();
    }
  }, [gridRef]);

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