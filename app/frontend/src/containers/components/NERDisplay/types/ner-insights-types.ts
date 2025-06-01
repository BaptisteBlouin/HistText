// app/frontend/src/containers/components/NERDisplay/types/ner-insights-types.ts
export interface NERInsightsProps {
  nerData: Record<string, any>;
  selectedAlias: string;  
  onDocumentClick?: (documentId: string) => void;
  entityLimit?: number;
  entities?: any[];
}

export interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

export interface DocumentLinkProps {
  documentId: string;
  children: React.ReactNode;
  onDocumentClick: (documentId: string) => void;
}

export interface ChartDataItem {
  name: string;
  fullName: string;
  count: number;
  documents: number;
  frequency: string;
}

export interface CooccurrenceDataItem {
  name: string;
  entity1: string;
  entity2: string;
  strength: number;
  count: number;
  documents: number;
  avgDistance: number | string;
  proximityScore: number;
  strengthLevel: string;
}