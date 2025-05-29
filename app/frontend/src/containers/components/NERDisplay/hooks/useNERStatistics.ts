// app/frontend/src/containers/components/NERDisplay/hooks/useNERStatistics.ts
import { useMemo, useState, useEffect } from 'react';
import { LightEntity, EntityGroup, NERAdvancedStats } from '../types/ner-types';
import { EntityNormalizer } from '../utils/EntityNormalizer';
import { useNERProcessor } from './useNERProcessor';
import config from '../../../../../config.json';

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

export const useNERStatistics = (nerData: Record<string, any>, entityLimit?: number) => {
  const [stats, setStats] = useState<NERAdvancedStats | null>(null);
  const { processAdvancedStats, processingState, isProcessing, cancelProcessing } = useNERProcessor();

  // Fast basic preprocessing - always runs immediately
  const basicData = useMemo((): BasicData | null => {
    if (!nerData || Object.keys(nerData).length === 0) return null;

    console.time('Basic preprocessing');
    
    const entities: LightEntity[] = [];
    let totalProcessed = 0;

    // Quick first pass - extract and filter
    for (const [docId, data] of Object.entries(nerData)) {
      if (!Array.isArray(data.t)) continue;
      
      for (let idx = 0; idx < data.t.length; idx++) {
        const originalText = data.t[idx];
        const label = data.l[idx];
        const confidence = data.c[idx];
        
        // Apply filtering
        if (EntityNormalizer.shouldFilter(originalText, label, confidence)) {
          continue;
        }

        const normalizedText = EntityNormalizer.normalize(originalText);
        if (!normalizedText) continue;

        const labelFull = config.NERLABELS2FULL[label] || label;
        const color = config.NER_LABELS_COLORS[label] || '#grey';

        entities.push({
          text: originalText,
          normalizedText,
          label,
          labelFull,
          documentId: docId,
          confidence,
          position: data.s[idx],
          originalText,
          color
        });

        totalProcessed++;
        if (entityLimit && totalProcessed >= entityLimit) break;
      }
      
      if (entityLimit && totalProcessed >= entityLimit) break;
    }

    // Group entities by normalized text + label
    const entityGroups = new Map<string, EntityGroup>();
    let totalConfidence = 0;

    entities.forEach(entity => {
      const key = EntityNormalizer.createEntityKey(entity.normalizedText, entity.label);
      
      if (!entityGroups.has(key)) {
        entityGroups.set(key, {
          displayText: entity.text,
          entities: [],
          totalCount: 0,
          documents: new Set(),
          avgConfidence: 0,
          label: entity.label,
          labelFull: entity.labelFull,
          color: entity.color
        });
      }
      
      const group = entityGroups.get(key)!;
      group.entities.push(entity);
      group.totalCount++;
      group.documents.add(entity.documentId);
      totalConfidence += entity.confidence;
    });

    // Calculate average confidence for each group
    entityGroups.forEach(group => {
      group.avgConfidence = group.entities.reduce((sum, e) => sum + e.confidence, 0) / group.entities.length;
    });

    console.timeEnd('Basic preprocessing');

    return {
      entities: entities.slice(0, entityLimit || entities.length),
      totalEntities: entities.length,
      totalDocuments: Object.keys(nerData).length,
      averageConfidence: entities.length > 0 ? totalConfidence / entities.length : 0,
      uniqueEntities: entityGroups.size,
      entityGroups,
      isLimited: entityLimit ? entities.length > entityLimit : false,
      totalEntitiesBeforeLimit: totalProcessed
    };
  }, [nerData, entityLimit]);

  // Start advanced processing when basic data is ready
  useEffect(() => {
    if (!basicData || stats?.processingComplete) return;

    const runAdvancedProcessing = async () => {
      try {
        console.time('Advanced processing');
        const advancedStats = await processAdvancedStats(
          basicData.entities,
          basicData.entityGroups,
          basicData
        );
        console.timeEnd('Advanced processing');
        setStats(advancedStats);
      } catch (error) {
        if (error instanceof Error && error.message !== 'Aborted') {
          console.error('Advanced processing failed:', error);
          // Set basic stats even if advanced processing fails
          setStats(createBasicStats(basicData));
        }
      }
    };

    // Small delay to let UI render basic data first
    const timeoutId = setTimeout(runAdvancedProcessing, 100);
    return () => clearTimeout(timeoutId);
  }, [basicData, processAdvancedStats, stats?.processingComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelProcessing();
      EntityNormalizer.clearCache();
    };
  }, [cancelProcessing]);

  // Return basic stats immediately, then advanced stats when ready
  return {
    stats: stats || (basicData ? createBasicStats(basicData) : null),
    processingState,
    isProcessing
  };
};

// Helper function to create basic stats structure
function createBasicStats(basicData: BasicData): NERAdvancedStats {
  return {
    totalEntities: basicData.totalEntities,
    totalDocuments: basicData.totalDocuments,
    averageEntitiesPerDocument: basicData.totalEntities / basicData.totalDocuments,
    entityDensity: basicData.totalEntities / basicData.totalDocuments,
    uniqueEntitiesRatio: basicData.uniqueEntities / basicData.totalEntities,
    
    // Will be populated by advanced processing
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
    
    // Processing metadata
    processingComplete: false,
    hasAdvancedFeatures: basicData.totalEntities <= 10000,
    isLimited: basicData.isLimited,
    totalEntitiesBeforeLimit: basicData.totalEntitiesBeforeLimit,
    processedEntities: basicData.totalEntities
  };
}