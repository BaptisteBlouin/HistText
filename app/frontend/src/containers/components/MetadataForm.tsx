// app/frontend/src/containers/components/MetadataForm.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  Chip,
} from "@mui/material";
import { PlayArrow, QueryStats, CheckCircle } from "@mui/icons-material";
import axios from "axios";
import config from "../../../config.json";
import { buildQueryString } from "./buildQueryString";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../lib/responsive-utils";
import { useEmbeddings } from "./MetadataForm/hooks/useEmbeddings";
import { useSmartValidation } from "../../hooks/useSmartValidation";
import { useSearchHistory, SavedSearch } from "../../hooks/useSearchHistory";
import {
  shouldExcludeField,
  isTextField,
  sortFieldsByPriority,
} from "./MetadataForm/utils/fieldUtils";
import FormHeader from "./MetadataForm/components/FormHeader";
import FormField from "./MetadataForm/components/FormField";
import DateRangeField from "./MetadataForm/components/DateRangeField";
import QueryOptions from "./MetadataForm/components/QueryOptions";
import CodeGeneration from "./MetadataForm/components/CodeGeneration";
import EmbeddingTools from "./MetadataForm/components/EmbeddingTools";
import SearchHistoryIntegration from "./MetadataForm/components/SearchHistoryIntegration";
import SearchHistoryPanel from "./SearchHistory/SearchHistoryPanel";

type StatsLevel = (typeof config.statsLevelOptions)[number];
type DocLevel = (typeof config.docLevelOptions)[number];

interface CollectionInfo {
  solr_database_id: number;
  collection_name: string;
  description: string;
  embeddings: string;
  lang: string | null;
  text_field: string;
  tokenizer: string | null;
  to_not_display: string[];
}

interface MetadataFormProps {
  metadata: any[];
  formData: {
    [key: string]: { value: string; operator: string; not?: boolean }[];
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      [key: string]: { value: string; operator: string; not?: boolean }[];
    }>
  >;
  dateRange: { min: string; max: string } | null;
  handleQuery: (
    e: React.FormEvent,
    onlyComputeStats: boolean,
    getNER: boolean,
    downloadOnly: boolean,
    statsLevel: StatsLevel,
    docLevel: DocLevel,
  ) => void;
  getNER: boolean;
  setGetNER: React.Dispatch<React.SetStateAction<boolean>>;
  downloadOnly: boolean;
  setdownloadOnly: React.Dispatch<React.SetStateAction<boolean>>;
  statsOnly: boolean;
  setStatsOnly: React.Dispatch<React.SetStateAction<boolean>>;
  statsLevel: StatsLevel;
  setStatsLevel: React.Dispatch<React.SetStateAction<StatsLevel>>;
  docLevel: DocLevel;
  setDocLevel: React.Dispatch<React.SetStateAction<DocLevel>>;
  solrDatabaseId: number | null;
  selectedAlias: string;
  allResults?: any[];
  // Search history integration props
  availableDatabases?: Array<{ id: number; name: string }>;
  availableCollections?: Record<number, string[]>;
  onDatabaseChange?: (database: any) => void;
  onAliasChange?: (alias: string) => void;
  onSwitchAndApply?: (search: any) => Promise<void>;
}

