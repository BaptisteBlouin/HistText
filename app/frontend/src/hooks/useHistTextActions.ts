import { useCallback } from "react";
import config from "../../config.json";
import { buildQueryString } from "../containers/components/buildQueryString";


interface UseHistTextActionsProps {
  authAxios: any;
  selectedAlias: string;
  selectedSolrDatabase: any;
  formData: any;
  dateRange: any;
  showNotification: (
    message: string,
    severity?: "success" | "error" | "warning" | "info",
  ) => void;
  setLoading: (loading: boolean) => void;
  setIsStatsLoading: (loading: boolean) => void;
  setIsNERLoading: (loading: boolean) => void;
  setIsDataLoading: (loading: boolean) => void;
  setStatsReady: (ready: boolean) => void;
  setNerReady: (ready: boolean) => void;
  setIsNERVisible: (visible: boolean) => void;
  setProgress: (progress: number) => void;
  setPartialResults: (results: any[]) => void;
  setAllResults: (results: any[]) => void;
  setStats: (stats: any) => void;
  setNERData: (data: any) => void;
  setMetadata: (metadata: any[]) => void;
  setAliases: (aliases: string[]) => void;
  setFormData: (formData: any) => void;
  setDateRange: (range: any) => void;
  setSelectedStat: (stat: string) => void;
  setWordFrequency: (frequency: any[]) => void;
  setActiveTab: (tab: number) => void;
  setViewNER: (view: boolean) => void;
  setSelectedAlias: (alias: string) => void; // Add this missing parameter
}

