import React, { forwardRef } from "react";
import DatabaseSelectorCard, { DatabaseSelectorCardHandle } from "./DatabaseSelectorCard";

/**
 * Props for the DatabaseSelector component, forwarding to DatabaseSelectorCard.
 */
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

/**
 * DatabaseSelector entry component.
 * Forwards all props to DatabaseSelectorCard.
 *
 * @param props - DatabaseSelectorProps
 * @returns The database selector UI.
 */
const DatabaseSelector = forwardRef<DatabaseSelectorCardHandle, DatabaseSelectorProps>((props, ref) => {
  return <DatabaseSelectorCard ref={ref} {...props} />;
});

DatabaseSelector.displayName = "DatabaseSelector";

export default DatabaseSelector;
export type { DatabaseSelectorCardHandle as DatabaseSelectorHandle };
