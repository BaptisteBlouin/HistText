import React, { useState } from "react";
import {
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Box,
  Typography,
} from "@mui/material";
import {
  ContentCopy,
  Check,
} from "@mui/icons-material";

interface CopyToClipboardProps {
  text: string;
  variant?: "icon" | "text" | "inline";
  size?: "small" | "medium" | "large";
  showToast?: boolean;
  label?: string;
  tooltipTitle?: string;
}

export const CopyToClipboard: React.FC<CopyToClipboardProps> = ({
  text,
  variant = "icon",
  size = "small",
  showToast = true,
  label,
  tooltipTitle = "Copy to clipboard",
}) => {
  const [copied, setCopied] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      
      if (showToast) {
        setShowNotification(true);
      }
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand("copy");
        setCopied(true);
        if (showToast) {
          setShowNotification(true);
        }
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy failed: ", fallbackErr);
      }
      
      document.body.removeChild(textArea);
    }
  };

  if (variant === "icon") {
    return (
      <>
        <Tooltip title={copied ? "Copied!" : tooltipTitle}>
          <IconButton
            onClick={handleCopy}
            size={size}
            color={copied ? "success" : "default"}
            sx={{
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            {copied ? <Check fontSize="inherit" /> : <ContentCopy fontSize="inherit" />}
          </IconButton>
        </Tooltip>
        
        {showToast && (
          <Snackbar
            open={showNotification}
            autoHideDuration={2000}
            onClose={() => setShowNotification(false)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert
              onClose={() => setShowNotification(false)}
              severity="success"
              variant="filled"
              sx={{ minWidth: 200 }}
            >
              Copied to clipboard!
            </Alert>
          </Snackbar>
        )}
      </>
    );
  }

  if (variant === "text") {
    return (
      <>
        <Box
          onClick={handleCopy}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            cursor: "pointer",
            px: 1,
            py: 0.5,
            borderRadius: 1,
            backgroundColor: copied ? "success.light" : "action.hover",
            color: copied ? "success.contrastText" : "text.primary",
            transition: "all 0.2s ease",
            "&:hover": {
              backgroundColor: copied ? "success.main" : "action.selected",
            },
          }}
        >
          {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {copied ? "Copied!" : (label || "Copy")}
          </Typography>
        </Box>
        
        {showToast && (
          <Snackbar
            open={showNotification}
            autoHideDuration={2000}
            onClose={() => setShowNotification(false)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert
              onClose={() => setShowNotification(false)}
              severity="success"
              variant="filled"
            >
              Copied to clipboard!
            </Alert>
          </Snackbar>
        )}
      </>
    );
  }

  if (variant === "inline") {
    return (
      <>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            maxWidth: "100%",
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontFamily: "monospace",
              backgroundColor: "action.hover",
              px: 1,
              py: 0.5,
              borderRadius: 1,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </Typography>
          <Tooltip title={copied ? "Copied!" : tooltipTitle}>
            <IconButton
              onClick={handleCopy}
              size="small"
              color={copied ? "success" : "default"}
              sx={{ flexShrink: 0 }}
            >
              {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        
        {showToast && (
          <Snackbar
            open={showNotification}
            autoHideDuration={2000}
            onClose={() => setShowNotification(false)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert
              onClose={() => setShowNotification(false)}
              severity="success"
              variant="filled"
            >
              Copied to clipboard!
            </Alert>
          </Snackbar>
        )}
      </>
    );
  }

  return null;
};

export default CopyToClipboard;