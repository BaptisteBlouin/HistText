import React, { useState } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Typography,
  Button,
} from "@mui/material";
import {
  Fullscreen,
  FullscreenExit,
  AspectRatio,
  CropFree,
  ExpandMore,
  Close,
} from "@mui/icons-material";
import { FullscreenMode } from "./index";

interface FullscreenControlsProps {
  fullscreenMode: FullscreenMode;
  onFullscreenModeChange: (mode: FullscreenMode) => void;
  containerRef?: React.RefObject<HTMLElement>;
  isAnyFullscreen: boolean;
}

const FullscreenControls: React.FC<FullscreenControlsProps> = ({
  fullscreenMode,
  onFullscreenModeChange,
  containerRef,
  isAnyFullscreen,
}) => {
  const [fullscreenMenuAnchor, setFullscreenMenuAnchor] =
    useState<null | HTMLElement>(null);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  const handleFullscreenModeChange = async (mode: FullscreenMode) => {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }

      if (mode === "native") {
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
      console.error("Error changing fullscreen mode:", error);
      onFullscreenModeChange(mode === "native" ? "browser" : mode);
    }

    setFullscreenMenuAnchor(null);
    setSpeedDialOpen(false);
  };

  const getFullscreenIcon = () => {
    switch (fullscreenMode) {
      case "normal":
        return <AspectRatio />;
      case "browser":
        return <CropFree />;
      case "native":
        return <FullscreenExit />;
      default:
        return <AspectRatio />;
    }
  };

  const getFullscreenTooltip = () => {
    switch (fullscreenMode) {
      case "normal":
        return "Normal view - Click for fullscreen options";
      case "browser":
        return "Browser fullscreen - Click for options";
      case "native":
        return "Native fullscreen - Click for options (ESC to exit)";
      default:
        return "Fullscreen options";
    }
  };

  const fullscreenActions = [
    {
      icon: <AspectRatio />,
      name: "Normal View",
      onClick: () => handleFullscreenModeChange("normal"),
      disabled: fullscreenMode === "normal",
    },
    {
      icon: <CropFree />,
      name: "Browser Fullscreen",
      onClick: () => handleFullscreenModeChange("browser"),
      disabled: fullscreenMode === "browser",
    },
    {
      icon: <Fullscreen />,
      name: "Native Fullscreen",
      onClick: () => handleFullscreenModeChange("native"),
      disabled: fullscreenMode === "native",
    },
  ];

  if (!isAnyFullscreen) {
    return (
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Tooltip title={getFullscreenTooltip()}>
          <IconButton
            onClick={(event) => setFullscreenMenuAnchor(event.currentTarget)}
            size="small"
            sx={{
              color: "text.secondary",
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            {getFullscreenIcon()}
            <ExpandMore sx={{ fontSize: 12, ml: 0.5 }} />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={fullscreenMenuAnchor}
          open={Boolean(fullscreenMenuAnchor)}
          onClose={() => setFullscreenMenuAnchor(null)}
          transformOrigin={{ horizontal: "right", vertical: "top" }}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        >
          <MenuItem
            onClick={() => handleFullscreenModeChange("normal")}
            selected={fullscreenMode === "normal"}
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
            onClick={() => handleFullscreenModeChange("browser")}
            selected={fullscreenMode === "browser"}
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
            onClick={() => handleFullscreenModeChange("native")}
            selected={fullscreenMode === "native"}
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
    );
  }

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          borderRadius: 2,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, fontSize: "0.875rem" }}
        >
          {fullscreenMode === "browser"
            ? "Browser Fullscreen"
            : "Native Fullscreen"}
        </Typography>
        <Tooltip title="Exit Fullscreen (ESC)">
          <IconButton
            size="small"
            onClick={() => handleFullscreenModeChange("normal")}
            sx={{
              color: "white",
              p: 0.5,
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.2)",
              },
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <SpeedDial
        ariaLabel="Fullscreen Options"
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          "& .MuiFab-primary": {
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          },
        }}
        icon={<SpeedDialIcon icon={getFullscreenIcon()} openIcon={<Close />} />}
        open={speedDialOpen}
        onOpen={() => setSpeedDialOpen(true)}
        onClose={() => setSpeedDialOpen(false)}
        direction="up"
      >
        {fullscreenActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
            sx={{
              opacity: action.disabled ? 0.5 : 1,
              bgcolor: action.disabled ? "grey.300" : "background.paper",
              "&:hover": {
                bgcolor: action.disabled ? "grey.300" : "primary.light",
              },
            }}
          />
        ))}
      </SpeedDial>
    </>
  );
};

export default React.memo(FullscreenControls);
