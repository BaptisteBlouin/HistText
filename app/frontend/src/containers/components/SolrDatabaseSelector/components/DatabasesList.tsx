import React from "react";
import {
  Box,
  Card,
  CardContent,
  Avatar,
  Typography,
  Chip,
  Zoom,
} from "@mui/material";
import { Check, DnsRounded, Storage } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import config from "../../../../../config.json";
import {
  getDatabaseInitials,
  getDatabaseDescription,
} from "../utils/databaseUtils";

interface DatabasesListProps {
  processedDatabases: any[];
  selectedSolrDatabase: any;
  searchTerm: string;
  onDatabaseSelect: (database: any) => void;
}

const DatabasesList: React.FC<DatabasesListProps> = React.memo(
  ({
    processedDatabases,
    selectedSolrDatabase,
    searchTerm,
    onDatabaseSelect,
  }) => {
    const theme = useTheme();

    if (processedDatabases.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Storage
            sx={{ fontSize: 48, color: "text.secondary", mb: 2, opacity: 0.5 }}
          />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No databases found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm
              ? "Try adjusting your search terms"
              : "No databases are available"}
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ maxHeight: "400px", overflow: "auto" }}>
        {/* Default Option */}
        <Card
          variant="outlined"
          onClick={() => onDatabaseSelect(null)}
          sx={{
            m: 1,
            cursor: "pointer",
            borderRadius: 2,
            border: selectedSolrDatabase === null ? "2px solid" : "1px solid",
            borderColor:
              selectedSolrDatabase === null ? "secondary.main" : "divider",
            bgcolor:
              selectedSolrDatabase === null ? "secondary.light" : "transparent",
            transition: "all 0.2s ease",
            "&:hover": {
              bgcolor:
                selectedSolrDatabase === null
                  ? "secondary.light"
                  : "action.hover",
              transform: "translateX(4px)",
              boxShadow: theme.shadows[2],
            },
          }}
        >
          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Avatar sx={{ bgcolor: "grey.300", color: "grey.600" }}>
                <DnsRounded />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {config.solr_selector_sentence || "Select a database..."}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose from the available databases below
                </Typography>
              </Box>
              {selectedSolrDatabase === null && <Check color="secondary" />}
            </Box>
          </CardContent>
        </Card>

        {/* Database Options */}
        {processedDatabases.map((dbInfo, index) => (
          <Zoom
            key={dbInfo.database.id}
            in={true}
            timeout={200 + index * 50}
            style={{ transitionDelay: `${index * 50}ms` }}
          >
            <Card
              variant="outlined"
              onClick={() => onDatabaseSelect(dbInfo.database)}
              sx={{
                m: 1,
                cursor: "pointer",
                borderRadius: 2,
                border: dbInfo.isSelected ? "2px solid" : "1px solid",
                borderColor: dbInfo.isSelected ? "secondary.main" : "divider",
                bgcolor: dbInfo.isSelected ? "secondary.light" : "transparent",
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: dbInfo.isSelected
                    ? "secondary.light"
                    : "action.hover",
                  transform: "translateX(4px)",
                  boxShadow: theme.shadows[2],
                },
              }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: dbInfo.isSelected
                        ? "secondary.main"
                        : "info.main",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    {getDatabaseInitials(dbInfo.database.name)}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        color: dbInfo.isSelected
                          ? "secondary.main"
                          : "text.primary",
                        fontSize: "1rem",
                        lineHeight: 1.2,
                        mb: 0.5,
                      }}
                    >
                      {dbInfo.database.name}
                    </Typography>

                    {getDatabaseDescription(dbInfo.database) !==
                      "No description available" && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.875rem",
                          lineHeight: 1.4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {getDatabaseDescription(dbInfo.database)}
                      </Typography>
                    )}

                    {/* Highlight search matches */}
                    {searchTerm && dbInfo.matchesSearch && (
                      <Chip
                        label="Match"
                        size="small"
                        color="secondary"
                        sx={{ mt: 1, fontSize: "0.75rem" }}
                      />
                    )}
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    {dbInfo.isSelected && <Check color="secondary" />}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Zoom>
        ))}
      </Box>
    );
  },
);

DatabasesList.displayName = "DatabasesList";

export default DatabasesList;
