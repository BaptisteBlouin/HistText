export interface NERInsightsProps {
  /** Raw NER data keyed by document ID */
  nerData: Record<string, any>;
  /** Display name or alias for the dataset or source */
  selectedAlias: string;
  /** Optional callback when a document is clicked, receives document ID */
  onDocumentClick?: (documentId: string) => void;
  /** Optional max number of entities to process */
  entityLimit?: number;
  /** Optional pre-processed entities array */
  entities?: any[];
}

export interface TabPanelProps {
  /** React children to render inside the tab panel */
  children?: React.ReactNode;
  /** The index of this tab panel */
  index: number;
  /** The currently active tab index */
  value: number;
}

export interface DocumentLinkProps {
  /** Document ID to identify the clicked document */
  documentId: string;
  /** Content to render inside the clickable link */
  children: React.ReactNode;
  /** Callback invoked when the document link is clicked */
  onDocumentClick: (documentId: string) => void;
}

export interface ChartDataItem {
  /** Short name or label of the entity */
  name: string;
  /** Full descriptive name of the entity */
  fullName: string;
  /** Count of occurrences */
  count: number;
  /** Number of distinct documents containing this entity */
  documents: number;
  /** Frequency string representation, e.g. percentage */
  frequency: string;
}

export interface CooccurrenceDataItem {
  /** Display name or label for the co-occurrence pair */
  name: string;
  /** First entity in the pair */
  entity1: string;
  /** Second entity in the pair */
  entity2: string;
  /** Numeric strength of the relationship */
  strength: number;
  /** Count of co-occurrences */
  count: number;
  /** Number of documents where co-occurrence appears */
  documents: number;
  /** Average character distance between entities or 'N/A' if unavailable */
  avgDistance: number | string;
  /** Proximity score (e.g. normalized closeness measure) */
  proximityScore: number;
  /** Qualitative strength level (e.g. 'high', 'medium', 'low') */
  strengthLevel: string;
}
