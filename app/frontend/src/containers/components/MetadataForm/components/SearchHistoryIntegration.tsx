import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  Alert
} from '@mui/material';
import {
  BookmarkAdd,
  Save,
  History as HistoryIcon
} from '@mui/icons-material';
import { useSearchHistory, SavedSearch } from '../../../../hooks/useSearchHistory';
import { buildQueryString } from '../../buildQueryString';

/**
 * Props for SearchHistoryIntegration component.
 *
 * @property formData - Current query form data.
 * @property dateRange - Selected date range.
 * @property selectedAlias - Current selected alias/collection.
 * @property selectedSolrDatabase - Current selected Solr database.
 * @property resultsCount - (Optional) Number of results for current query.
 * @property onShowHistory - Callback to show search history/library modal.
 */
interface SearchHistoryIntegrationProps {
  formData: any;
  dateRange: any;
  selectedAlias: string;
  selectedSolrDatabase: any;
  resultsCount?: number;
  onShowHistory: () => void;
}

/**
 * Component providing UI and logic for saving searches to history or bookmarks,
 * displaying a dialog to enter metadata, and showing a search library button.
 */
const SearchHistoryIntegration: React.FC<SearchHistoryIntegrationProps> = ({
  formData,
  dateRange,
  selectedAlias,
  selectedSolrDatabase,
  resultsCount,
  onShowHistory
}) => {
  const { addToHistory, saveAsBookmark, stats } = useSearchHistory();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [searchTags, setSearchTags] = useState('');
  const [saveAsBookmarkFlag, setSaveAsBookmarkFlag] = useState(false);

  // Detect if current form data has any meaningful values
  const hasSearchContent = Object.values(formData).some((entries: any) =>
    entries.some((entry: any) => entry.value && entry.value.trim())
  );

  // Generate a default name for saving based on form data and date range
  const generateDefaultName = useCallback(() => {
    if (!hasSearchContent || !selectedAlias) return '';
    
    const keyTerms: string[] = [];
    Object.entries(formData).forEach(([field, entries]: [string, any]) => {
      entries.forEach((entry: any) => {
        if (entry.value && entry.value.trim()) {
          keyTerms.push(entry.value.trim());
        }
      });
    });

    const termsPart = keyTerms.slice(0, 3).join(', ');
    const datePart = dateRange ? ` (${dateRange.min} to ${dateRange.max})` : '';
    
    return `${selectedAlias}: ${termsPart}${datePart}`.slice(0, 100);
  }, [formData, selectedAlias, dateRange, hasSearchContent]);

  // Open save dialog prefilled with default name and cleared other fields
  const handleSaveSearch = useCallback(() => {
    if (!hasSearchContent || !selectedAlias || !selectedSolrDatabase) return;

    const defaultName = generateDefaultName();
    setSearchName(defaultName);
    setSearchDescription('');
    setSearchTags('');
    setSaveAsBookmarkFlag(false);
    setSaveDialogOpen(true);
  }, [hasSearchContent, selectedAlias, selectedSolrDatabase, generateDefaultName]);

  // Confirm saving the search either as bookmark or history
  const handleConfirmSave = useCallback(() => {
    if (!searchName.trim()) return;

    const queryString = buildQueryString(formData, dateRange);
    
    const searchData: Omit<SavedSearch, 'id' | 'createdAt' | 'lastUsed'> = {
      name: searchName.trim(),
      description: searchDescription.trim() || undefined,
      formData,
      dateRange,
      selectedAlias,
      selectedSolrDatabase: {
        id: selectedSolrDatabase.id,
        name: selectedSolrDatabase.name
      },
      isBookmarked: saveAsBookmarkFlag,
      tags: searchTags ? searchTags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      queryString,
      resultsCount
    };

    if (saveAsBookmarkFlag) {
      saveAsBookmark(searchData);
    } else {
      addToHistory(searchData);
    }

    setSaveDialogOpen(false);
    setSearchName('');
    setSearchDescription('');
    setSearchTags('');
  }, [
    searchName,
    searchDescription,
    searchTags,
    saveAsBookmarkFlag,
    formData,
    dateRange,
    selectedAlias,
    selectedSolrDatabase,
    resultsCount,
    addToHistory,
    saveAsBookmark
  ]);

  if (!selectedAlias || !selectedSolrDatabase) {
    return null;
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={onShowHistory}
          sx={{ minWidth: 120 }}
        >
          Search Library
          {(stats.totalHistory + stats.totalBookmarks) > 0 && (
            <Chip 
              label={stats.totalHistory + stats.totalBookmarks} 
              size="small" 
              sx={{ ml: 1 }} 
            />
          )}
        </Button>

        {hasSearchContent && (
          <Button
            variant="contained"
            startIcon={<BookmarkAdd />}
            onClick={handleSaveSearch}
            color="secondary"
            sx={{ minWidth: 120 }}
          >
            Save Search
          </Button>
        )}
      </Box>

      <Dialog 
        open={saveDialogOpen} 
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Save />
          Save Search
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              <Typography variant="body2">
                Save this search to quickly reuse it later. Bookmarked searches are organized separately from your recent history.
              </Typography>
            </Alert>

            <TextField
              label="Search Name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              fullWidth
              required
              helperText="Give your search a descriptive name"
              autoFocus
            />

            <TextField
              label="Description (Optional)"
              value={searchDescription}
              onChange={(e) => setSearchDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              helperText="Add notes about what this search is for"
            />

            <TextField
              label="Tags (Optional)"
              value={searchTags}
              onChange={(e) => setSearchTags(e.target.value)}
              fullWidth
              helperText="Comma-separated tags for organization (e.g., research, analysis, project1)"
              placeholder="research, important, project-alpha"
            />

            <FormControl fullWidth>
              <InputLabel>Save Location</InputLabel>
              <Select
                value={saveAsBookmarkFlag ? 'bookmark' : 'history'}
                onChange={(e) => setSaveAsBookmarkFlag(e.target.value === 'bookmark')}
                label="Save Location"
              >
                <MenuItem value="history">Recent Searches (temporary)</MenuItem>
                <MenuItem value="bookmark">Bookmarks (permanent)</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Search Preview:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Chip label={selectedAlias} size="small" color="secondary" />
                {resultsCount && (
                  <Chip label={`${resultsCount} results`} size="small" color="success" />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {buildQueryString(formData, dateRange)}
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmSave} 
            variant="contained"
            disabled={!searchName.trim()}
            startIcon={saveAsBookmarkFlag ? <BookmarkAdd /> : <Save />}
          >
            {saveAsBookmarkFlag ? 'Save as Bookmark' : 'Save to History'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SearchHistoryIntegration;