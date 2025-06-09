import React from "react";
import { Card, CardContent, Typography, Grid, Alert, Box } from "@mui/material";
import {
  Assessment,
  Hub,
  CleaningServices,
  DataUsage,
} from "@mui/icons-material";

interface PatternSummaryProps {
  stats: any;
}

/**
 * Displays a summary overview of different quality pattern counts,
 * including bigrams, trigrams, and quadrigrams, with visual indicators
 * and a quality assurance note.
 */
const PatternSummary: React.FC<PatternSummaryProps> = ({ stats }) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Typography variant="h6">
            Enhanced Pattern Analysis Summary
          </Typography>
          <Assessment color="info" />
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Card
              variant="outlined"
              sx={{
                textAlign: "center",
                border: 2,
                borderColor: "primary.light",
              }}
            >
              <CardContent>
                <Typography variant="h4" color="primary.main">
                  {stats?.bigramPatterns?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Quality Bigram Patterns
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    mt: 1,
                  }}
                >
                  <CleaningServices
                    sx={{ fontSize: 12, color: "success.main" }}
                  />
                  <Typography variant="caption" color="success.main">
                    Filtered & Normalized
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card
              variant="outlined"
              sx={{
                textAlign: "center",
                border: 2,
                borderColor: "secondary.light",
              }}
            >
              <CardContent>
                <Typography variant="h4" color="secondary.main">
                  {stats?.trigramPatterns?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Quality Trigram Patterns
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    mt: 1,
                  }}
                >
                  <DataUsage sx={{ fontSize: 12, color: "primary.main" }} />
                  <Typography variant="caption" color="primary.main">
                    Advanced Analysis
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card
              variant="outlined"
              sx={{
                textAlign: "center",
                border: 2,
                borderColor: "success.light",
              }}
            >
              <CardContent>
                <Typography variant="h4" color="success.main">
                  {stats?.quadrigramPatterns?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Complex Patterns
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    mt: 1,
                  }}
                >
                  <Hub sx={{ fontSize: 12, color: "success.main" }} />
                  <Typography variant="caption" color="success.main">
                    Relationship Networks
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Quality Assurance:</strong> All patterns exclude repeated
            entities, filter out noise words (ordinals, cardinals, stop words),
            use normalized entity names, and require minimum proximity (entities
            within 500 characters) and frequency (2+ occurrences) thresholds.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default React.memo(PatternSummary);
