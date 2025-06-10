import React, { useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { Box, Paper, Fade, useTheme, useMediaQuery } from "@mui/material";
import { useAuth } from "../../../hooks/useAuth";
import { useSolrDatabaseSelectorState } from "./hooks/useSolrDatabaseSelectorState";
import { useProcessedDatabases } from "./hooks/useProcessedDatabases";
import { useAliasSelectorKeyboard } from "../AliasSelector/hooks/useAliasSelectorKeyboard";
import { useClickOutside } from "../AliasSelector/hooks/useClickOutside";
import DatabaseSelectorButton from "./components/DatabaseSelectorButton";
import DatabaseSearchHeader from "./components/DatabaseSearchHeader";
import DatabasesList from "./components/DatabasesList";

interface SolrDatabase {
  id: number;
  name: string;
  local_port: number;
  description?: string;
}

interface SolrDatabaseSelectorProps {
  solrDatabases: SolrDatabase[];
  selectedSolrDatabase: SolrDatabase | null;
  onSolrDatabaseChange: (database: SolrDatabase | null) => void;
}

export interface SolrDatabaseSelectorHandle {
  openDropdown: () => void;
}

const SolrDatabaseSelector = forwardRef<SolrDatabaseSelectorHandle, SolrDatabaseSelectorProps>(
  ({ solrDatabases, selectedSolrDatabase, onSolrDatabaseChange }, ref) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
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
      openDropdown,
      clearSearch,
    } = useSolrDatabaseSelectorState();

    const { processedDatabases, selectedDatabase } = useProcessedDatabases(
      solrDatabases,
      selectedSolrDatabase,
      searchTerm,
    );

    const handleDatabaseSelect = useCallback(
      (database: SolrDatabase | null) => {
        setIsLoading(true);
        onSolrDatabaseChange(database);
        closeDropdown();

        // Simulate loading state
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      },
      [onSolrDatabaseChange, closeDropdown, setIsLoading],
    );

    /**
     * Handle selecting the first filtered database (for Enter key).
     */
    const handleSelectFirst = useCallback(() => {
      if (processedDatabases.length > 0) {
        handleDatabaseSelect(processedDatabases[0].database);
      }
    }, [processedDatabases, handleDatabaseSelect]);

    // Reuse keyboard and click outside hooks from AliasSelector
    useClickOutside(dropdownRef, closeDropdown);
    useAliasSelectorKeyboard(isOpen, closeDropdown, searchInputRef, handleSelectFirst);

    // Expose openDropdown function through ref
    useImperativeHandle(ref, () => ({
      openDropdown,
    }), [openDropdown]);

    // Auto-focus search input when dropdown opens
    useEffect(() => {
      if (isOpen && searchInputRef.current) {
        // Small delay to ensure the dropdown is rendered
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 150);
        return () => clearTimeout(timer);
      }
    }, [isOpen]);

    const handleClearSelection = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSolrDatabaseChange(null);
      },
      [onSolrDatabaseChange],
    );

    if (!isAuthenticated) {
      return null;
    }

    return (
      <Box
        ref={containerRef}
        sx={{ position: "relative", minWidth: isMobile ? "100%" : 300 }}
      >
        {/* Main Selector Button */}
        <DatabaseSelectorButton
          selectedDatabase={selectedDatabase}
          selectedSolrDatabase={selectedSolrDatabase}
          solrDatabasesLength={solrDatabases.length}
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
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              mt: 1,
              borderRadius: 3,
              bgcolor: "background.paper",
              border: `1px solid ${theme.palette.divider}`,
              zIndex: 1000,
              maxHeight: isMobile ? "70vh" : "500px",
              overflow: "hidden",
              minWidth: isMobile ? "100%" : 400,
            }}
            style={{ display: isOpen ? "block" : "none" }}
          >
            {/* Search Header */}
            <DatabaseSearchHeader
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onClearSearch={clearSearch}
              resultsCount={processedDatabases.length}
              searchInputRef={searchInputRef}
            />

            {/* Databases List */}
            <DatabasesList
              processedDatabases={processedDatabases}
              selectedSolrDatabase={selectedSolrDatabase}
              searchTerm={searchTerm}
              onDatabaseSelect={handleDatabaseSelect}
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
  }
);

SolrDatabaseSelector.displayName = "SolrDatabaseSelector";

export default React.memo(SolrDatabaseSelector);
