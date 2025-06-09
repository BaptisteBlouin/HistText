import React, { useState, useEffect } from "react";
import AliasSelector from "./AliasSelector";
import SolrDatabaseSelector from "./SolrDatabaseSelector";
import {
  Box,
  Button,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import "../css/SidebarMenu.css";
import axios from "axios";

interface SidebarMenuProps {
  aliases: string[];
  selectedAlias: string;
  onAliasChange: (selectedAlias: string) => void;
  isStatsLoading: boolean;
  isNERLoading: boolean;
  isDataLoading: boolean;
  isCloudLoading: boolean;
  solrDatabases: any[];
  selectedSolrDatabase: any;
  onSolrDatabaseChange: (database: any) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TABS = {
  QUERY: "QUERY",
  PARTIAL_RESULTS: "PARTIAL_RESULTS",
  ALL_RESULTS: "ALL_RESULTS",
  CLOUD: "CLOUD",
  STATS: "STATS",
  NER: "NER",
};

const SidebarMenu: React.FC<SidebarMenuProps> = ({
  aliases,
  selectedAlias,
  onAliasChange,
  isStatsLoading,
  isNERLoading,
  isDataLoading,
  isCloudLoading,
  solrDatabases,
  selectedSolrDatabase,
  onSolrDatabaseChange,
  activeTab,
  setActiveTab,
}) => {
  // State variable to hold the real descriptions mapping (collection_name -> description)
  const [collectionDescriptions, setCollectionDescriptions] = useState<
    Record<string, string>
  >({});

  // When the selected Solr database changes, fetch the descriptions for its collections.
  useEffect(() => {
    if (selectedSolrDatabase && selectedSolrDatabase.id) {
      axios
        .get(
          `/api/solr_database_info?solr_database_id=${selectedSolrDatabase.id}`,
        )
        .then((response) => {
          const mapping: Record<string, string> = {};
          if (Array.isArray(response.data)) {
            response.data.forEach((info: any) => {
              mapping[info.collection_name] = info.description;
            });
          }
          setCollectionDescriptions(mapping);
        })
        .catch((error) => {
          console.error("Failed to fetch collection descriptions:", error);
          setCollectionDescriptions({});
        });
    } else {
      setCollectionDescriptions({});
    }
  }, [selectedSolrDatabase]);

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: "white",
        borderRadius: "16px",
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {/* Header Section */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 1,
        }}
      >
        {/* Solr Database Selector */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: "bold", minWidth: "80px" }}
          >
            Database
          </Typography>
          <SolrDatabaseSelector
            solrDatabases={solrDatabases}
            selectedSolrDatabase={selectedSolrDatabase}
            onSolrDatabaseChange={onSolrDatabaseChange}
          />
        </Box>

        {/* Alias Selector */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: "bold", minWidth: "80px" }}
          >
            Collection
          </Typography>
          <AliasSelector
            aliases={aliases}
            selectedAlias={selectedAlias}
            onAliasChange={onAliasChange}
            // Pass the fetched, real descriptions for the collections.
            descriptions={collectionDescriptions}
          />
        </Box>
      </Box>

      {/* Tabs Navigation */}
      <Box>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          sx={{
            "& .MuiTab-root": {
              fontWeight: "bold",
            },
          }}
        >
          <Tab label="Query" value={TABS.QUERY} />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                Partial Results
              </Box>
            }
            value={TABS.PARTIAL_RESULTS}
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                All Results
                {isDataLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
              </Box>
            }
            value={TABS.ALL_RESULTS}
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                Wordcloud
                {isCloudLoading && (
                  <CircularProgress size={16} sx={{ ml: 1 }} />
                )}
              </Box>
            }
            value={TABS.CLOUD}
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                Stats
                {isStatsLoading && (
                  <CircularProgress size={16} sx={{ ml: 1 }} />
                )}
              </Box>
            }
            value={TABS.STATS}
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                NER
                {isNERLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
              </Box>
            }
            value={TABS.NER}
          />
        </Tabs>
      </Box>
    </Box>
  );
};

export default SidebarMenu;
