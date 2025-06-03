import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Chip,
  Button
} from '@mui/material';
import {
  Article,
  Description,
  Info,
  DataObject,
  Label as LabelIcon,
  ContentCopy,
  ExpandMore
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { getFieldIcon, isLongContent } from '../utils/documentUtils';
import FieldRenderer from './FieldRenderer';

/**
 * Props for DocumentField, which renders a single field of a document,
 * with icon, expand/collapse, copy, and NER support.
 */
interface DocumentFieldProps {
  fieldName: string;
  content: string;
  isExpanded: boolean;
  copiedField: string | null;
  showNER: boolean;
  nerData?: any;
  documentId: string;
  onToggleExpand: (fieldName: string) => void;
  onCopyField: (fieldName: string, content: string) => void;
}

/**
 * Maps icon name to the corresponding MUI icon component.
 * @param iconName - Icon name string (from getFieldIcon)
 * @returns A ReactNode icon component
 */
const getFieldIconComponent = (iconName: string) => {
  const iconMap = {
    'Article': Article,
    'Description': Description,
    'Info': Info,
    'DataObject': DataObject,
    'Label': LabelIcon
  };
  const IconComponent = iconMap[iconName as keyof typeof iconMap] || LabelIcon;
  return <IconComponent />;
};

/**
 * Renders a single document field in a card, with icon, copy, expand/collapse,
 * and content highlighting/NER support.
 *
 * @param props - DocumentFieldProps
 * @returns Card UI for a document field.
 */
const DocumentField: React.FC<DocumentFieldProps> = React.memo(({
  fieldName,
  content,
  isExpanded,
  copiedField,
  showNER,
  nerData,
  documentId,
  onToggleExpand,
  onCopyField
}) => {
  const theme = useTheme();
  const isLong = isLongContent(content);
  const shouldCollapse = isLong && !isExpanded;

  return (
    <Grid item xs={12}>
      <Card 
        elevation={2}
        sx={{ 
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: theme.shadows[4],
            transform: 'translateY(-1px)'
          }
        }}
      >
        <CardContent>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 2 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getFieldIconComponent(getFieldIcon(fieldName))}
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: 'primary.main',
                  fontSize: '1.1rem'
                }}
              >
                {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Typography>
              {isLong && (
                <Chip 
                  label={`${content.length} chars`} 
                  size="small" 
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              )}
            </Box>
            
            <Stack direction="row" spacing={1}>
              <Tooltip title={copiedField === fieldName ? 'Copied!' : 'Copy content'}>
                <IconButton 
                  size="small"
                  onClick={() => onCopyField(fieldName, content)}
                  color={copiedField === fieldName ? 'success' : 'default'}
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
              
              {isLong && (
                <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
                  <IconButton 
                    size="small"
                    onClick={() => onToggleExpand(fieldName)}
                  >
                    <ExpandMore 
                      sx={{ 
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }} 
                    />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>
          
          <Box sx={{ 
            maxHeight: shouldCollapse ? '120px' : 'none',
            overflow: shouldCollapse ? 'hidden' : 'visible',
            position: 'relative'
          }}>
            <FieldRenderer
              fieldName={fieldName}
              content={content}
              showNER={showNER}
              nerData={nerData}
              documentId={documentId}
            />
            
            {shouldCollapse && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '40px',
                  background: 'linear-gradient(transparent, white)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  pb: 1
                }}
              >
                <Button
                  size="small"
                  onClick={() => onToggleExpand(fieldName)}
                  endIcon={<ExpandMore />}
                >
                  Show More
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
});

DocumentField.displayName = 'DocumentField';

export default DocumentField;