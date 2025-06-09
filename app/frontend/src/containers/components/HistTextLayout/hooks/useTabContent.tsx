import React, { useCallback, useMemo } from "react";
import { Box, Typography } from "@mui/material";
import {
  Search,
  Storage,
  TableRows,
  TableChart,
  Analytics,
  AccountTree,
} from "@mui/icons-material";
import { Cloud as CloudIcon } from "@mui/icons-material";

import EmptyState from "../../EmptyState";
import MetadataForm from "../../MetadataForm";
import DataGrid from "../../DataGrid";
import StatisticsDisplay from "../../StatisticsDisplay";
import Cloud from "../../Cloud";
import NERDisplay from "../../NERDisplay";

// Constants for tab indices
const TABS = {
  QUERY: 0,
  PARTIAL_RESULTS: 1,
  ALL_RESULTS: 2,
  STATS: 3,
  CLOUD: 4,
  NER: 5,
} as const;

/**
 * Provides a function to render tab content for a text analytics dashboard.
 * Selects components and empty states based on tab, data, and fullscreen state.
 *
 * @param data - Object containing current data, form state, results, loading, etc.
 * @param actions - Object with handler functions for queries, database switching, etc.
 * @param fullscreenState - Object describing the current fullscreen mode.
 *
 * @returns Object containing:
 *   - renderTabContent(tabIndex): React element for the given tab index
 */
export const useTabContent = (
  data: any,
  actions: any,
  fullscreenState: any,
) => {
  /**
   * Memoized action for the EmptyState, disabled when in fullscreen.
   */
  const emptyStateAction = useMemo(() => {
    if (fullscreenState.isAnyFullscreen) return undefined;

    return {
      label: "Choose Data Source",
      icon: <Search />,
      onClick: () => {},
    };
  }, [fullscreenState.isAnyFullscreen]);

  /**
   * Returns the content for a given tab, including empty states and loading indicators.
   */
  const renderTabContent = useCallback(
    (tabIndex: number) => {
      const tabContentStyles = { p: fullscreenState.isAnyFullscreen ? 2 : 3 };

      switch (tabIndex) {
        case TABS.QUERY:
          if (data.selectedAlias && data.metadata.length > 0) {
            return (
              <Box sx={tabContentStyles}>
                <MetadataForm
                  metadata={data.metadata}
                  formData={data.formData}
                  setFormData={data.setFormData}
                  dateRange={data.dateRange}
                  handleQuery={actions.handleQuery}
                  getNER={data.getNER}
                  setGetNER={data.setGetNER}
                  downloadOnly={data.downloadOnly}
                  setdownloadOnly={data.setdownloadOnly}
                  statsLevel={data.statsLevel}
                  setStatsLevel={data.setStatsLevel}
                  docLevel={data.docLevel}
                  setDocLevel={data.setDocLevel}
                  solrDatabaseId={data.selectedSolrDatabase?.id || null}
                  selectedAlias={data.selectedAlias}
                  allResults={data.allResults}
                  availableDatabases={data.availableDatabases || []}
                  availableCollections={data.allCollections || {}}
                  onDatabaseChange={actions.handleSolrDatabaseChange}
                  onAliasChange={actions.handleAliasChange}
                  onSwitchAndApply={actions.handleSwitchAndApplySearch}
                />
              </Box>
            );
          }
          return (
            <EmptyState
              icon={<Storage />}
              title="Get Started"
              description="Select a database and collection from above to begin your text analysis journey"
              action={emptyStateAction}
            />
          );

        case TABS.PARTIAL_RESULTS:
          return data.partialResults.length > 0 ? (
            <DataGrid
              results={data.partialResults}
              formData={data.formData}
              nerData={data.nerData}
              viewNER={data.viewNER}
              selectedAlias={data.selectedAlias}
              selectedSolrDatabase={data.selectedSolrDatabase}
              authAxios={data.authAxios}
            />
          ) : (
            <EmptyState
              icon={<TableRows />}
              title="No partial results available"
              description="Execute a query to see results"
            />
          );

        case TABS.ALL_RESULTS:
          return data.allResults.length > 0 ? (
            <DataGrid
              results={data.allResults}
              formData={data.formData}
              nerData={data.nerData}
              viewNER={false}
              selectedAlias={data.selectedAlias}
              selectedSolrDatabase={data.selectedSolrDatabase}
              authAxios={data.authAxios}
            />
          ) : (
            <EmptyState
              icon={<TableChart />}
              title="No complete results available"
              description="Execute a query to see the full dataset"
            />
          );

        case TABS.STATS:
          return data.stats ? (
            <StatisticsDisplay
              stats={data.stats}
              selectedStat={data.selectedStat}
              onStatChange={data.setSelectedStat}
            />
          ) : (
            <EmptyState
              icon={<Analytics />}
              title={
                data.isStatsLoading
                  ? "Generating statistics..."
                  : "No statistics available"
              }
              description={
                data.isStatsLoading
                  ? "This may take a moment for large datasets"
                  : "Execute a query to generate statistical analysis"
              }
            />
          );

        case TABS.CLOUD:
          if (data.isCloudLoading) {
            return (
              <Box sx={{ textAlign: "center", py: 8 }}>
                <CloudIcon
                  sx={{
                    fontSize: 64,
                    color: "text.secondary",
                    mb: 2,
                    opacity: 0.5,
                  }}
                />
                <Typography variant="h6" gutterBottom>
                  Generating Word Cloud...
                </Typography>
              </Box>
            );
          }

          return data.wordFrequency && data.wordFrequency.length > 0 ? (
            <Box
              sx={{
                p: fullscreenState.isAnyFullscreen ? 1 : 3,
                minHeight: "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Cloud wordFrequency={data.wordFrequency} />
            </Box>
          ) : (
            <EmptyState
              icon={<CloudIcon />}
              title="No word cloud data available"
              description="Execute a query with text data to generate word cloud"
            />
          );

        case TABS.NER:
          return data.nerData && Object.keys(data.nerData).length > 0 ? (
            <NERDisplay
              nerData={data.nerData}
              authAxios={data.authAxios}
              selectedAlias={data.selectedAlias}
              selectedSolrDatabase={data.selectedSolrDatabase}
              viewNER={data.viewNER}
            />
          ) : (
            <EmptyState
              icon={<AccountTree />}
              title={
                data.isNERLoading
                  ? "Processing NER data..."
                  : "No NER data available"
              }
              description={
                data.isNERLoading
                  ? "Analyzing entities in your text"
                  : "Enable NER in query options to extract named entities"
              }
            />
          );

        default:
          return null;
      }
    },
    [data, actions, fullscreenState.isAnyFullscreen, emptyStateAction],
  );

  return { renderTabContent };
};
