import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserActivity } from '../types';

export const useUserActivity = (accessToken: string | null, isVisible: boolean) => {
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
  const [userActivityLoading, setUserActivityLoading] = useState<boolean>(false);

  const fetchUserActivity = async () => {
    try {
      setUserActivityLoading(true);
      const response = await axios.get<UserActivity>('/api/dashboard/user-activity', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setUserActivity(response.data);
    } catch (err: any) {
      console.error('Failed to load user activity:', err);
    } finally {
      setUserActivityLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible && accessToken) {
      fetchUserActivity();
    }
  }, [isVisible, accessToken]);

  return {
    userActivity,
    userActivityLoading,
    fetchUserActivity,
  };
};