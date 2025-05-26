import { useState, useEffect } from 'react';
import axios from 'axios';
import { ComprehensiveStats, LegacyStats, DetailedEmbeddingStats, AdvancedCacheStats } from '../types';

export const useDashboardData = (accessToken: string | null) => {
  const [comprehensiveStats, setComprehensiveStats] = useState<ComprehensiveStats | null>(null);
  const [legacyStats, setLegacyStats] = useState<LegacyStats | null>(null);
  const [embeddingDetails, setEmbeddingDetails] = useState<DetailedEmbeddingStats | null>(null);
  const [advancedStats, setAdvancedStats] = useState<AdvancedCacheStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [advancedLoading, setAdvancedLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComprehensiveStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get<ComprehensiveStats>('/api/dashboard/comprehensive', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setComprehensiveStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load comprehensive stats:', err);
      // Fallback to legacy stats
      await fetchLegacyStats();
    } finally {
      setLoading(false);
    }
  };

  const fetchLegacyStats = async () => {
    try {
      const response = await axios.get<LegacyStats>('/api/stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setLegacyStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load legacy stats:', err);
      setError('Failed to load dashboard stats. Please try again.');
    }
  };

  const fetchEmbeddingDetails = async () => {
    try {
      setDetailsLoading(true);
      const response = await axios.get<DetailedEmbeddingStats>('/api/embeddings/stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setEmbeddingDetails(response.data);
    } catch (err: any) {
      console.error('Failed to load embedding details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchAdvancedStats = async () => {
    try {
      setAdvancedLoading(true);
      const response = await axios.get<AdvancedCacheStats>('/api/embeddings/advanced-stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setAdvancedStats(response.data);
    } catch (err: any) {
      console.error('Failed to load advanced cache stats:', err);
    } finally {
      setAdvancedLoading(false);
    }
  };

  const clearEmbeddingCache = async () => {
    try {
      await axios.post(
        '/api/embeddings/clear',
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (comprehensiveStats) {
        fetchComprehensiveStats();
      } else {
        fetchLegacyStats();
      }
      fetchEmbeddingDetails();
    } catch (err: any) {
      console.error('Failed to clear embedding cache:', err);
    }
  };

  const resetMetrics = async () => {
    try {
      await axios.post(
        '/api/embeddings/reset-metrics',
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      fetchAdvancedStats();
    } catch (err: any) {
      console.error('Failed to reset metrics:', err);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchComprehensiveStats();
    }
  }, [accessToken]);

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