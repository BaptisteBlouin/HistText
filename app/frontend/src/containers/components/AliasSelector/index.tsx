import React, { useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Fade,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useAuth } from '../../../hooks/useAuth';
import { useAliasSelectorState } from './hooks/useAliasSelectorState';
import { useProcessedCollections } from './hooks/useProcessedCollections';
import { useAliasSelectorKeyboard } from './hooks/useAliasSelectorKeyboard';
import { useClickOutside } from './hooks/useClickOutside';
import SelectorButton from './components/SelectorButton';
import SearchHeader from './components/SearchHeader';
import CollectionsList from './components/CollectionsList';

interface AliasSelectorProps {
  aliases: string[];
  selectedAlias: string;
  onAliasChange: (alias: string) => void;
  descriptions: Record<string, string>;
}

const AliasSelector: React.FC<AliasSelectorProps> = React.memo(({
  aliases,
  selectedAlias,
  onAliasChange,
  descriptions,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated } = useAuth();
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    isOpen,
    searchTerm,
    setSearchTerm,
    isLoading,
    setIsLoading,
    toggleDropdown,
    closeDropdown,
    clearSearch
  } = useAliasSelectorState();

  const { processedCollections, selectedCollection } = useProcessedCollections(
    aliases,
    descriptions,
    selectedAlias,
    searchTerm
  );

  // Custom hooks for behavior
  useClickOutside(dropdownRef, closeDropdown);
  useAliasSelectorKeyboard(isOpen, closeDropdown, searchInputRef);

  const handleCollectionSelect = useCallback((alias: string) => {
    setIsLoading(true);
    onAliasChange(alias);
    closeDropdown();
    
    // Simulate loading state
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, [onAliasChange, closeDropdown, setIsLoading]);

  const handleClearSelection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAliasChange('');
  }, [onAliasChange]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box ref={containerRef} sx={{ position: 'relative', minWidth: isMobile ? '100%' : 300 }}>
      {/* Main Selector Button */}
      <SelectorButton
        selectedCollection={selectedCollection}
        selectedAlias={selectedAlias}
        aliasesLength={aliases.length}
        isOpen={isOpen}
        isLoading={isLoading}
        onToggle={toggleDropdown}
        onClear={handleClearSelection}
      />

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
          <SearchHeader
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onClearSearch={clearSearch}
            resultsCount={processedCollections.length}
            searchInputRef={searchInputRef}
          />

          {/* Collections List */}
          <CollectionsList
            processedCollections={processedCollections}
            selectedAlias={selectedAlias}
            searchTerm={searchTerm}
            onCollectionSelect={handleCollectionSelect}
          />
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
});

AliasSelector.displayName = 'AliasSelector';

export default AliasSelector;