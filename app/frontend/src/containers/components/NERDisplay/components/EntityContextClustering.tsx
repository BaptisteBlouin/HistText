// app/frontend/src/containers/components/NERDisplay/components/EntityContextClustering.tsx
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
  Grid,
  List,
  ListItem,
  ListItemText,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Collapse
} from '@mui/material';
import { Psychology, Group, ExpandMore, Info, Analytics, Hub } from '@mui/icons-material';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface EntityCluster {
  id: number;
  entities: string[];
  commonDocuments: string[];
  avgCooccurrenceStrength: number;
  cohesionScore: number;
  size: number;
  representative: string;
  clusterType: 'cooccurrence' | 'document' | 'semantic';
  internalConnections: number;
  externalConnections: number;
  isolationScore: number;
  diversityIndex: number;
}

interface EntityContextClusteringProps {
  stats: any;
  onDocumentClick: (documentId: string) => void;
}

const EntityContextClustering: React.FC<EntityContextClusteringProps> = ({
  stats,
  onDocumentClick
}) => {
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [clusteringMethod, setClusteringMethod] = useState<'cooccurrence' | 'document' | 'hybrid'>('hybrid');
  const [showExplanation, setShowExplanation] = useState(false);

  // Compute enhanced entity clusters based on context
  const entityClusters = useMemo((): EntityCluster[] => {
    if (!stats?.strongestPairs || !stats?.topEntitiesByType) return [];

    console.time('Computing entity context clusters');
    
    // Build entity-to-entity relationships map
    const entityConnections = new Map<string, Set<string>>();
    const entityStrengths = new Map<string, Map<string, number>>();
    
    stats.strongestPairs.forEach((pair: any) => {
      const entity1 = pair.entity1;
      const entity2 = pair.entity2;
      
      if (!entityConnections.has(entity1)) {
        entityConnections.set(entity1, new Set());
        entityStrengths.set(entity1, new Map());
      }
      if (!entityConnections.has(entity2)) {
        entityConnections.set(entity2, new Set());
        entityStrengths.set(entity2, new Map());
      }
      
      entityConnections.get(entity1)!.add(entity2);
      entityConnections.get(entity2)!.add(entity1);
      
      entityStrengths.get(entity1)!.set(entity2, pair.strength || 1);
      entityStrengths.get(entity2)!.set(entity1, pair.strength || 1);
    });

    // Build document-based entity relationships
    const documentEntityMap = new Map<string, Set<string>>();
    if (stats.documentStats) {
      stats.documentStats.forEach((doc: any) => {
        const entities = new Set<string>();
        if (doc.topEntities) {
          doc.topEntities.forEach((entity: any) => {
            entities.add(entity.text);
          });
        }
        documentEntityMap.set(doc.documentId, entities);
      });
    }

    // Get all unique entities
    const allEntities = new Set<string>();
    entityConnections.forEach((connections, entity) => {
      allEntities.add(entity);
      connections.forEach(connected => allEntities.add(connected));
    });

    // Add entities from document stats that might not be in cooccurrences
    if (stats.topEntities) {
      stats.topEntities.forEach((entity: any) => {
        allEntities.add(entity.text);
      });
    }

    const entityArray = Array.from(allEntities);
    const clusters: EntityCluster[] = [];
    const clusteredEntities = new Set<string>();
    let clusterId = 0;

    // Enhanced clustering algorithm: connected components with multiple criteria
    entityArray.forEach(startEntity => {
      if (clusteredEntities.has(startEntity)) return;

      const cluster: string[] = [startEntity];
      const queue = [startEntity];
      clusteredEntities.add(startEntity);
      
      while (queue.length > 0) {
        const currentEntity = queue.shift()!;
        const connections = entityConnections.get(currentEntity) || new Set();
        
        connections.forEach(connectedEntity => {
          if (!clusteredEntities.has(connectedEntity)) {
            const strength = entityStrengths.get(currentEntity)?.get(connectedEntity) || 0;
            
            // Use different thresholds based on clustering method
            let threshold = 1;
            if (clusteringMethod === 'cooccurrence') {
              threshold = 2; // Higher threshold for cooccurrence-only
            } else if (clusteringMethod === 'document') {
              threshold = 0.5; // Lower threshold for document-based
            } else {
              threshold = 1.5; // Medium threshold for hybrid
            }
            
            if (strength >= threshold) {
              cluster.push(connectedEntity);
              queue.push(connectedEntity);
              clusteredEntities.add(connectedEntity);
            }
          }
        });

        // For document-based clustering, also connect entities from same documents
        if (clusteringMethod === 'document' || clusteringMethod === 'hybrid') {
          documentEntityMap.forEach((docEntities, docId) => {
            if (docEntities.has(currentEntity)) {
              docEntities.forEach(docEntity => {
                if (!clusteredEntities.has(docEntity) && docEntity !== currentEntity) {
                  // Additional filter: only add if entities appear together frequently
                  let shouldAdd = false;
                  if (clusteringMethod === 'document') {
                    shouldAdd = true;
                  } else {
                    // Hybrid: check if they appear in multiple documents together
                    let coDocumentCount = 0;
                    documentEntityMap.forEach((otherDocEntities) => {
                      if (otherDocEntities.has(currentEntity) && otherDocEntities.has(docEntity)) {
                        coDocumentCount++;
                      }
                    });
                    shouldAdd = coDocumentCount >= 2; // Must appear together in at least 2 documents
                  }
                  
                  if (shouldAdd) {
                    cluster.push(docEntity);
                    queue.push(docEntity);
                    clusteredEntities.add(docEntity);
                  }
                }
              });
            }
          });
        }
      }

      if (cluster.length > 1) { // Only create clusters with multiple entities
        // Find common documents for this cluster
        const commonDocuments: string[] = [];
        documentEntityMap.forEach((docEntities, docId) => {
          const hasClusterEntities = cluster.some(entity => docEntities.has(entity));
          if (hasClusterEntities) {
            commonDocuments.push(docId);
          }
        });

        // Calculate enhanced metrics
        let totalStrength = 0;
        let connectionCount = 0;
        let internalConnections = 0;
        
        for (let i = 0; i < cluster.length; i++) {
          for (let j = i + 1; j < cluster.length; j++) {
            const strength = entityStrengths.get(cluster[i])?.get(cluster[j]) || 0;
            if (strength > 0) {
              totalStrength += strength;
              internalConnections++;
            }
            connectionCount++;
          }
        }

        const avgCooccurrenceStrength = connectionCount > 0 ? totalStrength / connectionCount : 0;
        
        // Calculate cohesion score (how tightly connected the cluster is)
        const maxPossibleConnections = (cluster.length * (cluster.length - 1)) / 2;
        const cohesionScore = maxPossibleConnections > 0 ? internalConnections / maxPossibleConnections : 0;

        // Calculate external connections (connections to entities outside this cluster)
        let externalConnections = 0;
        cluster.forEach(entity => {
          const connections = entityConnections.get(entity) || new Set();
          connections.forEach(connectedEntity => {
            if (!cluster.includes(connectedEntity)) {
              externalConnections++;
            }
          });
        });

        // Isolation score: internal connections / (internal + external connections)
        const totalConnections = internalConnections + externalConnections;
        const isolationScore = totalConnections > 0 ? internalConnections / totalConnections : 0;

        // Diversity index: How many different entity types are in this cluster
        const entityTypes = new Set<string>();
        cluster.forEach(entity => {
          Object.entries(stats.topEntitiesByType || {}).forEach(([type, entities]: [string, any]) => {
            if (entities.some((e: any) => e.text === entity)) {
              entityTypes.add(type);
            }
          });
        });
        const maxPossibleTypes = Object.keys(stats.topEntitiesByType || {}).length;
        const diversityIndex = maxPossibleTypes > 0 ? entityTypes.size / maxPossibleTypes : 0;

        // Find representative entity (most connected within cluster)
        let representative = cluster[0];
        let maxConnections = 0;
        
        cluster.forEach(entity => {
          const connectionsInCluster = cluster.filter(other => 
            other !== entity && entityConnections.get(entity)?.has(other)
          ).length;
          
          if (connectionsInCluster > maxConnections) {
            maxConnections = connectionsInCluster;
            representative = entity;
          }
        });

        // Determine cluster type
        let clusterType: 'cooccurrence' | 'document' | 'semantic' = 'semantic';
        if (avgCooccurrenceStrength > 3) {
          clusterType = 'cooccurrence';
        } else if (diversityIndex < 0.3) {
          clusterType = 'document';
        }

        clusters.push({
          id: clusterId++,
          entities: cluster,
          commonDocuments,
          avgCooccurrenceStrength,
          cohesionScore,
          size: cluster.length,
          representative,
          clusterType,
          internalConnections,
          externalConnections,
          isolationScore,
          diversityIndex
        });
      }
    });

    console.timeEnd('Computing entity context clusters');
    console.log(`Found ${clusters.length} entity clusters using ${clusteringMethod} method`);
    
    return clusters.sort((a, b) => b.cohesionScore - a.cohesionScore);
  }, [stats, clusteringMethod]);

  // Prepare scatter plot data
  const scatterData = useMemo(() => {
    return entityClusters.map((cluster, index) => ({
      id: cluster.id,
      size: cluster.size,
      cohesion: cluster.cohesionScore * 100,
      isolation: cluster.isolationScore * 100,
      diversity: cluster.diversityIndex * 100,
      representative: cluster.representative,
      type: cluster.clusterType,
      color: cluster.clusterType === 'cooccurrence' ? '#FF6B6B' : 
             cluster.clusterType === 'document' ? '#4ECDC4' : '#45B7D1'
    }));
  }, [entityClusters]);

  // Prepare pie chart data for cluster types
  const clusterTypeData = useMemo(() => {
    const typeCounts = entityClusters.reduce((acc, cluster) => {
      acc[cluster.clusterType] = (acc[cluster.clusterType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: count,
      color: type === 'cooccurrence' ? '#FF6B6B' : 
             type === 'document' ? '#4ECDC4' : '#45B7D1'
    }));
  }, [entityClusters]);

  if (!stats?.strongestPairs || entityClusters.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">Entity Context Clustering</Typography>
          <Alert severity="info">
            Need entity relationship data to perform context clustering analysis.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Psychology color="primary" />
          <Typography variant="h6">
            Entity Context Clustering
          </Typography>
          <Chip 
            label={`${entityClusters.length} clusters found`}
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
              <strong>How Context Clustering is Computed:</strong>
              <br />
              1. <strong>Relationship Graph:</strong> Builds entity connections from cooccurrence data
              <br />
              2. <strong>Document Overlap:</strong> Adds connections for entities in same documents
              <br />
              3. <strong>Connected Components:</strong> Groups entities using graph traversal
              <br />
              4. <strong>Cohesion Score:</strong> Internal connections ÷ Max possible connections
              <br />
              5. <strong>Isolation Score:</strong> Internal ÷ (Internal + External connections)
              <br />
              6. <strong>Diversity Index:</strong> Number of entity types ÷ Total possible types
              <br />
              <br />
              <strong>Cluster Types:</strong> Cooccurrence (strong relationships), Document (same docs), Semantic (mixed)
            </Typography>
          </Alert>
        </Collapse>

        {/* Clustering Method Control */}
        <Box sx={{ mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Clustering Method</InputLabel>
            <Select
              value={clusteringMethod}
              onChange={(e) => setClusteringMethod(e.target.value as any)}
            >
              <MenuItem value="cooccurrence">Cooccurrence Only</MenuItem>
              <MenuItem value="document">Document Based</MenuItem>
              <MenuItem value="hybrid">Hybrid Approach</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Grid container spacing={3}>
          {/* Cluster Analysis Scatter Plot */}
          <Grid item xs={12} md={8}>
            <Typography variant="subtitle2" gutterBottom>
              Cluster Analysis: Size vs Cohesion vs Isolation
            </Typography>
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart data={scatterData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="size" 
                  name="Cluster Size"
                  label={{ value: 'Cluster Size (# entities)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  dataKey="cohesion"
                  name="Cohesion"
                  label={{ value: 'Cohesion Score (%)', angle: -90, position: 'insideLeft' }}
                />
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <Box sx={{ bgcolor: 'background.paper', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="subtitle2">
                            Cluster #{data.id} ({data.type})
                          </Typography>
                          <Typography variant="body2">
                            Representative: {data.representative}
                          </Typography>
                          <Typography variant="body2">
                            Size: {data.size} entities
                          </Typography>
                          <Typography variant="body2">
                            Cohesion: {data.cohesion.toFixed(1)}%
                          </Typography>
                          <Typography variant="body2">
                            Isolation: {data.isolation.toFixed(1)}%
                          </Typography>
                          <Typography variant="body2">
                            Diversity: {data.diversity.toFixed(1)}%
                          </Typography>
                        </Box>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter 
                  dataKey="cohesion" 
                  fill="#8884d8"
                  onClick={(data) => setSelectedCluster(data.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {scatterData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </Grid>
 
          {/* Cluster Type Distribution */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>
              Cluster Type Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={clusterTypeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {clusterTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" display="block" gutterBottom>
                <strong>Cluster Types:</strong>
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#FF6B6B', borderRadius: '50%' }} />
                  <Typography variant="caption">Cooccurrence: Strong entity relationships</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#4ECDC4', borderRadius: '50%' }} />
                  <Typography variant="caption">Document: Same document entities</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#45B7D1', borderRadius: '50%' }} />
                  <Typography variant="caption">Semantic: Mixed contextual grouping</Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
 
        {/* Cluster Details */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Cluster Details
          </Typography>
          {entityClusters.slice(0, 8).map((cluster) => (
            <Accordion 
              key={cluster.id}
              expanded={selectedCluster === cluster.id}
              onChange={() => setSelectedCluster(selectedCluster === cluster.id ? null : cluster.id)}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Box 
                    sx={{ 
                      width: 12, 
                      height: 12, 
                      bgcolor: cluster.clusterType === 'cooccurrence' ? '#FF6B6B' : 
                               cluster.clusterType === 'document' ? '#4ECDC4' : '#45B7D1',
                      borderRadius: '50%' 
                    }} 
                  />
                  <Group />
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Cluster #{cluster.id}: {cluster.representative}
                  </Typography>
                  <Chip 
                    label={`${cluster.size} entities`}
                    size="small"
                    color="primary"
                  />
                  <Chip 
                    label={`${(cluster.cohesionScore * 100).toFixed(0)}% cohesion`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                  <Chip 
                    label={cluster.clusterType}
                    size="small"
                    color={
                      cluster.clusterType === 'cooccurrence' ? 'error' :
                      cluster.clusterType === 'document' ? 'info' : 'success'
                    }
                    variant="outlined"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Entities in Cluster
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {cluster.entities.map((entity, index) => (
                        <Chip
                          key={index}
                          label={entity}
                          size="small"
                          variant={entity === cluster.representative ? 'filled' : 'outlined'}
                          color={entity === cluster.representative ? 'primary' : 'default'}
                        />
                      ))}
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Common Documents ({cluster.commonDocuments.length})
                    </Typography>
                    <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
                      {cluster.commonDocuments.slice(0, 8).map((docId, index) => (
                        <ListItem 
                          key={index}
                          button
                          onClick={() => onDocumentClick(docId)}
                          sx={{ py: 0.5 }}
                        >
                          <ListItemText
                            primary={docId.substring(0, 40) + '...'}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                      {cluster.commonDocuments.length > 8 && (
                        <ListItem>
                          <ListItemText
                            primary={`... and ${cluster.commonDocuments.length - 8} more documents`}
                            primaryTypographyProps={{ variant: 'caption', style: { fontStyle: 'italic' } }}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Cluster Metrics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Cohesion Score:</strong> {(cluster.cohesionScore * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Internal connectivity
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Isolation Score:</strong> {(cluster.isolationScore * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Internal vs external connections
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Diversity Index:</strong> {(cluster.diversityIndex * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Entity type variety
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Avg Cooccurrence:</strong> {cluster.avgCooccurrenceStrength.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Relationship strength
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Internal Links:</strong> {cluster.internalConnections}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Within cluster
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>External Links:</strong> {cluster.externalConnections}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        To other clusters
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Document Reach:</strong> {cluster.commonDocuments.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Documents containing cluster entities
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Cluster Type:</strong> {cluster.clusterType}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Primary clustering basis
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
 
        {/* Clustering Summary */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Clustering Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">
                <strong>Total Clusters:</strong> {entityClusters.length}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">
                <strong>Avg Cluster Size:</strong> {entityClusters.length > 0 
                  ? (entityClusters.reduce((sum, c) => sum + c.size, 0) / entityClusters.length).toFixed(1)
                  : '0'
                }
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">
                <strong>Avg Cohesion:</strong> {entityClusters.length > 0 
                  ? (entityClusters.reduce((sum, c) => sum + c.cohesionScore, 0) / entityClusters.length * 100).toFixed(1) + '%'
                  : '0%'
                }
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">
                <strong>Method Used:</strong> {clusteringMethod.charAt(0).toUpperCase() + clusteringMethod.slice(1)}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
 };
 
 export default React.memo(EntityContextClustering);