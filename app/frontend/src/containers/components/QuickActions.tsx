import React from 'react';
import { SpeedDial, SpeedDialIcon, SpeedDialAction } from '@mui/material';
import { Download, Refresh, Settings, Share } from '@mui/icons-material';

interface QuickActionsProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onExportData: () => void;
  onRefreshData: () => void;
  onShareQuery: () => void;
  onOpenSettings: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  open,
  onOpen,
  onClose,
  onExportData,
  onRefreshData,
  onShareQuery,
  onOpenSettings
}) => {
  const quickActionItems = [
    { icon: <Download />, name: 'Export Data', action: onExportData },
    { icon: <Refresh />, name: 'Refresh', action: onRefreshData },
    { icon: <Share />, name: 'Share Query', action: onShareQuery },
    { icon: <Settings />, name: 'Settings', action: onOpenSettings }
  ];

  return (
    <SpeedDial
      ariaLabel="Quick Actions"
      sx={{ position: 'fixed', bottom: 24, right: 24 }}
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
          onClick={() => {
            action.action();
            onClose();
          }}
        />
      ))}
    </SpeedDial>
  );
};

export default QuickActions;