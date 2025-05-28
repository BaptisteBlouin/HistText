// app/frontend/src/containers/components/NERDisplay/NERInsights.tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  useTheme,
  IconButton,
  Collapse,
  Alert,
  LinearProgress,
  Tooltip,
  Button
} from '@mui/material';
import {
  TrendingUp,
  Psychology,
  NetworkCheck,
  Timeline,
  ExpandMore,
  ExpandLess,
  Insights,
  Analytics,
  Hub,
  Assessment,
  Info
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import { useNERStatistics } from './hooks/useNERStatistics';

// Color palette for charts
const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
  '#0088fe', '#00c49f', '#ffbb28', '#ff8042', '#8dd1e1',
  '#d084d0', '#87d068', '#ffb347', '#deb887', '#5f9ea0'
];

interface NERInsightsProps {
  nerData: Record<string, any>;
  selectedAlias: string;
  onDocumentClick?: (documentId: string) => void; // NEW: For document modal
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const NERInsights: React.FC<NERInsightsProps> = ({ 
  nerData, 
  selectedAlias, 
  onDocumentClick 
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const stats = useNERStatistics(nerData);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Handle document click
  const handleDocumentClick = useCallback((documentId: string) => {
    if (onDocumentClick) {
      onDocumentClick(documentId);
    }
  }, [onDocumentClick]);

  // Create clickable document component
  const DocumentLink: React.FC<{ documentId: string; children: React.ReactNode }> = ({ 
    documentId, 
    children 
  }) => (
    <Box
      component="span"
      onClick={() => handleDocumentClick(documentId)}
      sx={{
        cursor: 'pointer',
        color: 'primary.main',
        textDecoration: 'underline',
        fontWeight: 'bold',
        '&:hover': {
          backgroundColor: 'primary.light',
          color: 'primary.contrastText',
          borderRadius: 1,
          padding: '2px 4px'
        }
      }}
    >
      {children}
    </Box>
  );

  // Prepare chart data
  const topEntitiesChartData = useMemo(() => 
    stats?.topEntities.slice(0, 15).map(entity => ({
      name: entity.text.length > 20 ? entity.text.substring(0, 20) + '...' : entity.text,
      fullName: entity.text,
      count: entity.count,
      documents: entity.documents,
      frequency: (entity.frequency * 100).toFixed(2)
    })) || []
  , [stats]);

  const entityTypeDistribution = useMemo(() => {
    if (!stats) return [];
    
    return Object.entries(stats.topEntitiesByType).map(([type, entities]) => ({
      name: type,
      value: entities.reduce((sum, entity) => sum + entity.count, 0),
      entities: entities.length
    })).slice(0, 10);
  }, [stats]);

  const confidenceDistributionData = useMemo(() =>
    stats?.confidenceDistribution.map(item => ({
      range: item.range,
      count: item.count,
      percentage: parseFloat(item.percentage.toFixed(1))
    })) || []
  , [stats]);

  // FIXED: Better cooccurrence display
  const cooccurrenceNetworkData = useMemo(() => {
    if (!stats) return [];
    
    return stats.strongestPairs.slice(0, 15).map(pair => ({
      name: `${pair.entity1} ↔ ${pair.entity2}`,
      entity1: pair.entity1,
      entity2: pair.entity2,
      strength: parseFloat(pair.strength.toFixed(2)),
      count: pair.count,
      documents: pair.documents.length,
      avgDistance: pair.avgDistance ? Math.round(pair.avgDistance) : 'N/A',
      proximityScore: pair.proximityScore ? parseFloat(pair.proximityScore.toFixed(2)) : 0
    }));
  }, [stats]);

  // FIXED: Ordered document stats data
  const documentStatsData = useMemo(() => {
    if (!stats) return [];
    
    return stats.documentStats
      .map((doc, index) => ({
        index: index + 1,
        docId: doc.documentId.substring(0, 12) + '...',
        fullDocId: doc.documentId,
        entityCount: doc.entityCount,
        uniqueCount: doc.uniqueEntityCount,
        avgConfidence: parseFloat((doc.averageConfidence * 100).toFixed(1)),
        diversity: parseFloat(((doc.uniqueEntityCount / Math.max(doc.entityCount, 1)) * 100).toFixed(1))
      }))
      .sort((a, b) => a.entityCount - b.entityCount) // Order by entity count
      .slice(0, 100); // Limit for performance
  }, [stats]);

  if (!stats) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        <Typography variant="body2">
          No NER data available for analysis. Run a query with NER enabled to see insights.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Insights color="primary" />
          NER Advanced Analytics
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Deep insights and statistical analysis of named entities from {selectedAlias}
        </Typography>
      </Box>

      {/* Key Metrics Overview */}
      <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {stats.totalEntities.toLocaleString()}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Total Entities
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {stats.averageEntitiesPerDocument.toFixed(1)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Avg Entities/Doc
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {(stats.uniqueEntitiesRatio * 100).toFixed(1)}%
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Unique Entities
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {Object.keys(stats.topEntitiesByType).length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Entity Types
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs for different analysis views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab icon={<TrendingUp />} label="Top Entities" />
          <Tab icon={<Hub />} label="Relationships" />
          <Tab icon={<Assessment />} label="Distribution" />
          <Tab icon={<Analytics />} label="Document Analysis" />
          <Tab icon={<Psychology />} label="Patterns" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          {/* Top Entities Bar Chart */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUp color="primary" />
                  Most Frequent Entities
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topEntitiesChartData}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis 
                     dataKey="name" 
                     angle={-45}
                     textAnchor="end"
                     height={100}
                     fontSize={12}
                   />
                   <YAxis />
                   <RechartsTooltip 
                     formatter={(value, name) => [value, name === 'count' ? 'Occurrences' : name]}
                     labelFormatter={(label) => {
                       const item = topEntitiesChartData.find(d => d.name === label);
                       return item ? item.fullName : label;
                     }}
                     content={({ active, payload }) => {
                       if (active && payload && payload.length) {
                         const data = payload[0].payload;
                         return (
                           <Box sx={{ bgcolor: 'background.paper', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                             <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                               {data.fullName}
                             </Typography>
                             <Typography variant="body2">
                               Occurrences: {data.count}
                             </Typography>
                             <Typography variant="body2">
                               Documents: {data.documents}
                             </Typography>
                             <Typography variant="body2">
                               Frequency: {data.frequency}%
                             </Typography>
                           </Box>
                         );
                       }
                       return null;
                     }}
                   />
                   <Bar dataKey="count" fill="#8884d8" />
                 </BarChart>
               </ResponsiveContainer>
             </CardContent>
           </Card>
         </Grid>

         {/* Entity Types Pie Chart */}
         <Grid item xs={12} lg={4}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Entity Types Distribution
               </Typography>
               <ResponsiveContainer width="100%" height={400}>
                 <PieChart>
                   <Pie
                     data={entityTypeDistribution}
                     dataKey="value"
                     nameKey="name"
                     cx="50%"
                     cy="50%"
                     outerRadius={120}
                     fill="#8884d8"
                     label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                   >
                     {entityTypeDistribution.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <RechartsTooltip 
                     formatter={(value, name) => [`${value} entities`, 'Count']}
                   />
                 </PieChart>
               </ResponsiveContainer>
             </CardContent>
           </Card>
         </Grid>

         {/* FIXED: Top Entities by Type */}
         <Grid item xs={12}>
           <Card>
             <CardContent>
               <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                 <Typography variant="h6">
                   Top Entities by Type
                 </Typography>
                 <IconButton onClick={() => toggleSection('entityTypes')}>
                   {expandedSections.has('entityTypes') ? <ExpandLess /> : <ExpandMore />}
                 </IconButton>
               </Box>
               <Collapse in={expandedSections.has('entityTypes')}>
                 <Grid container spacing={2}>
                   {Object.entries(stats.topEntitiesByType).map(([type, entities]) => (
                     <Grid item xs={12} md={6} lg={4} key={type}>
                       <Card variant="outlined">
                         <CardContent sx={{ p: 2 }}>
                           <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                             {type}
                           </Typography>
                           <List dense>
                             {entities.slice(0, 5).map((entity, index) => (
                               <ListItem key={index} sx={{ px: 0 }}>
                                 <ListItemText
                                   primary={
                                     <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                       <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                         {entity.text.length > 25 ? entity.text.substring(0, 25) + '...' : entity.text}
                                       </Typography>
                                       <Chip 
                                         label={entity.count} 
                                         size="small" 
                                         color="primary" 
                                         variant="outlined" 
                                       />
                                     </Box>
                                   }
                                   secondary={`${entity.documents} documents`}
                                 />
                               </ListItem>
                             ))}
                           </List>
                         </CardContent>
                       </Card>
                     </Grid>
                   ))}
                 </Grid>
               </Collapse>
             </CardContent>
           </Card>
         </Grid>
       </Grid>
     </TabPanel>

     <TabPanel value={activeTab} index={1}>
       <Grid container spacing={3}>
         {/* FIXED: Entity Cooccurrence Network */}
         <Grid item xs={12} lg={8}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                 <NetworkCheck color="primary" />
                 Entity Relationships (Cooccurrence)
               </Typography>
               <Alert severity="info" sx={{ mb: 2 }}>
                 <Typography variant="body2">
                   <strong>Statistical Significance:</strong> Shows entity pairs that appear together more often than expected by random chance.
                   <br />
                   <strong>Proximity Score:</strong> Higher scores indicate entities that not only co-occur but also appear close to each other in the text.
                 </Typography>
               </Alert>
               <ResponsiveContainer width="100%" height={450}>
                 <BarChart data={cooccurrenceNetworkData} layout="vertical">
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis type="number" />
                   <YAxis 
                     type="category" 
                     dataKey="name" 
                     width={200}
                     fontSize={10}
                   />
                   <RechartsTooltip 
                     content={({ active, payload }) => {
                       if (active && payload && payload.length) {
                         const data = payload[0].payload;
                         return (
                           <Box sx={{ bgcolor: 'background.paper', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                             <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                               {data.entity1} ↔ {data.entity2}
                             </Typography>
                             <Typography variant="body2">
                               Cooccurrences: {data.count}
                             </Typography>
                             <Typography variant="body2">
                               Documents: {data.documents}
                             </Typography>
                             <Typography variant="body2">
                               Statistical Strength: {data.strength}x expected
                             </Typography>
                             <Typography variant="body2">
                               Avg Distance: {data.avgDistance} characters
                             </Typography>
                             <Typography variant="body2">
                               Proximity Score: {data.proximityScore}
                             </Typography>
                           </Box>
                         );
                       }
                       return null;
                     }}
                   />
                   <Bar dataKey="proximityScore" fill="#82ca9d" />
                 </BarChart>
               </ResponsiveContainer>
             </CardContent>
           </Card>
         </Grid>

         {/* Centrality Scores */}
         <Grid item xs={12} lg={4}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Most Connected Entities
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Entities with the most relationships
               </Typography>
               <List>
                 {stats.centralityScores.slice(0, 10).map((entity, index) => (
                   <ListItem key={index} sx={{ px: 0 }}>
                     <ListItemText
                       primary={
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <Typography variant="body2" sx={{ fontWeight: 500 }}>
                             {entity.entity}
                           </Typography>
                           <Chip 
                             label={entity.connections} 
                             size="small" 
                             color="secondary" 
                           />
                         </Box>
                       }
                       secondary={
                         <LinearProgress 
                           variant="determinate" 
                           value={entity.score * 100} 
                           sx={{ mt: 0.5 }}
                         />
                       }
                     />
                   </ListItem>
                 ))}
               </List>
             </CardContent>
           </Card>
         </Grid>

         {/* FIXED: Strongest Entity Pairs with explanation */}
         <Grid item xs={12}>
           <Card>
             <CardContent>
               <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                 <Typography variant="h6">
                   Strongest Entity Pairs
                 </Typography>
                 <Tooltip title="Click for detailed explanation">
                   <IconButton 
                     size="small" 
                     onClick={() => toggleSection('cooccurrenceExplanation')}
                   >
                     <Info />
                   </IconButton>
                 </Tooltip>
               </Box>
               
               <Collapse in={expandedSections.has('cooccurrenceExplanation')}>
                 <Alert severity="info" sx={{ mb: 2 }}>
                   <Typography variant="body2" sx={{ mb: 1 }}>
                     <strong>How we measure "stronger than expected by chance":</strong>
                   </Typography>
                   <Typography variant="body2" component="div">
                     • <strong>Expected frequency:</strong> If entities appeared randomly, how often would they co-occur?
                     <br />
                     • <strong>Actual frequency:</strong> How often do they actually appear together?
                     <br />
                     • <strong>Statistical strength:</strong> Actual ÷ Expected (higher = more significant)
                     <br />
                     • <strong>Proximity bonus:</strong> Entities appearing closer together get higher scores
                     <br />
                     • <strong>Example:</strong> If "Apple" and "iPhone" appear together 50 times, but would only be expected to co-occur 10 times by chance, the strength is 5.0x
                   </Typography>
                 </Alert>
               </Collapse>

               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Entity pairs that appear together more often than expected by chance, with proximity weighting
               </Typography>
               <Grid container spacing={2}>
                 {stats.strongestPairs.slice(0, 12).map((pair, index) => (
                   <Grid item xs={12} sm={6} md={4} key={index}>
                     <Card variant="outlined" sx={{ height: '100%' }}>
                       <CardContent sx={{ p: 2 }}>
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                           <Chip label={pair.entity1} size="small" color="primary" />
                           <Typography variant="body2">↔</Typography>
                           <Chip label={pair.entity2} size="small" color="secondary" />
                         </Box>
                         <Typography variant="body2" color="text.secondary">
                           Cooccurrences: {pair.count}
                         </Typography>
                         <Typography variant="body2" color="text.secondary">
                           Documents: {pair.documents.length}
                         </Typography>
                         <Typography variant="body2" color="text.secondary">
                           Statistical Strength: {pair.strength.toFixed(2)}x expected
                         </Typography>
                         <Typography variant="body2" color="text.secondary">
                           Avg Distance: {pair.avgDistance ? Math.round(pair.avgDistance) : 'N/A'} chars
                         </Typography>
                         <Typography variant="body2" color="primary.main" sx={{ fontWeight: 'bold' }}>
                           Proximity Score: {pair.proximityScore?.toFixed(2) || 'N/A'}
                         </Typography>
                       </CardContent>
                     </Card>
                   </Grid>
                 ))}
               </Grid>
             </CardContent>
           </Card>
         </Grid>
       </Grid>
     </TabPanel>

     <TabPanel value={activeTab} index={2}>
       <Grid container spacing={3}>
         {/* Confidence Distribution */}
         <Grid item xs={12} lg={6}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Confidence Score Distribution
               </Typography>
               <ResponsiveContainer width="100%" height={300}>
                 <BarChart data={confidenceDistributionData}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="range" />
                   <YAxis />
                   <RechartsTooltip 
                     formatter={(value, name) => [
                       name === 'count' ? `${value} entities` : `${value}%`,
                       name === 'count' ? 'Count' : 'Percentage'
                     ]}
                   />
                   <Bar dataKey="count" fill="#ffc658" />
                 </BarChart>
               </ResponsiveContainer>
             </CardContent>
           </Card>
         </Grid>

         {/* Entity Length Distribution */}
         <Grid item xs={12} lg={6}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Entity Length Distribution
               </Typography>
               <ResponsiveContainer width="100%" height={300}>
                 <LineChart data={stats.entityLengthDistribution.slice(0, 20)}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="length" />
                   <YAxis />
                   <RechartsTooltip 
                     formatter={(value, name) => [
                       name === 'count' ? `${value} entities` : `${value}%`,
                       name === 'count' ? 'Count' : 'Percentage'
                     ]}
                   />
                   <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                 </LineChart>
               </ResponsiveContainer>
             </CardContent>
           </Card>
         </Grid>

         {/* FIXED: Document Entity Diversity with clickable IDs */}
         <Grid item xs={12}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Document Entity Diversity
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Documents with highest entity diversity (unique entities / total entities). Click document IDs to view details.
               </Typography>
               <List>
                 {stats.documentsWithHighestDiversity.slice(0, 10).map((doc, index) => (
                   <ListItem key={index} sx={{ px: 0 }}>
                     <ListItemText
                       primary={
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <DocumentLink documentId={doc.documentId}>
                             {doc.documentId.substring(0, 20) + '...'}
                           </DocumentLink>
                           <Chip 
                             label={`${((doc.uniqueEntityCount / Math.max(doc.entityCount, 1)) * 100).toFixed(0)}%`}
                             size="small" 
                             color="info" 
                           />
                         </Box>
                       }
                       secondary={`${doc.uniqueEntityCount} unique / ${doc.entityCount} total entities`}
                     />
                   </ListItem>
                 ))}
               </List>
             </CardContent>
           </Card>
         </Grid>
       </Grid>
     </TabPanel>

     <TabPanel value={activeTab} index={3}>
       <Grid container spacing={3}>
         {/* FIXED: Document Statistics Scatter Plot with ordered X-axis and clickable points */}
         <Grid item xs={12} lg={8}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Document Analysis: Entity Count vs Diversity
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Click on any point to view the document details
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
                               Unique Entities: {data.uniqueCount}
                             </Typography>
                             <Typography variant="body2">
                               Avg Confidence: {data.avgConfidence}%
                             </Typography>
                             <Typography variant="body2">
                               Diversity: {data.diversity}%
                             </Typography>
                             <Typography variant="caption" color="primary.main">
                               Click to view document
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
                         handleDocumentClick(data.fullDocId);
                       }
                     }}
                   />
                 </ScatterChart>
               </ResponsiveContainer>
             </CardContent>
           </Card>
         </Grid>

         {/* FIXED: Top Documents by Entity Count with clickable IDs */}
         <Grid item xs={12} lg={4}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Documents with Most Entities
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Click document IDs to view details
               </Typography>
               <List>
                 {stats.documentsWithMostEntities.slice(0, 10).map((doc, index) => (
                   <ListItem key={index} sx={{ px: 0 }}>
                     <ListItemText
                       primary={
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <DocumentLink documentId={doc.documentId}>
                             {doc.documentId.substring(0, 15) + '...'}
                           </DocumentLink>
                           <Chip 
                             label={doc.entityCount} 
                             size="small" 
                             color="primary" 
                           />
                         </Box>
                       }
                       secondary={`Unique: ${doc.uniqueEntityCount}, Conf: ${(doc.averageConfidence * 100).toFixed(0)}%`}
                     />
                   </ListItem>
                 ))}
               </List>
             </CardContent>
           </Card>
         </Grid>

         {/* FIXED: Anomaly Detection with clickable document IDs */}
         {stats.anomalyScores.length > 0 && (
           <Grid item xs={12}>
             <Card>
               <CardContent>
                 <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                   <Psychology color="warning" />
                   Anomaly Detection
                 </Typography>
                 <Alert severity="warning" sx={{ mb: 2 }}>
                   Documents with unusual entity patterns that may require attention. Click document IDs to investigate.
                 </Alert>
                 <Grid container spacing={2}>
                   {stats.anomalyScores.slice(0, 8).map((anomaly, index) => (
                     <Grid item xs={12} sm={6} md={3} key={index}>
                       <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
                         <CardContent sx={{ p: 2 }}>
                           <DocumentLink documentId={anomaly.documentId}>
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
                               sx={{ mt: 0.5 }}
                             />
                           </Box>
                           <Typography variant="caption" color="text.secondary">
                             {anomaly.reason}
                           </Typography>
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
     </TabPanel>

     <TabPanel value={activeTab} index={4}>
       <Grid container spacing={3}>
         {/* Common Entity Patterns */}
         <Grid item xs={12} lg={6}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Common Entity Bigram Patterns
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Pairs of entities that frequently appear together in sequence
               </Typography>
               <List>
                 {stats.bigramPatterns.slice(0, 10).map((pattern, index) => (
                   <ListItem key={index} sx={{ px: 0 }}>
                     <ListItemText
                       primary={
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <Typography variant="body2" sx={{ fontWeight: 500 }}>
                             {pattern.pattern}
                           </Typography>
                           <Chip 
                             label={pattern.count} 
                             size="small" 
                             color="primary" 
                           />
                         </Box>
                       }
                       secondary={`Found in ${pattern.documents.length} documents`}
                     />
                   </ListItem>
                 ))}
               </List>
             </CardContent>
           </Card>
         </Grid>

         {/* Trigram Patterns */}
         <Grid item xs={12} lg={6}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Entity Trigram Patterns
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Three-entity sequences that commonly occur together
               </Typography>
               <List>
                 {stats.trigramPatterns.slice(0, 8).map((pattern, index) => (
                   <ListItem key={index} sx={{ px: 0 }}>
                     <ListItemText
                       primary={
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                             {pattern.pattern}
                           </Typography>
                           <Chip 
                             label={pattern.count} 
                             size="small" 
                             color="secondary" 
                           />
                         </Box>
                       }
                       secondary={`Found in ${pattern.documents.length} documents`}
                     />
                   </ListItem>
                 ))}
               </List>
             </CardContent>
           </Card>
         </Grid>

         {/* NEW: Quadrigram Patterns */}
         <Grid item xs={12}>
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 Complex Entity Patterns (Quadrigrams)
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Four-entity sequences showing complex relationships and narrative structures
               </Typography>
               <List>
                 {stats.quadrigramPatterns.slice(0, 6).map((pattern, index) => (
                   <ListItem key={index} sx={{ px: 0 }}>
                     <ListItemText
                       primary={
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                             {pattern.pattern}
                           </Typography>
                           <Chip 
                             label={pattern.count} 
                             size="small" 
                             color="success" 
                           />
                         </Box>
                       }
                       secondary={`Found in ${pattern.documents.length} documents`}
                     />
                   </ListItem>
                 ))}
               </List>
             </CardContent>
           </Card>
         </Grid>
        <Grid item xs={12}>
        <Card>
            <CardContent>
            <Typography variant="h6" gutterBottom>
                Pattern Analysis Summary
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary.main">
                        {stats.bigramPatterns.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Unique Bigram Patterns
                    </Typography>
                    </CardContent>
                </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="secondary.main">
                        {stats.trigramPatterns.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Unique Trigram Patterns
                    </Typography>
                    </CardContent>
                </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                        {stats.quadrigramPatterns.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Unique Quadrigram Patterns
                    </Typography>
                    </CardContent>
                </Card>
                </Grid>
            </Grid>
            <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
                <strong>Note:</strong> Patterns exclude repeated entities to focus on meaningful relationships 
                between distinct entities (e.g., "Apple → iPhone → Store" but not "Apple → Apple → iPhone").
            </Typography>
            </Alert>
            </CardContent>
        </Card>
        </Grid>
       </Grid>
     </TabPanel>
   </Box>
 );
};

export default React.memo(NERInsights);