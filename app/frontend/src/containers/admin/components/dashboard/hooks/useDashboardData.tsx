// app/frontend/src/containers/admin/components/dashboard/hooks/useDashboardData.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import axios, { AxiosError } from 'axios';
import { ComprehensiveStats, LegacyStats, DetailedEmbeddingStats, AdvancedCacheStats } from '../types';

interface RequestCache {
  [key: string]: {
    promise: Promise<any>;
    timestamp: number;
    data?: any;
  };
}

interface UseDashboardDataReturn {
  comprehensiveStats: ComprehensiveStats | null;
  legacyStats: LegacyStats | null;
  embeddingDetails: DetailedEmbeddingStats | null;
  advancedStats: AdvancedCacheStats | null;
  loading: boolean;
  detailsLoading: boolean;
  advancedLoading: boolean;
  error: string | null;
  fetchComprehensiveStats: (options?: { useCache?: boolean }) => Promise<void>;
  fetchEmbeddingDetails: (options?: { useCache?: boolean }) => Promise<void>;
  fetchAdvancedStats: (options?: { useCache?: boolean }) => Promise<void>;
  clearEmbeddingCache: () => Promise<void>;
  resetMetrics: () => Promise<void>;
}

export const useDashboardData = (accessToken: string | null): UseDashboardDataReturn => {
  // State variables
  const [comprehensiveStats, setComprehensiveStats] = useState<ComprehensiveStats | null>(null);
  const [legacyStats, setLegacyStats] = useState<LegacyStats | null>(null);
  const [embeddingDetails, setEmbeddingDetails] = useState<DetailedEmbeddingStats | null>(null);
  const [advancedStats, setAdvancedStats] = useState<AdvancedCacheStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [advancedLoading, setAdvancedLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup and caching
  const requestCacheRef = useRef<RequestCache>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Fetch comprehensive stats
  const fetchComprehensiveStats = useCallback(async (options: { useCache?: boolean } = {}) => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get<ComprehensiveStats>('/api/dashboard/comprehensive', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (isMountedRef.current) {
        setComprehensiveStats(response.data);
        setLegacyStats(null); // Clear legacy stats when comprehensive is available
      }
    } catch (err: any) {
      console.error('Failed to load comprehensive stats:', err);
      
      // Fallback to legacy stats
      try {
        const legacyResponse = await axios.get<LegacyStats>('/api/stats', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (isMountedRef.current) {
          setLegacyStats(legacyResponse.data);
          setComprehensiveStats(null);
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
  }, [accessToken]);

  // Fetch embedding details
  const fetchEmbeddingDetails = useCallback(async (options: { useCache?: boolean } = {}) => {
    if (!accessToken) return;

    try {
      setDetailsLoading(true);
      
      const response = await axios.get<DetailedEmbeddingStats>('/api/embeddings/stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (isMountedRef.current) {
        setEmbeddingDetails(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load embedding details:', err);
      // Don't set error state for embedding details as it's not critical
    } finally {
      if (isMountedRef.current) {
        setDetailsLoading(false);
      }
    }
  }, [accessToken]);

  // Fetch advanced stats
  const fetchAdvancedStats = useCallback(async (options: { useCache?: boolean } = {}) => {
    if (!accessToken) return;

    try {
      setAdvancedLoading(true);
      
      const response = await axios.get<AdvancedCacheStats>('/api/embeddings/advanced-stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (isMountedRef.current) {
        setAdvancedStats(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load advanced cache stats:', err);
      // Don't set error state for advanced stats as it's not critical
    } finally {
      if (isMountedRef.current) {
        setAdvancedLoading(false);
      }
    }
  }, [accessToken]);

  // Clear embedding cache
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
      
      // Refresh relevant data after clearing cache
      await Promise.all([
        fetchComprehensiveStats({ useCache: false }),
        fetchEmbeddingDetails({ useCache: false }),
      ]);
    } catch (err: any) {
      console.error('Failed to clear embedding cache:', err);
      throw new Error(err.response?.data?.message || 'Failed to clear cache');
    }
  }, [accessToken, fetchComprehensiveStats, fetchEmbeddingDetails]);

  // Reset metrics
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
      
      // Refresh advanced stats after reset
      await fetchAdvancedStats({ useCache: false });
    } catch (err: any) {
      console.error('Failed to reset metrics:', err);
      throw new Error(err.response?.data?.message || 'Failed to reset metrics');
    }
  }, [accessToken, fetchAdvancedStats]);

  // Initial load effect
  useEffect(() => {
    if (accessToken && isMountedRef.current) {
      fetchComprehensiveStats();
    }
  }, [accessToken, fetchComprehensiveStats]);

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Clear cache
      requestCacheRef.current = {};
    };
  }, []);

  // Return all state and functions
  return {
    comprehensiveStats,
    legacyStats,
    embeddingDetails,
    advancedStats,
    loading,
    detailsLoading,
    advancedLoading,
    error,
    fetchComprehensiveStats,
    fetchEmbeddingDetails,
    fetchAdvancedStats,
    clearEmbeddingCache,
    resetMetrics,
  };
};