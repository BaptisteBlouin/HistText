import { useMemo, useState, useEffect } from "react";
import { LightEntity, EntityGroup, NERAdvancedStats } from "../types/ner-types";
import { EntityNormalizer } from "../utils/EntityNormalizer";
import { useNERProcessor } from "./useNERProcessor";
import config from "../../../../../config.json";

interface BasicData {
  entities: LightEntity[];
  totalEntities: number;
  totalDocuments: number;
  averageConfidence: number;
  uniqueEntities: number;
  entityGroups: Map<string, EntityGroup>;
  isLimited: boolean;
  totalEntitiesBeforeLimit: number;
}

/**
 * Hook to compute basic and advanced NER statistics from raw nerData.
 * Handles entity filtering, normalization, grouping, and advanced async processing.
 * Returns current stats along with processing state and status.
 */
export const useNERStatistics = (
  nerData: Record<string, any>,
  entityLimit?: number,
) => {
  const [stats, setStats] = useState<NERAdvancedStats | null>(null);
  const {
    processAdvancedStats,
    processingState,
    isProcessing,
    cancelProcessing,
  } = useNERProcessor();

  /**
   * Basic preprocessing: filter, normalize, group entities and compute preliminary stats.
   */
  const basicData = useMemo((): BasicData | null => {
    if (!nerData || Object.keys(nerData).length === 0) return null;

    console.time("Basic preprocessing");

    const entities: LightEntity[] = [];
    let totalProcessed = 0;
    type NerLabel = keyof typeof config.NERLABELS2FULL;

    // Extract entities applying filtering and normalization
    for (const [docId, data] of Object.entries(nerData)) {
      if (!Array.isArray(data.t)) continue;

      for (let idx = 0; idx < data.t.length; idx++) {
        const originalText = data.t[idx];
        const label = data.l[idx];
        const confidence = data.c[idx];

        if (EntityNormalizer.shouldFilter(originalText, label, confidence)) {
          continue;
        }

        const normalizedText = EntityNormalizer.normalize(originalText);
        if (!normalizedText) continue;

        const labelFull =
          label in config.NERLABELS2FULL
            ? config.NERLABELS2FULL[label as NerLabel]
            : label;
        const color =
          label in config.NER_LABELS_COLORS
            ? config.NER_LABELS_COLORS[label as NerLabel]
            : "#grey";

        entities.push({
          text: originalText,
          normalizedText,
          label,
          labelFull,
          documentId: docId,
          confidence,
          position: data.s[idx],
          originalText,
          color,
        });

        totalProcessed++;
        if (entityLimit && totalProcessed >= entityLimit) break;
      }

      if (entityLimit && totalProcessed >= entityLimit) break;
    }

    // Group entities by normalized text + label
    const entityGroups = new Map<string, EntityGroup>();
    let totalConfidence = 0;

    entities.forEach((entity) => {
      const key = EntityNormalizer.createEntityKey(
        entity.normalizedText,
        entity.label,
      );

      if (!entityGroups.has(key)) {
        entityGroups.set(key, {
          displayText: entity.text,
          entities: [],
          totalCount: 0,
          documents: new Set(),
          avgConfidence: 0,
          label: entity.label,
          labelFull: entity.labelFull,
          color: entity.color,
        });
      }

      const group = entityGroups.get(key)!;
      group.entities.push(entity);
      group.totalCount++;
      group.documents.add(entity.documentId);
      totalConfidence += entity.confidence;
    });

    // Compute average confidence per group
    entityGroups.forEach((group) => {
      group.avgConfidence =
        group.entities.reduce((sum, e) => sum + e.confidence, 0) /
        group.entities.length;
    });

    console.timeEnd("Basic preprocessing");

    return {
      entities: entities.slice(0, entityLimit || entities.length),
      totalEntities: entities.length,
      totalDocuments: Object.keys(nerData).length,
      averageConfidence:
        entities.length > 0 ? totalConfidence / entities.length : 0,
      uniqueEntities: entityGroups.size,
      entityGroups,
      isLimited: entityLimit ? entities.length > entityLimit : false,
      totalEntitiesBeforeLimit: totalProcessed,
    };
  }, [nerData, entityLimit]);

  /**
   * Trigger advanced processing asynchronously once basic data is ready.
   * Falls back to basic stats if advanced processing fails.
   */
  useEffect(() => {
    if (!basicData || stats?.processingComplete) return;

    const runAdvancedProcessing = async () => {
      try {
        console.time("Advanced processing");
        const advancedStats = await processAdvancedStats(
          basicData.entities,
          basicData.entityGroups,
          basicData,
        );
        console.timeEnd("Advanced processing");
        setStats(advancedStats);
      } catch (error) {
        if (error instanceof Error && error.message !== "Aborted") {
          console.error("Advanced processing failed:", error);
          setStats(createBasicStats(basicData));
        }
      }
    };

    const timeoutId = setTimeout(runAdvancedProcessing, 100);
    return () => clearTimeout(timeoutId);
  }, [basicData, processAdvancedStats, stats?.processingComplete]);

  /**
   * Cleanup processing on unmount.
   */
  useEffect(() => {
    return () => {
      cancelProcessing();
      EntityNormalizer.clearCache();
    };
  }, [cancelProcessing]);

  return {
    stats: stats || (basicData ? createBasicStats(basicData) : null),
    processingState,
    isProcessing,
  };
};

/**
 * Generates a basic NER statistics object from preprocessed basic data.
 * Used as fallback or initial stats before advanced processing completes.
 */
function createBasicStats(basicData: BasicData): NERAdvancedStats {
  return {
    totalEntities: basicData.totalEntities,
    totalDocuments: basicData.totalDocuments,
    averageEntitiesPerDocument:
      basicData.totalEntities / basicData.totalDocuments,
    entityDensity: basicData.totalEntities / basicData.totalDocuments,
    uniqueEntitiesRatio: basicData.uniqueEntities / basicData.totalEntities,

    topEntities: [],
    topEntitiesByType: {},
    entityCooccurrences: [],
    strongestPairs: [],
    bigramPatterns: [],
    trigramPatterns: [],
    quadrigramPatterns: [],
    centralityScores: [],
    anomalyScores: [],
    confidenceDistribution: [],
    entityLengthDistribution: [],
    documentStats: [],
    documentsWithMostEntities: [],
    documentsWithHighestDiversity: [],
    commonPatterns: [],
    communityGroups: [],
    clusterAnalysis: [],

    processingComplete: false,
    hasAdvancedFeatures: basicData.totalEntities <= 10000,
    isLimited: basicData.isLimited,
    totalEntitiesBeforeLimit: basicData.totalEntitiesBeforeLimit,
    processedEntities: basicData.totalEntities,
  };
}
