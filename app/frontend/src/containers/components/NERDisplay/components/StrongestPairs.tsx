import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip, LinearProgress } from '@mui/material';
import { CleaningServices } from '@mui/icons-material';

interface StrongestPairsProps {
  strongestPairs: any[];
}

/**
 * Displays a grid of strongest entity pairs with relationship metrics and quality indicators.
 */
const StrongestPairs: React.FC<StrongestPairsProps> = ({ strongestPairs }) => {
  return (
    <Grid container spacing={2}>
      {strongestPairs.slice(0, 12).map((pair, index) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
          <Card
            variant="outlined"
            sx={{ 
              height: '100%',
              border: pair.strength > 10 ? '2px solid' : '1px solid',
              borderColor: pair.strength > 10 ? 'success.main' : 'divider'
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip 
                  label={pair.entity1} 
                  size="small" 
                  color="primary" 
                  sx={{ maxWidth: '100px' }}
                />
                <Typography variant="body2">↔</Typography>
                <Chip 
                  label={pair.entity2} 
                  size="small" 
                  color="secondary" 
                  sx={{ maxWidth: '100px' }}
                />
              </Box>
              
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Relationship Strength
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((pair.strength / 20) * 100, 100)}
                    color={pair.strength > 10 ? 'success' : pair.strength > 5 ? 'warning' : 'error'}
                    sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                  />
                  <Chip
                    label={pair.strength.toFixed(1) + 'x'}
                    size="small"
                    color={pair.strength > 10 ? 'success' : pair.strength > 5 ? 'warning' : 'error'}
                    variant="outlined"
                  />
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary">
                Co-occurrences: {pair.count}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Documents: {pair.documents.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Distance: {pair.avgDistance ? Math.round(pair.avgDistance) : 'N/A'} chars
              </Typography>
              <Typography variant="body2" color="primary.main" sx={{ fontWeight: 'bold' }}>
                Proximity Score: {pair.proximityScore?.toFixed(2) || 'N/A'}
              </Typography>
              
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CleaningServices sx={{ fontSize: 12, color: 'success.main' }} />
                <Typography variant="caption" color="success.main">
                  Quality filtered
                </Typography>
                {pair.strength > 10 && (
                  <>
                    <Typography variant="caption" sx={{ mx: 0.5 }}>•</Typography>
                    <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold' }}>
                      Strong relationship
                    </Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default React.memo(StrongestPairs);