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

/**
 * AliasSelector component for selecting a Solr collection alias.
 * Includes dropdown, search, and selection features.
 *
 * @param aliases - Array of available alias strings.
 * @param selectedAlias - Currently selected alias.
 * @param onAliasChange - Callback when alias changes.
 * @param descriptions - Mapping from alias to description.
 */
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

  // State and handlers for dropdown, search, and loading
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

  // Get processed collection objects and selected collection details
  const { processedCollections, selectedCollection } = useProcessedCollections(
    aliases,
    descriptions,
    selectedAlias,
    searchTerm
  );

  // Close dropdown on outside click, and handle ESC key & search input focus
  useClickOutside(dropdownRef, closeDropdown);
  useAliasSelectorKeyboard(isOpen, closeDropdown, searchInputRef);

  /**
   * Handle selecting a collection from the list.
   * Triggers parent onAliasChange and closes dropdown with simulated loading.
   */
  const handleCollectionSelect = useCallback((alias: string) => {
    setIsLoading(true);
    onAliasChange(alias);
    closeDropdown();
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, [onAliasChange, closeDropdown, setIsLoading]);

  /**
   * Handle clearing the current selection.
   */
  const handleClearSelection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAliasChange('');
  }, [onAliasChange]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box ref={containerRef} sx={{ position: 'relative', minWidth: isMobile ? '100%' : 300 }}>
      <SelectorButton
        selectedCollection={selectedCollection}
        selectedAlias={selectedAlias}
        aliasesLength={aliases.length}
        isOpen={isOpen}
        isLoading={isLoading}
        onToggle={toggleDropdown}
        onClear={handleClearSelection}
      />

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
          <SearchHeader
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onClearSearch={clearSearch}
            resultsCount={processedCollections.length}
            searchInputRef={searchInputRef}
          />
          <CollectionsList
            processedCollections={processedCollections}
            selectedAlias={selectedAlias}
            searchTerm={searchTerm}
            onCollectionSelect={handleCollectionSelect}
          />
        </Paper>
      </Fade>

      {/* Keyframe animation for loading spinner */}
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