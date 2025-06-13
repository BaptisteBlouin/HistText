import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Define the configuration shape based on what we have in config.json
export interface AppConfiguration {
  // Frontend configurations
  statsLevelOptions: string[];
  docLevelOptions: string[];
  batch_size: number;
  default_date_name: string;
  solr_selector_sentence: string;
  collection_selector_sentence: string;
  viewNERFields: string[];
  NER_LABELS_COLORS: Record<string, string>;
  NERLABELS2FULL: Record<string, string>;
  HOME_MESSAGE: string;
  CONTACT_ADDRESS: string;
  HOME_URL: string;
  USE_HOME_LOGO: boolean;
  NER_ANALYTICS_MAX_ENTITIES: number;
  NER_ANALYTICS_WARNING_THRESHOLD: number;
  MAX_ENTITIES_FOR_FULL_ANALYSIS: number;
  
  // System configurations (alert system)
  alert_message?: string;
  alert_type?: 'info' | 'warning' | 'error' | 'success';
  alert_enabled?: boolean;
}

interface ConfigurationContextType {
  config: AppConfiguration | null;
  loading: boolean;
  error: string | null;
  refetchConfig: () => Promise<void>;
}

const ConfigurationContext = createContext<ConfigurationContextType | undefined>(undefined);

// Default configuration based on the original config.json
const defaultConfig: AppConfiguration = {
  statsLevelOptions: ["All", "Medium", "None"],
  docLevelOptions: ["100", "500", "1000", "5000", "10000"],
  batch_size: 100,
  default_date_name: "date_rdt",
  solr_selector_sentence: "Select a Text Base",
  collection_selector_sentence: "Select a Collection",
  viewNERFields: ["story", "text", "answers", "Text"],
  NER_LABELS_COLORS: {
    "P": "rgba(255, 99, 132, 1)",
    "N": "rgba(255, 159, 64, 1)",
    "F": "rgba(255, 205, 86, 1)",
    "O": "rgba(54, 162, 235, 1)",
    "G": "rgba(75, 192, 192, 1)",
    "L": "rgba(153, 102, 255, 1)",
    "PR": "rgba(201, 203, 207, 1)",
    "E": "rgba(255, 102, 204, 1)",
    "W": "rgba(102, 51, 153, 1)",
    "LA": "rgba(220, 20, 60, 1)",
    "D": "rgba(255, 215, 0, 1)",
    "T": "rgba(0, 191, 255, 1)",
    "PE": "rgba(34, 139, 34, 1)",
    "M": "rgba(46, 139, 87, 1)",
    "Q": "rgba(255, 140, 0, 1)",
    "OR": "rgba(138, 43, 226, 1)",
    "C": "rgba(100, 149, 237, 1)",
    "LG": "rgba(0, 206, 209, 1)",
    "MI": "rgba(119, 136, 153, 1)"
  },
  NERLABELS2FULL: {
    "P": "PERSON",
    "N": "NORP",
    "F": "FAC",
    "O": "ORG",
    "G": "GPE",
    "L": "LOC",
    "PR": "PRODUCT",
    "E": "EVENT",
    "W": "WORK_OF_ART",
    "LA": "LAW",
    "D": "DATE",
    "T": "TIME",
    "PE": "PERCENT",
    "M": "MONEY",
    "Q": "QUANTITY",
    "OR": "ORDINAL",
    "C": "CARDINAL",
    "LG": "LANGUAGE",
    "MI": "MISC"
  },
  HOME_MESSAGE: "The application is currently in beta version. Don't hesitate to send us your feedback.",
  CONTACT_ADDRESS: "histtext@gmail.com",
  HOME_URL: "https://www.enpchina.eu/2024/09/03/poc/",
  USE_HOME_LOGO: true,
  NER_ANALYTICS_MAX_ENTITIES: 15000,
  NER_ANALYTICS_WARNING_THRESHOLD: 15000,
  MAX_ENTITIES_FOR_FULL_ANALYSIS: 15000,
  alert_message: "",
  alert_type: "info",
  alert_enabled: false,
};

interface ConfigurationProviderProps {
  children: ReactNode;
}

export const ConfigurationProvider: React.FC<ConfigurationProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<AppConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/config/frontend');
      
      if (!response.ok) {
        // If the API is not available, fall back to the original config.json
        console.warn('Dynamic configuration API not available, falling back to static config');
        try {
          const fallbackResponse = await fetch('/config.json');
          if (fallbackResponse.ok) {
            const fallbackConfig = await fallbackResponse.json();
            setConfig({ ...defaultConfig, ...fallbackConfig });
            return;
          }
        } catch (fallbackError) {
          console.warn('Static config.json also not available, using default config');
        }
        
        // Use default config if both API and static file fail
        setConfig(defaultConfig);
        return;
      }
      
      const dynamicConfig = await response.json();
      
      // Merge with defaults to ensure all required properties exist
      const mergedConfig = { ...defaultConfig, ...dynamicConfig };
      setConfig(mergedConfig);
      
    } catch (err) {
      console.error('Failed to fetch configuration:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      
      // Fall back to default configuration on error
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfiguration();
  }, []);

  const refetchConfig = async () => {
    await fetchConfiguration();
  };

  return (
    <ConfigurationContext.Provider value={{ config, loading, error, refetchConfig }}>
      {children}
    </ConfigurationContext.Provider>
  );
};

export const useConfiguration = (): ConfigurationContextType => {
  const context = useContext(ConfigurationContext);
  if (context === undefined) {
    throw new Error('useConfiguration must be used within a ConfigurationProvider');
  }
  return context;
};

// Convenience hook to get just the config values
export const useConfig = (): AppConfiguration => {
  const { config } = useConfiguration();
  // Return the config or defaults if not loaded yet
  return config || defaultConfig;
};