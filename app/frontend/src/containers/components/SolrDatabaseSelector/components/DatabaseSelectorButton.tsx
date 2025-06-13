import React from "react";
import {
  Paper,
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
} from "@mui/material";
import { ExpandMore, Close, DnsRounded } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useConfig } from "../../../../contexts/ConfigurationContext";
import {
  getDatabaseInitials,
  truncateDescription,
  getDatabaseDescription,
} from "../utils/databaseUtils";

interface DatabaseSelectorButtonProps {
  selectedDatabase: any;
  selectedSolrDatabase: any;
  solrDatabasesLength: number;
  isOpen: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onClear: (e: React.MouseEvent) => void;
}

const DatabaseSelectorButton: React.FC<DatabaseSelectorButtonProps> =
  React.memo(
    ({
      selectedDatabase,
      selectedSolrDatabase,
      solrDatabasesLength,
      isOpen,
      isLoading,
      onToggle,
      onClear,
    }) => {
      const config = useConfig();
      const theme = useTheme();

      return (
        <Paper
          elevation={isOpen ? 8 : 2}
          onClick={onToggle}
          sx={{
            p: 2,
            cursor: "pointer",
            borderRadius: 3,
            border: `2px solid ${isOpen ? theme.palette.secondary.main : "transparent"}`,
            background: selectedSolrDatabase
              ? theme.palette.mode === 'dark' 
                ? "linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)"
                : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"
              : theme.palette.mode === 'dark'
                ? "linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)"
                : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: isOpen ? "translateY(-2px)" : "translateY(0)",
            "&:hover": {
              transform: "translateY(-4px) scale(1.02)",
              boxShadow: "0 12px 24px rgba(0,0,0,0.15)",
              borderColor: theme.palette.secondary.light,
              background: selectedSolrDatabase
                ? theme.palette.mode === 'dark' 
                  ? "linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%)"
                  : "linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%)"
                : theme.palette.mode === 'dark'
                  ? "linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)"
                  : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
            },
            "&:active": {
              transform: "translateY(-2px) scale(1.01)",
              transition: "transform 0.1s ease",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {/* Database Icon/Avatar */}
            {selectedSolrDatabase ? (
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: "secondary.main",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "1rem",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "scale(1.1) rotate(5deg)",
                    bgcolor: "secondary.dark",
                    boxShadow: "0 6px 12px rgba(0,0,0,0.2)",
                  },
                }}
              >
                {getDatabaseInitials(selectedSolrDatabase.name)}
              </Avatar>
            ) : (
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: "grey.300",
                  color: "grey.600",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "scale(1.1)",
                    bgcolor: "secondary.light",
                    color: "secondary.contrastText",
                    boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
                  },
                }}
              >
                <DnsRounded />
              </Avatar>
            )}

            {/* Database Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {selectedSolrDatabase ? (
                <>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: "text.primary",
                      fontSize: "1.1rem",
                      lineHeight: 1.2,
                      mb: 0.5,
                      transition: "color 0.3s ease",
                      "&:hover": {
                        color: "secondary.main",
                      },
                    }}
                  >
                    {selectedSolrDatabase.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.875rem",
                      lineHeight: 1.3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {truncateDescription(
                      getDatabaseDescription(selectedSolrDatabase),
                      80,
                    )}
                  </Typography>
                </>
              ) : (
                <Typography
                  variant="h6"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 500,
                    fontSize: "1.1rem",
                  }}
                >
                  {config.solr_selector_sentence || "Select a database..."}
                </Typography>
              )}
            </Box>

            {/* Action Icons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {isLoading && (
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      border: "2px solid #e0e0e0",
                      borderTop: "2px solid #1976d2",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                </Box>
              )}

              {selectedSolrDatabase && !isLoading && (
                <Tooltip title="Clear selection">
                  <IconButton
                    size="small"
                    onClick={onClear}
                    sx={{
                      bgcolor: "error.light",
                      color: "error.contrastText",
                      transition: "all 0.3s ease",
                      "&:hover": { 
                        bgcolor: "error.main",
                        transform: "scale(1.1) rotate(90deg)",
                        boxShadow: "0 4px 8px rgba(211, 47, 47, 0.3)",
                      },
                    }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              <IconButton
                size="small"
                sx={{
                  bgcolor: "secondary.light",
                  color: "secondary.contrastText",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "all 0.3s ease",
                  "&:hover": { 
                    bgcolor: "secondary.main",
                    transform: isOpen ? "rotate(180deg) scale(1.1)" : "rotate(0deg) scale(1.1)",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                  },
                }}
              >
                <ExpandMore />
              </IconButton>
            </Box>
          </Box>

          {/* Database Count Badge */}
          {solrDatabasesLength > 0 && (
            <Chip
              label={`${solrDatabasesLength} database${solrDatabasesLength !== 1 ? "s" : ""} available`}
              size="small"
              sx={{
                position: "absolute",
                top: -8,
                right: 12,
                bgcolor: "secondary.main",
                color: "white",
                fontWeight: 600,
                fontSize: "0.75rem",
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "scale(1.1)",
                  bgcolor: "secondary.dark",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                },
              }}
            />
          )}
        </Paper>
      );
    },
  );

DatabaseSelectorButton.displayName = "DatabaseSelectorButton";

export default DatabaseSelectorButton;
