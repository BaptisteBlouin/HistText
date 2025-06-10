import React from "react";
import {
  Box,
  Tabs,
  Tab,
  Chip,
  Badge,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Search,
  TableRows,
  TableChart,
  Analytics,
  AccountTree,
  Cloud as CloudIcon,
} from "@mui/icons-material";
import { CountBadge } from "../../../components/ui";
import { useResponsive } from "../../../lib/responsive-utils";

interface TabsHeaderProps {
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
}

const TABS = {
  QUERY: 0,
  PARTIAL_RESULTS: 1,
  ALL_RESULTS: 2,
  STATS: 3,
  CLOUD: 4,
  NER: 5,
};

interface TabInfo {
  icon: React.ReactNode;
  label: string;
  color: string;
  count?: number;
  description: string;
  isLoading: boolean;
}

const TabsHeader: React.FC<TabsHeaderProps> = ({
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
}) => {
  const { isMobile, isTablet } = useResponsive();
  const getTabInfo = (tabIndex: number): TabInfo => {
    const tabsInfo = {
      [TABS.QUERY]: {
        icon: <Search />,
        label: "Query Builder",
        color: "primary",
        description: "Build and execute search queries",
        isLoading: false,
      },
      [TABS.PARTIAL_RESULTS]: {
        icon:
          loading && partialResults.length === 0 ? (
            <CircularProgress size={20} />
          ) : (
            <TableRows />
          ),
        label: isMobile ? "Partial" : isTablet ? "Partial" : "Partial Results",
        color: "secondary",
        count: partialResults.length,
        description: "Quick preview of results",
        isLoading: loading && partialResults.length === 0,
      },
      [TABS.ALL_RESULTS]: {
        icon: isDataLoading ? <CircularProgress size={20} /> : <TableChart />,
        label: isMobile ? "All" : isTablet ? "All" : "All Results",
        color: "success",
        count: allResults.length,
        description: "Complete dataset",
        isLoading: isDataLoading,
      },
      [TABS.STATS]: {
        icon: isStatsLoading ? <CircularProgress size={20} /> : <Analytics />,
        label: "Analytics",
        color: "info",
        description: "Statistical analysis",
        isLoading: isStatsLoading,
      },
      [TABS.CLOUD]: {
        icon: isCloudLoading ? <CircularProgress size={20} /> : <CloudIcon />,
        label: isMobile ? "Cloud" : isTablet ? "Cloud" : "Word Cloud",
        color: "warning",
        description: "Visual word frequency",
        isLoading: isCloudLoading,
      },
      [TABS.NER]: {
        icon: isNERLoading ? <CircularProgress size={20} /> : <AccountTree />,
        label: "Entities",
        color: "error",
        description: "Named entity recognition",
        isLoading: isNERLoading,
      },
    };
    return tabsInfo[tabIndex];
  };

  return (
    <Tabs
      value={activeTab}
      onChange={onTabChange}
      variant={isMobile ? "scrollable" : isTablet ? "scrollable" : "fullWidth"}
      scrollButtons={isMobile || isTablet ? "auto" : false}
      sx={{
        flex: 1,
        "& .MuiTab-root": {
          textTransform: "none",
          fontWeight: 600,
          fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.9rem' },
          minHeight: { xs: 48, sm: 52, md: 56 },
          minWidth: { xs: 80, sm: 100, md: 120 },
          padding: { xs: '6px 8px', sm: '8px 12px', md: '12px 16px' },
          transition: "all 0.2s ease",
          "&:hover": {
            backgroundColor: "action.hover",
          },
        },
        "& .Mui-selected": {
          color: "primary.main !important",
        },
        "& .MuiTabs-indicator": {
          backgroundColor: "primary.main",
          height: 3,
        },
      }}
    >
      {Array.from({ length: 6 }, (_, index) => {
        const tabInfo = getTabInfo(index);
        const isDisabled =
          (index === TABS.PARTIAL_RESULTS &&
            partialResults.length === 0 &&
            !tabInfo.isLoading) ||
          (index === TABS.ALL_RESULTS &&
            allResults.length === 0 &&
            !tabInfo.isLoading) ||
          (index === TABS.STATS && !statsReady && !tabInfo.isLoading) ||
          (index === TABS.CLOUD &&
            wordFrequency.length === 0 &&
            !tabInfo.isLoading) ||
          (index === TABS.NER && !nerReady && !tabInfo.isLoading);

        let badgeContent = null;
        let badgeColor: any = tabInfo.color;

        if (tabInfo.isLoading) {
          badgeContent = "⟳";
          badgeColor = "primary";
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
                  "& .MuiBadge-badge": {
                    fontSize: tabInfo.isLoading ? "12px" : "11px",
                    height: tabInfo.isLoading ? "20px" : "16px",
                    minWidth: tabInfo.isLoading ? "20px" : "16px",
                    animation: tabInfo.isLoading
                      ? "spin 1s linear infinite"
                      : "none",
                    "@keyframes spin": {
                      "0%": {
                        transform: "rotate(0deg)",
                      },
                      "100%": {
                        transform: "rotate(360deg)",
                      },
                    },
                  },
                }}
              >
                {tabInfo.icon}
              </Badge>
            }
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                {tabInfo.label}
                {tabInfo.isLoading && !isMobile && (
                  <Chip
                    label="Processing"
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{
                      height: "18px",
                      fontSize: "10px",
                      "& .MuiChip-label": { px: 0.5 },
                    }}
                  />
                )}
              </Box>
            }
            iconPosition="start"
            disabled={isDisabled}
            sx={{
              opacity: isDisabled ? 0.5 : 1,
              "&.Mui-disabled": {
                color: "text.disabled",
              },
              ...(tabInfo.isLoading && {
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.1) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 2s ease-in-out infinite",
                "@keyframes shimmer": {
                  "0%": {
                    backgroundPosition: "-200% 0",
                  },
                  "100%": {
                    backgroundPosition: "200% 0",
                  },
                },
              }),
            }}
          />
        );
      })}
    </Tabs>
  );
};

export default React.memo(TabsHeader);
