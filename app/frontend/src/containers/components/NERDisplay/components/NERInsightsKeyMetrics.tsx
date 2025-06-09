import React from "react";
import { Card, CardContent, Grid, Typography, Box } from "@mui/material";

interface NERInsightsKeyMetricsProps {
  stats: any;
}

/**
 * Displays key metrics summary for NER insights in a styled card.
 * Metrics include total entities, entity types, average entities per document,
 * uniqueness ratio, and count of strong entity pairs.
 */
const NERInsightsKeyMetrics: React.FC<NERInsightsKeyMetricsProps> = ({
  stats,
}) => {
  return (
    <Card
      sx={{
        mb: 4,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
      }}
    >
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h3" sx={{ fontWeight: "bold", mb: 1 }}>
                {stats.totalEntities?.toLocaleString() || "0"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Total Entities
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                (After filtering)
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h3" sx={{ fontWeight: "bold", mb: 1 }}>
                {Object.keys(stats.topEntitiesByType || {}).length}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Entity Types
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                (Unique labels)
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h3" sx={{ fontWeight: "bold", mb: 1 }}>
                {stats.averageEntitiesPerDocument?.toFixed(1) || "0.0"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Avg/Document
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                (Entity density)
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h3" sx={{ fontWeight: "bold", mb: 1 }}>
                {((stats.uniqueEntitiesRatio || 0) * 100).toFixed(1)}%
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Unique Ratio
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                (Diversity index)
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h3" sx={{ fontWeight: "bold", mb: 1 }}>
                {stats.strongestPairs?.length || 0}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Strong Pairs
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                (Significant relationships)
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default React.memo(NERInsightsKeyMetrics);
