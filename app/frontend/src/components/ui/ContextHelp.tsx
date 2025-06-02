import React from 'react';
import {
  Tooltip,
  IconButton,
  Box,
  Typography,
  Link
} from '@mui/material';
import {
  Help,
  Info,
  Warning,
  CheckCircle,
  Star
} from '@mui/icons-material';

/**
 * All valid help topic keys for ContextHelp.
 */
type HelpTopic =
  | 'search_terms'
  | 'boolean_operators'
  | 'ai_search'
  | 'date_range'
  | 'field_selection'
  | 'ner_toggle'
  | 'word_cloud'
  | 'statistics'
  | 'collection_selection'
  | 'field_completeness'
  | 'query_performance'
  | 'not_operator'
  | 'and_operator'
  | 'or_operator';

/**
 * Defines a help content entry.
 * - `title`: Heading text.
 * - `content`: Main explanation.
 * - `examples`: Optional examples to show.
 * - `type`: Icon type and color.
 */
interface HelpContentEntry {
  title: string;
  content: string;
  examples?: string[];
  type: 'info' | 'success' | 'warning';
}

/**
 * Props for ContextHelp component.
 * - `topic`: Help topic key to display.
 * - `variant`: Renders as an icon button or inline icon.
 * - `size`: Icon size.
 * - `placement`: Tooltip placement.
 */
interface ContextHelpProps {
  topic: HelpTopic;
  variant?: 'icon' | 'inline';
  size?: 'small' | 'medium';
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Help content mapped by topic key.
 */
const HELP_CONTENT: Record<HelpTopic, HelpContentEntry> = {
  'search_terms': {
    title: 'Search Terms',
    content: 'Enter words or phrases to search for. Exact matching is handled automatically.',
    examples: ['China', 'computer science'],
    type: 'info'
  },
  'boolean_operators': {
    title: 'Boolean Logic',
    content: 'Use AND to require all terms, OR for any terms. Click NOT to exclude terms.',
    examples: ['AND: all terms required', 'OR: any term matches', 'NOT: excludes terms'],
    type: 'info'
  },
  'ai_search': {
    title: 'AI Semantic Search',
    content: 'Find words with similar meanings using AI. Click ⭐ to get suggestions.',
    examples: ['car → vehicle, automobile', 'happy → joyful, pleased'],
    type: 'success'
  },
  'date_range': {
    title: 'Date Filtering',
    content: 'Limit results to documents within a specific date range.',
    examples: ['2000-01-01 to 2025-12-31'],
    type: 'info'
  },
  'field_selection': {
    title: 'Field Selection',
    content: 'Choose from predefined values for this field. Select multiple values using AND/OR logic.',
    examples: ['Select one or more options', 'Use NOT to exclude values'],
    type: 'info'
  },
  'ner_toggle': {
    title: 'Named Entity Recognition',
    content: 'Automatically identify and highlight people, places, organizations, and other entities in your text.',
    examples: ['People: John Smith', 'Places: New York', 'Organizations: NASA'],
    type: 'success'
  },
  'word_cloud': {
    title: 'Word Cloud Visualization',
    content: 'Visual representation of word frequency. Larger words appear more often in your results.',
    type: 'info'
  },
  'statistics': {
    title: 'Statistical Analysis',
    content: 'Get insights about your document collection including word counts, languages, and distributions.',
    type: 'info'
  },
  'collection_selection': {
    title: 'Collection Selection',
    content: 'Choose which document collection to search. Each collection may have different fields and content types.',
    type: 'info'
  },
  'field_completeness': {
    title: 'Field Completeness',
    content: 'Shows what percentage of documents have data in each field. Higher percentages mean more reliable results.',
    type: 'info'
  },
  'query_performance': {
    title: 'Search Performance',
    content: 'More specific searches are faster. Consider adding filters to improve performance on large datasets.',
    type: 'warning'
  },
  'not_operator': {
    title: 'NOT Operator',
    content: 'Exclude documents containing this term. Red styling indicates exclusion.',
    examples: ['NOT climate → excludes "climate"', 'Useful for filtering out unwanted content'],
    type: 'info'
  },
  'and_operator': {
    title: 'AND Operator',
    content: 'All connected terms must appear in the document. More restrictive search.',
    examples: ['climate AND change → both required', 'Narrows down results'],
    type: 'info'
  },
  'or_operator': {
    title: 'OR Operator',
    content: 'Any of the connected terms can appear in the document. Broader search.',
    examples: ['cat OR dog → either matches', 'Expands search results'],
    type: 'info'
  }
};

/**
 * Displays contextual help via a tooltip and icon for various UI features.
 * Select help topic with `topic` prop, choose inline or icon button style with `variant`.
 */
const ContextHelp: React.FC<ContextHelpProps> = ({
  topic,
  variant = 'icon',
  size = 'small',
  placement = 'top'
}) => {
  const helpInfo = HELP_CONTENT[topic];

  if (!helpInfo) {
    console.warn(`No help content found for topic: ${topic}`);
    return null;
  }

  /**
   * Chooses an icon based on help type.
   */
  const getIcon = () => {
    switch (helpInfo.type) {
      case 'success': return <CheckCircle fontSize={size} color="success" />;
      case 'warning': return <Warning fontSize={size} color="warning" />;
      case 'info':
      default: return <Help fontSize={size} color="action" />;
    }
  };

  /**
   * Tooltip content: title, explanation, and optional examples.
   */
  const tooltipContent = (
    <Box sx={{ maxWidth: 300, p: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {helpInfo.title}
      </Typography>
      <Typography variant="body2" sx={{ mb: helpInfo.examples ? 1 : 0 }}>
        {helpInfo.content}
      </Typography>
      {helpInfo.examples && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            Examples:
          </Typography>
          {helpInfo.examples.map((example: string, index: number) => (
            <Typography key={index} variant="caption" sx={{
              display: 'block',
              fontFamily: 'monospace',
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '2px 4px',
              borderRadius: '3px',
              mb: 0.5
            }}>
              {example}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );

  if (variant === 'inline') {
    return (
      <Tooltip title={tooltipContent} arrow placement={placement}>
        <Box component="span" sx={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'help',
          ml: 0.5
        }}>
          {getIcon()}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipContent} arrow placement={placement}>
      <IconButton
        size={size}
        sx={{
          color: 'text.secondary',
          '&:hover': {
            color: helpInfo.type === 'success' ? 'success.main' :
                   helpInfo.type === 'warning' ? 'warning.main' : 'primary.main'
          }
        }}
      >
        {getIcon()}
      </IconButton>
    </Tooltip>
  );
};

export default ContextHelp;
