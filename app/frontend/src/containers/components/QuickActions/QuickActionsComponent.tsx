import React, { useMemo } from "react";
import { SpeedDial, SpeedDialIcon, SpeedDialAction } from "@mui/material";
import { Download, Refresh, Settings, Share } from "@mui/icons-material";

interface QuickAction {
  icon: React.ReactNode;
  name: string;
  action: () => void;
}

interface QuickActionsComponentProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onExportData: () => void;
  onRefreshData: () => void;
  onShareQuery: () => void;
  onOpenSettings: () => void;
}

const QuickActionsComponent: React.FC<QuickActionsComponentProps> = ({
  open,
  onOpen,
  onClose,
  onExportData,
  onRefreshData,
  onShareQuery,
  onOpenSettings,
}) => {
  const quickActionItems: QuickAction[] = useMemo(
    () => [
      { icon: <Download />, name: "Export Data", action: onExportData },
      { icon: <Refresh />, name: "Refresh", action: onRefreshData },
      { icon: <Share />, name: "Share Query", action: onShareQuery },
      { icon: <Settings />, name: "Settings", action: onOpenSettings },
    ],
    [onExportData, onRefreshData, onShareQuery, onOpenSettings],
  );

  const handleActionClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <SpeedDial
      ariaLabel="Quick Actions"
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        "& .MuiFab-primary": {
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
          },
        },
      }}
      icon={<SpeedDialIcon />}
      open={open}
      onOpen={onOpen}
      onClose={onClose}
    >
      {quickActionItems.map((action, index) => (
        <SpeedDialAction
          key={index}
          icon={action.icon}
          tooltipTitle={action.name}
          onClick={() => handleActionClick(action.action)}
          sx={{
            "&:hover": {
              backgroundColor: "primary.light",
            },
          }}
        />
      ))}
    </SpeedDial>
  );
};

export default React.memo(QuickActionsComponent);
