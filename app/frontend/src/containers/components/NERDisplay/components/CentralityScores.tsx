// app/frontend/src/containers/components/NERDisplay/components/CentralityScores.tsx
import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText, Box, Chip, LinearProgress, Tooltip } from '@mui/material';
import { Hub } from '@mui/icons-material';

interface CentralityScoresProps {
  centralityScores: Array<{ entity: string; score: number; connections: number }>;
}

const CentralityScores: React.FC<CentralityScoresProps> = ({ centralityScores }) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6">
            Most Connected Entities
          </Typography>
          <Chip 
            icon={<Hub />}
            label="Network Analysis" 
            size="small" 
            color="secondary" 
            variant="outlined"
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Normalized entities with the most relationships
        </Typography>
        <List>
          {centralityScores.slice(0, 10).map((entity, index) => (
            <ListItem key={index} sx={{ px: 0 }}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tooltip title={`Full entity: ${entity.entity}`}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 500,
                        maxWidth: '150px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {entity.entity}
                      </Typography>
                    </Tooltip>
                    <Chip 
                      label={entity.connections} 
                      size="small" 
                      color="secondary" 
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={entity.score * 100} 
                      sx={{ mt: 0.5, mb: 0.5 }}
                    />
                    <Typography variant="caption" color="success.main">
                      Normalized entity
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default React.memo(CentralityScores);