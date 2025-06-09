import React from "react";
import { Grid, Card, CardContent, Typography } from "@mui/material";

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
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} sm={3}>
        <Card
          sx={{
            textAlign: "center",
            bgcolor: "primary.light",
            color: "primary.contrastText",
          }}
        >
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">{displayEntitiesLength}</Typography>
            <Typography variant="caption">Words Shown</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card
          sx={{
            textAlign: "center",
            bgcolor: "secondary.light",
            color: "secondary.contrastText",
          }}
        >
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">
              {Object.keys(stats.byDocument).length}
            </Typography>
            <Typography variant="caption">Documents</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card
          sx={{
            textAlign: "center",
            bgcolor: "success.light",
            color: "success.contrastText",
          }}
        >
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">
              {Object.keys(stats.byLabel).length}
            </Typography>
            <Typography variant="caption">Types</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card
          sx={{
            textAlign: "center",
            bgcolor: "info.light",
            color: "info.contrastText",
          }}
        >
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">
              {(stats.avgConfidence * 100).toFixed(1)}%
            </Typography>
            <Typography variant="caption">Avg Confidence</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default React.memo(NERStats);
