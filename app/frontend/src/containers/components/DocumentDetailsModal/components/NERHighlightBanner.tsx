import React from 'react';
import { Card, CardContent, Box, Typography } from '@mui/material';
import { Label as LabelIcon } from '@mui/icons-material';

/**
 * Props for NERHighlightBanner, the info banner for active entity highlighting.
 */
interface NERHighlightBannerProps {
  showNER: boolean;
  hasNERData: boolean;
}

/**
 * Displays a banner when NER (Named Entity Recognition) highlighting is active for a document.
 * Shows only when both showNER and hasNERData are true.
 *
 * @param props - NERHighlightBannerProps
 * @returns Banner UI or null if not active.
 */
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