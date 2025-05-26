import { useState, useEffect } from 'react';
import axios from 'axios';
import { RequestAnalytics } from '../types';

export const useAnalytics = (accessToken: string | null, isVisible: boolean) => {
  const [analytics, setAnalytics] = useState<RequestAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);

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