import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  CircularProgress,
} from "@mui/material";
import { Storage } from "@mui/icons-material";
import axios from "axios";

import { GradientPaper, StatusChip } from "../../../components/ui";
import { useResponsive } from "../../../lib/responsive-utils";
import AliasSelector, { AliasSelectorHandle } from "../AliasSelector";
import SolrDatabaseSelector, { SolrDatabaseSelectorHandle } from "../SolrDatabaseSelector";
import StatusIndicators from "./StatusIndicators";

/**
 * Info about a collection within a Solr database.
 */
interface CollectionInfo {
  collection_name: string;
  description: string;
  embeddings: string;
  lang: string | null;
  text_field: string;
  tokenizer: string | null;
  to_not_display: string[];
}

/**
 * Props for the DatabaseSelectorCard component, managing Solr DB and collection selection.
 */
interface DatabaseSelectorCardProps {
  solrDatabases: any[];
  selectedSolrDatabase: any;
  onSolrDatabaseChange: (database: any) => void;
  aliases: string[];
  selectedAlias: string;
  onAliasChange: (alias: string) => void;
  allResults: any[];
  isDataLoading: boolean;
  isStatsLoading: boolean;
  isCloudLoading: boolean;
  isNERLoading: boolean;
  statsReady: boolean;
  stats: any;
  totalEntities: number;
  onOpenDatabaseSelector?: () => void;
}

export interface DatabaseSelectorCardHandle {
  openDatabaseSelector: () => void;
}

/**
 * Card UI for selecting Solr database and collection, displaying status,
 * and fetching/displaying collection descriptions via API.
 *
 * @param props - DatabaseSelectorCardProps
 * @returns Card element with Solr DB/collection controls and status indicators.
 */
const DatabaseSelectorCard = forwardRef<DatabaseSelectorCardHandle, DatabaseSelectorCardProps>(({
  solrDatabases,
  selectedSolrDatabase,
  onSolrDatabaseChange,
  aliases,
  selectedAlias,
  onAliasChange,
  allResults,
  isDataLoading,
  isStatsLoading,
  isCloudLoading,
  isNERLoading,
  statsReady,
  stats,
  totalEntities,
  onOpenDatabaseSelector,
}, ref) => {
  const [collectionDescriptions, setCollectionDescriptions] = useState<
    Record<string, string>
  >({});
  const [isLoadingDescriptions, setIsLoadingDescriptions] = useState(false);
  const { isMobile, isTablet } = useResponsive();
  const solrDatabaseSelectorRef = useRef<SolrDatabaseSelectorHandle>(null);
  const aliasSelectorRef = useRef<AliasSelectorHandle>(null);

  // Enhanced database change handler that auto-opens alias selector
  const handleDatabaseChangeWithAutoOpen = useCallback((database: any) => {
    // Call the original handler
    onSolrDatabaseChange(database);
    
    // If a database was selected (not null), auto-open the alias selector after a short delay
    if (database) {
      setTimeout(() => {
        aliasSelectorRef.current?.openDropdown();
      }, 500); // Wait for database change to complete
    }
  }, [onSolrDatabaseChange]);

  // Expose openDatabaseSelector function through ref
  useImperativeHandle(ref, () => ({
    openDatabaseSelector: () => {
      solrDatabaseSelectorRef.current?.openDropdown();
    },
  }), []);

  // Fetch collection descriptions when the selected Solr database changes
  useEffect(() => {
    if (selectedSolrDatabase && selectedSolrDatabase.id) {
      setIsLoadingDescriptions(true);
      console.log(
        "Fetching descriptions for database ID:",
        selectedSolrDatabase.id,
      );

      axios
        .get(
          `/api/solr_database_info?solr_database_id=${selectedSolrDatabase.id}`,
        )
        .then((response) => {
          console.log("Collection info response:", response.data);

          const mapping: Record<string, string> = {};
          if (Array.isArray(response.data)) {
            response.data.forEach((info: CollectionInfo) => {
              mapping[info.collection_name] =
                info.description || "No description available";
            });
          }

          console.log("Created description mapping:", mapping);
          setCollectionDescriptions(mapping);
        })
        .catch((error) => {
          console.error("Failed to fetch collection descriptions:", error);
          setCollectionDescriptions({});
        })
        .finally(() => {
          setIsLoadingDescriptions(false);
        });
    } else {
      setCollectionDescriptions({});
    }
  }, [selectedSolrDatabase]);

  return (
    <GradientPaper gradient="primary" sx={{ mb: { xs: 2, sm: 3 }, overflow: "visible" }}>
      <CardContent sx={{ 
        color: "white",
        p: { xs: 2, sm: 3 },
        '&:last-child': { pb: { xs: 2, sm: 3 } }
      }}>
        <Typography
          variant={isMobile ? "subtitle1" : "h6"}
          gutterBottom
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontWeight: 600,
            fontSize: { xs: '1.125rem', sm: '1.25rem' },
          }}
        >
          <Storage sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
          {isMobile ? "Data Source" : "Data Source Configuration"}
        </Typography>

        <Grid container spacing={{ xs: 2, sm: 3 }} alignItems="flex-start">
          <Grid item xs={12} md={6}>
            <Typography 
              variant="subtitle2" 
              gutterBottom 
              sx={{ 
                opacity: 0.9,
                fontSize: { xs: '0.8125rem', sm: '0.875rem' }
              }}
            >
              {isMobile ? "Database" : "Solr Database"}
            </Typography>
            <SolrDatabaseSelector
              ref={solrDatabaseSelectorRef}
              solrDatabases={solrDatabases}
              selectedSolrDatabase={selectedSolrDatabase}
              onSolrDatabaseChange={handleDatabaseChangeWithAutoOpen}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  opacity: 0.9,
                  fontSize: { xs: '0.8125rem', sm: '0.875rem' }
                }}
              >
                Collection
              </Typography>
              {isLoadingDescriptions && (
                <CircularProgress size={isMobile ? 10 : 12} sx={{ color: "white" }} />
              )}
            </Box>
            <AliasSelector
              ref={aliasSelectorRef}
              aliases={aliases}
              selectedAlias={selectedAlias}
              onAliasChange={onAliasChange}
              descriptions={collectionDescriptions}
            />
          </Grid>
        </Grid>

        <StatusIndicators
          selectedSolrDatabase={selectedSolrDatabase}
          selectedAlias={selectedAlias}
          collectionDescriptions={collectionDescriptions}
          allResults={allResults}
          isDataLoading={isDataLoading}
          isStatsLoading={isStatsLoading}
          isCloudLoading={isCloudLoading}
          isNERLoading={isNERLoading}
          statsReady={statsReady}
          stats={stats}
          totalEntities={totalEntities}
        />
      </CardContent>
    </GradientPaper>
  );
});

DatabaseSelectorCard.displayName = "DatabaseSelectorCard";

export default React.memo(DatabaseSelectorCard);
