import React, { useState } from "react";
import { useResponsive } from '../../../../../lib/responsive-utils';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Stack,
  Collapse,
  LinearProgress,
  Alert,
  Grid,
  Paper,
  useTheme,
  alpha,
  Fade,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Memory,
  Speed,
  Analytics,
  ExpandMore,
  ExpandLess,
  Delete,
} from "@mui/icons-material";
import { DetailedEmbeddingStats, AdvancedCacheStats } from "../types";
import {
  formatBytes,
  formatPercentage,
  formatNumber,
} from "../utils/formatters";

/**
 * Props for EmbeddingCacheManagement component.
 * - `embeddingDetails`: Basic embedding cache stats.
 * - `advancedStats`: Advanced system/cache stats.
 * - `detailsLoading`: True while loading embedding details.
 * - `advancedLoading`: True while loading advanced stats.
 * - `showEmbeddingDetails`: Toggle for showing embedding details.
 * - `showAdvancedStats`: Toggle for showing advanced stats.
 * - `onToggleEmbeddingDetails`: Handler for toggling embedding details.
 * - `onToggleAdvancedStats`: Handler for toggling advanced stats.
 * - `onClearCache`: Handler for clearing cache.
 * - `onResetMetrics`: Handler for resetting metrics.
 */
interface EmbeddingCacheManagementProps {
  embeddingDetails: DetailedEmbeddingStats | null;
  advancedStats: AdvancedCacheStats | null;
  detailsLoading: boolean;
  advancedLoading: boolean;
  showEmbeddingDetails: boolean;
  showAdvancedStats: boolean;
  onToggleEmbeddingDetails: () => void;
  onToggleAdvancedStats: () => void;
  onClearCache: () => void;
  onResetMetrics: () => void;
}

/**
 * Renders UI for inspecting and managing the embedding cache and related system stats.
 * Includes actions for clearing cache and resetting metrics.
 * Supports basic and advanced stats sections, each collapsible.
 */
export const EmbeddingCacheManagement: React.FC<
  EmbeddingCacheManagementProps
