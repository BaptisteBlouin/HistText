// app/frontend/src/containers/components/NERDisplay/components/tabs/AdvancedAnalyticsTab.tsx
import React from 'react';
import { Grid, Box, Typography, Alert } from '@mui/material';
import { Science, Insights } from '@mui/icons-material';
import DocumentSimilarityNetwork from '../DocumentSimilarityNetwork';
import EntityTimeline from '../EntityTimeline';
import EntityContextClustering from '../EntityContextClustering';
import CrossDocumentEntityTracker from '../CrossDocumentEntityTracker';
import EntityInfluenceScores from '../EntityInfluenceScores';

interface AdvancedAnalyticsTabProps {
  stats: any;
  entities: any[];
  onDocumentClick: (documentId: string) => void;
}

const AdvancedAnalyticsTab: React.FC<AdvancedAnalyticsTabProps> = ({
  stats,
  entities,
  onDocumentClick
}) => {
  console.log('AdvancedAnalyticsTab rendered with:', { 
    hasStats: !!stats, 
    entitiesCount: entities?.length || 0,
    statsKeys: stats ? Object.keys(stats) : []
  });

  console.log('AdvancedAnalyticsTab RENDERING');
  console.log('Stats available:', !!stats);
  console.log('Stats keys:', stats ? Object.keys(stats) : 'none');
  console.log('Entities count:', entities?.length || 0);
  console.log('onDocumentClick function:', typeof onDocumentClick);

  return (
    <Grid container spacing={3}>
      {/* Header */}
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Science color="primary" />
          <Typography variant="h5">Deep Entity Analytics</Typography>
        </Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Advanced analytics providing deeper insights into entity relationships, document connections, 
            and cross-corpus patterns. All computations use your filtered dataset.
          </Typography>
        </Alert>
      </Grid>

      {/* Document Similarity Network */}
      <Grid item xs={12}>
        <DocumentSimilarityNetwork 
          stats={stats}
          onDocumentClick={onDocumentClick}
        />
      </Grid>

      {/* Entity Influence Scores */}
      <Grid item xs={12} lg={6}>
        <EntityInfluenceScores 
          stats={stats}
          entities={entities}
        />
      </Grid>

      {/* Entity Timeline */}
      <Grid item xs={12} lg={6}>
        <EntityTimeline 
          stats={stats}
          entities={entities}
        />
      </Grid>

      {/* Cross-Document Entity Tracker */}
      <Grid item xs={12}>
        <CrossDocumentEntityTracker 
          stats={stats}
          entities={entities}
          onDocumentClick={onDocumentClick}
        />
      </Grid>

      {/* Entity Context Clustering */}
      <Grid item xs={12}>
        <EntityContextClustering 
          stats={stats}
          onDocumentClick={onDocumentClick}
        />
      </Grid>
    </Grid>
  );
};

export default React.memo(AdvancedAnalyticsTab);