import React, { useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Collapse,
  Fade,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { Analytics, Search, ExpandMore, ExpandLess } from "@mui/icons-material";
import { getStatDisplayName } from "../utils/chartUtils";

interface StatisticsSidebarProps {
  statCategories: any;
  stats: any;
  selectedStat: string;
  activeCategory: string;
  expandedCategories: Set<string>;
  searchTerm: string;
  filteredCategories: any;
  onStatChange: (stat: string) => void;
  onCategoryToggle: (categoryKey: string) => void;
  onSearchChange: (term: string) => void;
}

const StatisticsSidebar: React.FC<StatisticsSidebarProps> = ({
  statCategories,
  stats,
  selectedStat,
  activeCategory,
  expandedCategories,
  searchTerm,
  filteredCategories,
  onStatChange,
  onCategoryToggle,
  onSearchChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const handleCategoryClick = useCallback(
    (categoryKey: string, category: any) => {
      onCategoryToggle(categoryKey);
      const firstStat = category.stats.find((stat: string) => stats[stat]);
      if (firstStat) onStatChange(firstStat);
    },
    [stats, onStatChange, onCategoryToggle],
  );

  return (
    <Paper
      sx={{
        width: isMobile ? "100%" : "350px",
        height: isMobile ? "auto" : "80vh",
        overflowY: "auto",
        borderRadius: 3,
        background: theme.palette.mode === 'dark' 
          ? "linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%)"
          : "linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)",
      }}
    >
      <Box
        sx={{
          p: 3,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "primary.main",
          color: "white",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Analytics />
          Statistics Explorer
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
          Explore your data insights
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search statistics..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
      </Box>

      <List sx={{ p: 0 }}>
        {Object.entries(filteredCategories).map(
          ([categoryKey, category]: [string, any]) => (
            <Box key={categoryKey}>
              <ListItemButton
                onClick={() => handleCategoryClick(categoryKey, category)}
                sx={{
                  py: 2,
                  px: 3,
                  borderLeft: "4px solid",
                  borderLeftColor:
                    activeCategory === categoryKey
                      ? category.color
                      : "transparent",
                  backgroundColor:
                    activeCategory === categoryKey
                      ? `${category.color}15`
                      : "transparent",
                  "&:hover": {
                    backgroundColor: `${category.color}10`,
                  },
                }}
              >
                <ListItemIcon sx={{ color: category.color, minWidth: 40 }}>
                  <category.icon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        color:
                          activeCategory === categoryKey
                            ? category.color
                            : "text.primary",
                      }}
                    >
                      {category.title}
                    </Typography>
                  }
                />
                <Chip
                  size="small"
                  label={
                    category.stats.filter((stat: string) => stats[stat]).length
                  }
                  sx={{
                    bgcolor: category.color,
                    color: "white",
                    fontWeight: 600,
                  }}
                />
                {expandedCategories.has(categoryKey) ? (
                  <ExpandLess />
                ) : (
                  <ExpandMore />
                )}
              </ListItemButton>

              <Collapse
                in={expandedCategories.has(categoryKey)}
                timeout="auto"
                unmountOnExit
              >
                <List sx={{ pl: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                  {category.stats
                    .filter((stat: string) => stats[stat])
                    .map((stat: string) => (
                      <Fade in={expandedCategories.has(categoryKey)} key={stat}>
                        <ListItemButton
                          onClick={() => onStatChange(stat)}
                          sx={{
                            py: 1.5,
                            px: 3,
                            borderRadius: 2,
                            mx: 1,
                            mb: 0.5,
                            backgroundColor:
                              selectedStat === stat
                                ? category.color
                                : "transparent",
                            color:
                              selectedStat === stat ? "white" : "text.primary",
                            "&:hover": {
                              backgroundColor:
                                selectedStat === stat
                                  ? category.color
                                  : `${category.color}20`,
                            },
                          }}
                        >
                          <ListItemText
                            primary={
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: selectedStat === stat ? 600 : 400,
                                }}
                              >
                                {getStatDisplayName(stat)}
                              </Typography>
                            }
                          />
                          {selectedStat === stat && (
                            <Chip
                              size="small"
                              label="Active"
                              sx={{
                                bgcolor: "rgba(255,255,255,0.2)",
                                color: "white",
                              }}
                            />
                          )}
                        </ListItemButton>
                      </Fade>
                    ))}
                </List>
              </Collapse>
            </Box>
          ),
        )}
      </List>
    </Paper>
  );
};

export default React.memo(StatisticsSidebar);
