import React from 'react';
import HistTextLayoutContainer from './HistTextLayoutContainer';

interface HistTextLayoutProps {
  data: any;
  actions: any;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  fullscreenMode: any;
  setFullscreenMode: (mode: any) => void;
  quickActions: boolean;
  setQuickActions: (open: boolean) => void;
  notification: any;
  setNotification: (notification: any) => void;
  onSolrDatabaseChange: (database: any) => void;
  showNotification: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
}

const HistTextLayout: React.FC<HistTextLayoutProps> = (props) => {
  return <HistTextLayoutContainer {...props} />;
};

export default HistTextLayout;