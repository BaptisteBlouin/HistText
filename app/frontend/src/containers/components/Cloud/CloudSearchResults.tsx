import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

/**
 * Props for CloudSearchResults, showing quick links to found words.
 */
interface CloudSearchResultsProps {
  /** Current search term for filtering */
  searchTerm: string;
  /** Array of processed word data (from useCloudData) */
  processedData: any[];
  /** Currently highlighted word */
  highlightedWord: string | null;
  /** Callback to highlight/unhighlight a word */
  onWordHighlight: (word: string | null) => void;
}

/**
 * Displays a row of clickable chips for the first 10 search-matched words,
 * allowing the user to quickly highlight or unhighlight a word in the cloud.
 *
 * @param props - CloudSearchResultsProps
 * @returns Chips for matching words, or null if no search term.
 */
const CloudSearchResults: React.FC<CloudSearchResultsProps> = ({
  searchTerm,
  processedData,
  highlightedWord,
  onWordHighlight
}) => {
  if (!searchTerm) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {processedData.slice(0, 10).map((word) => (
        <Chip
          key={word.text}
          label={`${word.text} (${word.value})`}
          size="small"
          clickable
          onClick={() => onWordHighlight(word.text === highlightedWord ? null : word.text)}
          color={highlightedWord === word.text ? "primary" : "default"}
        />
      ))}
    </Box>
  );
};

export default React.memo(CloudSearchResults);