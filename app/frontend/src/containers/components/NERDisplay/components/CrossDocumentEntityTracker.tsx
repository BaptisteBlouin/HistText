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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Alert,
  Autocomplete,
  TextField,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { TrackChanges, Info } from '@mui/icons-material';

/**
 * Data structure for enhanced cross-document entity tracking.
 */
interface EntityTrackingData {
  entity: string;
  normalizedEntity: string;
  documentAppearances: Array<{
    documentId: string;
    count: number;
    confidence: number;
    firstPosition: number;
    entityTypes: string[];
    relativePosition: number;
  }>;
  totalOccurrences: number;
  documentSpread: number;
  consistencyScore: number;
  avgConfidence: number;
  mobilityScore: number;
  persistencePattern: 'stable' | 'growing' | 'declining' | 'sporadic';
  contextDiversity: number;
}

interface CrossDocumentEntityTrackerProps {
  stats: any;
  entities: any[];
  onDocumentClick: (documentId: string) => void;
}

/**
 * CrossDocumentEntityTracker component provides an advanced view
 * into how entities appear and evolve across multiple documents.
 * 
 * Features:
 * - Groups entities by normalized names for consistency.
 * - Computes metrics like document spread, consistency, mobility, persistence pattern, and context diversity.
 * - Allows sorting entities by various metrics.
 * - Displays detailed visualizations of entity occurrences and mobility.
 * - Provides a searchable entity selector and detailed document navigation.
 * 
 * @param stats - Analytics statistics including top entities by type.
 * @param entities - Array of entity instances across documents.
 * @param onDocumentClick - Callback when a document ID is clicked.
 */
