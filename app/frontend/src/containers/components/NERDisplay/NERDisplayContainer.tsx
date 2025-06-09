// app/frontend/src/containers/components/NERDisplay/NERDisplayContainer.tsx (updated to use new components)
import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  Box,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  Badge,
  CircularProgress,
  Typography,
  Alert,
  Chip,
  Button,
} from "@mui/material";
import { ModuleRegistry } from "@ag-grid-community/core";
import { ClientSideRowModelModule } from "@ag-grid-community/client-side-row-model";
import {
  TableChart,
  Insights,
  Analytics,
  TrendingUp,
  Clear,
} from "@mui/icons-material";
import "@ag-grid-community/styles/ag-grid.css";
import "@ag-grid-community/styles/ag-theme-quartz.css";
import "../../css/HistText.css";

import DocumentDetailsModal from "../DocumentDetailsModal";
import NERHeader from "./NERHeader";
import NERStats from "./NERStats";
import NERFilters from "./NERFilters";
import NEREntityTypes from "./NEREntityTypes";
import NERDataGrid from "./NERDataGrid";
import NERPerformanceHint from "./NERPerformanceHint";
import NERInsights from "./NERInsights"; // Updated modular component
import { useNERData } from "./hooks/useNERData";
import { useNERFilters } from "./hooks/useNERFilters";
import NERAnalyticsLimitDialog from "./NERAnalyticsLimitDialog";
import config from "../../../../config.json";

ModuleRegistry.registerModules([ClientSideRowModelModule]);

interface NERDisplayContainerProps {
  nerData: Record<string, any>;
  authAxios: any;
  selectedAlias: string;
  selectedSolrDatabase: { id: number } | null;
  viewNER?: boolean;
}

