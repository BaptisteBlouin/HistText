// Add debounced search for better performance
import { useCallback, useState, useMemo } from "react";
import { contentCache } from "../utils";

export const useDataGridActions = (
  results: any[],
  gridRef: React.MutableRefObject<any>,
) => {
  const [searchText, setSearchText] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Debounced search implementation for performance
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (gridRef.current?.api) {
          gridRef.current.api.setQuickFilter(value);
        }
      }, 150); // 150ms debounce for better performance
    };
  }, [gridRef]);

  // Optimized search handler
  const handleSearch = useCallback(
    (value: string) => {
      setSearchText(value);
      debouncedSearch(value);
    },
    [debouncedSearch],
  );

  // Optimized CSV download with chunked processing
  const downloadCSV = useCallback(() => {
    if (results.length === 0) return;

    // Process in chunks for large datasets
    const chunkSize = 1000;
    const headers = Object.keys(results[0]).filter(
      (key) => !(key.startsWith("_") && key.endsWith("_")),
    );
    
    let csvContent = headers.join(",") + "\n";

    // Process results in chunks to avoid blocking the UI
    const processChunk = (startIndex: number) => {
      const endIndex = Math.min(startIndex + chunkSize, results.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        const row = results[i];
        const values = headers.map((header) => {
          const value = row[header];
          const stringValue =
            value !== null && value !== undefined ? String(value) : "";
          return `"${stringValue.replace(/"/g, '""')}"`;
        });
        csvContent += values.join(",") + "\n";
      }

      if (endIndex < results.length) {
        // Use setTimeout to avoid blocking the main thread
        setTimeout(() => processChunk(endIndex), 0);
      } else {
        // Download when complete
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `histtext-data-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    };

    processChunk(0);
  }, [results]);

  // Rest of the existing functions remain the same...
  const clearFilters = useCallback(() => {
    setSearchText("");
    if (gridRef.current?.api) {
      gridRef.current.api.setQuickFilter("");
      gridRef.current.api.setFilterModel(null);
    }
    contentCache.clear();
  }, [gridRef]);

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
    clearCache,
  };
};