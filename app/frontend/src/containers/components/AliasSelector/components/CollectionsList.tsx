import React from "react";
import {
  Box,
  Card,
  CardContent,
  Avatar,
  Typography,
  Chip,
  Zoom,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Check, CollectionsBookmark, Info } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import config from "../../../../../config.json";
import { getCollectionInitials } from "../utils/collectionUtils";

interface CollectionsListProps {
  /** The processed array of collections to display. */
  processedCollections: any[];
  /** The currently selected collection alias (empty string means "default"). */
  selectedAlias: string;
  /** The search term (used for empty/search state and match highlighting). */
  searchTerm: string;
  /** Handler called when a collection is selected. */
  onCollectionSelect: (alias: string) => void;
}

/**
 * Lists available collections, supporting search highlighting and selection.
 * Shows a default "select" card and collection cards with basic info.
 */
const CollectionsList: React.FC<CollectionsListProps> = React.memo(
  ({ processedCollections, selectedAlias, searchTerm, onCollectionSelect }) => {
    const theme = useTheme();

    if (processedCollections.length === 0) {
      // No collections: Show an empty/search state.
      return (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <CollectionsBookmark
            sx={{ fontSize: 48, color: "text.secondary", mb: 2, opacity: 0.5 }}
          />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No collections found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm
              ? "Try adjusting your search terms"
              : "No collections are available"}
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ maxHeight: "400px", overflow: "auto" }}>
        {/* Render each collection as a card with transition */}
        {processedCollections.map((collection, index) => (
          <Zoom
            key={collection.name}
            in={true}
            timeout={200 + index * 50}
            style={{ transitionDelay: `${index * 50}ms` }}
          >
            <Card
              variant="outlined"
              onClick={() => onCollectionSelect(collection.name)}
              sx={{
                m: 1,
                cursor: "pointer",
                borderRadius: 2,
                border: collection.isSelected ? "2px solid" : "1px solid",
                borderColor: collection.isSelected ? "primary.main" : "divider",
                bgcolor: collection.isSelected
                  ? "primary.light"
                  : "transparent",
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: collection.isSelected
                    ? "primary.light"
                    : "action.hover",
                  transform: "translateX(4px)",
                  boxShadow: theme.shadows[2],
                },
              }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  {/* Collection initials avatar */}
                  <Avatar
                    sx={{
                      bgcolor: collection.isSelected
                        ? "primary.main"
                        : "secondary.main",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    {getCollectionInitials(collection.name)}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* Name */}
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        color: collection.isSelected
                          ? "primary.main"
                          : "text.primary",
                        fontSize: "1rem",
                        lineHeight: 1.2,
                        mb: 0.5,
                      }}
                    >
                      {collection.name}
                    </Typography>

                    {/* Description (if available) */}
                    {collection.description && (
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
                        {collection.description}
                      </Typography>
                    )}

                    {/* Chip for search matches */}
                    {searchTerm && collection.matchesSearch && (
                      <Chip
                        label="Match"
                        size="small"
                        color="info"
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
                    {collection.isSelected && <Check color="primary" />}

                    {/* Tooltip with info icon for full description */}
                    {collection.description && (
                      <Tooltip
                        title={
                          <Box>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, mb: 1 }}
                            >
                              {collection.name}
                            </Typography>
                            <Typography variant="body2">
                              {collection.description}
                            </Typography>
                          </Box>
                        }
                        placement="left"
                        arrow
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconButton
                          size="small"
                          sx={{
                            color: "text.secondary",
                            "&:hover": {
                              color: "primary.main",
                              backgroundColor: "primary.light",
                            },
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Info fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
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

CollectionsList.displayName = "CollectionsList";

export default CollectionsList;
