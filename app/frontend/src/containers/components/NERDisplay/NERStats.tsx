import React from "react";
import { Grid, Card, CardContent, Typography, useTheme } from "@mui/material";

interface NERStatsProps {
  stats: any;
  displayEntitiesLength: number;
  searchTerm: string;
}

const NERStats: React.FC<NERStatsProps> = ({
  stats,
  displayEntitiesLength,
  searchTerm,
}) => {
  const theme = useTheme();

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
            <Typography variant="h6" sx={{ color: theme.palette.mode === 'dark' ? "white" : "primary.main", fontWeight: 600 }}>{displayEntitiesLength}</Typography>
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
            <Typography variant="h6" sx={{ color: theme.palette.mode === 'dark' ? "white" : "secondary.main", fontWeight: 600 }}>
              {Object.keys(stats.byDocument).length}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.mode === 'dark' ? "rgba(255,255,255,0.8)" : "secondary.dark" }}>Documents</Typography>
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
            <Typography variant="h6" sx={{ color: theme.palette.mode === 'dark' ? "white" : "success.main", fontWeight: 600 }}>
              {Object.keys(stats.byLabel).length}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.mode === 'dark' ? "rgba(255,255,255,0.8)" : "success.dark" }}>Types</Typography>
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
            <Typography variant="h6" sx={{ color: theme.palette.mode === 'dark' ? "white" : "info.main", fontWeight: 600 }}>
              {(stats.avgConfidence * 100).toFixed(1)}%
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.mode === 'dark' ? "rgba(255,255,255,0.8)" : "info.dark" }}>Avg Confidence</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default React.memo(NERStats);
