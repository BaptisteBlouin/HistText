import React, { useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Search,
  TableRows,
  TableChart,
  Analytics,
  AccountTree,
  Fullscreen,
  FullscreenExit,
  Visibility,
  VisibilityOff,
  AspectRatio,
  CropFree,
  ExpandMore
} from '@mui/icons-material';
import {
  Cloud as CloudIcon
} from '@mui/icons-material';

interface TabInfo {
  icon: React.ReactNode;
  label: string;
  color: string;
  count?: number;
  description: string;
  isLoading: boolean;
}

// Define fullscreen modes
export type FullscreenMode = 'normal' | 'browser' | 'native';

interface TabNavigationProps {
  activeTab: number;
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
  partialResults: any[];
  allResults: any[];
  statsReady: boolean;
  wordFrequency: any[];
  nerReady: boolean;
  loading: boolean;
  isDataLoading: boolean;
  isStatsLoading: boolean;
  isCloudLoading: boolean;
  isNERLoading: boolean;
  fullscreenMode: FullscreenMode;
  onFullscreenModeChange: (mode: FullscreenMode) => void;
  isNERVisible: boolean;
  viewNER: boolean;
  onToggleNER: () => void;
  containerRef?: React.RefObject<HTMLElement>;
}

const TABS = {
  QUERY: 0,
  PARTIAL_RESULTS: 1,
  ALL_RESULTS: 2,
  STATS: 3,
  CLOUD: 4,
  NER: 5,
};

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  partialResults,
  allResults,
  statsReady,
  wordFrequency,
  nerReady,
  loading,
  isDataLoading,
  isStatsLoading,
  isCloudLoading,
  isNERLoading,
  fullscreenMode,
  onFullscreenModeChange,
  isNERVisible,
  viewNER,
  onToggleNER,
  containerRef
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [fullscreenMenuAnchor, setFullscreenMenuAnchor] = React.useState<null | HTMLElement>(null);

  // Handle native fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyNativeFullscreen = Boolean(document.fullscreenElement);
      if (!isCurrentlyNativeFullscreen && fullscreenMode === 'native') {
        onFullscreenModeChange('normal');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [fullscreenMode, onFullscreenModeChange]);

  // Handle fullscreen mode changes
  const handleFullscreenModeChange = async (mode: FullscreenMode) => {
    try {
      // Exit current native fullscreen if active
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }

      // Enter new mode
      if (mode === 'native') {
        const element = containerRef?.current || document.documentElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          await (element as any).webkitRequestFullscreen();
        } else if ((element as any).msRequestFullscreen) {
          await (element as any).msRequestFullscreen();
        }
      }

      onFullscreenModeChange(mode);
    } catch (error) {
      console.error('Error changing fullscreen mode:', error);
      // Fallback to browser mode if native fullscreen fails
      onFullscreenModeChange(mode === 'native' ? 'browser' : mode);
    }

    setFullscreenMenuAnchor(null);
  };

  const getFullscreenIcon = () => {
    switch (fullscreenMode) {
      case 'normal':
        return <AspectRatio />;
      case 'browser':
        return <CropFree />;
      case 'native':
        return <FullscreenExit />;
      default:
        return <AspectRatio />;
    }
  };

  const getFullscreenTooltip = () => {
    switch (fullscreenMode) {
      case 'normal':
        return 'Normal view - Click for fullscreen options';
      case 'browser':
        return 'Browser fullscreen - Click for options';
      case 'native':
        return 'Native fullscreen - Click for options (ESC to exit)';
      default:
        return 'Fullscreen options';
    }
  };

  const getTabInfo = (tabIndex: number): TabInfo => {
    const tabsInfo = {
      [TABS.QUERY]: { 
        icon: <Search />, 
        label: 'Query Builder', 
        color: 'primary',
        description: 'Build and execute search queries',
        isLoading: false
      },
      [TABS.PARTIAL_RESULTS]: { 
        icon: loading && partialResults.length === 0 ? <CircularProgress size={20} /> : <TableRows />, 
        label: isMobile ? 'Partial' : 'Partial Results', 
        color: 'secondary',
        count: partialResults.length,
        description: 'Quick preview of results',
        isLoading: loading && partialResults.length === 0
      },
      [TABS.ALL_RESULTS]: { 
        icon: isDataLoading ? <CircularProgress size={20} /> : <TableChart />, 
        label: isMobile ? 'All' : 'All Results', 
        color: 'success',
        count: allResults.length,
        description: 'Complete dataset',
        isLoading: isDataLoading
      },
      [TABS.STATS]: { 
        icon: isStatsLoading ? <CircularProgress size={20} /> : <Analytics />, 
        label: 'Analytics', 
        color: 'info',
        description: 'Statistical analysis',
        isLoading: isStatsLoading
      },
      [TABS.CLOUD]: { 
        icon: isCloudLoading ? <CircularProgress size={20} /> : <CloudIcon />, 
        label: isMobile ? 'Cloud' : 'Word Cloud', 
        color: 'warning',
        description: 'Visual word frequency',
        isLoading: isCloudLoading
      },
      [TABS.NER]: { 
        icon: isNERLoading ? <CircularProgress size={20} /> : <AccountTree />, 
        label: 'Entities', 
        color: 'error',
        description: 'Named entity recognition',
        isLoading: isNERLoading
      }
    };
    return tabsInfo[tabIndex];
  };

  return (
    <Box sx={{ 
      borderBottom: 1, 
      borderColor: 'divider',
      background: 'linear-gradient(90deg, #f8fafc 0%, #e2e8f0 100%)',
      position: 'relative'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
        <Tabs 
          value={activeTab} 
          onChange={onTabChange}
          variant={isMobile ? "scrollable" : "fullWidth"}
          scrollButtons={isMobile ? "auto" : false}
          sx={{
            flex: 1,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: isMobile ? '0.8rem' : '0.9rem',
              minHeight: 56,
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
              }
            },
            '& .Mui-selected': {
              color: '#667eea !important',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#667eea',
              height: 3,
            }
          }}
        >
          {Array.from({ length: 6 }, (_, index) => {
            const tabInfo = getTabInfo(index);
            const isDisabled = 
              (index === TABS.PARTIAL_RESULTS && partialResults.length === 0 && !tabInfo.isLoading) ||
              (index === TABS.ALL_RESULTS && allResults.length === 0 && !tabInfo.isLoading) ||
              (index === TABS.STATS && !statsReady && !tabInfo.isLoading) ||
              (index === TABS.CLOUD && wordFrequency.length === 0 && !tabInfo.isLoading) ||
              (index === TABS.NER && !nerReady && !tabInfo.isLoading);

            let badgeContent = null;
            let badgeColor: any = tabInfo.color;
            
            if (tabInfo.isLoading) {
              badgeContent = '⟳';
              badgeColor = 'primary';
            } else if (tabInfo.count && tabInfo.count > 0) {
              badgeContent = tabInfo.count;
            }

            return (
              <Tab
                key={index}
                icon={
                  <Badge 
                    badgeContent={badgeContent}
                    color={badgeColor}
                    invisible={!badgeContent}
                    max={999}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: tabInfo.isLoading ? '12px' : '11px',
                        height: tabInfo.isLoading ? '20px' : '16px',
                        minWidth: tabInfo.isLoading ? '20px' : '16px',
                        animation: tabInfo.isLoading ? 'spin 1s linear infinite' : 'none',
                        '@keyframes spin': {
                          '0%': {
                            transform: 'rotate(0deg)',
                          },
                          '100%': {
                            transform: 'rotate(360deg)',
                          },
                        }
                      }
                    }}
                  >
                    {tabInfo.icon}
                  </Badge>
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {tabInfo.label}
                    {tabInfo.isLoading && !isMobile && (
                      <Chip 
                        label="Processing" 
                        size="small" 
                        color="primary"
                        variant="outlined"
                        sx={{ 
                          height: '18px', 
                          fontSize: '10px',
                          '& .MuiChip-label': { px: 0.5 }
                        }}
                      />
                    )}
                  </Box>
                }
                iconPosition="start"
                disabled={isDisabled}
                sx={{
                  opacity: isDisabled ? 0.5 : 1,
                  '&.Mui-disabled': {
                    color: 'text.disabled'
                  },
                  ...(tabInfo.isLoading && {
                    background: 'linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.1) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s ease-in-out infinite',
                    '@keyframes shimmer': {
                      '0%': {
                        backgroundPosition: '-200% 0',
                      },
                      '100%': {
                        backgroundPosition: '200% 0',
                      },
                    }
                  })
                }}
              />
            );
          })}
        </Tabs>
                    
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title={getFullscreenTooltip()}>
            <IconButton 
              onClick={(event) => setFullscreenMenuAnchor(event.currentTarget)}
              size="small"
              sx={{ 
                color: 'text.secondary',
                bgcolor: fullscreenMode !== 'normal' ? 'primary.light' : 'transparent',
                '&:hover': {
                  bgcolor: fullscreenMode !== 'normal' ? 'primary.main' : 'action.hover',
                  color: fullscreenMode !== 'normal' ? 'white' : 'inherit'
                }
              }}
            >
              {getFullscreenIcon()}
              <ExpandMore sx={{ fontSize: 12, ml: 0.5 }} />
            </IconButton>
          </Tooltip>

          {/* Fullscreen Mode Menu */}
          <Menu
            anchorEl={fullscreenMenuAnchor}
            open={Boolean(fullscreenMenuAnchor)}
            onClose={() => setFullscreenMenuAnchor(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem 
              onClick={() => handleFullscreenModeChange('normal')}
              selected={fullscreenMode === 'normal'}
            >
              <ListItemIcon>
                <AspectRatio fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Normal View" 
                secondary="Standard layout with navigation"
              />
            </MenuItem>
            <MenuItem 
              onClick={() => handleFullscreenModeChange('browser')}
              selected={fullscreenMode === 'browser'}
            >
              <ListItemIcon>
                <CropFree fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Browser Fullscreen" 
                secondary="Full browser window (keeps browser UI)"
              />
            </MenuItem>
            <MenuItem 
              onClick={() => handleFullscreenModeChange('native')}
              selected={fullscreenMode === 'native'}
            >
              <ListItemIcon>
                <Fullscreen fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Native Fullscreen" 
                secondary="Complete screen takeover (ESC to exit)"
              />
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* NER Toggle FAB - Show only on Partial Results tab when NER is available */}
      {activeTab === TABS.PARTIAL_RESULTS && isNERVisible && (
        <Tooltip title={viewNER ? 'Hide NER highlighting' : 'Show NER highlighting'}>
          <Fab
            onClick={onToggleNER}
            size="medium"
            sx={{
              position: 'absolute',
              bottom: -28,
              right: 24,
              bgcolor: viewNER ? 'error.main' : 'primary.main',
              '&:hover': { bgcolor: viewNER ? 'error.dark' : 'primary.dark' },
              zIndex: 1000,
            }}
          >
            {viewNER ? <VisibilityOff /> : <Visibility />}
          </Fab>
        </Tooltip>
      )}
    </Box>
  );
};

export default TabNavigation;