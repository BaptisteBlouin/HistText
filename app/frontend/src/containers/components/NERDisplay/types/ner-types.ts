// app/frontend/src/containers/components/NERDisplay/types/ner-types.ts
export interface LightEntity {
    text: string;
    normalizedText: string;
    label: string;
    labelFull: string;
    documentId: string;
    confidence: number;
    position: number;
    originalText: string;
    color: string;
  }
  
  export interface EntityGroup {
    displayText: string;
    entities: LightEntity[];
    totalCount: number;
    documents: Set<string>;
    avgConfidence: number;
    label: string;
    labelFull: string;
    color: string;
  }
  
  export interface EntityCooccurrence {
    entity1: string;
    entity2: string;
    count: number;
    documents: string[];
    strength: number;
    avgDistance?: number;
    proximityScore?: number;
  }
  
  export interface EntityPattern {
    entities: string[];
    count: number;
    documents: string[];
    pattern: string;
    type: 'bigram' | 'trigram' | 'quadrigram';
  }
  
  export interface ProcessingState {
    phase: 'idle' | 'preprocessing' | 'basic_stats' | 'relationships' | 'patterns' | 'complete';
    progress: number;
    currentTask: string;
  }
  
  export interface DocumentStats {
    documentId: string;
    entityCount: number;
    uniqueEntityCount: number;
    averageConfidence: number;
    entityTypes: Record<string, number>;
    topEntities: Array<{ text: string; count: number }>;
  }
  
  export interface NERAdvancedStats {
    // Basic stats
    totalEntities: number;
    totalDocuments: number;
    averageEntitiesPerDocument: number;
    entityDensity: number;
    uniqueEntitiesRatio: number;
    
    // Top entities
    topEntities: Array<{ text: string; count: number; documents: number; frequency: number }>;
    topEntitiesByType: Record<string, Array<{ text: string; count: number; documents: number }>>;
    
    // Advanced features
    entityCooccurrences: EntityCooccurrence[];
    strongestPairs: EntityCooccurrence[];
    bigramPatterns: EntityPattern[];
    trigramPatterns: EntityPattern[];
    quadrigramPatterns: EntityPattern[];
    centralityScores: Array<{ entity: string; score: number; connections: number }>;
    anomalyScores: Array<{ documentId: string; score: number; reason: string }>;
    
    // Distributions
    confidenceDistribution: Array<{ range: string; count: number; percentage: number }>;
    entityLengthDistribution: Array<{ length: number; count: number; percentage: number }>;
    
    // Document analysis
    documentStats: DocumentStats[];
    documentsWithMostEntities: DocumentStats[];
    documentsWithHighestDiversity: DocumentStats[];
    
    // Processing metadata
    processingComplete: boolean;
    hasAdvancedFeatures: boolean;
    isLimited?: boolean;
    totalEntitiesBeforeLimit?: number;
    processedEntities?: number;
    
    // Placeholders
    commonPatterns: EntityPattern[];
    communityGroups: any[];
    clusterAnalysis: any[];
  }
  
  export interface ProcessingConfig {
    CHUNK_SIZE: number;
    DELAY_BETWEEN_CHUNKS: number;
    MAX_ENTITIES_FOR_FULL_ANALYSIS: number;
    MAX_COOCCURRENCE_PAIRS: number;
    MAX_PATTERNS_PER_TYPE: number;
    RELATIONSHIP_BATCH_SIZE: number;
    PATTERN_BATCH_SIZE: number;
  }