const MetadataForm: React.FC<MetadataFormProps> = ({
  metadata,
  formData,
  setFormData,
  dateRange,
  handleQuery,
  getNER,
  setGetNER,
  downloadOnly,
  setdownloadOnly,
  statsOnly,
  setStatsOnly,
  statsLevel,
  setStatsLevel,
  docLevel,
  setDocLevel,
  solrDatabaseId,
  selectedAlias,
  allResults = [],
  availableDatabases,
  availableCollections,
  onDatabaseChange,
  onAliasChange,
}) => {
  const { accessToken } = useAuth();
  const { isMobile, isTablet } = useResponsive();
  const [collectionInfo, setCollectionInfo] = useState<CollectionInfo | null>(
    null,
  );
  const [hasEmbeddings, setHasEmbeddings] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEmbeddingAlert, setShowEmbeddingAlert] = useState(false);
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  // Search history hook
  const { addToHistory } = useSearchHistory();

  // Custom hooks
  const {
    neighbors,
    loadingNeighbors,
    similarityResult,
    analogyResult,
    embeddingLoading,
    getNeighbors,
    removeNeighborDropdown,
    getSimilarity,
    getAnalogy,
    setSimilarityResult,
    setAnalogyResult,
  } = useEmbeddings(solrDatabaseId, selectedAlias, accessToken || "", hasEmbeddings);

  // Smart validation hook
  const { validateField, formValidation } = useSmartValidation(
    formData,
    metadata,
    collectionInfo,
  );

  // Fetch collection info
  useEffect(() => {
    if (solrDatabaseId && selectedAlias) {
      axios
        .get(`/api/solr_database_info/${solrDatabaseId}/${selectedAlias}`)
        .then((response) => {
          setCollectionInfo(response.data);
          setHasEmbeddings(response.data.embeddings !== "none");
          if (response.data.embeddings !== "none") {
            setShowEmbeddingAlert(true);
          }
        })
        .catch((error) => {
          // Handle 404 gracefully - it's normal for some collections to not have description info
          if (error.response?.status === 404) {
            console.warn(`No description info found for collection ${selectedAlias} in database ${solrDatabaseId}`);
            // Set minimal collection info with defaults
            setCollectionInfo({
              solr_database_id: solrDatabaseId,
              collection_name: selectedAlias,
              description: "",
              embeddings: "none",
              lang: null,
              text_field: "text",
              tokenizer: null,
              to_not_display: [],
            });
            setHasEmbeddings(false);
          } else {
            console.error("Failed to fetch collection info:", error);
            setCollectionInfo(null);
            setHasEmbeddings(false);
          }
        });
    } else {
      setCollectionInfo(null);
      setHasEmbeddings(false);
    }
  }, [solrDatabaseId, selectedAlias]);

  // Initialize form data
  useEffect(() => {
    const initializedFormData: any = {};
    metadata.forEach((field: any) => {
      if (!formData[field.name]) {
        initializedFormData[field.name] = [
          { value: "", operator: "", not: false },
        ];
      }
    });
    setFormData((prevData: any) => ({ ...prevData, ...initializedFormData }));
  }, [metadata, setFormData, formData]);

  const handleSwitchAndApply = useCallback(
    async (search: SavedSearch) => {
      try {
        // Check if handlers are available
        if (!onDatabaseChange || !onAliasChange) {
          throw new Error("Database/collection switching not supported");
        }

        // Switch database if different
        if (search.selectedSolrDatabase.id !== solrDatabaseId) {
          const targetDatabase = availableDatabases?.find(
            (db) => db.id === search.selectedSolrDatabase.id,
          );
          if (!targetDatabase) {
            throw new Error("Target database not found");
          }
          await onDatabaseChange(targetDatabase);

          // Wait for database change to propagate
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Switch collection if different
        if (search.selectedAlias !== selectedAlias) {
          await onAliasChange(search.selectedAlias);

          // Wait for alias change to propagate
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Apply the form data
        setFormData(search.formData);

        // Note: You might also want to handle dateRange if it's managed at this level
      } catch (error) {
        console.error("Error switching collection and applying search:", error);
        throw error; // Re-throw to let the panel handle the error
      }
    },
    [
      solrDatabaseId,
      selectedAlias,
      availableDatabases,
      onDatabaseChange,
      onAliasChange,
      setFormData,
    ],
  );
  // Auto-save searches to history when query is executed
  const handleSubmitWithHistory = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (formValidation.canSubmit) {
        // Save to history before executing query
        if (selectedAlias && solrDatabaseId) {
          const queryString = buildQueryString(formData, dateRange);

          // Generate a default name for the search
          const keyTerms: string[] = [];
          Object.entries(formData).forEach(
            ([field, entries]: [string, any]) => {
              entries.forEach((entry: any) => {
                if (entry.value && entry.value.trim()) {
                  keyTerms.push(entry.value.trim());
                }
              });
            },
          );

          const termsPart = keyTerms.slice(0, 2).join(", ");
          const defaultName = `${selectedAlias}: ${termsPart}`.slice(0, 80);

          const searchData: Omit<SavedSearch, "id" | "createdAt" | "lastUsed"> =
            {
              name: defaultName || `Search in ${selectedAlias}`,
              formData,
              dateRange,
              selectedAlias,
              selectedSolrDatabase: {
                id: solrDatabaseId,
                name: collectionInfo?.collection_name || "Unknown",
              },
              isBookmarked: false,
              tags: [],
              queryString,
              resultsCount: allResults.length || undefined,
            };

          addToHistory(searchData);
        }

        // Execute the query
        handleQuery(e, statsOnly, getNER, downloadOnly, statsLevel, docLevel);
      }
    },
    [
      formValidation.canSubmit,
      selectedAlias,
      solrDatabaseId,
      formData,
      dateRange,
      collectionInfo,
      allResults.length,
      addToHistory,
      handleQuery,
      getNER,
      downloadOnly,
      statsOnly,
      statsLevel,
      docLevel,
    ],
  );

  // Handle applying saved search
  const handleApplySavedSearch = useCallback(
    async (search: SavedSearch) => {
      try {
        // Strict compatibility check - prevent cross-collection application
        if (!solrDatabaseId || !selectedAlias) {
          console.warn("No current database/alias selected");
          return;
        }

        if (
          search.selectedSolrDatabase.id !== solrDatabaseId ||
          search.selectedAlias !== selectedAlias
        ) {
          console.warn("Search is not compatible with current collection:", {
            searchDatabase: search.selectedSolrDatabase.id,
            searchAlias: search.selectedAlias,
            currentDatabase: solrDatabaseId,
            currentAlias: selectedAlias,
          });
          return;
        }

        // Only apply the form data if the collections match exactly
        setFormData(search.formData);

        // Note: dateRange changes would need to be handled by parent component
        // since it's typically managed at a higher level
      } catch (error) {
        console.error("Error applying saved search:", error);
      }
    },
    [solrDatabaseId, selectedAlias, setFormData],
  );

  // Handle saving current search manually
  const handleSaveCurrentSearch = useCallback(() => {
    setHistoryPanelOpen(false);
    // Add a small delay to allow the panel to close, then trigger save
    setTimeout(() => {
      // This will be handled by the SearchHistoryIntegration component
      // We can trigger it by setting a flag or calling a function
    }, 300);
  }, []);

  // Handlers
  const handleFormChange = useCallback(
    (
      event: React.ChangeEvent<
        | HTMLInputElement
        | HTMLTextAreaElement
        | { name?: string; value: unknown }
      >,
      index: number,
    ) => {
      const { name, value } = event.target;
      setFormData((prev) => ({
        ...prev,
        [name!]: (prev[name!] || []).map((entry, i) =>
          i === index ? { ...entry, value: (value as any)?.toString() || "" } : entry,
        ),
      }));
    },
    [setFormData],
  );

  const handleSelectChange = useCallback(
    (fieldName: string, newValue: string | null, index: number = 0) => {
      setFormData((prev) => ({
        ...prev,
        [fieldName]: (prev[fieldName] || []).map((entry, i) =>
          i === index ? { ...entry, value: newValue || "" } : entry,
        ),
      }));
    },
    [setFormData],
  );

  const addBooleanField = useCallback(
    (name: string, operator: string) => {
      setFormData((prev) => ({
        ...prev,
        [name]: [...(prev[name] || []), { value: "", operator, not: false }],
      }));
    },
    [setFormData],
  );

  const removeBooleanField = useCallback(
    (name: string, index: number) => {
      setFormData((prev) => ({
        ...prev,
        [name]: (prev[name] || []).filter((_, i) => i !== index),
      }));
    },
    [setFormData],
  );

  const toggleNotCondition = useCallback(
    (name: string, index: number) => {
      setFormData((prev) => ({
        ...prev,
        [name]: (prev[name] || []).map((entry, i) =>
          i === index ? { ...entry, not: !entry.not } : entry,
        ),
      }));
    },
    [setFormData],
  );

  const handleOpenEmbeddingModal = useCallback(() => {
    setEmbeddingModalOpen(true);
  }, []);

  const handleCloseEmbeddingModal = useCallback(() => {
    setEmbeddingModalOpen(false);
  }, []);

  // Filter and sort fields
  const visibleFields = sortFieldsByPriority(
    metadata.filter((field) => !shouldExcludeField(field.name, collectionInfo)),
  );

  // Check if we have any search content
  const hasSearchContent = Object.values(formData).some((entries: any) =>
    entries.some((entry: any) => entry.value && entry.value.trim()),
  );

  return (
    <Box sx={{ width: "100%" }}>
      <FormHeader
        hasEmbeddings={hasEmbeddings}
        showEmbeddingAlert={showEmbeddingAlert}
        onShowEmbeddingAlert={setShowEmbeddingAlert}
        onOpenEmbeddingModal={handleOpenEmbeddingModal}
      />

      <Card sx={{ mb: { xs: 2, sm: 3 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box component="form" onSubmit={handleSubmitWithHistory}>
            <Typography
              variant={isMobile ? "subtitle1" : "h6"}
              gutterBottom
              sx={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 1,
                fontSize: { xs: '1.125rem', sm: '1.25rem' }
              }}
            >
              <QueryStats sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
              Search Fields
            </Typography>
            {/* Search History Integration */}
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <SearchHistoryIntegration
                formData={formData}
                dateRange={dateRange}
                selectedAlias={selectedAlias}
                selectedSolrDatabase={
                  solrDatabaseId
                    ? {
                        id: solrDatabaseId,
                        name: collectionInfo?.collection_name || "Database",
                      }
                    : null
                }
                resultsCount={allResults.length || undefined}
                onShowHistory={() => setHistoryPanelOpen(true)}
              />
            </Box>
            <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 3 } }}>
              {visibleFields.map((field) => (
                <Grid 
                  item 
                  xs={12} 
                  sm={isMobile ? 12 : isTablet ? 6 : 6} 
                  md={6} 
                  lg={4} 
                  key={field.name}
                >
                  <FormField
                    field={field}
                    formData={formData}
                    collectionInfo={collectionInfo}
                    hasEmbeddings={hasEmbeddings}
                    neighbors={neighbors}
                    loadingNeighbors={loadingNeighbors}
                    metadata={metadata}
                    onFormChange={handleFormChange}
                    onSelectChange={handleSelectChange}
                    onToggleNot={toggleNotCondition}
                    onAddBooleanField={addBooleanField}
                    onRemoveBooleanField={removeBooleanField}
                    onFetchNeighbors={getNeighbors}
                    onRemoveNeighborDropdown={removeNeighborDropdown}
                  />
                </Grid>
              ))}
            </Grid>

            <DateRangeField
              dateRange={dateRange}
              formData={formData}
              onFormChange={handleFormChange}
            />

            <QueryOptions
              getNER={getNER}
              setGetNER={setGetNER}
              downloadOnly={downloadOnly}
              setDownloadOnly={setdownloadOnly}
              statsOnly={statsOnly}
              setStatsOnly={setStatsOnly}
              statsLevel={statsLevel}
              setStatsLevel={setStatsLevel}
              docLevel={docLevel}
              setDocLevel={setDocLevel}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
            />

            {/* Form Validation Summary */}
            <Box sx={{ mb: 3 }}>
              <Alert
                severity={
                  formValidation.overallStatus === "error"
                    ? "error"
                    : formValidation.overallStatus === "ready"
                      ? "success"
                      : "info"
                }
                sx={{ mb: 2 }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="body2">
                    {formValidation.summary}
                  </Typography>
                </Box>
              </Alert>
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Button
                variant="contained"
                color="primary"
                type="submit"
                size="large"
                startIcon={<PlayArrow />}
                disabled={!formValidation.canSubmit}
                sx={{
                  minWidth: 120,
                  opacity: formValidation.canSubmit ? 1 : 0.6,
                  cursor: formValidation.canSubmit ? "pointer" : "not-allowed",
                }}
              >
                Execute Query
              </Button>

              {solrDatabaseId && (
                <CodeGeneration
                  formData={formData}
                  dateRange={dateRange}
                  selectedAlias={selectedAlias}
                  solrDatabaseId={solrDatabaseId}
                  getNER={getNER}
                  downloadOnly={downloadOnly}
                  statsLevel={statsLevel}
                  accessToken={accessToken || ""}
                />
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Search History Panel */}
      <SearchHistoryPanel
        open={historyPanelOpen}
        onClose={() => setHistoryPanelOpen(false)}
        onApplySearch={handleApplySavedSearch}
        currentFormData={hasSearchContent ? formData : undefined}
        currentDateRange={dateRange}
        currentAlias={selectedAlias}
        currentSolrDatabase={
          solrDatabaseId
            ? {
                id: solrDatabaseId,
                name: collectionInfo?.collection_name || "Database",
              }
            : undefined
        }
        onSaveCurrentSearch={handleSaveCurrentSearch}
        availableDatabases={availableDatabases}
        availableCollections={availableCollections}
        onSwitchAndApply={handleSwitchAndApply}
        canSwitchCollections={!!(onDatabaseChange && onAliasChange)}
      />

      <EmbeddingTools
        hasEmbeddings={hasEmbeddings}
        embeddingLoading={embeddingLoading}
        similarityResult={similarityResult}
        analogyResult={analogyResult}
        onGetSimilarity={getSimilarity}
        onGetAnalogy={getAnalogy}
        externalModalOpen={embeddingModalOpen}
        onExternalModalClose={handleCloseEmbeddingModal}
      />
    </Box>
  );
};

export default MetadataForm;
