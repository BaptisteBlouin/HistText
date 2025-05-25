import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
  Card,
  CardContent,
  Avatar,
  Divider,
  Badge,
  useTheme,
  useMediaQuery,
  Skeleton
} from '@mui/material';
import {
  Search,
  ExpandMore,
  ExpandLess,
  Info,
  Storage,
  Description,
  Check,
  Close,
  CollectionsBookmark
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import config from '../../../config.json';

interface AliasSelectorProps {
  aliases: string[];
  selectedAlias: string;
  onAliasChange: (alias: string) => void;
  descriptions: Record<string, string>;
}

interface CollectionInfo {
  name: string;
  description: string;
  isSelected: boolean;
  matchesSearch: boolean;
}

const AliasSelector: React.FC<AliasSelectorProps> = ({
  aliases,
  selectedAlias,
  onAliasChange,
  descriptions,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Process collections with descriptions and search filtering
  const processedCollections = useMemo(() => {
    const collections: CollectionInfo[] = aliases.map(alias => ({
      name: alias,
      description: descriptions[alias] || 'No description available',
      isSelected: alias === selectedAlias,
      matchesSearch: !searchTerm || 
        alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (descriptions[alias] || '').toLowerCase().includes(searchTerm.toLowerCase())
    }));

    return collections.filter(col => col.matchesSearch);
  }, [aliases, descriptions, selectedAlias, searchTerm]);

  const selectedCollection = useMemo(() => 
    processedCollections.find(col => col.isSelected) || null
  , [processedCollections]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key to close dropdown
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen]);

  const handleToggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  const handleCollectionSelect = (alias: string) => {
    setIsLoading(true);
    onAliasChange(alias);
    setIsOpen(false);
    setSearchTerm('');
    
    // Simulate loading state
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAliasChange('');
  };

  const truncateDescription = (description: string, maxLength: number = 120) => {
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
  };

  const getCollectionInitials = (name: string) => {
    return name
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box ref={containerRef} sx={{ position: 'relative', minWidth: isMobile ? '100%' : 300 }}>
      {/* Main Selector Button */}
      <Paper
        elevation={isOpen ? 8 : 2}
        onClick={handleToggleDropdown}
        sx={{
          p: 2,
          cursor: 'pointer',
          borderRadius: 3,
          border: `2px solid ${isOpen ? theme.palette.primary.main : 'transparent'}`,
          background: selectedAlias 
            ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'translateY(-2px)' : 'translateY(0)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[6],
            borderColor: theme.palette.primary.light,
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Collection Icon/Avatar */}
          {selectedAlias ? (
            <Avatar
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 600,
                fontSize: '1rem'
              }}
            >
              {getCollectionInitials(selectedAlias)}
            </Avatar>
          ) : (
            <Avatar
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'grey.300',
                color: 'grey.600'
              }}
            >
              <CollectionsBookmark />
            </Avatar>
          )}

          {/* Collection Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {selectedAlias ? (
              <>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    fontSize: '1.1rem',
                    lineHeight: 1.2,
                    mb: 0.5
                  }}
                >
                  {selectedAlias}
                </Typography>
                {selectedCollection?.description && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.875rem',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {truncateDescription(selectedCollection.description, 80)}
                  </Typography>
                )}
              </>
            ) : (
              <Typography
                variant="h6"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                  fontSize: '1.1rem'
                }}
              >
                {config.collection_selector_sentence || 'Select a collection...'}
              </Typography>
            )}
          </Box>

          {/* Action Icons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: 20,
                  height: 20,
                  border: '2px solid #e0e0e0',
                  borderTop: '2px solid #1976d2',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              </Box>
            )}
            
            {selectedAlias && !isLoading && (
              <Tooltip title="Clear selection">
                <IconButton
                  size="small"
                  onClick={handleClearSelection}
                  sx={{
                    bgcolor: 'error.light',
                    color: 'error.contrastText',
                    '&:hover': { bgcolor: 'error.main' }
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            <IconButton
              size="small"
              sx={{
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease',
                '&:hover': { bgcolor: 'primary.main' }
              }}
            >
              <ExpandMore />
            </IconButton>
          </Box>
        </Box>

        {/* Collection Count Badge */}
        {aliases.length > 0 && (
          <Chip
            label={`${aliases.length} collection${aliases.length !== 1 ? 's' : ''} available`}
            size="small"
            sx={{
              position: 'absolute',
              top: -8,
              right: 12,
              bgcolor: 'success.main',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          />
        )}
      </Paper>

      {/* Dropdown */}
      <Fade in={isOpen} timeout={300}>
        <Paper
          ref={dropdownRef}
          elevation={12}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 1,
            borderRadius: 3,
            background: 'white',
            border: `1px solid ${theme.palette.divider}`,
            zIndex: 1000,
            maxHeight: isMobile ? '70vh' : '500px',
            overflow: 'hidden',
            minWidth: isMobile ? '100%' : 400
          }}
          style={{ display: isOpen ? 'block' : 'none' }}
        >
          {/* Search Header */}
          <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <TextField
              ref={searchInputRef}
              fullWidth
              size="small"
              placeholder="Search collections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchTerm('')}
                      edge="end"
                    >
                      <Close />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  }
                }
              }}
            />
            
            {searchTerm && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {processedCollections.length} result{processedCollections.length !== 1 ? 's' : ''} found
              </Typography>
            )}
          </Box>

          {/* Collections List */}
          <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
            {/* Default Option */}
            <Card
              variant="outlined"
              onClick={() => handleCollectionSelect('')}
              sx={{
                m: 1,
                cursor: 'pointer',
                borderRadius: 2,
                border: selectedAlias === '' ? '2px solid' : '1px solid',
                borderColor: selectedAlias === '' ? 'primary.main' : 'divider',
                bgcolor: selectedAlias === '' ? 'primary.light' : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: selectedAlias === '' ? 'primary.light' : 'action.hover',
                  transform: 'translateX(4px)',
                  boxShadow: theme.shadows[2]
                }
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'grey.300', color: 'grey.600' }}>
                    <CollectionsBookmark />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {config.collection_selector_sentence || 'Select a collection...'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Choose from the available collections below
                    </Typography>
                  </Box>
                  {selectedAlias === '' && (
                    <Check color="primary" />
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Collection Options */}
            {processedCollections.length > 0 ? (
              processedCollections.map((collection, index) => (
                <Zoom
                  key={collection.name}
                  in={true}
                  timeout={200 + index * 50}
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <Card
                    variant="outlined"
                    onClick={() => handleCollectionSelect(collection.name)}
                    sx={{
                      m: 1,
                      cursor: 'pointer',
                      borderRadius: 2,
                      border: collection.isSelected ? '2px solid' : '1px solid',
                      borderColor: collection.isSelected ? 'primary.main' : 'divider',
                      bgcolor: collection.isSelected ? 'primary.light' : 'transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: collection.isSelected ? 'primary.light' : 'action.hover',
                        transform: 'translateX(4px)',
                        boxShadow: theme.shadows[2]
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Avatar
                          sx={{
                            bgcolor: collection.isSelected ? 'primary.main' : 'secondary.main',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                          }}
                        >
                          {getCollectionInitials(collection.name)}
                        </Avatar>
                        
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: collection.isSelected ? 'primary.main' : 'text.primary',
                              fontSize: '1rem',
                              lineHeight: 1.2,
                              mb: 0.5
                            }}
                          >
                            {collection.name}
                          </Typography>
                          
                          {collection.description && (
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'text.secondary',
                                fontSize: '0.875rem',
                                lineHeight: 1.4,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical'
                              }}
                            >
                              {collection.description}
                            </Typography>
                          )}
                          
                          {/* Highlight search matches */}
                          {searchTerm && collection.matchesSearch && (
                            <Chip
                              label="Match"
                              size="small"
                              color="info"
                              sx={{ mt: 1, fontSize: '0.75rem' }}
                            />
                          )}
                        </Box>
                        
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          {collection.isSelected && (
                            <Check color="primary" />
                          )}
                          
                          {collection.description && (
                            <Tooltip
                              title={
                                <Box>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                    {collection.name}
                                  </Typography>
                                  <Typography variant="body2">
                                    {collection.description}
                                  </Typography>
                                </Box>
                              }
                              placement="left"
                              arrow
                            >
                              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                                <Info fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Zoom>
              ))
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Storage sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No collections found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchTerm ? 'Try adjusting your search terms' : 'No collections are available'}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Fade>

      {/* Add keyframe animation for loading spinner */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};

export default AliasSelector;