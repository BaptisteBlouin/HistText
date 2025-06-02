import { useState, useCallback, useRef } from 'react';

/**
 * Represents the refresh/loading/error state for a set of components.
 * Keys are component IDs.
 */
interface RefreshState {
  [componentId: string]: {
    loading: boolean;
    lastRefresh: Date | null;
    error: string | null;
  };
}

/**
 * useComponentRefresh
 * Custom hook to manage refresh and loading state for multiple dashboard components.
 * Provides abort support and per-component tracking.
 *
 * @returns {
 *   refreshComponent: Triggers refresh for a component with loading/error tracking,
 *   cancelRefresh: Cancels refresh for a component,
 *   getRefreshState: Gets state for a component,
 *   refreshStates: All refresh states.
 * }
 */
export const useComponentRefresh = () => {
  const [refreshStates, setRefreshStates] = useState<RefreshState>({});
  const abortControllersRef = useRef<{ [key: string]: AbortController }>({});

  /**
   * Updates the refresh state for a single component.
   */
  const updateRefreshState = useCallback((componentId: string, updates: Partial<RefreshState[string]>) => {
    setRefreshStates(prev => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        ...updates,
      },
    }));
  }, []);

  /**
   * Triggers a refresh for the specified component.
   * Handles aborting any previous refresh and updates loading/error state.
   */
  const refreshComponent = useCallback(async (
    componentId: string,
    refreshFn: () => Promise<void>
  ) => {
    // Cancel any existing refresh for this component
    if (abortControllersRef.current[componentId]) {
      abortControllersRef.current[componentId].abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    abortControllersRef.current[componentId] = controller;

    updateRefreshState(componentId, { 
      loading: true, 
      error: null 
    });

    try {
      await refreshFn();
      
      // Only update if not aborted
      if (!controller.signal.aborted) {
        updateRefreshState(componentId, {
          loading: false,
          lastRefresh: new Date(),
        });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        updateRefreshState(componentId, {
          loading: false,
          error: error instanceof Error ? error.message : 'Refresh failed',
        });
      }
    } finally {
      // Clean up controller
      if (abortControllersRef.current[componentId] === controller) {
        delete abortControllersRef.current[componentId];
      }
    }
  }, [updateRefreshState]);

  /**
   * Cancels the refresh process for a given component.
   */
  const cancelRefresh = useCallback((componentId: string) => {
    if (abortControllersRef.current[componentId]) {
      abortControllersRef.current[componentId].abort();
      delete abortControllersRef.current[componentId];
    }
    
    updateRefreshState(componentId, { loading: false });
  }, [updateRefreshState]);

  /**
   * Returns the refresh state for a given component.
   */
  const getRefreshState = useCallback((componentId: string) => {
    return refreshStates[componentId] || {
      loading: false,
      lastRefresh: null,
      error: null,
    };
  }, [refreshStates]);

  return {
    refreshComponent,
    cancelRefresh,
    getRefreshState,
    refreshStates,
  };
};