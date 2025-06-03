import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import config from '../../../../../config.json';

type NerLabelKey = keyof typeof config.NER_LABELS_COLORS;

/**
 * Props for FieldRenderer, which renders a document field's value,
 * with support for NER highlighting and tooltip explanations.
 */
interface FieldRendererProps {
  fieldName: string;
  content: string;
  showNER: boolean;
  nerData?: any;
  documentId: string;
}

/**
 * Renders a field value with optional NER highlights and tooltips.
 * If showNER is active and nerData present, spans/chips are rendered for each annotation.
 *
 * @param props - FieldRendererProps
 * @returns React node with formatted field content.
 */
const FieldRenderer: React.FC<FieldRendererProps> = React.memo(({
  fieldName,
  content,
  showNER,
  nerData,
  documentId
}) => {
  const NER_LABELS_COLORS = config.NER_LABELS_COLORS;
  const NERLABELS2FULL = config.NERLABELS2FULL;
  const viewNERFields = config.viewNERFields;

  if (!content) return null;

  const hasNER = showNER &&
    viewNERFields.some(field => fieldName === field || fieldName.includes(field)) &&
    nerData &&
    nerData[documentId] &&
    Array.isArray(nerData[documentId].t);

  if (hasNER) {
    const annotations = nerData[documentId].t.map((text: string, index: number) => ({
      t: text,
      l: nerData[documentId].l[index],
      s: nerData[documentId].s[index],
      e: nerData[documentId].e[index],
      c: nerData[documentId].c[index],
    }));

    const sortedAnnotations = annotations.sort((a: any, b: any) => {
      if (a.s !== b.s) {
        return a.s - b.s;
      }
      return b.e - b.s - (a.e - a.s);
    });

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedAnnotations.forEach(({ s, e, l, c }: any) => {
      if (s > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}-${s}`}>
            {content.slice(lastIndex, s)}
          </span>
        );
      }
      const label = l[0] as NerLabelKey;
      const color = NER_LABELS_COLORS[label] || '#gray';
      const confidence = (c * 100).toFixed(1);
      
      elements.push(
        <Tooltip
          key={`${s}-${e}`}
          title={`${NERLABELS2FULL[label] || label} (${confidence}% confidence)`}
          arrow
        >
          <Chip
            label={content.slice(s, e)}
            size="small"
            sx={{
              backgroundColor: color,
              color: 'white',
              margin: '2px 1px',
              fontWeight: 500,
              fontSize: '0.875rem',
              height: 'auto',
              '& .MuiChip-label': {
                padding: '4px 8px'
              }
            }}
          />
        </Tooltip>
      );
      lastIndex = e;
    });

    if (lastIndex < content.length) {
      elements.push(
        <span key={`text-${lastIndex}-end`}>
          {content.slice(lastIndex)}
        </span>
      );
    }

    return (
      <Box sx={{ 
        lineHeight: 1.8, 
        fontSize: '0.95rem',
        '& span': { 
          wordBreak: 'break-word' 
        }
      }}>
        {elements}
      </Box>
    );
  }

  return (
    <Typography 
      variant="body2" 
      sx={{ 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        lineHeight: 1.6,
        fontSize: '0.95rem'
      }}
    >
      {content}
    </Typography>
  );
});

FieldRenderer.displayName = 'FieldRenderer';

export default FieldRenderer;