export const useHistTextActions = ({
  authAxios,
  selectedAlias,
  selectedSolrDatabase,
  formData,
  dateRange,
  showNotification,
  setLoading,
  setIsStatsLoading,
  setIsNERLoading,
  setIsDataLoading,
  setStatsReady,
  setNerReady,
  setIsNERVisible,
  setProgress,
  setPartialResults,
  setAllResults,
  setStats,
  setNERData,
  setMetadata,
  setAliases,
  setFormData,
  setDateRange,
  setSelectedStat,
  setWordFrequency,
  setActiveTab,
  setViewNER,
  setSelectedAlias, // Add this to the destructuring
}: UseHistTextActionsProps) => {
  const handleAliasChange = useCallback(
    async (alias: string) => {
      setLoading(true);
      setSelectedAlias(alias); // Now this will work
      setFormData({});
      setDateRange(null);
      setStats(null);
      setSelectedStat("");
      setNERData(null);
      setActiveTab(0); // TABS.QUERY
      setIsNERVisible(false);
      setViewNER(false);
      setPartialResults([]);
      setAllResults([]);
      setWordFrequency([]);
      setStatsReady(false);
      setNerReady(false);

      if (alias && selectedSolrDatabase) {
        try {
          const solrDatabaseId = selectedSolrDatabase.id;

          const metadataResponse = await authAxios.get(
            `/api/solr/collection_metadata?collection=${encodeURIComponent(alias)}&solr_database_id=${solrDatabaseId}`,
          );
          if (metadataResponse.data && Array.isArray(metadataResponse.data)) {
            const fields = metadataResponse.data;
            setMetadata(fields);

            if (
              fields.some(
                (field: any) => field.name === config.default_date_name,
              )
            ) {
              const dateRangeResponse = await authAxios.get(
                `/api/solr/date_range?collection=${encodeURIComponent(alias)}&solr_database_id=${solrDatabaseId}`,
              );
              if (dateRangeResponse.data?.min && dateRangeResponse.data?.max) {
                setDateRange({
                  min: dateRangeResponse.data.min.split("T")[0],
                  max: dateRangeResponse.data.max.split("T")[0],
                });
                setFormData((prevData: any) => ({
                  ...prevData,
                  min_date: [
                    {
                      value: dateRangeResponse.data.min.split("T")[0],
                      operator: "AND",
                    },
                  ],
                  max_date: [
                    {
                      value: dateRangeResponse.data.max.split("T")[0],
                      operator: "AND",
                    },
                  ],
                }));
              }
            }
          } else {
            console.error(
              "Unexpected response structure:",
              metadataResponse.data,
            );
            setMetadata([]);
          }
          showNotification(
            `Collection "${alias}" loaded successfully`,
            "success",
          );
        } catch (error) {
          console.error(
            "Error fetching collection metadata or date range:",
            error,
          );
          showNotification("Failed to load collection metadata", "error");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    },
    [
      selectedSolrDatabase,
      authAxios,
      showNotification,
      setLoading,
      setSelectedAlias,
      setFormData,
      setDateRange,
      setStats,
      setSelectedStat,
      setNERData,
      setActiveTab,
      setIsNERVisible,
      setViewNER,
      setPartialResults,
      setAllResults,
      setWordFrequency,
      setStatsReady,
      setNerReady,
      setMetadata,
    ],
  );

  // hooks/useHistTextActions.ts (corrected fetchAllDocuments function)
  const fetchAllDocuments = useCallback(
    async (
      onlyComputeStats: boolean,
      wantNER: boolean,
      wantDownload: boolean,
      selectedStatsLevel: string = config.statsLevelOptions[0],
      selectedDocLevel: string = config.docLevelOptions[0],
    ) => {
      // Basic validation first
      if (!selectedAlias || !selectedSolrDatabase) {
        showNotification(
          "Please select a database and collection first",
          "warning",
        );
        return;
      }

      // Check if user has entered at least one search term (excluding dates)
      const hasSearchTerms = Object.entries(formData).some(([key, entries]) => {
        if (key === "min_date" || key === "max_date") return false;
        return (entries as any).some(
          (entry: any) => entry.value && entry.value.trim() !== "",
        );
      });

      if (!hasSearchTerms) {
        showNotification(
          "Please enter search criteria in at least one field",
          "warning",
        );
        return;
      }

      // Initialize loading states
      setLoading(true);
      setIsStatsLoading(true);
      setStatsReady(false);
      setNerReady(false);
      setIsDataLoading(true);

      if (wantNER) {
        setIsNERLoading(true);
        setIsNERVisible(false);
      }

      // Add timeout for stats and NER to prevent stuck loading states
      const TIMEOUT_MS = 30000; // 30 seconds timeout
      let statsTimeoutId: NodeJS.Timeout | null = null;
      let nerTimeoutId: NodeJS.Timeout | null = null;

      try {
        const queryString = buildQueryString(formData, dateRange);
        const batchSize = config.batch_size;
        const maxDocuments = Number(selectedDocLevel);
        let start = 0;
        let totalResults = 0;
        setProgress(0);
        const solrDatabaseId = selectedSolrDatabase.id;

        // First request
        const firstResponse = await authAxios.get(
          `/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(
            queryString,
          )}&start=${start}&rows=${batchSize}&get_ner=${wantNER}&download_only=${wantDownload}&stats_level=${selectedStatsLevel}&solr_database_id=${solrDatabaseId}&is_first=true&only_stats=${onlyComputeStats}`,
        );

        const firstSolrResponse = firstResponse.data.solr_response;
        const firstDocs = firstSolrResponse.response.docs;

        totalResults = firstSolrResponse.total_results;
        if (totalResults > maxDocuments) {
          totalResults = maxDocuments;
        }

        if (totalResults === 0) {
          showNotification(
            "No documents found matching your search criteria",
            "info",
          );
          setPartialResults([]);
          setAllResults([]);
          setActiveTab(1);
        } else if (onlyComputeStats) {
          // When only computing stats, don't set document results
          setPartialResults([]);
          setAllResults([]);
          setActiveTab(2); // Switch to stats tab
          showNotification(`Computing statistics for ${totalResults} documents`, "success");
        } else {
          setPartialResults([...firstDocs]);
          setActiveTab(1);
          showNotification(`Found ${totalResults} documents`, "success");
        }

        start += batchSize;
        setProgress((start / Math.max(totalResults, 1)) * 100);
        setLoading(false);
        // Continue with full results if needed (skip if only computing stats)
        if (totalResults > batchSize && !onlyComputeStats) {
          const allResponse = await authAxios.get(
            `/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(
              queryString,
            )}&start=0&rows=${totalResults}&get_ner=${wantNER}&download_only=${wantDownload}&stats_level=${selectedStatsLevel}&solr_database_id=${solrDatabaseId}`,
          );
          const solrResponseAll = allResponse.data.solr_response;
          const docsAll = solrResponseAll.response.docs;
          setAllResults([...docsAll]);
          setProgress(100);

          if (wantDownload && solrResponseAll.csv_path) {
            const filename = solrResponseAll.csv_path.split("/").pop();
            const downloadUrl = `/api/solr/download_csv/${filename}`;
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", filename || "data.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification("Download started", "success");
          }
        } else {
          setAllResults([...firstDocs]);

          if (wantDownload && firstSolrResponse.csv_path) {
            const filename = firstSolrResponse.csv_path.split("/").pop();
            const downloadUrl = `/api/solr/download_csv/${filename}`;
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", filename || "data.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification("Download started", "success");
          }
        }

        // Handle statistics with timeout and proper error handling
        if (firstSolrResponse.stats_path) {
          // Set timeout for stats
          statsTimeoutId = setTimeout(() => {
            setIsStatsLoading(false);
            setStatsReady(false);
            setStats(null);
            showNotification("Statistics generation timed out", "warning");
          }, TIMEOUT_MS);

          authAxios
            .get(
              `/api/solr/stats?path=${encodeURIComponent(firstSolrResponse.stats_path)}&solr_database_id=${solrDatabaseId}`,
            )
            .then((response_stats: any) => {
              if (statsTimeoutId) {
                clearTimeout(statsTimeoutId);
                statsTimeoutId = null;
              }
              setStats(response_stats.data);
              setStatsReady(true);
            })
            .catch((error: any) => {
              if (statsTimeoutId) {
                clearTimeout(statsTimeoutId);
                statsTimeoutId = null;
              }
              console.error("Error fetching stats:", error);
              setStats(null);
              setStatsReady(false);

              // More specific error handling for stats
              if (error.response?.status === 404) {
                showNotification(
                  "Statistics file not found - it may have expired",
                  "warning",
                );
              } else if ((error as any).response?.status >= 500) {
                showNotification(
                  "Server error while generating statistics",
                  "warning",
                );
              } else {
                showNotification(
                  "Statistics are not available for this query",
                  "info",
                );
              }
            })
            .finally(() => {
              if (statsTimeoutId) {
                clearTimeout(statsTimeoutId);
                statsTimeoutId = null;
              }
              setIsStatsLoading(false);
            });
        } else {
          setStats(null);
          setStatsReady(false);
          setIsStatsLoading(false);
          showNotification(
            "Statistics are not available for this collection",
            "info",
          );
        }

        // Handle NER with timeout and proper error handling
        if (wantNER) {
          if (firstSolrResponse.ner_path) {
            // Set timeout for NER
            nerTimeoutId = setTimeout(() => {
              setIsNERLoading(false);
              setNerReady(false);
              setNERData(null);
              setIsNERVisible(false);
              showNotification("Named entity recognition timed out", "warning");
            }, TIMEOUT_MS);

            authAxios
              .get(
                `/api/solr/ner?path=${encodeURIComponent(firstSolrResponse.ner_path)}&solr_database_id=${solrDatabaseId}`,
              )
              .then((response_ner: any) => {
                if (nerTimeoutId) {
                  clearTimeout(nerTimeoutId);
                  nerTimeoutId = null;
                }

                if (
                  response_ner.data &&
                  Object.keys(response_ner.data).length > 0
                ) {
                  setNERData(response_ner.data);
                  setIsNERVisible(true);
                  setNerReady(true);
                  showNotification(
                    "Named entities extracted successfully",
                    "success",
                  );
                } else {
                  setNERData(null);
                  setIsNERVisible(false);
                  setNerReady(false);
                  showNotification(
                    "No named entities found in the results",
                    "info",
                  );
                }
              })
              .catch((error: any) => {
                if (nerTimeoutId) {
                  clearTimeout(nerTimeoutId);
                  nerTimeoutId = null;
                }

                console.error("Error fetching NER:", error);
                setNERData(null);
                setIsNERVisible(false);
                setNerReady(false);

                // More specific error handling for NER
                if (error.response?.status === 404) {
                  showNotification(
                    "NER data file not found - it may have expired",
                    "info",
                  );
                } else if ((error as any).response?.status >= 500) {
                  showNotification(
                    "Named entity recognition is not available for this collection",
                    "info",
                  );
                } else if (error.response?.status === 400) {
                  showNotification(
                    "Named entity recognition is not supported for this content",
                    "info",
                  );
                } else {
                  showNotification(
                    "Named entity recognition is not available for this collection",
                    "info",
                  );
                }
              })
              .finally(() => {
                if (nerTimeoutId) {
                  clearTimeout(nerTimeoutId);
                  nerTimeoutId = null;
                }
                setIsNERLoading(false);
              });
          } else {
            setNERData(null);
            setIsNERVisible(false);
            setNerReady(false);
            setIsNERLoading(false);
            showNotification(
              "Named entity recognition is not available for this collection",
              "info",
            );
          }
        }
      } catch (error) {
        console.error("Error querying alias:", error);

        // Clean up timeouts on main error
        if (statsTimeoutId) {
          clearTimeout(statsTimeoutId);
          statsTimeoutId = null;
        }
        if (nerTimeoutId) {
          clearTimeout(nerTimeoutId);
          nerTimeoutId = null;
        }

        // Reset all data states on error
        setPartialResults([]);
        setAllResults([]);
        setStats(null);
        setNERData(null);
        setStatsReady(false);
        setNerReady(false);
        setIsNERVisible(false);

        // Provide specific error messages
        if ((error as any).response?.status === 400) {
          showNotification(
            "Invalid search query. Please check your search criteria.",
            "error",
          );
        } else if ((error as any).response?.status === 404) {
          showNotification(
            "Collection not found. It may have been removed or renamed.",
            "error",
          );
        } else if ((error as any).response?.status >= 500) {
          showNotification("Server error. Please try again later.", "error");
        } else if ((error as any).code === "NETWORK_ERROR" || !(error as any).response) {
          showNotification(
            "Network error. Please check your connection and try again.",
            "error",
          );
        } else {
          showNotification("Query failed. Please try again.", "error");
        }
      } finally {
        // CRITICAL: Always reset main loading states and clean up timeouts
        setLoading(false);
        setIsDataLoading(false);
        setProgress(0);

        // Clean up any remaining timeouts
        if (statsTimeoutId) {
          clearTimeout(statsTimeoutId);
        }
        if (nerTimeoutId) {
          clearTimeout(nerTimeoutId);
        }

        // Force reset loading states if they're still loading (fallback safety)
        // This ensures no loading state gets permanently stuck
        setTimeout(() => {
          setIsStatsLoading(false);
          if (wantNER) {
            setIsNERLoading(false);
          }
        }, 100);
      }
    },
    [
      selectedAlias,
      selectedSolrDatabase,
      formData,
      dateRange,
      authAxios,
      showNotification,
      setLoading,
      setIsStatsLoading,
      setStatsReady,
      setNerReady,
      setIsDataLoading,
      setIsNERLoading,
      setIsNERVisible,
      setProgress,
      setPartialResults,
      setActiveTab,
      setAllResults,
      setStats,
      setNERData,
    ],
  );

  const handleQuery = useCallback(
    (
      e: React.FormEvent,
      onlyComputeStats: boolean,
      wantNER: boolean,
      wantDownload: boolean,
      selectedStatsLevel: string,
      selectedDocLevel: string,
    ) => {
      e.preventDefault();
      fetchAllDocuments(
        onlyComputeStats,
        wantNER,
        wantDownload,
        selectedStatsLevel,
        selectedDocLevel,
      );
    },
    [fetchAllDocuments],
  );

  const exportAllData = useCallback(() => {
    showNotification("Export functionality coming soon", "info");
  }, [showNotification]);

  const refreshData = useCallback(() => {
    if (selectedAlias) {
      handleAliasChange(selectedAlias);
    }
  }, [selectedAlias, handleAliasChange]);

  const shareQuery = useCallback(() => {
    const queryString = buildQueryString(formData, dateRange);
    navigator.clipboard.writeText(
      window.location.href + "?query=" + encodeURIComponent(queryString),
    );
    showNotification("Query URL copied to clipboard", "success");
  }, [formData, dateRange, showNotification]);

  const openSettings = useCallback(() => {
    showNotification("Settings panel coming soon", "info");
  }, [showNotification]);

  return {
    handleAliasChange,
    handleQuery,
    exportAllData,
    refreshData,
    shareQuery,
    openSettings,
  };
};
