// app/frontend/src/containers/components/MetadataForm/components/AdvancedQueryBuilder.tsx
import React from 'react';
import {
  Grid,
  Typography,
  Box,
  Chip,
  Alert
} from '@mui/material';
import { Psychology } from '@mui/icons-material';
import FormField from './FormField';

interface AdvancedQueryBuilderProps {
  fields: any[];
  formData: any;
  collectionInfo: any;
  hasEmbeddings: boolean;
  neighbors: { [key: string]: string[] };
  loadingNeighbors: { [key: string]: boolean };
  metadata: any[];
  onFormChange: (event: any, fieldName: string, index: number) => void;
  onSelectChange: (fieldName: string, newValue: string | null, index: number) => void;
  onToggleNot: (fieldName: string, index: number) => void;
  onAddBooleanField: (fieldName: string, operator: string) => void;
  onRemoveBooleanField: (fieldName: string, index: number) => void;
  onFetchNeighbors: (inputValue: string, fieldName: string) => void;
  onRemoveNeighborDropdown: (fieldName: string) => void;
}

const AdvancedQueryBuilder: React.FC<AdvancedQueryBuilderProps> = ({
  fields,
  formData,
  collectionInfo,
  hasEmbeddings,
  neighbors,
  loadingNeighbors,
  metadata,
  onFormChange,
  onSelectChange,
  onToggleNot,
  onAddBooleanField,
  onRemoveBooleanField,
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
        bgcolor: 'secondary.light', 
        border: 1, 
        borderColor: 'secondary.main' 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Psychology color="secondary" />
         <Typography variant="subtitle2" color="secondary.dark" sx={{ fontWeight: 600 }}>
           Advanced Query Mode
         </Typography>
       </Box>
       <Typography variant="body2" color="secondary.dark">
         Build complex queries with custom Boolean logic. Use AND/OR operators, NOT conditions, 
         and multiple terms per field. Parentheses are automatically managed for proper grouping.
       </Typography>
       <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
         <Chip label="AND logic" size="small" color="success" variant="outlined" />
         <Chip label="OR logic" size="small" color="info" variant="outlined" />
         <Chip label="NOT conditions" size="small" color="error" variant="outlined" />
         {hasEmbeddings && (
           <Chip label="✨ AI suggestions" size="small" color="secondary" variant="outlined" />
         )}
       </Box>
     </Box>

     <Grid container spacing={3}>
       {fields.map(field => (
         <Grid item xs={12} md={6} lg={4} key={field.name}>
           <FormField
             field={field}
             formData={formData}
             collectionInfo={collectionInfo}
             hasEmbeddings={hasEmbeddings}
             neighbors={neighbors}
             loadingNeighbors={loadingNeighbors}
             metadata={metadata}
             onFormChange={onFormChange}
             onSelectChange={onSelectChange}
             onToggleNot={onToggleNot}
             onAddBooleanField={onAddBooleanField}
             onRemoveBooleanField={onRemoveBooleanField}
             onFetchNeighbors={onFetchNeighbors}
             onRemoveNeighborDropdown={onRemoveNeighborDropdown}
           />
         </Grid>
       ))}
     </Grid>
   </Box>
 );
};

export default React.memo(AdvancedQueryBuilder);