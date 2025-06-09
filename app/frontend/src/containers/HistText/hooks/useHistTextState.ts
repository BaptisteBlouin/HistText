import { useState, useCallback, useMemo } from "react";
import { FullscreenMode } from "../components/TabNavigation";

interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

const INITIAL_NOTIFICATION_STATE: NotificationState = {
  open: false,
  message: "",
  severity: "info",
};

export const useHistTextState = () => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [fullscreenMode, setFullscreenMode] =
    useState<FullscreenMode>("normal");
  const [quickActions, setQuickActions] = useState<boolean>(false);
  const [notification, setNotification] = useState<NotificationState>(
    INITIAL_NOTIFICATION_STATE,
  );

  const showNotification = useCallback(
    (
      message: string,
      severity: "success" | "error" | "warning" | "info" = "info",
    ) => {
      setNotification({ open: true, message, severity });
    },
    [],
  );

  const resetHistTextState = useCallback(() => {
    setActiveTab(0);
    setQuickActions(false);
    setNotification(INITIAL_NOTIFICATION_STATE);
  }, []);

  return {
    activeTab,
    setActiveTab,
    fullscreenMode,
    setFullscreenMode,
    quickActions,
    setQuickActions,
    notification,
    setNotification,
    showNotification,
    resetHistTextState,
  };
};
