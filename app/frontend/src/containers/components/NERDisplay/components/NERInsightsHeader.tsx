// app/frontend/src/containers/components/NERDisplay/components/NERInsightsHeader.tsx
import React from 'react';
import { Box, Typography, Badge, CircularProgress } from '@mui/material';
import { Insights, CleaningServices } from '@mui/icons-material';
import FeatureAvailabilityIndicator from './FeatureAvailabilityIndicator';

interface NERInsightsHeaderProps {
  selectedAlias: string;
  isProcessing: boolean;
  stats: any;
}

const NERInsightsHeader: React.FC<NERInsightsHeaderProps> = ({
  selectedAlias,
  isProcessing,
  stats
}) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Insights color="primary" />
        Advanced Entity Analytics
        <Badge badgeContent="Enhanced" color="success" variant="dot">
          <CleaningServices />
        </Badge>
        {isProcessing && <CircularProgress size={24} />}
      </Typography>
      
      <Typography variant="subtitle1" color="text.secondary">
        Progressive analysis with normalized and filtered entities from {selectedAlias}
      </Typography>
      
      {/* Feature availability indicators */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <FeatureAvailabilityIndicator 
          feature="Basic Stats" 
          available={!!stats} 
          description="Entity counts, types, and basic distributions"
        />
        <FeatureAvailabilityIndicator 
          feature="Relationships" 
          available={stats?.strongestPairs?.length > 0}
          loading={isProcessing}
          limited={!stats?.hasAdvancedFeatures}
          description="Entity co-occurrence and relationship analysis"
        />
        <FeatureAvailabilityIndicator 
          feature="Patterns" 
          available={stats?.bigramPatterns?.length > 0}
          loading={isProcessing}
          limited={!stats?.hasAdvancedFeatures}
          description="N-gram patterns and entity sequences"
        />
      </Box>
    </Box>
  );
};

export default React.memo(NERInsightsHeader);