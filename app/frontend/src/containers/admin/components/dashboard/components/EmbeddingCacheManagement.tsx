import React, { useState } from "react";
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
  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
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
            <Memory />
            Embedding Cache Management
          </Typography>
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

        <Collapse in={showEmbeddingDetails}>
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Speed />
              Basic Performance Metrics
            </Typography>

            {detailsLoading ? (
              <LinearProgress sx={{ my: 2 }} />
            ) : !embeddingDetails ? (
              <Alert severity="info">
                No detailed embedding statistics available
              </Alert>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: "center",
                      bgcolor: "success.light",
                      color: "success.contrastText",
                    }}
                  >
                    <Typography variant="h6">
                      {formatPercentage(embeddingDetails.hit_ratio)}
                    </Typography>
                    <Typography variant="body2">Cache Hit Ratio</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: "center",
                      bgcolor: "info.light",
                      color: "info.contrastText",
                    }}
                  >
                    <Typography variant="h6">
                      {formatBytes(embeddingDetails.memory_usage_bytes)}
                    </Typography>
                    <Typography variant="body2">Memory Usage</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: "center",
                      bgcolor: "warning.light",
                      color: "warning.contrastText",
                    }}
                  >
                    <Typography variant="h6">
                      {formatNumber(embeddingDetails.path_cache_entries)}
                    </Typography>
                    <Typography variant="body2">Cache Entries</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: "center",
                      bgcolor: "secondary.light",
                      color: "secondary.contrastText",
                    }}
                  >
                    <Typography variant="h6">
                      {formatNumber(embeddingDetails.total_embeddings_loaded)}
                    </Typography>
                    <Typography variant="body2">Total Embeddings</Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </Box>
        </Collapse>

        <Collapse in={showAdvancedStats}>
          <Box>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Analytics />
              Advanced System Analytics
            </Typography>

            {advancedLoading ? (
              <LinearProgress sx={{ my: 2 }} />
            ) : !advancedStats ? (
              <Alert severity="info">No advanced statistics available</Alert>
            ) : (
              <Stack spacing={3}>
                <Box>
                  <Typography
                    variant="subtitle1"
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    Cache Performance
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {formatPercentage(advancedStats.cache?.hit_ratio)}
                        </Typography>
                        <Typography variant="body2">Hit Ratio</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {formatNumber(advancedStats.cache?.entries_count)}
                        </Typography>
                        <Typography variant="body2">Cache Entries</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {formatBytes(advancedStats.cache?.memory_usage)}
                        </Typography>
                        <Typography variant="body2">Memory Usage</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {formatBytes(advancedStats.cache?.max_memory)}
                        </Typography>
                        <Typography variant="body2">Memory Limit</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>

                <Box>
                  <Typography
                    variant="subtitle1"
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    Performance Metrics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {(
                            advancedStats.performance?.avg_search_time_ms || 0
                          ).toFixed(1)}{" "}
                          ms
                        </Typography>
                        <Typography variant="body2">Avg Search Time</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {(
                            advancedStats.performance?.avg_similarity_time_us ||
                            0
                          ).toFixed(1)}{" "}
                          μs
                        </Typography>
                        <Typography variant="body2">
                          Avg Similarity Time
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {formatNumber(
                            advancedStats.performance?.total_searches,
                          )}
                        </Typography>
                        <Typography variant="body2">Total Searches</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {formatBytes(
                            advancedStats.performance?.peak_memory_bytes,
                          )}
                        </Typography>
                        <Typography variant="body2">Peak Memory</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>

                <Box>
                  <Typography
                    variant="subtitle1"
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    System Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {formatNumber(advancedStats.system_info?.cpu_cores)}
                        </Typography>
                        <Typography variant="body2">CPU Cores</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {formatBytes(
                            advancedStats.system_info?.total_memory_bytes,
                          )}
                        </Typography>
                        <Typography variant="body2">Total Memory</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {advancedStats.system_info?.architecture || "Unknown"}
                        </Typography>
                        <Typography variant="body2">Architecture</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="h6">
                          {advancedStats.system_info?.operating_system ||
                            "Unknown"}
                        </Typography>
                        <Typography variant="body2">
                          Operating System
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Typography
                    variant="caption"
                    display="block"
                    sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}
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
