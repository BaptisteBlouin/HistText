// app/frontend/src/containers/components/NERDisplay/components/TopEntitiesList.tsx
import React from 'react';
import { Grid, Card, CardContent, Typography, List, ListItem, ListItemText, Box, Chip, Tooltip } from '@mui/material';

interface TopEntitiesListProps {
  topEntitiesByType: Record<string, Array<{ text: string; count: number; documents: number }>>;
}

const TopEntitiesList: React.FC<TopEntitiesListProps> = ({ topEntitiesByType }) => {
  return (
    <Grid container spacing={2}>
      {Object.entries(topEntitiesByType).map(([type, entities]) => (
        <Grid item xs={12} md={6} lg={4} key={type}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  {type}
                </Typography>
                <Chip 
                  label={`${entities.length} unique`} 
                  size="small" 
                  color="info" 
                  variant="outlined"
                />
              </Box>
              <List dense>
                {entities.slice(0, 5).map((entity, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Tooltip title={`Full name: ${entity.text}`} placement="top">
                            <Typography variant="body2" sx={{ 
                              fontWeight: 500,
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {entity.text}
                            </Typography>
                          </Tooltip>
                          <Chip 
                            label={entity.count} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        </Box>
                      }
                      secondary={`${entity.documents} docs • Normalized entity`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default React.memo(TopEntitiesList);