// app/frontend/src/containers/components/SearchHistory/SearchHistoryFAB.tsx
import React, { useState } from "react";
import {
  Fab,
  Tooltip,
  Badge,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  useTheme,
} from "@mui/material";
import { History, Bookmark, Add, FolderOpen } from "@mui/icons-material";
import { useSearchHistory } from "../../../hooks/useSearchHistory";
import { useResponsive } from "../../../lib/responsive-utils";

interface SearchHistoryFABProps {
  onOpenHistory: () => void;
  onOpenBookmarks: () => void;
  onSaveCurrentSearch: () => void;
  hasCurrentSearch: boolean;
}

const SearchHistoryFAB: React.FC<SearchHistoryFABProps> = ({
  onOpenHistory,
  onOpenBookmarks,
  onSaveCurrentSearch,
  hasCurrentSearch,
}) => {
  const theme = useTheme();
  const { stats } = useSearchHistory();
  const { isMobile, isVerySmallMobile } = useResponsive();
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  const actions = [
    {
      icon: <History />,
      name: `Recent (${stats.totalHistory})`,
      onClick: onOpenHistory,
    },
    {
      icon: <Bookmark />,
      name: `Bookmarks (${stats.totalBookmarks})`,
      onClick: onOpenBookmarks,
    },
    ...(hasCurrentSearch
      ? [
          {
            icon: <Add />,
            name: "Save Current",
            onClick: onSaveCurrentSearch,
          },
        ]
      : []),
  ];

  // Get the appropriate size styling for the SpeedDial
  const getSpeedDialSize = () => {
    if (isVerySmallMobile) return { width: 40, height: 40 };
    if (isMobile) return { width: 48, height: 48 };
    return { width: 56, height: 56 };
  };

  return (
    <SpeedDial
      ariaLabel="Search History Actions"
      sx={{
        position: "fixed",
        bottom: isMobile ? (isVerySmallMobile ? 70 : 80) : 24, // Position above mobile menu FAB
        right: isMobile ? (isVerySmallMobile ? 12 : 16) : 24, // Move to right side on mobile to avoid menu FAB
        left: isMobile ? 'auto' : 24, // Remove left positioning on mobile
        zIndex: 1000,
        '& .MuiSpeedDial-fab': {
          ...getSpeedDialSize(),
          // Theme-aware colors with your app's gradient
          background: theme.palette.mode === 'dark'
            ? "linear-gradient(135deg, #424242 0%, #303030 100%)"
            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          "&:hover": {
            background: theme.palette.mode === 'dark'
              ? "linear-gradient(135deg, #4a4a4a 0%, #2d2d2d 100%)"
              : "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
          },
        },
        '& .MuiSpeedDialAction-fab': {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          border: `1px solid ${theme.palette.divider}`,
          "&:hover": {
            backgroundColor: theme.palette.action.hover,
          },
        },
      }}
      icon={
        <SpeedDialIcon
          icon={
            <Badge
              badgeContent={stats.totalHistory + stats.totalBookmarks}
              color="primary"
              max={99}
              sx={{
                "& .MuiBadge-badge": {
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? theme.palette.primary.light 
                    : theme.palette.primary.main,
                  color: theme.palette.mode === 'dark' 
                    ? theme.palette.primary.contrastText 
                    : "white",
                },
              }}
            >
              <FolderOpen sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
            </Badge>
          }
          openIcon={<FolderOpen sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />}
        />
      }
      onOpen={() => setSpeedDialOpen(true)}
      onClose={() => setSpeedDialOpen(false)}
      open={speedDialOpen}
      direction="up"
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
          onClick={() => {
            action.onClick();
            setSpeedDialOpen(false);
          }}
          sx={{
            "& .MuiSpeedDialAction-staticTooltipLabel": {
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.shadows[4],
            },
          }}
        />
      ))}
    </SpeedDial>
  );
};

export default SearchHistoryFAB;