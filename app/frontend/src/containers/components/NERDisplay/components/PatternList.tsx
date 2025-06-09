import React from "react";
import {
  List,
  ListItem,
  ListItemText,
  Box,
  Typography,
  Chip,
} from "@mui/material";
import { CleaningServices, DataUsage, Analytics } from "@mui/icons-material";

interface PatternListProps {
  patterns: Array<{
    pattern: string;
    count: number;
    documents: string[];
  }>;
  maxItems?: number;
  colorType?: "primary" | "secondary" | "success";
  isAdvanced?: boolean;
}

/**
 * Displays a list of entity patterns with counts and document occurrences.
 * Supports styling variations for advanced and normalized patterns.
 */
const PatternList: React.FC<PatternListProps> = ({
  patterns,
  maxItems = 10,
  colorType = "primary",
  isAdvanced = false,
}) => {
  const getIcon = () => {
    if (isAdvanced) return <Analytics sx={{ fontSize: 12 }} />;
    if (colorType === "secondary")
      return <DataUsage sx={{ fontSize: 12, color: "primary.main" }} />;
    return <CleaningServices sx={{ fontSize: 12, color: "success.main" }} />;
  };

  const getSecondaryText = () => {
    if (isAdvanced) return "Advanced normalized pattern";
    if (colorType === "secondary") return "Normalized entities";
    return "Quality filtered";
  };

  return (
    <List>
      {patterns.slice(0, maxItems).map((pattern, index) => (
        <ListItem
          key={index}
          sx={{
            px: 0,
            border: isAdvanced ? 2 : 1,
            borderColor: isAdvanced ? "success.light" : "divider",
            borderRadius: 1,
            mb: 1,
          }}
        >
          <ListItemText
            primary={
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    color: isAdvanced ? "success.dark" : "inherit",
                  }}
                >
                  {pattern.pattern}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip label={pattern.count} size="small" color={colorType} />
                  {getIcon()}
                </Box>
              </Box>
            }
            secondary={`Found in ${pattern.documents.length} documents • ${getSecondaryText()}`}
          />
        </ListItem>
      ))}
    </List>
  );
};

export default React.memo(PatternList);
