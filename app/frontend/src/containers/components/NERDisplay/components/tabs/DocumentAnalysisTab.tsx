import React, { useMemo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Alert
} from '@mui/material';
import { Analytics, Psychology, Warning } from '@mui/icons-material';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import DocumentLink from '../DocumentLink';

interface DocumentAnalysisTabProps {
  stats: any;
  onDocumentClick: (documentId: string) => void;
}

/**
 * DocumentAnalysisTab component visualizes document-level NER analytics
 * including entity counts, diversity, and anomaly detection.
 * 
 * Displays a scatter plot of entity count vs unique entity diversity,
 * a ranked list of high-quality documents by diversity, and
 * anomaly detection cards for documents with unusual entity patterns.
 */
const DocumentAnalysisTab: React.FC<DocumentAnalysisTabProps> = ({
  stats,
  onDocumentClick
}) => {
  /**
   * Memoize processed document stats data for rendering charts and lists.
   * Calculates diversity percentage and categorizes it as High, Medium, or Low.
   */
  const documentStatsData = useMemo(() => {
    if (!stats?.documentStats) return [];
    
    return stats.documentStats
      .map((doc: any, index: number) => ({
        index: index + 1,
        docId: doc.documentId.substring(0, 12) + '...',
        fullDocId: doc.documentId,
        entityCount: doc.entityCount,
        uniqueCount: doc.uniqueEntityCount,
        avgConfidence: parseFloat((doc.averageConfidence * 100).toFixed(1)),
        diversity: parseFloat(((doc.uniqueEntityCount / Math.max(doc.entityCount, 1)) * 100).toFixed(1)),
        diversityLevel: ((doc.uniqueEntityCount / Math.max(doc.entityCount, 1)) * 100) > 80 ? 'High' :
                       ((doc.uniqueEntityCount / Math.max(doc.entityCount, 1)) * 100) > 60 ? 'Medium' : 'Low'
      }))
      .sort((a: any, b: any) => b.diversity - a.diversity)
      .slice(0, 100);
  }, [stats]);

  return (
    <Grid container spacing={3}>
      {/* Document Analysis Scatter Plot: Entity Count vs Diversity */}
      <Grid item xs={12} lg={8}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h6">
                Document Analysis: Entity Count vs Diversity
              </Typography>
              <Chip 
                label="Normalized analysis" 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Click on any point to view the document details. Diversity based on normalized entities.
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart data={documentStatsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="entityCount" name="Entity Count" />
                <YAxis dataKey="uniqueCount" name="Unique Entities" />
                <RechartsTooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <Box sx={{ bgcolor: 'background.paper', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {data.fullDocId}
                          </Typography>
                          <Typography variant="body2">
                            Total Entities: {data.entityCount}
                          </Typography>
                          <Typography variant="body2">
                            Unique Entities: {data.uniqueCount} (normalized)
                          </Typography>
                          <Typography variant="body2">
                            Avg Confidence: {data.avgConfidence}%
                          </Typography>
                          <Typography variant="body2">
                            Diversity: {data.diversity}% ({data.diversityLevel})
                          </Typography>
                          <Typography variant="caption" color="primary.main">
                            Click to view document
                          </Typography>
                          <br />
                          <Typography variant="caption" color="success.main">
                            ✓ Quality filtered analysis
                          </Typography>
                        </Box>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter 
                  dataKey="uniqueCount" 
                  fill="#8884d8"
                  onClick={(data) => {
                    if (data && data.fullDocId) {
                      onDocumentClick(data.fullDocId);
                    }
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Top Documents by Diversity */}
      <Grid item xs={12} lg={4}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h6">
                High-Quality Documents
              </Typography>
              <Chip 
                label="Diversity ranked" 
                size="small" 
                color="success" 
                variant="outlined"
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Documents ranked by entity diversity. Click document IDs to view details.
            </Typography>
            <List>
              {documentStatsData.slice(0, 10).map((doc: any, index: number) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <DocumentLink 
                          documentId={doc.fullDocId}
                          onDocumentClick={onDocumentClick}
                        >
                          {doc.docId}
                        </DocumentLink>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Chip 
                            label={doc.entityCount} 
                            size="small" 
                            color="primary" 
                          />
                          <Chip 
                            label={`${doc.diversity}%`} 
                            size="small" 
                            color={doc.diversityLevel === 'High' ? 'success' : doc.diversityLevel === 'Medium' ? 'warning' : 'error'} 
                          />
                        </Box>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption">
                          Unique: {doc.uniqueCount}, Conf: {doc.avgConfidence}%, Quality: {doc.diversityLevel}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="success.main">
                          ✓ Normalized entity analysis
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Anomaly Detection */}
      {stats?.anomalyScores?.length > 0 && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Psychology color="warning" />
                <Typography variant="h6">
                  Anomaly Detection
                </Typography>
                <Chip 
                  label="Enhanced" 
                  size="small"
                  color="warning" 
                  variant="outlined"
                />
              </Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Documents with unusual normalized entity patterns that may require attention. Analysis based on quality-filtered entities.
              </Alert>
              <Grid container spacing={2}>
                {stats.anomalyScores.slice(0, 8).map((anomaly: any, index: number) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <Card variant="outlined" sx={{ 
                      borderColor: 'warning.main',
                      height: '100%'
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        <DocumentLink 
                          documentId={anomaly.documentId}
                          onDocumentClick={onDocumentClick}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {anomaly.documentId.substring(0, 15) + '...'}
                          </Typography>
                        </DocumentLink>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Anomaly Score
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={anomaly.score * 100} 
                            color="warning"
                            sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {anomaly.reason}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" color="success.main">
                            ✓ Quality filtered
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};

export default React.memo(DocumentAnalysisTab);