import React from 'react';
import DatabaseSelectorCard from './DatabaseSelectorCard';

interface DatabaseSelectorProps {
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
}

const DatabaseSelector: React.FC<DatabaseSelectorProps> = (props) => {
  return <DatabaseSelectorCard {...props} />;
};

export default DatabaseSelector;