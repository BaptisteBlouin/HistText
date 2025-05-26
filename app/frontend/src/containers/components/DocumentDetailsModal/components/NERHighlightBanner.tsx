import React from 'react';
import { Card, CardContent, Box, Typography } from '@mui/material';
import { Label as LabelIcon } from '@mui/icons-material';

interface NERHighlightBannerProps {
  showNER: boolean;
  hasNERData: boolean;
}

const NERHighlightBanner: React.FC<NERHighlightBannerProps> = React.memo(({
  showNER,
  hasNERData
}) => {
  if (!showNER || !hasNERData) return null;

  return (
    <Card sx={{ mb: 3, border: '1px solid', borderColor: 'primary.light' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LabelIcon color="primary" />
          <Typography variant="h6" color="primary">
            Entity Highlighting Active
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Named entities are highlighted with colored chips. Hover over them to see confidence scores.
        </Typography>
      </CardContent>
    </Card>
  );
});

NERHighlightBanner.displayName = 'NERHighlightBanner';

export default NERHighlightBanner;