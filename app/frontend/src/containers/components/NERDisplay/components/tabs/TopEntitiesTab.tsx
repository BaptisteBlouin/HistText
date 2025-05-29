// app/frontend/src/containers/components/NERDisplay/components/tabs/TopEntitiesTab.tsx
import React, { useMemo } from 'react';
import { Grid, Card, CardContent, Typography, Alert, Box, Chip, Tooltip, IconButton, Collapse } from '@mui/material';
import { TrendingUp, FilterAlt, DataUsage, ExpandMore, ExpandLess } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import TopEntitiesList from '../TopEntitiesList';
import { COLORS } from '../../constants/chart-colors';

interface TopEntitiesTabProps {
  stats: any;
  expandedSections: Set<string>;
  onToggleSection: (section: string) => void;
}

const TopEntitiesTab: React.FC<TopEntitiesTabProps> = ({
  stats,
  expandedSections,
  onToggleSection
}) => {
  // Prepare chart data
  const topEntitiesChartData = useMemo(() => 
    stats?.topEntities?.slice(0, 15).map((entity: any) => ({
      name: entity.text.length > 25 ? entity.text.substring(0, 25) + '...' : entity.text,
      fullName: entity.text,
      count: entity.count,
      documents: entity.documents,
      frequency: (entity.frequency * 100).toFixed(2)
    })) || []
  , [stats]);

  const entityTypeDistribution = useMemo(() => {
    if (!stats?.topEntitiesByType) return [];
    
    return Object.entries(stats.topEntitiesByType).map(([type, entities]: [string, any[]]) => ({
      name: type,
      value: entities.reduce((sum, entity) => sum + entity.count, 0),
      entities: entities.length,
      uniqueEntities: entities.length
    })).slice(0, 10);
  }, [stats]);

  return (
    <Grid container spacing={3}>
      {/* Enhanced Top Entities Chart */}
      <Grid item xs={12} lg={8}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingUp color="primary" />
              <Typography variant="h6">
                Most Frequent Entities
              </Typography>
              <Chip 
                icon={<FilterAlt />}
                label="Normalized & Filtered" 
                size="small" 
                color="success" 
                variant="outlined"
              />
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Entities have been normalized (e.g., "Mr. Johnson" + "Johnson" = "Johnson") and filtered to remove noise.
              </Typography>
            </Alert>
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
                          <Typography variant="caption" color="success.main">
                            ✓ Normalized entity
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

      {/* Enhanced Entity Types Distribution */}
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
                  formatter={(value, name) => [
                    `${value} occurrences`,
                    'Total Count'
                  ]}
                  labelFormatter={(label) => {
                    const entry = entityTypeDistribution.find((e: any) => e.name === label);
                    return `${label} (${entry?.uniqueEntities || 0} unique entities)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Enhanced Top Entities by Type */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">
                  Top Entities by Type
                </Typography>
                <Chip 
                  icon={<DataUsage />}
                  label="Quality Filtered" 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              </Box>
              <IconButton onClick={() => onToggleSection('entityTypes')}>
                {expandedSections.has('entityTypes') ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
            <Collapse in={expandedSections.has('entityTypes')}>
              <TopEntitiesList 
                topEntitiesByType={stats?.topEntitiesByType || {}}
              />
            </Collapse>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default React.memo(TopEntitiesTab);