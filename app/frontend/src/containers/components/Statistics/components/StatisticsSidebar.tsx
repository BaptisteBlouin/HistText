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
import { useResponsive } from "../../../../lib/responsive-utils";

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
  const { isMobile, isTablet, getSidebarWidth } = useResponsive();

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
      className="responsive-sidebar"
      sx={{
        width: getSidebarWidth(),
        height: isMobile ? "auto" : isTablet ? "70vh" : "80vh",
        overflowY: "auto",
        borderRadius: { xs: 2, sm: 3, md: 3 },
        background: theme.palette.mode === 'dark' 
          ? "linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%)"
          : "linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)",
        minHeight: { xs: 'auto', sm: '500px', md: '600px' },
      }}
    >
      <Box
        sx={{
          p: { xs: 2, sm: 2.5, md: 3 },
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "primary.main",
          color: "white",
          borderTopLeftRadius: { xs: 8, sm: 12 },
          borderTopRightRadius: { xs: 8, sm: 12 },
        }}
      >
        <Typography
          variant={isMobile ? "h6" : "h5"}
          sx={{
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem' },
          }}
        >
          <Analytics sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
          {isMobile ? "Stats" : "Statistics Explorer"}
        </Typography>
        {!isMobile && (
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Explore your data insights
          </Typography>
        )}
      </Box>

      <Box sx={{ p: { xs: 1.5, sm: 2, md: 2 } }}>
        <TextField
          fullWidth
          size={isMobile ? "small" : "medium"}
          placeholder={isMobile ? "Search..." : "Search statistics..."}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }} />
              </InputAdornment>
            ),
          }}
          sx={{ 
            mb: { xs: 1.5, sm: 2 },
            '& .MuiOutlinedInput-input': {
              fontSize: { xs: '0.875rem', sm: '1rem' },
              padding: { xs: '8px 12px', sm: '12px 14px' },
            },
          }}
        />
      </Box>

      <List sx={{ p: 0 }}>
        {Object.entries(filteredCategories).map(
          ([categoryKey, category]: [string, any]) => (
            <Box key={categoryKey}>
              <ListItemButton
                onClick={() => handleCategoryClick(categoryKey, category)}
                sx={{
                  py: { xs: 1.5, sm: 2 },
                  px: { xs: 2, sm: 3 },
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
                  minHeight: { xs: 56, sm: 64 },
                }}
              >
                <ListItemIcon sx={{ 
                  color: category.color, 
                  minWidth: { xs: 36, sm: 40 },
                  '& svg': {
                    fontSize: { xs: '1.25rem', sm: '1.5rem' }
                  }
                }}>
                  <category.icon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant={isMobile ? "body1" : "subtitle1"}
                      sx={{
                        fontWeight: 600,
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                        color:
                          activeCategory === categoryKey
                            ? category.color
                            : "text.primary",
                      }}
                    >
                      {isMobile && category.title.length > 12 
                        ? `${category.title.substring(0, 12)}...` 
                        : category.title}
                    </Typography>
                  }
                />
                <Chip
                  size={isMobile ? "small" : "medium"}
                  label={
                    category.stats.filter((stat: string) => stats[stat]).length
                  }
                  sx={{
                    bgcolor: category.color,
                    color: "white",
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                    height: { xs: 24, sm: 32 },
                  }}
                />
                {expandedCategories.has(categoryKey) ? (
                  <ExpandLess sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                ) : (
                  <ExpandMore sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                )}
              </ListItemButton>

              <Collapse
                in={expandedCategories.has(categoryKey)}
                timeout="auto"
                unmountOnExit
              >
                <List sx={{ 
                  pl: { xs: 1, sm: 2 }, 
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50'
                }}>
                  {category.stats
                    .filter((stat: string) => stats[stat])
                    .map((stat: string) => (
                      <Fade in={expandedCategories.has(categoryKey)} key={stat}>
                        <ListItemButton
                          onClick={() => onStatChange(stat)}
                          sx={{
                            py: { xs: 1, sm: 1.5 },
                            px: { xs: 2, sm: 3 },
                            borderRadius: 2,
                            mx: { xs: 0.5, sm: 1 },
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
                            minHeight: { xs: 44, sm: 48 },
                          }}
                        >
                          <ListItemText
                            primary={
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: selectedStat === stat ? 600 : 400,
                                  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                                  lineHeight: 1.4,
                                }}
                              >
                                {isMobile 
                                  ? (getStatDisplayName(stat).length > 20 
                                      ? `${getStatDisplayName(stat).substring(0, 20)}...` 
                                      : getStatDisplayName(stat))
                                  : getStatDisplayName(stat)}
                              </Typography>
                            }
                          />
                          {selectedStat === stat && (
                            <Chip
                              size="small"
                              label={isMobile ? "✓" : "Active"}
                              sx={{
                                bgcolor: "rgba(255,255,255,0.2)",
                                color: "white",
                                fontSize: { xs: '0.625rem', sm: '0.75rem' },
                                height: { xs: 20, sm: 24 },
                                minWidth: { xs: 20, sm: 'auto' },
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
