// app/frontend/src/containers/admin/components/dashboard/hooks/useComponentRefresh.tsx
import { useState, useCallback, useRef } from 'react';

interface RefreshState {
  [componentId: string]: {
    loading: boolean;
    lastRefresh: Date | null;
    error: string | null;
  };
}

export const useComponentRefresh = () => {
  const [refreshStates, setRefreshStates] = useState<RefreshState>({});
  const abortControllersRef = useRef<{ [key: string]: AbortController }>({});

  const updateRefreshState = useCallback((componentId: string, updates: Partial<RefreshState[string]>) => {
    setRefreshStates(prev => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        ...updates,
      },
    }));
  }, []);

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

  const cancelRefresh = useCallback((componentId: string) => {
    if (abortControllersRef.current[componentId]) {
      abortControllersRef.current[componentId].abort();
      delete abortControllersRef.current[componentId];
    }
    
    updateRefreshState(componentId, { loading: false });
  }, [updateRefreshState]);

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