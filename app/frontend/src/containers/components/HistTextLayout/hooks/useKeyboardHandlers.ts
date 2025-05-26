import { useEffect, useMemo, useCallback } from 'react';

export const useKeyboardHandlers = (
  fullscreenMode: any,
  setFullscreenMode: any,
  setQuickActions: any,
  setNotification: any,
  actions: any,
  showNotification: any
) => {
  // Optimized keyboard handler
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (fullscreenMode !== 'normal') {
        setFullscreenMode('normal');
      }
    }
  }, [fullscreenMode, setFullscreenMode]);

  // Effect for ESC key handling
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Memoized quick actions handlers
  const quickActionsHandlers = useMemo(() => ({
    onOpen: () => setQuickActions(true),
    onClose: () => setQuickActions(false),
    onExportData: actions.exportAllData,
    onRefreshData: actions.refreshData,
    onShareQuery: actions.shareQuery,
    onOpenSettings: actions.openSettings,
  }), [setQuickActions, actions]);

  // Memoized notification handlers
  const notificationHandlers = useMemo(() => ({
    onClose: () => setNotification(prev => ({ ...prev, open: false }))
  }), [setNotification]);

  return {
    quickActionsHandlers,
    notificationHandlers
  };
};