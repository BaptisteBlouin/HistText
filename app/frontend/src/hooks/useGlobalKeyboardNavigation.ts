import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

interface UseGlobalKeyboardNavigationProps {
  activeTab?: number;
  setActiveTab?: (tab: number) => void;
  onToggleSidebar?: () => void;
  onOpenSearchHistory?: () => void;
  onFocusSearch?: () => void;
  onExecuteSearch?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

export const useGlobalKeyboardNavigation = ({
  activeTab = 0,
  setActiveTab,
  onToggleSidebar,
  onOpenSearchHistory,
  onFocusSearch,
  onExecuteSearch,
  onRefresh,
  onExport,
}: UseGlobalKeyboardNavigationProps = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
    const target = event.target as HTMLElement;
    if (
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.contentEditable === 'true' ||
      target?.classList.contains('ag-cell-editor')
    ) {
      // Allow specific shortcuts even in input fields
      if (event.key === 'Escape') {
        target.blur();
        return;
      }
      
      // Allow Ctrl+Enter for search execution in input fields
      if (event.ctrlKey && event.key === 'Enter' && onExecuteSearch) {
        event.preventDefault();
        onExecuteSearch();
        return;
      }
      
      return;
    }

    // Prevent default behavior for our shortcuts
    const preventDefault = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    // Navigation shortcuts
    if (event.ctrlKey && !event.shiftKey && !event.altKey) {
      switch (event.key.toLowerCase()) {
        case 'h':
          preventDefault();
          navigate('/');
          break;
          
        case 'm':
          preventDefault();
          if (isAuthenticated) {
            navigate('/histtext');
          }
          break;
          
        case 'a':
          preventDefault();
          if (isAuthenticated) {
            navigate('/account');
          }
          break;
          
        case 'b':
          preventDefault();
          if (onToggleSidebar) {
            onToggleSidebar();
          }
          break;
          
        case 'k':
          preventDefault();
          if (onFocusSearch) {
            onFocusSearch();
          }
          break;
          
        case 'r':
          preventDefault();
          if (onRefresh) {
            onRefresh();
          } else {
            // Fallback to page refresh
            window.location.reload();
          }
          break;
          
        case 'e':
          preventDefault();
          if (onExport) {
            onExport();
          }
          break;
          
        // Tab navigation (only in HistText)
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
          if (location.pathname.startsWith('/histtext') && setActiveTab) {
            preventDefault();
            const tabIndex = parseInt(event.key) - 1;
            setActiveTab(tabIndex);
          }
          break;
          
        case 'arrowleft':
          if (location.pathname.startsWith('/histtext') && setActiveTab) {
            preventDefault();
            const newTab = Math.max(0, activeTab - 1);
            setActiveTab(newTab);
          }
          break;
          
        case 'arrowright':
          if (location.pathname.startsWith('/histtext') && setActiveTab) {
            preventDefault();
            const newTab = Math.min(5, activeTab + 1); // Assuming 6 tabs (0-5)
            setActiveTab(newTab);
          }
          break;
          
        case 'enter':
          preventDefault();
          if (onExecuteSearch) {
            onExecuteSearch();
          }
          break;
      }
    }
    
    // Ctrl+Shift shortcuts
    if (event.ctrlKey && event.shiftKey && !event.altKey) {
      switch (event.key.toLowerCase()) {
        case 'a':
          preventDefault();
          if (isAuthenticated && user?.is_admin) {
            navigate('/Admin');
          }
          break;
          
        case 'h':
          preventDefault();
          if (onOpenSearchHistory) {
            onOpenSearchHistory();
          }
          break;
      }
    }
    
    // Alt shortcuts (browser navigation)
    if (event.altKey && !event.ctrlKey && !event.shiftKey) {
      switch (event.key.toLowerCase()) {
        case 'arrowleft':
          preventDefault();
          window.history.back();
          break;
          
        case 'arrowright':
          preventDefault();
          window.history.forward();
          break;
      }
    }
    
    // Special keys
    switch (event.key) {
      case 'Escape':
        // Close dialogs, clear selections, blur active element
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.blur) {
          activeElement.blur();
        }
        
        // Close any open dialogs
        const dialogs = document.querySelectorAll('[role="dialog"]');
        dialogs.forEach(dialog => {
          const closeButton = dialog.querySelector('[aria-label="close"], [aria-label="Close"]') as HTMLElement;
          if (closeButton) {
            closeButton.click();
          }
        });
        break;
        
      case '?':
        // Show keyboard shortcuts help
        if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
          preventDefault();
          // This will be handled by the KeyboardShortcutsHelp component
          const event2 = new CustomEvent('show-keyboard-help');
          window.dispatchEvent(event2);
        }
        break;
    }
  }, [
    navigate,
    location.pathname,
    isAuthenticated,
    user?.role,
    activeTab,
    setActiveTab,
    onToggleSidebar,
    onOpenSearchHistory,
    onFocusSearch,
    onExecuteSearch,
    onRefresh,
    onExport,
  ]);

  useEffect(() => {
    // Add the keyboard event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    // Return any utility functions that components might need
    focusSearch: onFocusSearch,
    executeSearch: onExecuteSearch,
    refresh: onRefresh,
  };
};

export default useGlobalKeyboardNavigation;