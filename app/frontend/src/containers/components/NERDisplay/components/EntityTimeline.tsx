import React, { useMemo, useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  IconButton,
  Collapse
} from '@mui/material';
import { Timeline, Info } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, ComposedChart, Area } from 'recharts';

interface EntityTimelineProps {
  stats: any;
  entities: any[];
}

interface TimelineDataPoint {
  sequence: number;
  documentId: string;
  entityCount: number;
  topEntities: string[];
  uniqueEntities: number;
  avgConfidence: number;
  entityDensity: number;
  dominantType: string;
  diversityIndex: number;
}

/**
 * Displays an analysis of entity metrics over a sequence of documents.
 * Supports multiple metrics visualization, entity tracking, and timeline trends.
 */
const EntityTimeline: React.FC<EntityTimelineProps> = ({ stats, entities }) => {
  const [selectedMetric, setSelectedMetric] = useState<'entityCount' | 'uniqueEntities' | 'avgConfidence' | 'entityDensity' | 'diversityIndex'>('entityCount');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [showExplanation, setShowExplanation] = useState(false);

  /**
   * Processes document stats to build timeline data points with enhanced metrics.
   */
  const timelineData = useMemo((): TimelineDataPoint[] => {
    if (!stats?.documentStats) return [];

    return stats.documentStats
      .slice(0, 30)
      .map((doc: any, index: number) => {
        const estimatedDocLength = doc.entityCount * 50;
        const entityDensity = (doc.entityCount / Math.max(estimatedDocLength, 1000)) * 1000;
        
        const entityTypes = doc.entityTypes || {};
        const dominantType = Object.entries(entityTypes).reduce((max, [type, count]) => 
          (count as number) > (max.count || 0) ? { type, count: count as number } : max, 
          { type: 'Mixed', count: 0 }
        ).type;
        
        const totalEntities = Object.values(entityTypes).reduce((sum: number, count) => sum + (count as number), 0);
        let diversityIndex = 0;
        if (totalEntities > 0) {
          Object.values(entityTypes).forEach((count) => {
            const p = (count as number) / totalEntities;
            if (p > 0) {
              diversityIndex -= p * Math.log2(p);
            }
          });
          const maxTypes = Object.keys(entityTypes).length;
          if (maxTypes > 1) {
            diversityIndex = diversityIndex / Math.log2(maxTypes);
          }
        }

        return {
          sequence: index + 1,
          documentId: doc.documentId,
          entityCount: doc.entityCount,
          topEntities: doc.topEntities?.slice(0, 3).map((e: any) => e.text) || [],
          uniqueEntities: doc.uniqueEntityCount,
          avgConfidence: doc.averageConfidence * 100,
          entityDensity,
          dominantType,
          diversityIndex
        };
      });
  }, [stats]);

  /**
   * Computes the evolution of a specific entity over the document timeline.
   */
  const entityEvolutionData = useMemo(() => {
    if (!selectedEntity || !entities) return [];

    const entityOccurrences = new Map<string, number>();
    
    entities
      .filter(e => e.text.toLowerCase().includes(selectedEntity.toLowerCase()) || 
                   e.normalizedText?.toLowerCase().includes(selectedEntity.toLowerCase()))
      .forEach(entity => {
        const count = entityOccurrences.get(entity.documentId) || 0;
        entityOccurrences.set(entity.documentId, count + 1);
      });

    return timelineData.map(point => ({
      sequence: point.sequence,
      documentId: point.documentId,
      entityOccurrences: entityOccurrences.get(point.documentId) || 0,
      relativeFrequency: entityOccurrences.get(point.documentId) ? 
        (entityOccurrences.get(point.documentId)! / point.entityCount) * 100 : 0
    })).filter(point => point.entityOccurrences > 0);
  }, [selectedEntity, entities, timelineData]);

  /**
   * Extracts top entities from stats for selection dropdown.
   */
  const topEntities = useMemo(() => {
    if (!stats?.topEntities) return [];
    return stats.topEntities.slice(0, 20);
  }, [stats]);

  /**
   * Computes trends and insights by comparing metrics in the first and second halves of the timeline.
   */
  const timelineTrends = useMemo(() => {
    if (timelineData.length < 3) return null;

    const firstHalf = timelineData.slice(0, Math.floor(timelineData.length / 2));
    const secondHalf = timelineData.slice(Math.floor(timelineData.length / 2));

    const avgFirst = {
      entityCount: firstHalf.reduce((sum, d) => sum + d.entityCount, 0) / firstHalf.length,
      uniqueEntities: firstHalf.reduce((sum, d) => sum + d.uniqueEntities, 0) / firstHalf.length,
      diversityIndex: firstHalf.reduce((sum, d) => sum + d.diversityIndex, 0) / firstHalf.length
    };

    const avgSecond = {
      entityCount: secondHalf.reduce((sum, d) => sum + d.entityCount, 0) / secondHalf.length,
      uniqueEntities: secondHalf.reduce((sum, d) => sum + d.uniqueEntities, 0) / secondHalf.length,
      diversityIndex: secondHalf.reduce((sum, d) => sum + d.diversityIndex, 0) / secondHalf.length
    };

    return {
      entityCountTrend: avgSecond.entityCount > avgFirst.entityCount ? 'increasing' : 'decreasing',
      diversityTrend: avgSecond.diversityIndex > avgFirst.diversityIndex ? 'increasing' : 'decreasing',
      peakActivity: timelineData.reduce((max, doc) => 
        doc.entityCount > max.entityCount ? doc : max
      ),
      mostDiverse: timelineData.reduce((max, doc) => 
        doc.diversityIndex > max.diversityIndex ? doc : max
      )
    };
  }, [timelineData]);

  if (!stats?.documentStats || timelineData.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Timeline color="primary" />
            <Typography variant="h6">Entity Timeline Analysis</Typography>
          </Box>
          <Alert severity="info">
            Not enough document data available for timeline analysis.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Timeline color="primary" />
          <Typography variant="h6">Entity Timeline Analysis</Typography>
          <Chip label="Document Sequence" size="small" color="secondary" variant="outlined" />
          <IconButton size="small" onClick={() => setShowExplanation(!showExplanation)}>
            <Info />
          </IconButton>
        </Box>

        <Collapse in={showExplanation}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>How Timeline is Computed:</strong>
              <br />
              1. <strong>Document Sequence:</strong> Documents ordered by processing sequence (may correlate with temporal patterns)
              <br />
              2. <strong>Entity Density:</strong> Entities per estimated document length (normalized)
              <br />
              3. <strong>Diversity Index:</strong> Shannon entropy of entity types, normalized (0-1, higher = more diverse)
              <br />
              4. <strong>Dominant Type:</strong> Most frequent entity type in each document
              <br />
              5. <strong>Entity Evolution:</strong> How specific entities appear/disappear over sequence
              <br />
              <br />
              <strong>Trends:</strong> Computed by comparing first and second half of document sequence
            </Typography>
          </Alert>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Timeline Metric</InputLabel>
            <Select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
            >
              <MenuItem value="entityCount">Total Entities</MenuItem>
              <MenuItem value="uniqueEntities">Unique Entities</MenuItem>
              <MenuItem value="avgConfidence">Avg Confidence</MenuItem>
              <MenuItem value="entityDensity">Entity Density</MenuItem>
              <MenuItem value="diversityIndex">Diversity Index</MenuItem>
            </Select>
          </FormControl>

          {topEntities.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Track Specific Entity</InputLabel>
              <Select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                {topEntities.map((entity: any) => (
                  <MenuItem key={entity.text} value={entity.text}>
                    {entity.text} ({entity.count})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Document Sequence Timeline - {selectedMetric.replace(/([A-Z])/g, ' $1').toLowerCase()}
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="sequence" 
                label={{ value: 'Document Sequence', position: 'insideBottom', offset: -5 }}
              />
              <YAxis />
              <RechartsTooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <Box sx={{ bgcolor: 'background.paper', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="subtitle2">
                          Document #{label}: {data.documentId.substring(0, 20)}...
                        </Typography>
                        <Typography variant="body2">Total Entities: {data.entityCount}</Typography>
                        <Typography variant="body2">Unique Entities: {data.uniqueEntities}</Typography>
                        <Typography variant="body2">Avg Confidence: {data.avgConfidence.toFixed(1)}%</Typography>
                        <Typography variant="body2">Entity Density: {data.entityDensity.toFixed(1)}</Typography>
                        <Typography variant="body2">Diversity Index: {data.diversityIndex.toFixed(2)}</Typography>
                        <Typography variant="body2">Dominant Type: {data.dominantType}</Typography>
                        <Typography variant="body2">Top Entities: {data.topEntities.join(', ')}</Typography>
                      </Box>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey={selectedMetric} 
                stroke="#8884d8" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {selectedMetric === 'entityCount' && (
                <Area
                  type="monotone"
                  dataKey="uniqueEntities"
                  stackId="1"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.3}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Box>

        {selectedEntity && entityEvolutionData.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Entity Evolution: "{selectedEntity}"
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={entityEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="sequence" 
                  label={{ value: 'Document Sequence', position: 'insideBottom', offset: -5 }}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <RechartsTooltip 
                  formatter={(value, name) => [
                    name === 'entityOccurrences' ? `${value} occurrences` : `${value}% relative frequency`,
                    name === 'entityOccurrences' ? 'Entity Count' : 'Relative Frequency'
                  ]}
                  labelFormatter={(label) => `Document #${label}`}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="entityOccurrences" 
                  fill="#82ca9d" 
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="relativeFrequency" 
                  stroke="#ff7300" 
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        )}

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Timeline Insights & Trends
          </Typography>
          {timelineTrends && (
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Entity Count Trend"
                  secondary={`Overall ${timelineTrends.entityCountTrend} pattern detected across document sequence`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Diversity Trend"
                  secondary={`Entity type diversity is ${timelineTrends.diversityTrend} over sequence`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Peak Entity Activity"
                  secondary={`Document #${timelineTrends.peakActivity.sequence} with ${timelineTrends.peakActivity.entityCount} entities (${timelineTrends.peakActivity.dominantType} dominant)`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Highest Diversity"
                  secondary={`Document #${timelineTrends.mostDiverse.sequence} with diversity index of ${timelineTrends.mostDiverse.diversityIndex.toFixed(2)}`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Average Entity Density"
                  secondary={`${(timelineData.reduce((sum, d) => sum + d.entityDensity, 0) / timelineData.length).toFixed(1)} entities per estimated document unit`}
                />
              </ListItem>
            </List>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default React.memo(EntityTimeline);