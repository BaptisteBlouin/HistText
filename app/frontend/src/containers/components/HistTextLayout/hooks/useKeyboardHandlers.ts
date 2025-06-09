import { useEffect, useMemo, useCallback } from "react";

/**
 * Hook providing keyboard and UI handlers for fullscreen and quick actions.
 *
 * Handles ESC key for exiting fullscreen and normalizing mode,
 * exposes memoized handlers for quick actions and notifications.
 *
 * @param fullscreenMode - The current fullscreen mode/state.
 * @param setFullscreenMode - Setter function to change fullscreen mode.
 * @param setQuickActions - Setter function to show/hide quick actions UI.
 * @param setNotification - Setter function to update notification state.
 * @param actions - Object containing available action handlers (export, refresh, share, settings).
 * @param showNotification - Function or value related to showing notifications (not directly used here).
 *
 * @returns Object containing:
 *   - quickActionsHandlers: Handlers for quick action UI.
 *   - notificationHandlers: Handlers for notification UI.
 */
export const useKeyboardHandlers = (
  fullscreenMode: any,
  setFullscreenMode: any,
  setQuickActions: any,
  setNotification: any,
  actions: any,
  showNotification: any,
) => {
  /**
   * Handles the Escape key:
   * - If in browser fullscreen, exits fullscreen.
   * - Otherwise, resets fullscreenMode to 'normal' if not already.
   */
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (fullscreenMode !== "normal") {
          setFullscreenMode("normal");
        }
      }
    },
    [fullscreenMode, setFullscreenMode],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  /**
   * Handlers for quick actions UI (open/close/actions).
   */
  const quickActionsHandlers = useMemo(
    () => ({
      onOpen: () => setQuickActions(true),
      onClose: () => setQuickActions(false),
      onExportData: actions.exportAllData,
      onRefreshData: actions.refreshData,
      onShareQuery: actions.shareQuery,
      onOpenSettings: actions.openSettings,
    }),
    [setQuickActions, actions],
  );

  /**
   * Handlers for notifications (close notification).
   */
  const notificationHandlers = useMemo(
    () => ({
      onClose: () => setNotification((prev: any) => ({ ...prev, open: false })),
    }),
    [setNotification],
  );

  return {
    quickActionsHandlers,
    notificationHandlers,
  };
};
