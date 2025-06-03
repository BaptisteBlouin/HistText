import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid
} from '@mui/material';
import { Info } from '@mui/icons-material';

/**
 * Props for the CloudDialogs component, controlling info and share dialogs.
 */
interface CloudDialogsProps {
  showWordInfo: boolean;
  selectedWord: any;
  shareDialogOpen: boolean;
  colorScheme: string;
  maxWords: number;
  filterMinFreq: number;
  onCloseWordInfo: () => void;
  onCloseShare: () => void;
  onHighlightWord: (word: string) => void;
  onShare: () => void;
}

/**
 * Label mapping for supported color schemes.
 */
const COLOR_SCHEMES = {
  default: { name: 'Default' },
  warm: { name: 'Warm Sunset' },
  cool: { name: 'Ocean Breeze' },
  purple: { name: 'Purple Haze' },
  forest: { name: 'Forest' },
  sunset: { name: 'Sunset' },
  monochrome: { name: 'Monochrome' }
};

/**
 * CloudDialogs renders modal dialogs for showing selected word info
 * and for sharing the current word cloud configuration.
 *
 * @param props - CloudDialogsProps
 * @returns React element for dialogs
 */
const CloudDialogs: React.FC<CloudDialogsProps> = ({
  showWordInfo,
  selectedWord,
  shareDialogOpen,
  colorScheme,
  maxWords,
  filterMinFreq,
  onCloseWordInfo,
  onCloseShare,
  onHighlightWord,
  onShare
}) => {
  return (
    <>
      {/* Word Info Dialog */}
      <Dialog open={showWordInfo} onClose={onCloseWordInfo}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Info />
          Word Information
        </DialogTitle>
        <DialogContent>
          {selectedWord && (
            <Box>
              <Typography variant="h4" gutterBottom color="primary">
                {selectedWord.text}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Frequency</Typography>
                  <Typography variant="h6">{selectedWord.value}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Rank</Typography>
                  <Typography variant="h6">#{selectedWord.rank}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Length</Typography>
                  <Typography variant="h6">{selectedWord.text.length} chars</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Font Size</Typography>
                  <Typography variant="h6">{Math.round(selectedWord.size)}px</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Type</Typography>
                  <Typography variant="h6">{selectedWord.isChinese ? 'Chinese' : 'English'}</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onHighlightWord(selectedWord?.text)} color="primary">
            Highlight
          </Button>
          <Button onClick={onCloseWordInfo}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={onCloseShare}>
        <DialogTitle>Share Word Cloud Configuration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Share your current word cloud settings with others!
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Theme: {COLOR_SCHEMES[colorScheme as keyof typeof COLOR_SCHEMES]?.name || colorScheme} • 
              Words: {maxWords} • 
              Min Freq: {filterMinFreq}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseShare}>Cancel</Button>
          <Button onClick={onShare} variant="contained">Copy Link</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default React.memo(CloudDialogs);
