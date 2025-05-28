// app/frontend/src/containers/components/SearchHistory/SearchHistoryPanel.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Menu,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  Avatar,
  Badge,
  Paper
} from '@mui/material';
import {
  History,
  Bookmark,
  Search,
  MoreVert,
  PlayArrow,
  Edit,
  Delete,
  BookmarkBorder,
  BookmarkAdd,
  Share,
  Download,
  Upload,
  Clear,
  Label,
  AccessTime,
  Folder,
  Warning,
  Block
} from '@mui/icons-material';
import { useSearchHistory, SavedSearch } from '../../../hooks/useSearchHistory';
import { formatDistanceToNow } from 'date-fns';
import { GradientPaper } from '../../../components/ui';

interface SearchHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  onApplySearch: (search: SavedSearch) => void;
  currentFormData?: any;
  currentDateRange?: any;
  currentAlias?: string;
  currentSolrDatabase?: any;
  onSaveCurrentSearch?: () => void;
}

const SearchHistoryPanel: React.FC<SearchHistoryPanelProps> = ({
  open,
  onClose,
  onApplySearch,
  currentFormData,
  currentDateRange,
  currentAlias,
  currentSolrDatabase,
  onSaveCurrentSearch
}) => {
  const {
    searchHistory,
    bookmarks,
    isLoading,
    addToHistory,
    saveAsBookmark,
    removeFromHistory,
    removeBookmark,
    updateSearchUsage,
    updateBookmark,
    clearHistory,
    clearBookmarks,
    searchInSaved,
    exportSearches,
    importSearches,
    stats
  } = useSearchHistory();

  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<SavedSearch | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [incompatibleDialogOpen, setIncompatibleDialogOpen] = useState(false);
  const [incompatibleSearch, setIncompatibleSearch] = useState<SavedSearch | null>(null);

  // Check if a search is compatible with current collection
  const isSearchCompatible = useCallback((search: SavedSearch) => {
    if (!currentSolrDatabase || !currentAlias) return false;
    
    return (
      search.selectedSolrDatabase.id === currentSolrDatabase.id &&
      search.selectedAlias === currentAlias
    );
  }, [currentSolrDatabase, currentAlias]);

  // Filter searches based on query and compatibility
  const filteredData = useMemo(() => {
    let historyResults = searchHistory;
    let bookmarkResults = bookmarks;

    // Apply text search filter
    if (searchQuery.trim()) {
      const searchResults = searchInSaved(searchQuery);
      historyResults = searchResults.history;
      bookmarkResults = searchResults.bookmarks;
    }

    // Separate compatible and incompatible searches
    const compatibleHistory = historyResults.filter(isSearchCompatible);
    const incompatibleHistory = historyResults.filter(search => !isSearchCompatible(search));
    
    const compatibleBookmarks = bookmarkResults.filter(isSearchCompatible);
    const incompatibleBookmarks = bookmarkResults.filter(search => !isSearchCompatible(search));

    return {
      compatible: {
        history: compatibleHistory,
        bookmarks: compatibleBookmarks
      },
      incompatible: {
        history: incompatibleHistory,
        bookmarks: incompatibleBookmarks
      }
    };
  }, [searchQuery, searchHistory, bookmarks, searchInSaved, isSearchCompatible]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setSearchQuery('');
  };

  const handleApplySearch = useCallback((search: SavedSearch) => {
    // Double-check compatibility before applying
    if (!isSearchCompatible(search)) {
      setIncompatibleSearch(search);
      setIncompatibleDialogOpen(true);
      return;
    }

    updateSearchUsage(search.id);
    onApplySearch(search);
    onClose();
  }, [isSearchCompatible, updateSearchUsage, onApplySearch, onClose]);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, item: SavedSearch) => {
    event.stopPropagation();
    setSelectedItem(item);
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedItem(null);
  };

  const handleEdit = () => {
    if (selectedItem) {
      setEditingSearch(selectedItem);
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
    handleMenuClose();
  };

  const handleBookmarkToggle = () => {
    if (selectedItem) {
      if (selectedItem.isBookmarked) {
        removeBookmark(selectedItem.id);
      } else {
        saveAsBookmark(selectedItem);
      }
    }
    handleMenuClose();
  };

  const handleSaveEdit = (updates: Partial<SavedSearch>) => {
    if (editingSearch) {
      updateBookmark(editingSearch.id, updates);
      setEditDialogOpen(false);
      setEditingSearch(null);
    }
  };

  const handleConfirmDelete = () => {
    if (selectedItem) {
      if (activeTab === 0) {
        removeFromHistory(selectedItem.id);
      } else {
        removeBookmark(selectedItem.id);
      }
    }
    setDeleteConfirmOpen(false);
    setSelectedItem(null);
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importSearches(file)
        .then(() => {
          // Success notification would go here
        })
        .catch((error) => {
          console.error('Import failed:', error);
        });
    }
  };

  const renderSearchItem = (search: SavedSearch, isBookmark: boolean, isCompatible: boolean) => {
    const isCurrentCollection = isCompatible;
    
    return (
      <Card 
        key={search.id}
        sx={{ 
          mb: 2, 
          cursor: isCompatible ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          opacity: isCompatible ? 1 : 0.7,
          border: isCompatible ? '1px solid transparent' : '1px solid',
          borderColor: isCompatible ? 'transparent' : 'warning.main',
          '&:hover': isCompatible ? {
            transform: 'translateY(-2px)',
            boxShadow: 4
          } : {},
          position: 'relative'
        }}
      >
        {!isCompatible && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1
            }}
          >
            <Tooltip title="Incompatible with current collection">
              <Block color="warning" />
            </Tooltip>
          </Box>
        )}
        
        <CardContent 
          sx={{ p: 2 }}
          onClick={isCompatible ? () => handleApplySearch(search) : undefined}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Avatar sx={{ 
              bgcolor: isCompatible 
                ? (isBookmark ? 'warning.main' : 'secondary.main')
                : 'grey.400'
            }}>
              {isBookmark ? <Bookmark /> : <History />}
            </Avatar>
            
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 1,
                  color: isCompatible ? 'text.primary' : 'text.secondary'
                }}
              >
                {search.name}
              </Typography>
              
              {search.description && (
                <Typography 
                  variant="body2" 
                  color={isCompatible ? 'text.secondary' : 'text.disabled'} 
                  sx={{ mb: 1 }}
                >
                  {search.description}
                </Typography>
              )}
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Chip 
                  label={search.selectedSolrDatabase.name} 
                  size="small" 
                  color={isCurrentCollection && search.selectedSolrDatabase.id === currentSolrDatabase?.id ? "primary" : "default"}
                  variant={isCurrentCollection && search.selectedSolrDatabase.id === currentSolrDatabase?.id ? "filled" : "outlined"}
                />
                <Chip 
                  label={search.selectedAlias} 
                  size="small" 
                  color={isCurrentCollection && search.selectedAlias === currentAlias ? "secondary" : "default"}
                  variant={isCurrentCollection && search.selectedAlias === currentAlias ? "filled" : "outlined"}
                />
                {search.resultsCount && (
                  <Chip 
                    label={`${search.resultsCount} results`}
                    size="small" 
                    color={isCompatible ? "success" : "default"}
                    variant="outlined"
                  />
                )}
              </Box>
              
              {!isCompatible && (
                <Alert severity="warning" sx={{ mt: 1, mb: 1 }} variant="outlined">
                  <Typography variant="caption">
                    This search is for {search.selectedSolrDatabase.name} › {search.selectedAlias}
                    {currentSolrDatabase && currentAlias && 
                      `, but you're currently in ${currentSolrDatabase.name} › ${currentAlias}`
                    }
                  </Typography>
                </Alert>
              )}
              
              {search.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                  {search.tags.map(tag => (
                    <Chip 
                      key={tag}
                      label={tag} 
                      size="small" 
                      icon={<Label />}
                      sx={{ 
                        fontSize: '0.75rem',
                        opacity: isCompatible ? 1 : 0.7
                      }}
                    />
                  ))}
                </Box>
              )}
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <AccessTime sx={{ 
                  fontSize: 16, 
                  color: isCompatible ? 'text.secondary' : 'text.disabled' 
                }} />
                <Typography 
                  variant="caption" 
                  color={isCompatible ? 'text.secondary' : 'text.disabled'}
                >
                  {formatDistanceToNow(new Date(search.lastUsed), { addSuffix: true })}
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                onClick={(e) => handleMenuClick(e, search)}
              >
                <MoreVert />
              </IconButton>
              
              {isCompatible && (
                <Tooltip title="Apply Search">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplySearch(search);
                    }}
                  >
                    <PlayArrow />
                  </IconButton>
                </Tooltip>
              )}
              
              {!isCompatible && (
                <Tooltip title="Cannot apply - incompatible collection">
                  <IconButton
                    size="small"
                    disabled
                    onClick={(e) => {
                      e.stopPropagation();
                      setIncompatibleSearch(search);
                      setIncompatibleDialogOpen(true);
                    }}
                  >
                    <Block />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderSearchList = (searches: SavedSearch[], isBookmark: boolean, isCompatible: boolean, title: string) => {
    if (searches.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ 
          mb: 2, 
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          {!isCompatible && <Warning color="warning" />}
          {title}
          <Chip label={searches.length} size="small" />
        </Typography>
        {searches.map(search => renderSearchItem(search, isBookmark, isCompatible))}
      </Box>
    );
  };

  if (!open) return null;

  const currentData = activeTab === 0 ? filteredData.compatible.history : filteredData.compatible.bookmarks;
  const incompatibleData = activeTab === 0 ? filteredData.incompatible.history : filteredData.incompatible.bookmarks;
  const hasCompatible = currentData.length > 0;
  const hasIncompatible = incompatibleData.length > 0;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { height: '80vh', borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Folder color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Search Library
        </Typography>
        <Badge badgeContent={stats.totalHistory + stats.totalBookmarks} color="primary">
          <Box />
        </Badge>
        {currentSolrDatabase && currentAlias && (
          <Box sx={{ ml: 'auto' }}>
            <Chip 
              label={`${currentSolrDatabase.name} › ${currentAlias}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        )}
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
            <Tab 
              icon={<History />} 
              label={`Recent (${filteredData.compatible.history.length}${filteredData.incompatible.history.length > 0 ? `+${filteredData.incompatible.history.length}` : ''})`} 
              iconPosition="start"
            />
            <Tab 
              icon={<Bookmark />} 
              label={`Bookmarks (${filteredData.compatible.bookmarks.length}${filteredData.incompatible.bookmarks.length > 0 ? `+${filteredData.incompatible.bookmarks.length}` : ''})`} 
              iconPosition="start"
            />
          </Tabs>
        </Box>
        
        <Box sx={{ p: 2 }}>
          {/* Current Collection Info */}
          {(!currentSolrDatabase || !currentAlias) && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Select a database and collection to see compatible saved searches.
              </Typography>
            </Alert>
          )}

          {/* Search and Controls */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search saved queries..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
              sx={{ flexGrow: 1, minWidth: 200 }}
            />
            
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={exportSearches}
              size="small"
            >
              Export
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Upload />}
              component="label"
              size="small"
            >
              Import
              <input
                type="file"
                accept=".json"
                hidden
                onChange={handleImportFile}
              />
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Clear />}
              onClick={activeTab === 0 ? clearHistory : clearBookmarks}
              size="small"
              color="error"
            >
              Clear All
            </Button>
          </Box>
          
          {/* Save Current Search */}
          {currentFormData && currentAlias && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">
                  You have an active search that you can save
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<BookmarkAdd />}
                  onClick={onSaveCurrentSearch}
                >
                  Save Current Search
                </Button>
              </Box>
            </Alert>
          )}
          
          {/* Search Results */}
          <Box sx={{ maxHeight: 'calc(80vh - 350px)', overflow: 'auto' }}>
            {isLoading ? (
              <Typography>Loading...</Typography>
            ) : (
              <>
                {/* Compatible Searches */}
                {hasCompatible && renderSearchList(
                  currentData, 
                  activeTab === 1, 
                  true, 
                  currentSolrDatabase && currentAlias ? `Compatible with ${currentAlias}` : "Compatible Searches"
                )}
                
                {/* Incompatible Searches */}
                {hasIncompatible && renderSearchList(
                  incompatibleData, 
                  activeTab === 1, 
                  false, 
                  "Other Collections"
                )}
                
                {/* Empty State */}
                {!hasCompatible && !hasIncompatible && (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    {activeTab === 0 ? <History sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} /> : <Bookmark sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />}
                    <Typography variant="h6" color="text.secondary">
                      {searchQuery ? 'No matching searches found' : (activeTab === 0 ? 'No recent searches' : 'No bookmarks saved')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {searchQuery ? 'Try different search terms' : (activeTab === 0 ? 'Your recent searches will appear here' : 'Save important searches to bookmark them')}
                    </Typography>
                  </Paper>
                )}
              </>
            )}
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      
      {/* Incompatible Search Dialog */}
      <Dialog 
        open={incompatibleDialogOpen} 
        onClose={() => setIncompatibleDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          Incompatible Search
        </DialogTitle>
        <DialogContent>
          {incompatibleSearch && (
            <Box>
              <Typography gutterBottom>
                This search was created for a different collection and cannot be applied to your current selection.
              </Typography>
              
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Search Details:
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Name:</strong> {incompatibleSearch.name}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Created for:</strong> {incompatibleSearch.selectedSolrDatabase.name} › {incompatibleSearch.selectedAlias}
                </Typography>
                {currentSolrDatabase && currentAlias && (
                  <Typography variant="body2">
                    <strong>Current collection:</strong> {currentSolrDatabase.name} › {currentAlias}
                  </Typography>
                )}
              </Box>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  To use this search, please switch to the {incompatibleSearch.selectedSolrDatabase.name} database and {incompatibleSearch.selectedAlias} collection first.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIncompatibleDialogOpen(false)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <Edit sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={handleBookmarkToggle}>
          {selectedItem?.isBookmarked ? (
            <>
              <BookmarkBorder sx={{ mr: 1 }} /> Remove Bookmark
            </>
          ) : (
            <>
              <Bookmark sx={{ mr: 1 }} /> Add Bookmark
            </>
          )}
        </MenuItem>
        <MenuItem onClick={() => navigator.clipboard.writeText(selectedItem?.queryString || '')}>
          <Share sx={{ mr: 1 }} /> Copy Query
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
      
      {/* Edit Dialog */}
      {editDialogOpen && editingSearch && (
        <EditSearchDialog
          open={editDialogOpen}
          search={editingSearch}
          onClose={() => setEditDialogOpen(false)}
          onSave={handleSaveEdit}
        />
      )}
      
      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Search</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

// Edit Search Dialog Component (unchanged)
const EditSearchDialog: React.FC<{
  open: boolean;
  search: SavedSearch;
  onClose: () => void;
  onSave: (updates: Partial<SavedSearch>) => void;
}> = ({ open, search, onClose, onSave }) => {
  const [name, setName] = useState(search.name);
  const [description, setDescription] = useState(search.description || '');
  const [tags, setTags] = useState(search.tags.join(', '));

  const handleSave = () => {
    onSave({
      name,
      description,
      description,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Search</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
          <TextField
            label="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            fullWidth
            helperText="Add tags to organize your searches"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!name.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SearchHistoryPanel;