> = ({
  embeddingDetails,
  advancedStats,
  detailsLoading,
  advancedLoading,
  showEmbeddingDetails,
  showAdvancedStats,
  onToggleEmbeddingDetails,
  onToggleAdvancedStats,
  onClearCache,
  onResetMetrics,
}) => {
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Mobile Header */}
        {isMobile ? (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  p: 1,
                  borderRadius: '8px',
                  bgcolor: 'secondary.main',
                  color: 'white',
                }}
              >
                <Memory sx={{ fontSize: '1.25rem' }} />
              </Box>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                Cache Management
              </Typography>
            </Box>
            
            {/* Mobile Action Buttons */}
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={onToggleEmbeddingDetails}
                  endIcon={showEmbeddingDetails ? <ExpandLess /> : <ExpandMore />}
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                >
                  Basic
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={onToggleAdvancedStats}
                  endIcon={showAdvancedStats ? <ExpandLess /> : <ExpandMore />}
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                >
                  Advanced
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  onClick={onClearCache}
                  startIcon={<Delete />}
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                >
                  Clear
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  onClick={onResetMetrics}
                  startIcon={<Analytics />}
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Box>
        ) : (
          /* Desktop Header */
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  p: 1.5,
                  borderRadius: '12px',
                  bgcolor: 'secondary.main',
                  color: 'white',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`,
                }}
              >
                <Memory />
              </Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                }}
              >
                Embedding Cache Management
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={onToggleEmbeddingDetails}
                endIcon={showEmbeddingDetails ? <ExpandLess /> : <ExpandMore />}
                size="small"
              >
                Basic Stats
              </Button>
              <Button
                variant="outlined"
                onClick={onToggleAdvancedStats}
                endIcon={showAdvancedStats ? <ExpandLess /> : <ExpandMore />}
                size="small"
              >
                Advanced Stats
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={onClearCache}
                startIcon={<Delete />}
                size="small"
              >
                Clear Cache
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={onResetMetrics}
                startIcon={<Analytics />}
                size="small"
              >
                Reset Metrics
              </Button>
            </Stack>
          </Box>
        )}

        <Collapse in={showEmbeddingDetails}>
          <Box sx={{ mb: { xs: 2, sm: 3 } }}>
            <Typography
              variant={isMobile ? 'subtitle1' : 'h6'}
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
            >
              <Speed sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
              {isMobile ? 'Performance' : 'Basic Performance Metrics'}
            </Typography>

            {detailsLoading ? (
              <LinearProgress sx={{ my: 2 }} />
            ) : !embeddingDetails ? (
              <Alert severity="info">
                No detailed embedding statistics available
              </Alert>
            ) : (
              <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                <Grid item xs={6} sm={6} md={3}>
                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      textAlign: "center",
                      bgcolor: "success.light",
                      color: "success.contrastText",
                      borderRadius: 2,
                      boxShadow: 2,
                    }}
                  >
                    <Typography variant={isMobile ? 'h6' : 'h6'}>
                      {formatPercentage(embeddingDetails.hit_ratio)}
                    </Typography>
                    <Typography variant={isMobile ? 'caption' : 'body2'}>
                      {isMobile ? 'Hit Ratio' : 'Cache Hit Ratio'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      textAlign: "center",
                      bgcolor: "info.light",
                      color: "info.contrastText",
                      borderRadius: 2,
                      boxShadow: 2,
                    }}
                  >
                    <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      {formatBytes(embeddingDetails.memory_usage_bytes)}
                    </Typography>
                    <Typography variant={isMobile ? 'caption' : 'body2'}>
                      {isMobile ? 'Memory' : 'Memory Usage'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      textAlign: "center",
                      bgcolor: "warning.light",
                      color: "warning.contrastText",
                      borderRadius: 2,
                      boxShadow: 2,
                    }}
                  >
                    <Typography variant={isMobile ? 'h6' : 'h6'}>
                      {formatNumber(embeddingDetails.path_cache_entries)}
                    </Typography>
                    <Typography variant={isMobile ? 'caption' : 'body2'}>
                      {isMobile ? 'Entries' : 'Cache Entries'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      textAlign: "center",
                      bgcolor: "secondary.light",
                      color: "secondary.contrastText",
                      borderRadius: 2,
                      boxShadow: 2,
                    }}
                  >
                    <Typography variant={isMobile ? 'h6' : 'h6'}>
                      {formatNumber(embeddingDetails.total_embeddings_loaded)}
                    </Typography>
                    <Typography variant={isMobile ? 'caption' : 'body2'}>
                      {isMobile ? 'Total' : 'Total Embeddings'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </Box>
        </Collapse>

        <Collapse in={showAdvancedStats}>
          <Box>
            <Typography
              variant={isMobile ? 'subtitle1' : 'h6'}
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
            >
              <Analytics sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
              {isMobile ? 'Advanced Analytics' : 'Advanced System Analytics'}
            </Typography>

            {advancedLoading ? (
              <LinearProgress sx={{ my: 2 }} />
            ) : !advancedStats ? (
              <Alert severity="info">No advanced statistics available</Alert>
            ) : (
              <Stack spacing={{ xs: 2, sm: 3 }}>
                <Box>
                  <Typography
                    variant={isMobile ? 'body1' : 'subtitle1'}
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    Cache Performance
                  </Typography>
                  <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'}>
                          {formatPercentage(advancedStats.cache?.hit_ratio)}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>Hit Ratio</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'}>
                          {formatNumber(advancedStats.cache?.entries_count)}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>
                          {isMobile ? 'Entries' : 'Cache Entries'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'body1' : 'h6'} sx={{ fontSize: { xs: '0.875rem', sm: '1.25rem' } }}>
                          {formatBytes(advancedStats.cache?.memory_usage)}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>
                          {isMobile ? 'Usage' : 'Memory Usage'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'body1' : 'h6'} sx={{ fontSize: { xs: '0.875rem', sm: '1.25rem' } }}>
                          {formatBytes(advancedStats.cache?.max_memory)}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>
                          {isMobile ? 'Limit' : 'Memory Limit'}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>

                <Box>
                  <Typography
                    variant={isMobile ? 'body1' : 'subtitle1'}
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    Performance Metrics
                  </Typography>
                  <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'}>
                          {(
                            advancedStats.performance?.avg_search_time_ms || 0
                          ).toFixed(1)}{" "}
                          ms
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>
                          {isMobile ? 'Search Time' : 'Avg Search Time'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'}>
                          {(
                            advancedStats.performance?.avg_similarity_time_us ||
                            0
                          ).toFixed(1)}{" "}
                          μs
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>
                          {isMobile ? 'Similarity' : 'Avg Similarity Time'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'}>
                          {formatNumber(
                            advancedStats.performance?.total_searches,
                          )}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>
                          {isMobile ? 'Searches' : 'Total Searches'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'body1' : 'h6'} sx={{ fontSize: { xs: '0.875rem', sm: '1.25rem' } }}>
                          {formatBytes(
                            advancedStats.performance?.peak_memory_bytes,
                          )}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>
                          {isMobile ? 'Peak' : 'Peak Memory'}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>

                <Box>
                  <Typography
                    variant={isMobile ? 'body1' : 'subtitle1'}
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    System Information
                  </Typography>
                  <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'}>
                          {formatNumber(advancedStats.system_info?.cpu_cores)}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>CPU Cores</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'body1' : 'h6'} sx={{ fontSize: { xs: '0.875rem', sm: '1.25rem' } }}>
                          {formatBytes(
                            advancedStats.system_info?.total_memory_bytes,
                          )}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>
                          {isMobile ? 'Memory' : 'Total Memory'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'body2' : 'h6'} sx={{ fontSize: { xs: '0.75rem', sm: '1.25rem' } }}>
                          {advancedStats.system_info?.architecture || "Unknown"}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>Architecture</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: "center", borderRadius: 2 }}>
                        <Typography variant={isMobile ? 'body2' : 'h6'} sx={{ fontSize: { xs: '0.75rem', sm: '1.25rem' } }}>
                          {advancedStats.system_info?.operating_system ||
                            "Unknown"}
                        </Typography>
                        <Typography variant={isMobile ? 'caption' : 'body2'}>
                          {isMobile ? 'OS' : 'Operating System'}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Typography
                    variant="caption"
                    display="block"
                    sx={{ mt: { xs: 1.5, sm: 2 }, textAlign: "center", color: "text.secondary" }}
                  >
                    Last updated:{" "}
                    {new Date(advancedStats.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};