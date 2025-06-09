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
        bottom: 24,
        left: 24,
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
              <FolderOpen />
            </Badge>
          }
          openIcon={<FolderOpen />}
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
        />
      ))}
    </SpeedDial>
  );
};

export default SearchHistoryFAB;
