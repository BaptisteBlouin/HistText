import React from 'react';
import QuickActionsComponent from './QuickActionsComponent';

interface QuickActionsProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onExportData: () => void;
  onRefreshData: () => void;
  onShareQuery: () => void;
  onOpenSettings: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = (props) => {
  return <QuickActionsComponent {...props} />;
};

export default QuickActions;