const NERDisplayContainer: React.FC<NERDisplayContainerProps> = ({
  nerData,
  authAxios,
  selectedAlias,
  selectedSolrDatabase,
  viewNER = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [entityLimit, setEntityLimit] = useState<number | undefined>(undefined);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<
    string[] | undefined
  >(undefined);
  const [hasUserConfirmed, setHasUserConfirmed] = useState(false);

  // Local state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const totalEntities = useMemo(() => {
    return Object.values(nerData).reduce((total, data: any) => {
      return total + (Array.isArray(data.t) ? data.t.length : 0);
    }, 0);
  }, [nerData]);

  // Process NER data to get entity type statistics
  const entityTypeStats = useMemo(() => {
    const typeStats: Record<string, { count: number; percentage: number }> = {};
    let totalCount = 0;

    Object.values(nerData).forEach((data: any) => {
      if (Array.isArray(data.l)) {
        data.l.forEach((label: string) => {
          const labelFull = config.NERLABELS2FULL[label] || label;
          typeStats[labelFull] = typeStats[labelFull] || {
            count: 0,
            percentage: 0,
          };
          typeStats[labelFull].count++;
          totalCount++;
        });
      }
    });

    // Calculate percentages
    Object.keys(typeStats).forEach((type) => {
      typeStats[type].percentage = (typeStats[type].count / totalCount) * 100;
    });

    return typeStats;
  }, [nerData]);

  // Estimate processing time based on entity count
  const getEstimatedTime = (entityCount: number): string => {
    if (entityCount < 5000) return "< 1 second";
    if (entityCount < 15000) return "1-3 seconds";
    if (entityCount < 25000) return "3-8 seconds";
    if (entityCount < 50000) return "8-20 seconds";
    return "> 30 seconds";
  };

  // Process NER data with potential filtering
  const filteredNerData = useMemo(() => {
    if (!selectedEntityTypes || selectedEntityTypes.length === 0) {
      return nerData;
    }

    // Filter nerData to only include selected entity types
    const filtered: Record<string, any> = {};

    Object.entries(nerData).forEach(([docId, data]) => {
      if (Array.isArray(data.t) && Array.isArray(data.l)) {
        const filteredIndices: number[] = [];

        data.l.forEach((label: string, index: number) => {
          const labelFull = config.NERLABELS2FULL[label] || label;
          if (selectedEntityTypes.includes(labelFull)) {
            filteredIndices.push(index);
          }
        });

        if (filteredIndices.length > 0) {
          filtered[docId] = {
            t: filteredIndices.map((i) => data.t[i]),
            l: filteredIndices.map((i) => data.l[i]),
            s: filteredIndices.map((i) => data.s[i]),
            e: filteredIndices.map((i) => data.e[i]),
            c: filteredIndices.map((i) => data.c[i]),
          };
        }
      }
    });

    return filtered;
  }, [nerData, selectedEntityTypes]);

  // Process NER data
  const { entities, stats, processedData } = useNERData(filteredNerData);

  // Filter state and logic
  const {
    searchTerm,
    setSearchTerm,
    selectedLabels,
    setSelectedLabels,
    minConfidence,
    setMinConfidence,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    showAdvancedFilters,
    setShowAdvancedFilters,
    quickFilterMode,
    setQuickFilterMode,
    filteredEntities,
    displayEntities,
    uniqueLabels,
    clearAllFilters,
  } = useNERFilters(entities, stats);

  // Handlers
  const handleIdClick = useCallback((documentId: string) => {
    setSelectedDocumentId(documentId);
    setIsModalOpen(true);
  }, []);

  const handleTabChange = useCallback(
    (event: React.SyntheticEvent, newValue: number) => {
      if (newValue === 1 && activeTab !== 1) {
        // Switching to Advanced Analytics
        const maxEntities = config.NER_ANALYTICS_MAX_ENTITIES || 25000;

        if (totalEntities > maxEntities && !hasUserConfirmed) {
          setShowLimitDialog(true);
          return; // Don't switch tabs yet
        }

        setIsAnalyticsLoading(true);
        setTimeout(() => {
          setActiveTab(newValue);
          setTimeout(() => {
            setIsAnalyticsLoading(false);
          }, 100);
        }, 50);
      } else {
        setActiveTab(newValue);
      }
    },
    [activeTab, totalEntities, hasUserConfirmed],
  );

  const handleLimitDialogResponse = useCallback(
    (useLimited: boolean, entityTypes?: string[]) => {
      const maxEntities = config.NER_ANALYTICS_MAX_ENTITIES || 25000;

      setShowLimitDialog(false);
      setHasUserConfirmed(true);

      if (entityTypes && entityTypes.length > 0) {
        // User selected specific entity types
        setSelectedEntityTypes(entityTypes);
        setEntityLimit(undefined); // Don't limit by number when filtering by type
      } else if (useLimited) {
        // User selected subset option
        setEntityLimit(maxEntities);
        setSelectedEntityTypes(undefined);
      } else {
        // User selected process all
        setEntityLimit(undefined);
        setSelectedEntityTypes(undefined);
      }

      // Now proceed to analytics tab
      setIsAnalyticsLoading(true);
      setTimeout(() => {
        setActiveTab(1);
        setTimeout(() => {
          setIsAnalyticsLoading(false);
        }, 100);
      }, 50);
    },
    [],
  );

  const handleLimitDialogClose = useCallback(() => {
    setShowLimitDialog(false);
    // Stay on current tab
  }, []);

  const onGridReady = useCallback((params: any) => {
    params.api.sizeColumnsToFit();
  }, []);

  // Calculate current dataset info for display
  const currentDatasetInfo = useMemo(() => {
    const currentTotal = Object.values(filteredNerData).reduce(
      (total, data: any) => {
        return total + (Array.isArray(data.t) ? data.t.length : 0);
      },
      0,
    );

    return {
      totalEntities: currentTotal,
      isFiltered: selectedEntityTypes && selectedEntityTypes.length > 0,
      selectedTypes: selectedEntityTypes,
      reductionPercentage: selectedEntityTypes
        ? ((totalEntities - currentTotal) / totalEntities) * 100
        : 0,
    };
  }, [filteredNerData, totalEntities, selectedEntityTypes]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Enhanced Header with Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant={isMobile ? "scrollable" : "fullWidth"}
          scrollButtons={isMobile ? "auto" : false}
        >
          <Tab icon={<TableChart />} label="Entity Data" iconPosition="start" />
          <Tab
            icon={
              <Badge
                badgeContent={
                  totalEntities >
                  (config.NER_ANALYTICS_WARNING_THRESHOLD || 15000)
                    ? "!"
                    : "NEW"
                }
                color={
                  totalEntities > (config.NER_ANALYTICS_MAX_ENTITIES || 25000)
                    ? "error"
                    : "warning"
                }
                variant="dot"
              >
                {isAnalyticsLoading ? (
                  <CircularProgress size={20} sx={{ color: "inherit" }} />
                ) : (
                  <Insights />
                )}
              </Badge>
            }
            label={
              isAnalyticsLoading
                ? "Loading..."
                : totalEntities > (config.NER_ANALYTICS_MAX_ENTITIES || 25000)
                  ? "Advanced Analytics (!)"
                  : "Advanced Analytics"
            }
            iconPosition="start"
            disabled={isAnalyticsLoading}
          />
        </Tabs>
      </Box>

      {/* Dataset Filter Info */}
      {currentDatasetInfo.isFiltered && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="body2">
              <strong>Filtered Dataset:</strong> Showing{" "}
              {currentDatasetInfo.totalEntities.toLocaleString()} entities (
              {currentDatasetInfo.reductionPercentage.toFixed(1)}% reduction)
              from selected types:
            </Typography>
            {currentDatasetInfo.selectedTypes?.map((type) => (
              <Chip
                key={type}
                label={type}
                size="small"
                style={{
                  backgroundColor: config.NER_LABELS_COLORS[type] || "#757575",
                  color: "white",
                }}
              />
            ))}
            <Button
              size="small"
              onClick={() => {
                setSelectedEntityTypes(undefined);
                setHasUserConfirmed(false);
              }}
              startIcon={<Clear />}
            >
              Clear Filter
            </Button>
          </Box>
        </Alert>
      )}

      {/* Tab Content */}
      {activeTab === 0 && (
        <>
          <NERHeader
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            displayEntitiesLength={displayEntities.length}
            totalEntities={stats.totalEntities}
            selectedLabelsLength={selectedLabels.length}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvancedFilters={() =>
              setShowAdvancedFilters(!showAdvancedFilters)
            }
            onDownloadCSV={() => {}} // Implement download CSV
            onClearAllFilters={clearAllFilters}
            quickFilterMode={quickFilterMode}
          />

          <NERStats
            stats={stats}
            displayEntitiesLength={displayEntities.length}
            searchTerm={searchTerm}
          />

          <NERFilters
            showAdvancedFilters={showAdvancedFilters}
            searchTerm={searchTerm}
            minConfidence={minConfidence}
            onMinConfidenceChange={setMinConfidence}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />

          <NEREntityTypes
            stats={stats}
            uniqueLabels={uniqueLabels}
            selectedLabels={selectedLabels}
            onLabelToggle={(label) => {
              setSelectedLabels((prev) =>
                prev.includes(label)
                  ? prev.filter((l) => l !== label)
                  : [...prev, label],
              );
            }}
            onSelectAll={() => setSelectedLabels(uniqueLabels)}
            onSelectNone={() => setSelectedLabels([])}
            filteredEntities={filteredEntities}
            quickFilterMode={quickFilterMode}
            onQuickFilterChange={setQuickFilterMode}
          />

          <NERDataGrid
            displayEntities={displayEntities}
            stats={stats}
            isMobile={isMobile}
            onGridReady={onGridReady}
            onIdClick={handleIdClick}
          />

          <NERPerformanceHint totalEntities={stats.totalEntities} />
        </>
      )}

      {activeTab === 1 && (
        <>
          {isAnalyticsLoading ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "400px",
                gap: 2,
              }}
            >
              <CircularProgress size={60} />
              <Typography variant="h6" color="text.secondary">
                Computing Advanced Analytics...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Analyzing{" "}
                {entityLimit
                  ? `${entityLimit.toLocaleString()} of ${totalEntities.toLocaleString()}`
                  : currentDatasetInfo.isFiltered
                    ? `${currentDatasetInfo.totalEntities.toLocaleString()} filtered`
                    : totalEntities.toLocaleString()}{" "}
                entities
              </Typography>
            </Box>
          ) : (
            <NERInsights
              nerData={filteredNerData}
              selectedAlias={selectedAlias}
              onDocumentClick={handleIdClick}
              entityLimit={entityLimit}
              entities={entities}
            />
          )}
        </>
      )}

      <DocumentDetailsModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentId={selectedDocumentId || ""}
        collectionName={selectedAlias}
        solrDatabaseId={selectedSolrDatabase?.id || null}
        authAxios={authAxios}
        nerData={filteredNerData}
        viewNER={viewNER}
      />

      <NERAnalyticsLimitDialog
        open={showLimitDialog}
        onClose={handleLimitDialogClose}
        onProceed={handleLimitDialogResponse}
        totalEntities={totalEntities}
        maxEntities={config.NER_ANALYTICS_MAX_ENTITIES || 25000}
        estimatedTime={getEstimatedTime(totalEntities)}
        entityTypeStats={entityTypeStats}
        entities={entities}
      />
    </Box>
  );
};

export default React.memo(NERDisplayContainer);
