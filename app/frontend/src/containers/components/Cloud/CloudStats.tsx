import React from "react";
import { Grid, Card, CardContent, Typography, useTheme } from "@mui/material";

/**
 * Props for CloudStats, displaying a summary of cloud statistics.
 */
interface CloudStatsProps {
  /** Stats object returned from useCloudData (see useCloudData for structure) */
  stats: any;
}

/**
 * Displays a grid of summary statistics for the current word cloud:
 * total words, top frequency, Chinese word count, and English word count.
 *
 * @param props - CloudStatsProps
 * @returns Stats summary cards, or null if no stats provided.
 */
const CloudStats: React.FC<CloudStatsProps> = ({ stats }) => {
  const theme = useTheme();
  
  if (!stats) return null;

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} sm={3}>
        <Card
          sx={{
            textAlign: "center",
            bgcolor: theme.palette.mode === 'dark' ? "primary.dark" : "primary.light",
            color: theme.palette.mode === 'dark' ? "white" : "primary.contrastText",
          }}
        >
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6" sx={{ color: theme.palette.mode === 'dark' ? "white" : "primary.main", fontWeight: 600 }}>{stats.totalWords}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.mode === 'dark' ? "rgba(255,255,255,0.8)" : "primary.dark" }}>Words Shown</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card
          sx={{
            textAlign: "center",
            bgcolor: theme.palette.mode === 'dark' ? "secondary.dark" : "secondary.light",
            color: theme.palette.mode === 'dark' ? "white" : "secondary.contrastText",
          }}
        >
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6" sx={{ color: theme.palette.mode === 'dark' ? "white" : "secondary.main", fontWeight: 600 }}>{stats.maxFrequency}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.mode === 'dark' ? "rgba(255,255,255,0.8)" : "secondary.dark" }}>Top Frequency</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card
          sx={{
            textAlign: "center",
            bgcolor: theme.palette.mode === 'dark' ? "success.dark" : "success.light",
            color: theme.palette.mode === 'dark' ? "white" : "success.contrastText",
          }}
        >
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6" sx={{ color: theme.palette.mode === 'dark' ? "white" : "success.main", fontWeight: 600 }}>{stats.chineseWords}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.mode === 'dark' ? "rgba(255,255,255,0.8)" : "success.dark" }}>Chinese Words</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card
          sx={{
            textAlign: "center",
            bgcolor: theme.palette.mode === 'dark' ? "info.dark" : "info.light",
            color: theme.palette.mode === 'dark' ? "white" : "info.contrastText",
          }}
        >
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6" sx={{ color: theme.palette.mode === 'dark' ? "white" : "info.main", fontWeight: 600 }}>{stats.englishWords}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.mode === 'dark' ? "rgba(255,255,255,0.8)" : "info.dark" }}>English Words</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default React.memo(CloudStats);
