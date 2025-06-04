import React from 'react';
import { Box, Typography } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface CooccurrenceChartProps {
  data: any[];
}

/**
 * CooccurrenceChart component renders a vertical bar chart
 * showing the co-occurrence relationships between entities.
 * 
 * Each bar represents the proximity score of an entity pair,
 * with tooltip details showing counts, documents, statistical strength,
 * and other relevant metrics for the relationship.
 * 
 * @param data - Array of co-occurrence data objects to visualize.
 */
const CooccurrenceChart: React.FC<CooccurrenceChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={450}>
      <BarChart data={data} layout="vertical">
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
                    Co-occurrences: {data.count}
                  </Typography>
                  <Typography variant="body2">
                    Documents: {data.documents}
                  </Typography>
                  <Typography variant="body2">
                    Statistical Strength: {data.strength}x expected
                  </Typography>
                  <Typography variant="body2">
                    Strength Level: {data.strengthLevel}
                  </Typography>
                  <Typography variant="body2">
                    Avg Distance: {data.avgDistance} chars
                  </Typography>
                  <Typography variant="body2" color="primary.main">
                    Proximity Score: {data.proximityScore}
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    ✓ Quality filtered relationship
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
  );
};

export default React.memo(CooccurrenceChart);