const CrossDocumentEntityTracker: React.FC<CrossDocumentEntityTrackerProps> = ({
  stats,
  entities,
  onDocumentClick
}) => {
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [sortBy, setSortBy] = useState<'spread' | 'consistency' | 'mobility' | 'occurrences' | 'persistence'>('spread');
  const [showExplanation, setShowExplanation] = useState(false);

  // Compute enhanced tracking data with multiple metrics and filtering
  const trackingData = useMemo((): EntityTrackingData[] => {
    if (!entities || entities.length === 0) {
      return [];
    }

    // Group entities by normalized text
    const entityGroups = new Map<string, Array<any>>();
    entities.forEach(entity => {
      const documentId = entity.documentId || entity.id || entity.docId || 'unknown';
      const entityText = entity.text || entity.entityText || '';
      const normalizedText = entity.normalizedText || entityText.toLowerCase();

      if (!entityText || !documentId || documentId === 'unknown') return;

      if (!entityGroups.has(normalizedText)) {
        entityGroups.set(normalizedText, []);
      }
      entityGroups.get(normalizedText)!.push({
        ...entity,
        documentId,
        text: entityText
      });
    });

    const trackingResults: EntityTrackingData[] = [];

    entityGroups.forEach((entityInstances, normalizedText) => {
      // Group by document
      const documentMap = new Map<string, Array<any>>();
      entityInstances.forEach(instance => {
        const docId = instance.documentId;
        if (!documentMap.has(docId)) {
          documentMap.set(docId, []);
        }
        documentMap.get(docId)!.push(instance);
      });

      // Calculate document appearances with metrics
      const documentAppearances = Array.from(documentMap.entries()).map(([docId, instances]) => {
        const avgConfidence = instances.reduce((sum, inst) => sum + (inst.confidence || 0), 0) / instances.length;
        const firstPosition = Math.min(...instances.map(inst => inst.position || inst.start || 0));
        const entityTypes = Array.from(new Set(instances.map(inst => inst.labelFull || inst.label || 'UNKNOWN')));
        const positions = instances.map(inst => inst.position || inst.start || 0);
        const maxPosition = Math.max(...positions);
        const relativePosition = maxPosition > 0 ? firstPosition / maxPosition : 0;

        return {
          documentId: docId,
          count: instances.length,
          confidence: avgConfidence,
          firstPosition,
          entityTypes,
          relativePosition
        };
      });

      documentAppearances.sort((a, b) => a.documentId.localeCompare(b.documentId));

      const totalOccurrences = entityInstances.length;
      const documentSpread = documentAppearances.length;

      if (documentSpread < 2 && totalOccurrences < 3) return;

      // Consistency score measures evenness across documents
      const avgOccurrencesPerDoc = totalOccurrences / documentSpread;
      const variance = documentAppearances.reduce((sum, appearance) => {
        return sum + Math.pow(appearance.count - avgOccurrencesPerDoc, 2);
      }, 0) / documentSpread;
      const consistencyScore = 1 / (1 + Math.sqrt(variance));

      const avgConfidence = entityInstances.reduce((sum, inst) => sum + (inst.confidence || 0), 0) / entityInstances.length;

      // Mobility score measures variability in position within documents
      const relativePositions = documentAppearances.map(app => app.relativePosition).filter(pos => !isNaN(pos));
      let mobilityScore = 0;
      if (relativePositions.length > 1) {
        const avgRelativePosition = relativePositions.reduce((sum, pos) => sum + pos, 0) / relativePositions.length;
        const positionVariance = relativePositions.reduce((sum, pos) => sum + Math.pow(pos - avgRelativePosition, 2), 0) / relativePositions.length;
        mobilityScore = Math.min(Math.sqrt(positionVariance), 1);
      }

      // Persistence pattern based on frequency changes across documents
      let persistencePattern: 'stable' | 'growing' | 'declining' | 'sporadic' = 'stable';
      if (documentAppearances.length >= 3) {
        const firstThird = documentAppearances.slice(0, Math.floor(documentAppearances.length / 3));
        const lastThird = documentAppearances.slice(-Math.floor(documentAppearances.length / 3));

        const avgFirst = firstThird.reduce((sum, app) => sum + app.count, 0) / firstThird.length;
        const avgLast = lastThird.reduce((sum, app) => sum + app.count, 0) / lastThird.length;

        if (avgFirst > 0) {
          const changeRatio = avgLast / avgFirst;
          const variance = documentAppearances.reduce((sum, app) => {
            const diff = app.count - avgOccurrencesPerDoc;
            return sum + diff * diff;
          }, 0) / documentAppearances.length;

          if (variance > avgOccurrencesPerDoc * 2) {
            persistencePattern = 'sporadic';
          } else if (changeRatio > 1.5) {
            persistencePattern = 'growing';
          } else if (changeRatio < 0.67) {
            persistencePattern = 'declining';
          }
        }
      }

      const allEntityTypes = new Set(documentAppearances.flatMap(app => app.entityTypes));
      const maxPossibleTypes = Math.max(Object.keys(stats?.topEntitiesByType || {}).length, 1);
      const contextDiversity = allEntityTypes.size / maxPossibleTypes;

      trackingResults.push({
        entity: entityInstances[0].text,
        normalizedEntity: normalizedText,
        documentAppearances,
        totalOccurrences,
        documentSpread,
        consistencyScore,
        avgConfidence,
        mobilityScore,
        persistencePattern,
        contextDiversity
      });
    });

    return trackingResults.sort((a, b) => {
      switch (sortBy) {
        case 'spread': return b.documentSpread - a.documentSpread;
        case 'consistency': return b.consistencyScore - a.consistencyScore;
        case 'mobility': return b.mobilityScore - a.mobilityScore;
        case 'occurrences': return b.totalOccurrences - a.totalOccurrences;
        case 'persistence': return b.contextDiversity - a.contextDiversity;
        default: return b.documentSpread - a.documentSpread;
      }
    });
  }, [entities, stats, sortBy]);

  // Get selected entity details from tracking data
  const selectedEntityData = useMemo(() => {
    if (!selectedEntity) return null;
    return trackingData.find(data => 
      data.entity.toLowerCase().includes(selectedEntity.toLowerCase()) ||
      data.normalizedEntity.toLowerCase().includes(selectedEntity.toLowerCase())
    );
  }, [selectedEntity, trackingData]);

  // Chart data for the selected entity showing document occurrences
  const chartData = useMemo(() => {
    if (!selectedEntityData) return [];
    return selectedEntityData.documentAppearances.map((appearance, index) => ({
      document: `Doc ${index + 1}`,
      fullDocId: appearance.documentId,
      occurrences: appearance.count,
      confidence: appearance.confidence * 100,
      relativePosition: appearance.relativePosition * 100,
      sequence: index + 1
    }));
  }, [selectedEntityData]);

  // Mobility pattern detection for the selected entity
  const mobilityPattern = useMemo(() => {
    if (!selectedEntityData || selectedEntityData.documentAppearances.length < 3) return null;
    const positions = selectedEntityData.documentAppearances.map(app => app.relativePosition).filter(pos => !isNaN(pos));
    if (positions.length < 2) return null;
    const trend = positions[positions.length - 1] - positions[0];
    return {
      pattern: Math.abs(trend) > 0.3 ? (trend > 0 ? 'moving-later' : 'moving-earlier') : 'stable-position',
      avgPosition: positions.reduce((sum, pos) => sum + pos, 0) / positions.length,
      positionRange: Math.max(...positions) - Math.min(...positions)
    };
  }, [selectedEntityData]);

  if (!entities || entities.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TrackChanges color="primary" />
            <Typography variant="h6">Cross-Document Entity Tracker</Typography>
          </Box>
          <Alert severity="info">
            No entity data available for cross-document tracking.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (trackingData.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TrackChanges color="primary" />
            <Typography variant="h6">Cross-Document Entity Tracker</Typography>
          </Box>
          <Alert severity="warning">
            No entities found that appear across multiple documents. This feature requires entities that appear in at least 2 documents or have 3+ total occurrences.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrackChanges color="primary" />
          <Typography variant="h6">
            Cross-Document Entity Tracker
          </Typography>
          <Chip 
            label={`${trackingData.length} tracked entities`}
            size="small" 
            color="primary" 
          />
          <IconButton size="small" onClick={() => setShowExplanation(!showExplanation)}>
            <Info />
          </IconButton>
        </Box>

        <Collapse in={showExplanation}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>How Cross-Document Tracking is Computed:</strong>
              <br />
              1. <strong>Entity Normalization:</strong> Groups similar entities (e.g., "Apple Inc." + "Apple")
              <br />
              2. <strong>Document Spread:</strong> Number of documents containing the entity
              <br />
              3. <strong>Consistency Score:</strong> 1 / (1 + √variance) - how evenly distributed across documents
              <br />
              4. <strong>Mobility Score:</strong> √variance of relative positions within documents
              <br />
              5. <strong>Persistence Pattern:</strong> Growing/declining/stable/sporadic based on frequency changes
              <br />
              6. <strong>Context Diversity:</strong> Number of different entity types it appears with
              <br />
              <br />
              <strong>Use Case:</strong> Track how entities evolve, move, and maintain presence across your corpus
            </Typography>
          </Alert>
        </Collapse>

        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <MenuItem value="spread">Document Spread</MenuItem>
              <MenuItem value="consistency">Consistency</MenuItem>
              <MenuItem value="mobility">Mobility</MenuItem>
              <MenuItem value="occurrences">Total Occurrences</MenuItem>
              <MenuItem value="persistence">Context Diversity</MenuItem>
            </Select>
          </FormControl>

          <Autocomplete
            size="small"
            sx={{ minWidth: 250 }}
            options={trackingData.map(data => data.entity)}
            value={selectedEntity}
            onChange={(event, newValue) => setSelectedEntity(newValue || '')}
            renderInput={(params) => (
              <TextField {...params} label="Select Entity to Track" />
            )}
          />
        </Box>

        {/* Selected Entity Visualization */}
        {selectedEntityData && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Entity Evolution: "{selectedEntity}"
            </Typography>
            
            <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip 
                label={`${selectedEntityData.documentSpread} documents`}
                size="small"
                color="primary"
              />
              <Chip 
                label={`${selectedEntityData.totalOccurrences} total occurrences`}
                size="small"
                color="secondary"
              />
              <Chip 
                label={`${(selectedEntityData.consistencyScore * 100).toFixed(0)}% consistency`}
                size="small"
                color="success"
                variant="outlined"
              />
              <Chip 
                label={`${selectedEntityData.persistencePattern} pattern`}
                size="small"
                color={
                  selectedEntityData.persistencePattern === 'growing' ? 'success' :
                  selectedEntityData.persistencePattern === 'declining' ? 'error' :
                  selectedEntityData.persistencePattern === 'sporadic' ? 'warning' : 'info'
                }
                variant="outlined"
              />
            </Box>

            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="document" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <Box sx={{ bgcolor: 'background.paper', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant="subtitle2">
                              {data.fullDocId.substring(0, 30)}...
                            </Typography>
                            <Typography variant="body2">
                              Occurrences: {data.occurrences}
                            </Typography>
                            <Typography variant="body2">
                              Avg Confidence: {data.confidence.toFixed(1)}%
                            </Typography>
                            <Typography variant="body2">
                              Relative Position: {data.relativePosition.toFixed(1)}% through document
                            </Typography>
                            {mobilityPattern && (
                              <Typography variant="body2" color="primary.main">
                                Mobility Pattern: {mobilityPattern.pattern.replace('-', ' ')}
                              </Typography>
                            )}
                          </Box>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar yAxisId="left" dataKey="occurrences" fill="#8884d8" name="Occurrences" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Mobility Analysis */}
            {mobilityPattern && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Mobility Analysis
                </Typography>
                <Typography variant="body2">
                  <strong>Position Pattern:</strong> {mobilityPattern.pattern.replace('-', ' ')}
                </Typography>
                <Typography variant="body2">
                  <strong>Average Position:</strong> {(mobilityPattern.avgPosition * 100).toFixed(1)}% through documents
                </Typography>
                <Typography variant="body2">
                  <strong>Position Variance:</strong> {(mobilityPattern.positionRange * 100).toFixed(1)}% range
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Entity Tracking Table */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Entity Tracking Overview
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Entity</TableCell>
                  <TableCell align="right">Documents</TableCell>
                  <TableCell align="right">Total Count</TableCell>
                  <TableCell align="right">Consistency</TableCell>
                  <TableCell align="right">Mobility</TableCell>
                  <TableCell align="right">Pattern</TableCell>
                  <TableCell align="right">Context Diversity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trackingData.slice(0, 20).map((data, index) => (
                  <TableRow 
                    key={index}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedEntity(data.entity)}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {data.entity.length > 30 ? data.entity.substring(0, 30) + '...' : data.entity}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={data.documentSpread}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">{data.totalOccurrences}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={data.consistencyScore * 100}
                          sx={{ width: 50, height: 4 }}
                          color="success"
                        />
                        <Typography variant="caption">
                          {(data.consistencyScore * 100).toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={data.mobilityScore * 100}
                          sx={{ width: 50, height: 4 }}
                          color="warning"
                        />
                        <Typography variant="caption">
                          {(data.mobilityScore * 100).toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={data.persistencePattern}
                        size="small"
                        color={
                          data.persistencePattern === 'growing' ? 'success' :
                          data.persistencePattern === 'declining' ? 'error' :
                          data.persistencePattern === 'sporadic' ? 'warning' : 'info'
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {(data.contextDiversity * 100).toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Document Navigation for Selected Entity */}
        {selectedEntityData && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Documents containing "{selectedEntity}" (click to view)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {selectedEntityData.documentAppearances.map((appearance, index) => (
                <Chip
                  key={index}
                  label={`${appearance.documentId.substring(0, 15)}... (${appearance.count}x)`}
                  size="small"
                  onClick={() => onDocumentClick(appearance.documentId)}
                  color="primary"
                  variant="outlined"
                  clickable
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(CrossDocumentEntityTracker);