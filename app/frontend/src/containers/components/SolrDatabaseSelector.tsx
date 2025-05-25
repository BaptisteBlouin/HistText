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
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search,
  ExpandMore,
  Info,
  Storage,
  Check,
  Close,
  DnsRounded // Using this instead of Database
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import config from '../../../config.json';

interface SolrDatabase {
  id: number;
  name: string;
  local_port: number;
  description?: string;
  // Add other fields if necessary
}

interface SolrDatabaseSelectorProps {
  solrDatabases: SolrDatabase[];
  selectedSolrDatabase: SolrDatabase | null;
  onSolrDatabaseChange: (database: SolrDatabase | null) => void;
}

interface DatabaseInfo {
  database: SolrDatabase;
  isSelected: boolean;
  matchesSearch: boolean;
}

const SolrDatabaseSelector: React.FC<SolrDatabaseSelectorProps> = ({
  solrDatabases,
  selectedSolrDatabase,
  onSolrDatabaseChange,
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

  // Process databases with search filtering
  const processedDatabases = useMemo(() => {
    const databases: DatabaseInfo[] = solrDatabases.map(db => ({
      database: db,
      isSelected: db.id === selectedSolrDatabase?.id,
      matchesSearch: !searchTerm || 
        db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (db.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    }));

    return databases.filter(db => db.matchesSearch);
  }, [solrDatabases, selectedSolrDatabase, searchTerm]);

  const selectedDatabase = useMemo(() => 
    processedDatabases.find(db => db.isSelected) || null
  , [processedDatabases]);

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

  const handleDatabaseSelect = (database: SolrDatabase | null) => {
    setIsLoading(true);
    onSolrDatabaseChange(database);
    setIsOpen(false);
    setSearchTerm('');
    
    // Simulate loading state
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSolrDatabaseChange(null);
  };

  const truncateDescription = (description: string, maxLength: number = 80) => {
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
  };

  const getDatabaseInitials = (name: string) => {
    return name
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const getDatabaseDescription = (database: SolrDatabase) => {
    return database.description || ``;
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
          background: selectedSolrDatabase 
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
          {/* Database Icon/Avatar */}
          {selectedSolrDatabase ? (
            <Avatar
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'secondary.main',
                color: 'white',
                fontWeight: 600,
                fontSize: '1rem'
              }}
            >
              {getDatabaseInitials(selectedSolrDatabase.name)}
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
              <DnsRounded />
            </Avatar>
          )}

          {/* Database Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {selectedSolrDatabase ? (
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
                  {selectedSolrDatabase.name}
                </Typography>
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
                  {truncateDescription(getDatabaseDescription(selectedSolrDatabase), 80)}
                </Typography>
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
                {config.solr_selector_sentence || 'Select a database...'}
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
            
            {selectedSolrDatabase && !isLoading && (
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
                bgcolor: 'secondary.light',
                color: 'secondary.contrastText',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease',
                '&:hover': { bgcolor: 'secondary.main' }
              }}
            >
              <ExpandMore />
            </IconButton>
          </Box>
        </Box>

        {/* Database Count Badge */}
        {solrDatabases.length > 0 && (
          <Chip
            label={`${solrDatabases.length} database${solrDatabases.length !== 1 ? 's' : ''} available`}
            size="small"
            sx={{
              position: 'absolute',
              top: -8,
              right: 12,
              bgcolor: 'secondary.main',
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
              placeholder="Search databases..."
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
                    borderColor: 'secondary.main',
                  }
                }
              }}
            />
            
            {searchTerm && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {processedDatabases.length} result{processedDatabases.length !== 1 ? 's' : ''} found
              </Typography>
            )}
          </Box>

          {/* Databases List */}
          <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
            {/* Default Option */}
            <Card
              variant="outlined"
              onClick={() => handleDatabaseSelect(null)}
              sx={{
                m: 1,
                cursor: 'pointer',
                borderRadius: 2,
                border: selectedSolrDatabase === null ? '2px solid' : '1px solid',
                borderColor: selectedSolrDatabase === null ? 'secondary.main' : 'divider',
                bgcolor: selectedSolrDatabase === null ? 'secondary.light' : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: selectedSolrDatabase === null ? 'secondary.light' : 'action.hover',
                  transform: 'translateX(4px)',
                  boxShadow: theme.shadows[2]
                }
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'grey.300', color: 'grey.600' }}>
                    <DnsRounded />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {config.solr_selector_sentence || 'Select a database...'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Choose from the available databases below
                    </Typography>
                  </Box>
                  {selectedSolrDatabase === null && (
                    <Check color="secondary" />
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Database Options */}
            {processedDatabases.length > 0 ? (
              processedDatabases.map((dbInfo, index) => (
                <Zoom
                  key={dbInfo.database.id}
                  in={true}
                  timeout={200 + index * 50}
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <Card
                    variant="outlined"
                    onClick={() => handleDatabaseSelect(dbInfo.database)}
                    sx={{
                      m: 1,
                      cursor: 'pointer',
                      borderRadius: 2,
                      border: dbInfo.isSelected ? '2px solid' : '1px solid',
                      borderColor: dbInfo.isSelected ? 'secondary.main' : 'divider',
                      bgcolor: dbInfo.isSelected ? 'secondary.light' : 'transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: dbInfo.isSelected ? 'secondary.light' : 'action.hover',
                        transform: 'translateX(4px)',
                        boxShadow: theme.shadows[2]
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Avatar
                          sx={{
                            bgcolor: dbInfo.isSelected ? 'secondary.main' : 'info.main',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                          }}
                        >
                          {getDatabaseInitials(dbInfo.database.name)}
                        </Avatar>
                        
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: dbInfo.isSelected ? 'secondary.main' : 'text.primary',
                              fontSize: '1rem',
                              lineHeight: 1.2,
                              mb: 0.5
                            }}
                          >
                            {dbInfo.database.name}
                          </Typography>
                          
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
                            {getDatabaseDescription(dbInfo.database)}
                          </Typography>

                          
                          {/* Highlight search matches */}
                          {searchTerm && dbInfo.matchesSearch && (
                            <Chip
                              label="Match"
                              size="small"
                              color="secondary"
                              sx={{ mt: 1, ml: 1, fontSize: '0.75rem' }}
                            />
                          )}
                        </Box>
                        
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          {dbInfo.isSelected && (
                            <Check color="secondary" />
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
                  No databases found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchTerm ? 'Try adjusting your search terms' : 'No databases are available'}
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

export default SolrDatabaseSelector;