import React from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';

interface CloudStatsProps {
  stats: any;
}

const CloudStats: React.FC<CloudStatsProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">{stats.totalWords}</Typography>
            <Typography variant="caption">Words Shown</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">{stats.maxFrequency}</Typography>
            <Typography variant="caption">Top Frequency</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">{stats.chineseWords}</Typography>
            <Typography variant="caption">Chinese Words</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="h6">{stats.englishWords}</Typography>
            <Typography variant="caption">English Words</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default React.memo(CloudStats);