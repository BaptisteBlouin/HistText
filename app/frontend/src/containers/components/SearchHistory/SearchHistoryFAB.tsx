// app/frontend/src/containers/components/SearchHistory/SearchHistoryFAB.tsx
import React, { useState } from "react";
import {
  Fab,
  Tooltip,
  Badge,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
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

  return (
    <SpeedDial
      ariaLabel="Search History Actions"
      sx={{
        position: "fixed",
        bottom: isMobile ? (isVerySmallMobile ? 70 : 80) : 24, // Position above mobile menu FAB
        right: isMobile ? (isVerySmallMobile ? 12 : 16) : 24, // Move to right side on mobile to avoid menu FAB
        left: isMobile ? 'auto' : 24, // Remove left positioning on mobile
        zIndex: 1000,
      }}
      icon={
        <SpeedDialIcon
          icon={
            <Badge
              badgeContent={stats.totalHistory + stats.totalBookmarks}
              color="primary"
              max={99}
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
      size={isVerySmallMobile ? "small" : isMobile ? "medium" : "large"}
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
        />
      ))}
    </SpeedDial>
  );
};

export default SearchHistoryFAB;
