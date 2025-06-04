import React from 'react';
import HistTextLayoutContainer from './HistTextLayoutContainer';

/**
 * Props for the HistTextLayout component.
 *
 * @property data - All state and data needed for the layout.
 * @property actions - Action handlers for the UI.
 * @property activeTab - The currently active tab index.
 * @property setActiveTab - Handler to set the active tab.
 * @property fullscreenMode - Current fullscreen mode state.
 * @property setFullscreenMode - Setter for fullscreen mode.
 * @property quickActions - Whether the quick actions UI is visible.
 * @property setQuickActions - Setter for quick actions state.
 * @property notification - Notification system state.
 * @property setNotification - Setter for notification state.
 * @property onSolrDatabaseChange - Handler for database selection changes.
 * @property showNotification - Function to show a notification message.
 */
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

/**
 * Wrapper for HistTextLayoutContainer, forwarding all props.
 */
const HistTextLayout: React.FC<HistTextLayoutProps> = (props) => {
  return <HistTextLayoutContainer {...props} />;
};

export default HistTextLayout;