import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress,
  Typography,
  Box,
  Stack,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from "@mui/material";
import {
  Close,
  CheckCircle,
  Error,
  Schedule,
  Info,
} from "@mui/icons-material";

interface ProgressItem {
  id: string;
  label: string;
  status: "pending" | "processing" | "completed" | "error";
  message?: string;
}

interface ProgressIndicatorProps {
  open: boolean;
  onClose?: () => void;
  title: string;
  items: ProgressItem[];
  allowClose?: boolean;
  showDetails?: boolean;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  open,
  onClose,
  title,
  items,
  allowClose = false,
  showDetails = true,
}) => {
  const completedItems = items.filter(item => item.status === "completed").length;
  const errorItems = items.filter(item => item.status === "error").length;
  const totalItems = items.length;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const isComplete = completedItems + errorItems === totalItems;

  const getStatusIcon = (status: ProgressItem["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle color="success" fontSize="small" />;
      case "error":
        return <Error color="error" fontSize="small" />;
      case "processing":
        return <Schedule color="primary" fontSize="small" />;
      default:
        return <Schedule color="action" fontSize="small" />;
    }
  };

  const getStatusColor = (status: ProgressItem["status"]) => {
    switch (status) {
      case "completed":
        return "success";
      case "error":
        return "error";
      case "processing":
        return "primary";
      default:
        return "default";
    }
  };

  return (
    <Dialog
      open={open}
      onClose={allowClose && isComplete ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={!allowClose || !isComplete}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {allowClose && isComplete && onClose && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        {/* Overall Progress */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {completedItems}/{totalItems} completed
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "action.hover",
              "& .MuiLinearProgress-bar": {
                borderRadius: 4,
                background: errorItems > 0 
                  ? "linear-gradient(90deg, #4caf50 0%, #ff9800 100%)"
                  : "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
              },
            }}
          />
          
          {/* Summary chips */}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Chip
              size="small"
              label={`${completedItems} completed`}
              color="success"
              variant={completedItems > 0 ? "filled" : "outlined"}
            />
            {errorItems > 0 && (
              <Chip
                size="small"
                label={`${errorItems} failed`}
                color="error"
                variant="filled"
              />
            )}
            {totalItems - completedItems - errorItems > 0 && (
              <Chip
                size="small"
                label={`${totalItems - completedItems - errorItems} pending`}
                color="default"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>

        {showDetails && (
          <>
            <Divider sx={{ mb: 2 }} />
            
            {/* Detailed Progress List */}
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Details
            </Typography>
            
            <List dense sx={{ maxHeight: 300, overflow: "auto" }}>
              {items.map((item, index) => (
                <ListItem
                  key={item.id}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    backgroundColor: item.status === "processing" 
                      ? "action.hover" 
                      : "transparent",
                    border: item.status === "processing" 
                      ? "1px solid" 
                      : "1px solid transparent",
                    borderColor: "primary.light",
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {getStatusIcon(item.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: item.status === "processing" ? 600 : 400,
                          color: item.status === "error" ? "error.main" : "text.primary",
                        }}
                      >
                        {item.label}
                      </Typography>
                    }
                    secondary={
                      item.message && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: item.status === "error" ? "error.main" : "text.secondary",
                            fontStyle: item.status === "error" ? "italic" : "normal",
                          }}
                        >
                          {item.message}
                        </Typography>
                      )
                    }
                  />
                  <Chip
                    size="small"
                    label={item.status}
                    color={getStatusColor(item.status) as any}
                    variant="outlined"
                    sx={{ textTransform: "capitalize" }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        {/* Final Status Message */}
        {isComplete && (
          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 2,
              backgroundColor: errorItems > 0 ? "warning.light" : "success.light",
              border: `1px solid ${errorItems > 0 ? "warning.main" : "success.main"}`,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              {errorItems > 0 ? (
                <Info color="warning" />
              ) : (
                <CheckCircle color="success" />
              )}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: errorItems > 0 ? "warning.dark" : "success.dark",
                }}
              >
                {errorItems > 0
                  ? `Operation completed with ${errorItems} error${errorItems !== 1 ? "s" : ""}`
                  : "Operation completed successfully!"
                }
              </Typography>
            </Stack>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProgressIndicator;