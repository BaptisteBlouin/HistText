import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { ComprehensiveStats, LegacyStats, DetailedEmbeddingStats, AdvancedCacheStats } from '../types';

/**
 * Internal cache entry for dashboard API responses.
 */
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * Return value of useDashboardData hook.
 * - Includes all API-provided stats and utility flags/functions for loading/error/caching/refresh.
 */
interface UseDashboardDataReturn {
  comprehensiveStats: ComprehensiveStats | null;
  legacyStats: LegacyStats | null;
  embeddingDetails: DetailedEmbeddingStats | null;
  advancedStats: AdvancedCacheStats | null;
  loading: boolean;
  detailsLoading: boolean;
  advancedLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isDataFresh: boolean;
  fetchComprehensiveStats: (options?: { useCache?: boolean; force?: boolean }) => Promise<void>;
  fetchEmbeddingDetails: (options?: { useCache?: boolean; force?: boolean }) => Promise<void>;
  fetchAdvancedStats: (options?: { useCache?: boolean; force?: boolean }) => Promise<void>;
  clearEmbeddingCache: () => Promise<void>;
  resetMetrics: () => Promise<void>;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEYS = {
  COMPREHENSIVE: 'dashboard_comprehensive',
  LEGACY: 'dashboard_legacy',
  EMBEDDING: 'dashboard_embedding',
  ADVANCED: 'dashboard_advanced',
} as const;

/**
 * useDashboardData
 * 
 * Provides comprehensive dashboard data with automatic caching, stale-checking, 
 * fallback to legacy endpoints, and utility methods for refreshing and clearing state.
 * Caches responses in-memory and in localStorage for 5 minutes.
 * 
 * @param accessToken The user access token for API authorization.
 * @returns See UseDashboardDataReturn.
 */
export const useDashboardData = (accessToken: string | null): UseDashboardDataReturn => {
  // State variables
  const [comprehensiveStats, setComprehensiveStats] = useState<ComprehensiveStats | null>(null);
  const [legacyStats, setLegacyStats] = useState<LegacyStats | null>(null);
  const [embeddingDetails, setEmbeddingDetails] = useState<DetailedEmbeddingStats | null>(null);
  const [advancedStats, setAdvancedStats] = useState<AdvancedCacheStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [advancedLoading, setAdvancedLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Refs for cleanup and caching
  const cacheRef = useRef<{ [key: string]: CacheEntry }>({});
  const isMountedRef = useRef<boolean>(true);

  /**
   * Returns true if a given cache entry is still valid.
   */
  const isDataFresh = useCallback((key: string): boolean => {
    const cached = cacheRef.current[key];
    if (!cached) return false;
    return Date.now() < cached.expiresAt;
  }, []);

  /**
   * Gets a cached value by key, only if not expired.
   */
  const getCachedData = useCallback((key: string): any => {
    const cached = cacheRef.current[key];
    if (!cached || Date.now() >= cached.expiresAt) {
      return null;
    }
    return cached.data;
  }, []);

  /**
   * Stores a value in the cache and updates lastUpdated.
   */
  const setCachedData = useCallback((key: string, data: any): void => {
    const now = Date.now();
    cacheRef.current[key] = {
      data,
      timestamp: now,
      expiresAt: now + CACHE_DURATION,
    };
    setLastUpdated(new Date(now));
  }, []);

  /**
   * Should fetch if force is set, if not using cache, or if data is stale.
   */
  const shouldFetch = useCallback((key: string, force: boolean = false, useCache: boolean = true): boolean => {
    if (force) return true;
    if (!useCache) return true;
    return !isDataFresh(key);
  }, [isDataFresh]);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadFromStorage = (): void => {
      try {
        const storedCache = localStorage.getItem('dashboard_cache');
        if (storedCache) {
          const parsed = JSON.parse(storedCache);
          
          // Check if data is still fresh
          Object.entries(parsed).forEach(([key, entry]: [string, any]) => {
            if (Date.now() < entry.expiresAt) {
              cacheRef.current[key] = entry;
              
              // Set state based on cached data
              switch (key) {
                case CACHE_KEYS.COMPREHENSIVE:
                  setComprehensiveStats(entry.data);
                  setLastUpdated(new Date(entry.timestamp));
                  break;
                case CACHE_KEYS.LEGACY:
                  setLegacyStats(entry.data);
                  setLastUpdated(new Date(entry.timestamp));
                  break;
                case CACHE_KEYS.EMBEDDING:
                  setEmbeddingDetails(entry.data);
                  break;
                case CACHE_KEYS.ADVANCED:
                  setAdvancedStats(entry.data);
                  break;
              }
            }
          });
        }
      } catch (error) {
        console.error('Failed to load cache from localStorage:', error);
      }
    };

    loadFromStorage();
  }, []);

