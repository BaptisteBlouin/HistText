// app/frontend/src/containers/components/MetadataForm/components/SimpleQueryBuilder.tsx
import React from 'react';
import {
  Grid,
  Typography,
  Box,
  Chip
} from '@mui/material';
import { LightbulbOutlined } from '@mui/icons-material';
import SimpleFormField from './SimpleFormField';

interface SimpleQueryBuilderProps {
  fields: any[];
  formData: any;
  collectionInfo: any;
  hasEmbeddings: boolean;
  neighbors: { [key: string]: string[] };
  loadingNeighbors: { [key: string]: boolean };
  metadata: any[];
  onFormChange: (event: any, fieldName: string, index: number) => void;
  onSelectChange: (fieldName: string, newValue: string | null, index: number) => void;
  onFetchNeighbors: (inputValue: string, fieldName: string) => void;
  onRemoveNeighborDropdown: (fieldName: string) => void;
}

const SimpleQueryBuilder: React.FC<SimpleQueryBuilderProps> = ({
  fields,
  formData,
  collectionInfo,
  hasEmbeddings,
  neighbors,
  loadingNeighbors,
  metadata,
  onFormChange,
  onSelectChange,
  onFetchNeighbors,
  onRemoveNeighborDropdown
}) => {
  return (
    <Box>
      {/* Info Panel */}
      <Box sx={{ 
        mb: 3, 
        p: 2, 
        borderRadius: 2, 
        bgcolor: 'info.light', 
        border: 1, 
        borderColor: 'info.main' 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <LightbulbOutlined color="info" />
          <Typography variant="subtitle2" color="info.dark" sx={{ fontWeight: 600 }}>
            Simple Query Mode
          </Typography>
        </Box>
        <Typography variant="body2" color="info.dark">
          Enter search terms in the fields below. Terms are automatically combined with AND logic.
          Switch to Advanced mode for custom Boolean logic, or Raw mode for direct query editing.
        </Typography>
        {hasEmbeddings && (
          <Chip 
            label="✨ AI-powered suggestions available"
            size="small" 
            color="secondary" 
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      <Grid container spacing={3}>
        {fields.map(field => (
          <Grid item xs={12} md={6} lg={4} key={field.name}>
            <SimpleFormField
              field={field}
              formData={formData}
              collectionInfo={collectionInfo}
              hasEmbeddings={hasEmbeddings}
              neighbors={neighbors}
              loadingNeighbors={loadingNeighbors}
              metadata={metadata}
              onFormChange={onFormChange}
              onSelectChange={onSelectChange}
              onFetchNeighbors={onFetchNeighbors}
              onRemoveNeighborDropdown={onRemoveNeighborDropdown}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default React.memo(SimpleQueryBuilder);