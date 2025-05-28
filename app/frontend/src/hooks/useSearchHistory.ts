// app/frontend/src/hooks/useSearchHistory.ts
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  formData: Record<string, { value: string; operator: string; not?: boolean }[]>;
  dateRange: { min: string; max: string } | null;
  selectedAlias: string;
  selectedSolrDatabase: {
    id: number;
    name: string;
  };
  createdAt: string;
  lastUsed: string;
  isBookmarked: boolean;
  tags: string[];
  queryString: string;
  resultsCount?: number;
}

interface UseSearchHistoryOptions {
  maxHistorySize?: number;
  maxBookmarksSize?: number;
}

export const useSearchHistory = (options: UseSearchHistoryOptions = {}) => {
  const { maxHistorySize = 50, maxBookmarksSize = 100 } = options;
  const { session } = useAuth();
  
  const [searchHistory, setSearchHistory] = useState<SavedSearch[]>([]);
  const [bookmarks, setBookmarks] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Storage keys - user-specific
  const historyKey = `histtext_search_history_${session?.userId || 'anonymous'}`;
  const bookmarksKey = `histtext_bookmarks_${session?.userId || 'anonymous'}`;

  // Load data from localStorage on mount
  useEffect(() => {
    setIsLoading(true);
    try {
      const storedHistory = localStorage.getItem(historyKey);
      const storedBookmarks = localStorage.getItem(bookmarksKey);

      if (storedHistory) {
        setSearchHistory(JSON.parse(storedHistory));
      }
      if (storedBookmarks) {
        setBookmarks(JSON.parse(storedBookmarks));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [historyKey, bookmarksKey, session?.userId]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(historyKey, JSON.stringify(searchHistory));
      } catch (error) {
        console.error('Error saving search history:', error);
      }
    }
  }, [searchHistory, historyKey, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
      } catch (error) {
        console.error('Error saving bookmarks:', error);
      }
    }
  }, [bookmarks, bookmarksKey, isLoading]);

  // Add search to history
  const addToHistory = useCallback((search: Omit<SavedSearch, 'id' | 'createdAt' | 'lastUsed'>) => {
    const newSearch: SavedSearch = {
      ...search,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    setSearchHistory(prev => {
      // Remove duplicates based on similar queries
      const filtered = prev.filter(item => 
        item.queryString !== newSearch.queryString ||
        item.selectedAlias !== newSearch.selectedAlias ||
        item.selectedSolrDatabase.id !== newSearch.selectedSolrDatabase.id
      );
      
      // Add new search to beginning and limit size
      const updated = [newSearch, ...filtered].slice(0, maxHistorySize);
      return updated;
    });

    return newSearch.id;
  }, [maxHistorySize]);

  // Save search as bookmark
  const saveAsBookmark = useCallback((search: SavedSearch | Omit<SavedSearch, 'id' | 'createdAt' | 'lastUsed'>) => {
    const bookmark: SavedSearch = {
      ...search,
      id: 'id' in search ? search.id : `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: 'createdAt' in search ? search.createdAt : new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      isBookmarked: true,
    };

    setBookmarks(prev => {
      // Check if bookmark already exists
      const exists = prev.some(item => 
        item.queryString === bookmark.queryString &&
        item.selectedAlias === bookmark.selectedAlias &&
        item.selectedSolrDatabase.id === bookmark.selectedSolrDatabase.id
      );

      if (exists) return prev;

      // Add new bookmark and limit size
      return [bookmark, ...prev].slice(0, maxBookmarksSize);
    });

    return bookmark.id;
  }, [maxBookmarksSize]);

  // Remove from history
  const removeFromHistory = useCallback((id: string) => {
    setSearchHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  // Remove bookmark
  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => prev.filter(item => item.id !== id));
  }, []);

  // Update search usage (move to top of history)
  const updateSearchUsage = useCallback((id: string) => {
    setSearchHistory(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index === -1) return prev;

      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        lastUsed: new Date().toISOString(),
      };

      // Move to front
      const [item] = updated.splice(index, 1);
      return [item, ...updated];
    });
  }, []);

  // Update bookmark
  const updateBookmark = useCallback((id: string, updates: Partial<SavedSearch>) => {
    setBookmarks(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates, lastUsed: new Date().toISOString() } : item
    ));
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  // Clear all bookmarks
  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
  }, []);

  // Search within history and bookmarks
  const searchInSaved = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    
    const filteredHistory = searchHistory.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery) ||
      item.queryString.toLowerCase().includes(lowerQuery) ||
      item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );

    const filteredBookmarks = bookmarks.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery) ||
      item.queryString.toLowerCase().includes(lowerQuery) ||
      item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );

    return {
      history: filteredHistory,
      bookmarks: filteredBookmarks,
    };
  }, [searchHistory, bookmarks]);

  // Export searches for backup
  const exportSearches = useCallback(() => {
    const data = {
      history: searchHistory,
      bookmarks: bookmarks,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `histtext-searches-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [searchHistory, bookmarks]);

  // Import searches from backup
  const importSearches = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          
          if (data.history && Array.isArray(data.history)) {
            setSearchHistory(prev => [...data.history, ...prev].slice(0, maxHistorySize));
          }
          
          if (data.bookmarks && Array.isArray(data.bookmarks)) {
            setBookmarks(prev => [...data.bookmarks, ...prev].slice(0, maxBookmarksSize));
          }
          
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }, [maxHistorySize, maxBookmarksSize]);

  return {
    // Data
    searchHistory,
    bookmarks,
    isLoading,
    
    // Actions
    addToHistory,
    saveAsBookmark,
    removeFromHistory,
    removeBookmark,
    updateSearchUsage,
    updateBookmark,
    clearHistory,
    clearBookmarks,
    searchInSaved,
    exportSearches,
    importSearches,
    
    // Statistics
    stats: {
      totalHistory: searchHistory.length,
      totalBookmarks: bookmarks.length,
      recentSearches: searchHistory.slice(0, 10),
      topTags: bookmarks.reduce((acc, item) => {
        item.tags.forEach(tag => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>),
    }
  };
};