  // Save cache to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('dashboard_cache', JSON.stringify(cacheRef.current));
    } catch (error) {
      console.error('Failed to save cache to localStorage:', error);
    }
  }, [comprehensiveStats, legacyStats, embeddingDetails, advancedStats]);

  /**
   * Fetches comprehensive stats (prefers cache, falls back to legacy on error).
   */
  const fetchComprehensiveStats = useCallback(async (options: { useCache?: boolean; force?: boolean } = {}): Promise<void> => {
    const { useCache = true, force = false } = options;
    
    if (!accessToken) return;

    // Check if we should use cached data
    if (!shouldFetch(CACHE_KEYS.COMPREHENSIVE, force, useCache)) {
      const cached = getCachedData(CACHE_KEYS.COMPREHENSIVE);
      if (cached) {
        setComprehensiveStats(cached);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/dashboard/comprehensive', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (isMountedRef.current) {
        setComprehensiveStats(response.data);
        setLegacyStats(null);
        setCachedData(CACHE_KEYS.COMPREHENSIVE, response.data);
      }
    } catch (err: any) {
      console.error('Failed to load comprehensive stats:', err);
      
      // Try legacy stats as fallback
      try {
        const legacyResponse = await axios.get('/api/stats', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (isMountedRef.current) {
          setLegacyStats(legacyResponse.data);
          setComprehensiveStats(null);
          setCachedData(CACHE_KEYS.LEGACY, legacyResponse.data);
        }
      } catch (legacyErr: any) {
        console.error('Failed to load legacy stats:', legacyErr);
        if (isMountedRef.current) {
          setError('Failed to load dashboard statistics. Please try again.');
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken, shouldFetch, getCachedData, setCachedData]);

  /**
   * Fetches embedding detail stats, uses cache if possible.
   */
  const fetchEmbeddingDetails = useCallback(async (options: { useCache?: boolean; force?: boolean } = {}): Promise<void> => {
    const { useCache = true, force = false } = options;
    
    if (!accessToken) return;

    // Check cache first
    if (!shouldFetch(CACHE_KEYS.EMBEDDING, force, useCache)) {
      const cached = getCachedData(CACHE_KEYS.EMBEDDING);
      if (cached) {
        setEmbeddingDetails(cached);
        return;
      }
    }

    try {
      setDetailsLoading(true);
      
      const response = await axios.get('/api/embeddings/stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (isMountedRef.current) {
        setEmbeddingDetails(response.data);
        setCachedData(CACHE_KEYS.EMBEDDING, response.data);
      }
    } catch (err: any) {
      console.error('Failed to load embedding details:', err);
    } finally {
      if (isMountedRef.current) {
        setDetailsLoading(false);
      }
    }
  }, [accessToken, shouldFetch, getCachedData, setCachedData]);

  /**
   * Fetches advanced cache stats, uses cache if possible.
   */
  const fetchAdvancedStats = useCallback(async (options: { useCache?: boolean; force?: boolean } = {}): Promise<void> => {
    const { useCache = true, force = false } = options;
    
    if (!accessToken) return;

    // Check cache first
    if (!shouldFetch(CACHE_KEYS.ADVANCED, force, useCache)) {
      const cached = getCachedData(CACHE_KEYS.ADVANCED);
      if (cached) {
        setAdvancedStats(cached);
        return;
      }
    }

    try {
      setAdvancedLoading(true);
      
      const response = await axios.get('/api/embeddings/advanced-stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (isMountedRef.current) {
        setAdvancedStats(response.data);
        setCachedData(CACHE_KEYS.ADVANCED, response.data);
      }
    } catch (err: any) {
      console.error('Failed to load advanced cache stats:', err);
    } finally {
      if (isMountedRef.current) {
        setAdvancedLoading(false);
      }
    }
  }, [accessToken, shouldFetch, getCachedData, setCachedData]);

  /**
   * Clears the embedding cache and refreshes related stats.
   */
  const clearEmbeddingCache = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      throw new Error('No access token available');
    }

    try {
      await axios.post(
        '/api/embeddings/clear',
        {},
        { 
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      // Clear related cache entries
      delete cacheRef.current[CACHE_KEYS.COMPREHENSIVE];
      delete cacheRef.current[CACHE_KEYS.EMBEDDING];
      delete cacheRef.current[CACHE_KEYS.ADVANCED];
      
      // Force refresh relevant data
      await Promise.all([
        fetchComprehensiveStats({ force: true }),
        fetchEmbeddingDetails({ force: true }),
      ]);
    } catch (err: any) {
      console.error('Failed to clear embedding cache:', err);
      throw new Error(err.response?.data?.message || 'Failed to clear cache');
    }
  }, [accessToken, fetchComprehensiveStats, fetchEmbeddingDetails]);

  /**
   * Resets embedding metrics and refreshes advanced stats.
   */
  const resetMetrics = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      throw new Error('No access token available');
    }

    try {
      await axios.post(
        '/api/embeddings/reset-metrics',
        {},
        { 
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      // Clear advanced stats cache
      delete cacheRef.current[CACHE_KEYS.ADVANCED];
      
      // Force refresh advanced stats
      await fetchAdvancedStats({ force: true });
    } catch (err: any) {
      console.error('Failed to reset metrics:', err);
      throw new Error(err.response?.data?.message || 'Failed to reset metrics');
    }
  }, [accessToken, fetchAdvancedStats]);

  // Initial load effect - only load if no fresh cached data
  useEffect(() => {
    if (accessToken && isMountedRef.current) {
      // Only fetch if we don't have fresh cached data
      if (!isDataFresh(CACHE_KEYS.COMPREHENSIVE) && !isDataFresh(CACHE_KEYS.LEGACY)) {
        fetchComprehensiveStats();
      }
    }
  }, [accessToken, fetchComprehensiveStats, isDataFresh]);

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Calculate if current data is fresh
  const currentDataFresh = isDataFresh(CACHE_KEYS.COMPREHENSIVE) || isDataFresh(CACHE_KEYS.LEGACY);

  return {
    comprehensiveStats,
    legacyStats,
    embeddingDetails,
    advancedStats,
    loading,
    detailsLoading,
    advancedLoading,
    error,
    lastUpdated,
    isDataFresh: currentDataFresh,
    fetchComprehensiveStats,
    fetchEmbeddingDetails,
    fetchAdvancedStats,
    clearEmbeddingCache,
    resetMetrics,
  };
};
