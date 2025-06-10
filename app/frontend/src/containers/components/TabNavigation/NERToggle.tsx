import React from "react";
import { Tooltip, Fab, Box } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

interface NERToggleProps {
  activeTab: number;
  isNERVisible: boolean;
  viewNER: boolean;
  onToggleNER: () => void;
  isAnyFullscreen: boolean;
  tabsConstant: { PARTIAL_RESULTS: number };
}

const NERToggle: React.FC<NERToggleProps> = ({
  activeTab,
  isNERVisible,
  viewNER,
  onToggleNER,
  isAnyFullscreen,
  tabsConstant,
}) => {
  if (activeTab !== tabsConstant.PARTIAL_RESULTS || !isNERVisible) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: isAnyFullscreen ? 24 : 24,
        right: isAnyFullscreen ? 24 : 24,
        zIndex: 1300, // Higher than most Material-UI components
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Tooltip
        title={viewNER ? "Hide NER highlighting" : "Show NER highlighting"}
        placement="left"
      >
        <Fab
          onClick={onToggleNER}
          size="medium"
          sx={{
            bgcolor: viewNER ? "error.main" : "primary.main",
            color: "white",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            transition: "all 0.3s ease",
            transform: "scale(1)",
            "&:hover": {
              bgcolor: viewNER ? "error.dark" : "primary.dark",
              transform: "scale(1.05)",
              boxShadow: "0 6px 25px rgba(0,0,0,0.4)",
            },
          }}
        >
          {viewNER ? <VisibilityOff /> : <Visibility />}
        </Fab>
      </Tooltip>
    </Box>
  );
};

export default React.memo(NERToggle);