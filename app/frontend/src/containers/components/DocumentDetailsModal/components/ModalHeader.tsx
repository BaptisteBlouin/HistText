import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Tooltip,
} from "@mui/material";
import {
  Description,
  Close,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

/**
 * Props for ModalHeader, the top bar for the document modal dialog.
 */
interface ModalHeaderProps {
  documentId: string;
  hasNER: boolean;
  showNER: boolean;
  onToggleNER: () => void;
  onClose: () => void;
}

/**
 * Modal dialog header displaying document info and controls.
 * Includes NER highlight toggle and close button.
 *
 * @param props - ModalHeaderProps
 * @returns Modal header UI.
 */
const ModalHeader: React.FC<ModalHeaderProps> = React.memo(
  ({ documentId, hasNER, showNER, onToggleNER, onClose }) => {
    return (
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
        }}
      >
        <Toolbar>
          <Description sx={{ mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Document Details
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {documentId ? `ID: ${documentId}` : "Loading..."}
            </Typography>
          </Box>

          {hasNER && (
            <Tooltip
              title={
                showNER
                  ? "Hide entity highlighting"
                  : "Show entity highlighting"
              }
            >
              <IconButton color="inherit" onClick={onToggleNER} sx={{ mr: 1 }}>
                {showNER ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </Tooltip>
          )}

          <IconButton color="inherit" onClick={onClose}>
            <Close />
          </IconButton>
        </Toolbar>
      </AppBar>
    );
  },
);

ModalHeader.displayName = "ModalHeader";

export default ModalHeader;
