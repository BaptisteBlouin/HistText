export interface LightEntity {
  /** Original text of the entity mention */
  text: string;
  /** Normalized text for consistent grouping */
  normalizedText: string;
  /** Entity label code (e.g. "PER", "ORG") */
  label: string;
  /** Full descriptive label */
  labelFull: string;
  /** ID of the document where entity appears */
  documentId: string;
  /** Confidence score (0 to 1) for entity recognition */
  confidence: number;
  /** Start position offset in document text */
  position: number;
  /** Original raw text before normalization */
  originalText: string;
  /** Display color for UI purposes */
  color: string;
}

export interface EntityGroup {
  /** Representative display text for the group */
  displayText: string;
  /** All LightEntity instances belonging to this group */
  entities: LightEntity[];
  /** Total count of entity mentions in this group */
  totalCount: number;
  /** Set of document IDs containing this group */
  documents: Set<string>;
  /** Average confidence score of group entities */
  avgConfidence: number;
  /** Label code for this group */
  label: string;
  /** Full descriptive label for this group */
  labelFull: string;
  /** UI color associated with this group */
  color: string;
}

export interface EntityCooccurrence {
  /** First entity in the co-occurrence pair */
  entity1: string;
  /** Second entity in the co-occurrence pair */
  entity2: string;
  /** Number of times the pair co-occurs */
  count: number;
  /** Array of document IDs where co-occurrence occurs */
  documents: string[];
  /** Numeric strength score quantifying relationship */
  strength: number;
  /** Average character distance between the two entities (optional) */
  avgDistance?: number;
  /** Proximity score quantifying closeness (optional) */
  proximityScore?: number;
}

export interface EntityPattern {
  /** Sequence of entity labels or texts forming the pattern */
  entities: string[];
  /** Number of occurrences of this pattern */
  count: number;
  /** Documents where pattern occurs */
  documents: string[];
  /** Normalized textual pattern representation */
  pattern: string;
  /** Pattern type (bigram, trigram, or quadrigram) */
  type: 'bigram' | 'trigram' | 'quadrigram';
}

export interface ProcessingState {
  /** Current processing phase */
  phase: 'idle' | 'preprocessing' | 'basic_stats' | 'relationships' | 'patterns' | 'complete';
  /** Completion percentage (0-100) */
  progress: number;
  /** Description of the current task */
  currentTask: string;
}

export interface DocumentStats {
  /** Document identifier */
  documentId: string;
  /** Total number of entities found */
  entityCount: number;
  /** Number of unique entities */
  uniqueEntityCount: number;
  /** Average confidence score for entities in document */
  averageConfidence: number;
  /** Map of entity types to their counts */
  entityTypes: Record<string, number>;
  /** Top entities with text and count */
  topEntities: Array<{ text: string; count: number }>;
}

export interface NERAdvancedStats {
  // Basic statistics
  totalEntities: number;
  totalDocuments: number;
  averageEntitiesPerDocument: number;
  entityDensity: number;
  uniqueEntitiesRatio: number;
  
  // Top entities summary
  topEntities: Array<{ text: string; count: number; documents: number; frequency: number }>;
  topEntitiesByType: Record<string, Array<{ text: string; count: number; documents: number }>>;
  
  // Advanced feature data
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
  
  // Document-level analysis
  documentStats: DocumentStats[];
  documentsWithMostEntities: DocumentStats[];
  documentsWithHighestDiversity: DocumentStats[];
  
  // Processing metadata
  processingComplete: boolean;
  hasAdvancedFeatures: boolean;
  isLimited?: boolean;
  totalEntitiesBeforeLimit?: number;
  processedEntities?: number;
  
  // Additional placeholders for future data
  commonPatterns: EntityPattern[];
  communityGroups: any[];
  clusterAnalysis: any[];
}

export interface ProcessingConfig {
  /** Number of entities processed per chunk */
  CHUNK_SIZE: number;
  /** Delay (ms) between processing chunks */
  DELAY_BETWEEN_CHUNKS: number;
  /** Max entities count for running full analysis */
  MAX_ENTITIES_FOR_FULL_ANALYSIS: number;
  /** Max number of co-occurrence pairs to analyze */
  MAX_COOCCURRENCE_PAIRS: number;
  /** Max patterns to keep per type */
  MAX_PATTERNS_PER_TYPE: number;
  /** Batch size for relationship analysis */
  RELATIONSHIP_BATCH_SIZE: number;
  /** Batch size for pattern analysis */
  PATTERN_BATCH_SIZE: number;
}