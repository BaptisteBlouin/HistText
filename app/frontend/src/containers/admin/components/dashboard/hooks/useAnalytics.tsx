import { useState, useEffect } from 'react';
import axios from 'axios';
import { RequestAnalytics } from '../types';

/**
 * useAnalytics
 * Custom hook to fetch and manage API analytics data for the dashboard.
 * 
 * @param accessToken Authorization token for API requests.
 * @param isVisible Only fetch analytics if true (e.g. when visible).
 * 
 * @returns {
 *   analytics: Analytics data or null,
 *   analyticsLoading: Loading state,
 *   fetchAnalytics: Function to manually trigger a refresh.
 * }
 */
export const useAnalytics = (accessToken: string | null, isVisible: boolean) => {
  const [analytics, setAnalytics] = useState<RequestAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);

  /**
   * Fetches analytics data from the API.
   */
  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await axios.get<RequestAnalytics>('/api/dashboard/analytics', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setAnalytics(response.data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible && accessToken) {
      fetchAnalytics();
    }
  }, [isVisible, accessToken]);

  return {
    analytics,
    analyticsLoading,
    fetchAnalytics,
  };
};
