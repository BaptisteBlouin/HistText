import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

interface CloudSearchResultsProps {
  searchTerm: string;
  processedData: any[];
  highlightedWord: string | null;
  onWordHighlight: (word: string | null) => void;
}

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