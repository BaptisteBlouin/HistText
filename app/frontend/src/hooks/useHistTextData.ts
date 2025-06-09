import { useState, useMemo } from "react";
import { useAuth } from "./useAuth";
import axios, { AxiosHeaders } from "axios";
import config from "../../config.json";

type StatsLevel = (typeof config.statsLevelOptions)[number];
type DocLevel = (typeof config.docLevelOptions)[number];

export const useHistTextData = () => {
  const { accessToken } = useAuth();

  // Create authenticated axios instance
  const authAxios = useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(
      (config) => {
        if (accessToken) {
          if (config.headers instanceof AxiosHeaders) {
            config.headers.set("Authorization", `Bearer ${accessToken}`);
          } else {
            config.headers = new AxiosHeaders({
              ...(config.headers as any),
              Authorization: `Bearer ${accessToken}`,
            });
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );
    return instance;
  }, [accessToken]);

  // State
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedAlias, setSelectedAlias] = useState<string>("");
  const [partialResults, setPartialResults] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedStat, setSelectedStat] = useState<string>("");
  const [metadata, setMetadata] = useState<any[]>([]);
  const [formData, setFormData] = useState<{
    [key: string]: { value: string; operator: string }[];
  }>({});
  const [dateRange, setDateRange] = useState<{
    min: string;
    max: string;
  } | null>(null);
  const [nerData, setNERData] = useState<any>(null);
  const [wordFrequency, setWordFrequency] = useState<
    { text: string; value: number }[]
  >([]);
  const [solrDatabases, setSolrDatabases] = useState<any[]>([]);
  const [selectedSolrDatabase, setSelectedSolrDatabase] = useState<any>(null);

  // Loading states
  const [loading, setLoading] = useState<boolean>(false);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(false);
  const [isNERLoading, setIsNERLoading] = useState<boolean>(false);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(false);

  // Ready states
  const [statsReady, setStatsReady] = useState<boolean>(false);
  const [nerReady, setNerReady] = useState<boolean>(false);

  // Progress
  const [progress, setProgress] = useState<number>(0);
  const [cloudProgress, setCloudProgress] = useState<number>(0);

  // Settings
  const [getNER, setGetNER] = useState<boolean>(false);
  const [downloadOnly, setdownloadOnly] = useState<boolean>(false);
  const [statsOnly, setStatsOnly] = useState<boolean>(false);
  const [statsLevel, setStatsLevel] = useState<StatsLevel>(
    config.statsLevelOptions[0],
  );
  const [docLevel, setDocLevel] = useState<DocLevel>(config.docLevelOptions[0]);

  // UI states
  const [isNERVisible, setIsNERVisible] = useState<boolean>(false);
  const [viewNER, setViewNER] = useState<boolean>(false);

  // Computed values
  const totalEntities = useMemo(
    () =>
      nerData ? Object.values(nerData).flatMap((d: any) => d.t || []).length : 0,
    [nerData],
  );

  return {
    // Data
    aliases,
    selectedAlias,
    partialResults,
    allResults,
    stats,
    selectedStat,
    metadata,
    formData,
    dateRange,
    nerData,
    wordFrequency,
    solrDatabases,
    selectedSolrDatabase,
    totalEntities,

    // Loading states
    loading,
    isStatsLoading,
    isNERLoading,
    isDataLoading,
    isCloudLoading,
    statsReady,
    nerReady,
    progress,
    cloudProgress,

    // Settings
    getNER,
    downloadOnly,
    statsOnly,
    statsLevel,
    docLevel,
    isNERVisible,
    viewNER,

    // Setters
    setAliases,
    setSelectedAlias,
    setPartialResults,
    setAllResults,
    setStats,
    setSelectedStat,
    setMetadata,
    setFormData,
    setDateRange,
    setNERData,
    setWordFrequency,
    setSolrDatabases,
    setSelectedSolrDatabase,
    setLoading,
    setIsStatsLoading,
    setIsNERLoading,
    setIsDataLoading,
    setIsCloudLoading,
    setStatsReady,
    setNerReady,
    setProgress,
    setCloudProgress,
    setGetNER,
    setdownloadOnly,
    setStatsOnly,
    setStatsLevel,
    setDocLevel,
    setIsNERVisible,
    setViewNER,

    // Utils
    authAxios,
  };
};
