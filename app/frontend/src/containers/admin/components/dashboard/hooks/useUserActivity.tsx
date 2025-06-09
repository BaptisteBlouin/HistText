import { useState, useEffect } from "react";
import axios from "axios";
import { UserActivity } from "../types";

/**
 * useUserActivity
 *
 * Custom hook to fetch and manage user activity/security events for the dashboard.
 *
 * @param accessToken Authorization token for API requests.
 * @param isVisible Only fetch activity if true (e.g. when visible).
 *
 * @returns {
 *   userActivity: User activity data or null,
 *   userActivityLoading: Loading state,
 *   fetchUserActivity: Function to manually trigger a refresh.
 * }
 */
export const useUserActivity = (
  accessToken: string | null,
  isVisible: boolean,
) => {
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
  const [userActivityLoading, setUserActivityLoading] =
    useState<boolean>(false);

  /**
   * Fetches user activity from the API.
   */
  const fetchUserActivity = async () => {
    try {
      setUserActivityLoading(true);
      const response = await axios.get<UserActivity>(
        "/api/dashboard/user-activity",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      setUserActivity(response.data);
    } catch (err: any) {
      console.error("Failed to load user activity:", err);
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
