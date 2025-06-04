import React from 'react';
import { Grid, Card, CardContent, Typography, Alert, Box, Badge } from '@mui/material';
import { Psychology, FilterAlt, Hub } from '@mui/icons-material';
import PatternList from '../PatternList';
import PatternSummary from '../PatternSummary';

interface PatternsTabProps {
  stats: any;
}

/**
 * PatternsTab component displays enhanced pattern analytics on entities,
 * including bigram, trigram, and quadrigram sequences with normalization and filtering applied.
 */
const PatternsTab: React.FC<PatternsTabProps> = ({ stats }) => {
  return (
    <Grid container spacing={3}>
      {/* Header with quality improvements */}
      <Grid item xs={12}>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Psychology />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              Enhanced Pattern Analysis
            </Typography>
          </Box>
          <Typography variant="body2">
            <strong>Quality Improvements:</strong>
            <br />
            • <strong>Entity Normalization:</strong> "President Biden" + "Biden" + "Joe Biden" = "Biden"
            <br />
            • <strong>Noise Filtering:</strong> Excludes ordinals (1st, 2nd), cardinals (one, two), common stop words
            <br />
            • <strong>Proximity Analysis:</strong> Only entities within 500 characters are considered related
            <br />
            • <strong>Repetition Exclusion:</strong> Patterns like "Apple → Apple → Store" are filtered out
            <br />
            • <strong>Minimum Frequency:</strong> Only patterns occurring 2+ times are shown
          </Typography>
        </Alert>
      </Grid>

      {/* Bigram Patterns */}
      <Grid item xs={12} lg={6}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h6">Entity Bigram Patterns</Typography>
              <Badge badgeContent="Enhanced" color="success" variant="dot">
                <FilterAlt />
              </Badge>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Pairs of normalized entities that frequently appear together in sequence
            </Typography>
            <PatternList 
              patterns={stats?.bigramPatterns || []}
              maxItems={10}
              colorType="primary"
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Trigram Patterns */}
      <Grid item xs={12} lg={6}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h6">Entity Trigram Patterns</Typography>
              <Badge badgeContent="Enhanced" color="primary" variant="dot">
                <Psychology />
              </Badge>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Three-entity sequences showing complex normalized relationships
            </Typography>
            <PatternList 
              patterns={stats?.trigramPatterns || []}
              maxItems={8}
              colorType="secondary"
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Quadrigram Patterns */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h6">Complex Entity Patterns (Quadrigrams)</Typography>
              <Badge badgeContent="Advanced" color="error" variant="dot">
                <Hub />
              </Badge>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Four-entity sequences showing complex normalized relationships and narrative structures
            </Typography>
            <PatternList 
              patterns={stats?.quadrigramPatterns || []}
              maxItems={6}
              colorType="success"
              isAdvanced
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Pattern Summary */}
      <Grid item xs={12}>
        <PatternSummary stats={stats} />
      </Grid>
    </Grid>
  );
};

export default React.memo(PatternsTab);