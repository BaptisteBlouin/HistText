// app/frontend/src/containers/components/NERDisplay/hooks/useNERStatistics.ts
import { useMemo } from 'react';
import config from '../../../../../config.json';

interface EntityOccurrence {
  text: string;
  label: string;
  labelFull: string;
  documentId: string;
  confidence: number;
  position: number;
}

interface EntityCooccurrence {
  entity1: string;
  entity2: string;
  count: number;
  documents: string[];
  strength: number;
  avgDistance?: number; // NEW: Average distance between entities
  proximityScore?: number; // NEW: Proximity-weighted strength
}

interface DocumentEntityStats {
  documentId: string;
  entityCount: number;
  uniqueEntityCount: number;
  averageConfidence: number;
  entityTypes: Record<string, number>;
  topEntities: Array<{ text: string; count: number }>;
}

interface EntityPattern {
  entities: string[];
  count: number;
  documents: string[];
  pattern: string;
  type: 'bigram' | 'trigram' | 'quadrigram'; // NEW: Pattern type
}

interface NERAdvancedStats {
  // Basic stats (existing)
  totalEntities: number;
  totalDocuments: number;
  averageEntitiesPerDocument: number;
  entityDensity: number;
  
  // Top entities
  topEntities: Array<{ text: string; count: number; documents: number; frequency: number }>;
  topEntitiesByType: Record<string, Array<{ text: string; count: number; documents: number }>>;
  
  // Cooccurrence analysis
  entityCooccurrences: EntityCooccurrence[];
  strongestPairs: EntityCooccurrence[];
  communityGroups: Array<{ entities: string[]; strength: number; documents: string[] }>;
  
  // Document-level analysis
  documentStats: DocumentEntityStats[];
  documentsWithMostEntities: DocumentEntityStats[];
  documentsWithHighestDiversity: DocumentEntityStats[];
  
  // Pattern analysis
  commonPatterns: EntityPattern[];
  bigramPatterns: EntityPattern[];
  trigramPatterns: EntityPattern[];
  quadrigramPatterns: EntityPattern[]; // NEW
  
  // Distribution analysis
  confidenceDistribution: Array<{ range: string; count: number; percentage: number }>;
  entityLengthDistribution: Array<{ length: number; count: number; percentage: number }>;
  
  // Network analysis
  centralityScores: Array<{ entity: string; score: number; connections: number }>;
  
  // Advanced insights
  uniqueEntitiesRatio: number;
  anomalyScores: Array<{ documentId: string; score: number; reason: string }>;
}

export const useNERStatistics = (nerData: Record<string, any>) => {
  const advancedStats = useMemo(() => {
    if (!nerData || Object.keys(nerData).length === 0) {
      return null;
    }

    const entities: EntityOccurrence[] = [];
    const documentStats: DocumentEntityStats[] = [];
    
    // Extract all entities with their context
    Object.entries(nerData).forEach(([docId, data]) => {
      if (!Array.isArray(data.t)) return;
      
      const docEntities: EntityOccurrence[] = [];
      const docEntityTypes: Record<string, number> = {};
      const docEntityCounts: Record<string, number> = {};
      
      data.t.forEach((text: string, idx: number) => {
        const entity: EntityOccurrence = {
          text: text.trim(),
          label: data.l[idx],
          labelFull: config.NERLABELS2FULL[data.l[idx]] || data.l[idx],
          documentId: docId,
          confidence: data.c[idx],
          position: data.s[idx] // Start position for distance calculation
        };
        
        entities.push(entity);
        docEntities.push(entity);
        docEntityTypes[entity.labelFull] = (docEntityTypes[entity.labelFull] || 0) + 1;
        docEntityCounts[entity.text] = (docEntityCounts[entity.text] || 0) + 1;
      });
      
      // Calculate document-level stats
      const uniqueEntities = new Set(docEntities.map(e => e.text)).size;
      const avgConfidence = docEntities.length > 0 ? 
        docEntities.reduce((sum, e) => sum + e.confidence, 0) / docEntities.length : 0;
      const topEntities = Object.entries(docEntityCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([text, count]) => ({ text, count }));
      
      documentStats.push({
        documentId: docId,
        entityCount: docEntities.length,
        uniqueEntityCount: uniqueEntities,
        averageConfidence: avgConfidence,
        entityTypes: docEntityTypes,
        topEntities
      });
    });
    
    // Calculate basic stats
    const totalEntities = entities.length;
    const totalDocuments = Object.keys(nerData).length;
    const averageEntitiesPerDocument = totalEntities / totalDocuments;
    const uniqueEntities = new Set(entities.map(e => e.text)).size;
    const uniqueEntitiesRatio = uniqueEntities / totalEntities;
    
    // Top entities analysis - FIXED
    const entityCounts = new Map<string, { count: number; documents: Set<string> }>();
    entities.forEach(entity => {
      const key = entity.text;
      if (!entityCounts.has(key)) {
        entityCounts.set(key, { count: 0, documents: new Set() });
      }
      const entry = entityCounts.get(key)!;
      entry.count++;
      entry.documents.add(entity.documentId);
    });
    
    const topEntities = Array.from(entityCounts.entries())
      .map(([text, { count, documents }]) => ({
        text,
        count,
        documents: documents.size,
        frequency: count / totalEntities
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
    
    // Top entities by type - FIXED
    const topEntitiesByType: Record<string, Array<{ text: string; count: number; documents: number }>> = {};
    
    // Group entities by label first
    const entitiesByLabel = new Map<string, EntityOccurrence[]>();
    entities.forEach(entity => {
      if (!entitiesByLabel.has(entity.labelFull)) {
        entitiesByLabel.set(entity.labelFull, []);
      }
      entitiesByLabel.get(entity.labelFull)!.push(entity);
    });
    
    // Calculate top entities for each type
    entitiesByLabel.forEach((typeEntities, labelFull) => {
      const typeCounts = new Map<string, { count: number; documents: Set<string> }>();
      
      typeEntities.forEach(entity => {
        const key = entity.text;
        if (!typeCounts.has(key)) {
          typeCounts.set(key, { count: 0, documents: new Set() });
        }
        const entry = typeCounts.get(key)!;
        entry.count++;
        entry.documents.add(entity.documentId);
      });
      
      topEntitiesByType[labelFull] = Array.from(typeCounts.entries())
        .map(([text, { count, documents }]) => ({ text, count, documents: documents.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    });
    
    // Enhanced Cooccurrence analysis with distance
    const cooccurrenceMap = new Map<string, EntityCooccurrence>();
    const docEntityMap = new Map<string, Array<{ text: string; position: number }>>();
    
    // Group entities by document with positions
    entities.forEach(entity => {
      if (!docEntityMap.has(entity.documentId)) {
        docEntityMap.set(entity.documentId, []);
      }
      docEntityMap.get(entity.documentId)!.push({
        text: entity.text,
        position: entity.position
      });
    });
    
    // Calculate enhanced cooccurrences with distance
    docEntityMap.forEach((docEntities, docId) => {
      // Sort by position for distance calculation
      const sortedEntities = docEntities.sort((a, b) => a.position - b.position);
      const uniqueTexts = Array.from(new Set(sortedEntities.map(e => e.text)));
      
      for (let i = 0; i < uniqueTexts.length; i++) {
        for (let j = i + 1; j < uniqueTexts.length; j++) {
          const entity1 = uniqueTexts[i];
          const entity2 = uniqueTexts[j];
          const key = [entity1, entity2].sort().join('|||');
          
          if (!cooccurrenceMap.has(key)) {
            cooccurrenceMap.set(key, {
              entity1: entity1 < entity2 ? entity1 : entity2,
              entity2: entity1 < entity2 ? entity2 : entity1,
              count: 0,
              documents: [],
              strength: 0,
              avgDistance: 0,
              proximityScore: 0
            });
          }
          
          const cooccurrence = cooccurrenceMap.get(key)!;
          cooccurrence.count++;
          cooccurrence.documents.push(docId);
          
          // Calculate minimum distance between these entities in this document
          const positions1 = sortedEntities.filter(e => e.text === entity1).map(e => e.position);
          const positions2 = sortedEntities.filter(e => e.text === entity2).map(e => e.position);
          
          let minDistance = Infinity;
          positions1.forEach(pos1 => {
            positions2.forEach(pos2 => {
              const distance = Math.abs(pos1 - pos2);
              if (distance < minDistance) {
                minDistance = distance;
              }
            });
          });
          
          // Update average distance
          const currentAvg = cooccurrence.avgDistance || 0;
          const currentCount = cooccurrence.documents.length;
          cooccurrence.avgDistance = ((currentAvg * (currentCount - 1)) + minDistance) / currentCount;
        }
      }
    });
    
    // Calculate cooccurrence strength and proximity scores
    const entityCooccurrences = Array.from(cooccurrenceMap.values()).map(cooc => {
      const entity1Count = entityCounts.get(cooc.entity1)?.count || 1;
      const entity2Count = entityCounts.get(cooc.entity2)?.count || 1;
      const expected = (entity1Count * entity2Count) / totalDocuments;
      
      // Statistical significance (how much more than expected)
      cooc.strength = cooc.count / Math.max(expected, 1);
      
      // Proximity score (closer entities get higher scores)
      const maxDistance = 1000; // Normalize distance
      const normalizedDistance = Math.min(cooc.avgDistance || maxDistance, maxDistance) / maxDistance;
      const proximityWeight = 1 - normalizedDistance; // Closer = higher weight
      cooc.proximityScore = cooc.strength * (1 + proximityWeight);
      
      return cooc;
    }).sort((a, b) => b.proximityScore! - a.proximityScore!);
    
    const strongestPairs = entityCooccurrences.slice(0, 20);
    
    const bigramPatterns = new Map<string, EntityPattern>();
    const trigramPatterns = new Map<string, EntityPattern>();
    const quadrigramPatterns = new Map<string, EntityPattern>();

    docEntityMap.forEach((docEntities, docId) => {
    const entityTexts = docEntities.sort((a, b) => a.position - b.position).map(e => e.text);
    
    // Bigrams - EXCLUDE REPEATED ENTITIES
    for (let i = 0; i < entityTexts.length - 1; i++) {
        // Skip if entities are the same
        if (entityTexts[i] === entityTexts[i + 1]) continue;
        
        const pattern = `${entityTexts[i]} → ${entityTexts[i + 1]}`;
        const key = [entityTexts[i], entityTexts[i + 1]].sort().join('|||'); // Sort for deduplication
        
        if (!bigramPatterns.has(key)) {
        bigramPatterns.set(key, {
            entities: [entityTexts[i], entityTexts[i + 1]],
            count: 0,
            documents: [],
            pattern,
            type: 'bigram'
        });
        }
        
        const bigramPattern = bigramPatterns.get(key)!;
        bigramPattern.count++;
        if (!bigramPattern.documents.includes(docId)) {
        bigramPattern.documents.push(docId);
        }
    }
    
    // Trigrams - EXCLUDE REPEATED ENTITIES
    for (let i = 0; i < entityTexts.length - 2; i++) {
        const entities = [entityTexts[i], entityTexts[i + 1], entityTexts[i + 2]];
        
        // Skip if any entities are repeated
        if (new Set(entities).size !== entities.length) continue;
        
        const pattern = `${entityTexts[i]} → ${entityTexts[i + 1]} → ${entityTexts[i + 2]}`;
        const key = entities.sort().join('|||'); // Sort for deduplication
        
        if (!trigramPatterns.has(key)) {
        trigramPatterns.set(key, {
            entities: [entityTexts[i], entityTexts[i + 1], entityTexts[i + 2]],
            count: 0,
            documents: [],
            pattern,
            type: 'trigram'
        });
        }
        
        const trigramPattern = trigramPatterns.get(key)!;
        trigramPattern.count++;
        if (!trigramPattern.documents.includes(docId)) {
        trigramPattern.documents.push(docId);
        }
    }
    
    // Quadrigrams - EXCLUDE REPEATED ENTITIES
    for (let i = 0; i < entityTexts.length - 3; i++) {
        const entities = [entityTexts[i], entityTexts[i + 1], entityTexts[i + 2], entityTexts[i + 3]];
        
        // Skip if any entities are repeated
        if (new Set(entities).size !== entities.length) continue;
        
        const pattern = `${entityTexts[i]} → ${entityTexts[i + 1]} → ${entityTexts[i + 2]} → ${entityTexts[i + 3]}`;
        const key = entities.sort().join('|||'); // Sort for deduplication
        
        if (!quadrigramPatterns.has(key)) {
        quadrigramPatterns.set(key, {
            entities: [entityTexts[i], entityTexts[i + 1], entityTexts[i + 2], entityTexts[i + 3]],
            count: 0,  
            documents: [],
            pattern,
            type: 'quadrigram'
        });
        }
        
        const quadrigramPattern = quadrigramPatterns.get(key)!;
        quadrigramPattern.count++;
        if (!quadrigramPattern.documents.includes(docId)) {
        quadrigramPattern.documents.push(docId);
        }
    }
    });
        
    // Confidence distribution
    const confidenceRanges = [
      { min: 0.9, max: 1.0, label: '90-100%' },
      { min: 0.8, max: 0.89, label: '80-89%' },
      { min: 0.7, max: 0.79, label: '70-79%' },
      { min: 0.6, max: 0.69, label: '60-69%' },
      { min: 0.5, max: 0.59, label: '50-59%' },
      { min: 0.0, max: 0.49, label: '0-49%' }
    ];
    
    const confidenceDistribution = confidenceRanges.map(range => {
      const count = entities.filter(e => e.confidence >= range.min && e.confidence <= range.max).length;
      return {
        range: range.label,
        count,
        percentage: (count / totalEntities) * 100
      };
    });
    
    // Entity length distribution
    const lengthCounts = new Map<number, number>();
    entities.forEach(entity => {
      const length = entity.text.length;
      lengthCounts.set(length, (lengthCounts.get(length) || 0) + 1);
    });
    
    const entityLengthDistribution = Array.from(lengthCounts.entries())
      .map(([length, count]) => ({
        length,
        count,
        percentage: (count / totalEntities) * 100
      }))
      .sort((a, b) => a.length - b.length);
    
    // Centrality analysis
    const centralityScores = topEntities.slice(0, 20).map(entity => {
      const connections = entityCooccurrences.filter(cooc => 
        cooc.entity1 === entity.text || cooc.entity2 === entity.text
      ).length;
      
      return {
        entity: entity.text,
        score: connections / Math.max(topEntities.length - 1, 1),
        connections
      };
    }).sort((a, b) => b.score - a.score);
    
    // Anomaly detection
    const avgEntitiesPerDoc = averageEntitiesPerDocument;
    const avgUniqueEntitiesPerDoc = documentStats.length > 0 ? 
      documentStats.reduce((sum, doc) => sum + doc.uniqueEntityCount, 0) / documentStats.length : 0;
    
    const anomalyScores = documentStats.map(doc => {
      let score = 0;
      let reasons = [];
      
      if (doc.entityCount > avgEntitiesPerDoc * 3) {
        score += 0.3;
        reasons.push('high entity count');
      }
      
      if (doc.entityCount < avgEntitiesPerDoc * 0.1 && doc.entityCount > 0) {
        score += 0.2;
        reasons.push('low entity count');
      }
      
      if (doc.averageConfidence < 0.5) {
        score += 0.3;
        reasons.push('low confidence');
      }
      
      if (doc.uniqueEntityCount > avgUniqueEntitiesPerDoc * 2) {
        score += 0.2;
        reasons.push('high diversity');
      }
      
      return {
        documentId: doc.documentId,
        score,
        reason: reasons.join(', ') || 'normal'
      };
    }).filter(doc => doc.score > 0.3).sort((a, b) => b.score - a.score);
    
    const stats: NERAdvancedStats = {
      totalEntities,
      totalDocuments,
      averageEntitiesPerDocument,
      entityDensity: totalEntities / totalDocuments,
      topEntities,
      topEntitiesByType,
      entityCooccurrences: entityCooccurrences.slice(0, 100),
      strongestPairs,
      communityGroups: [],
      documentStats,
      documentsWithMostEntities: documentStats.slice().sort((a, b) => b.entityCount - a.entityCount).slice(0, 10),
      documentsWithHighestDiversity: documentStats.slice().sort((a, b) => b.uniqueEntityCount - a.uniqueEntityCount).slice(0, 10),
      commonPatterns: Array.from(bigramPatterns.values()).concat(Array.from(trigramPatterns.values())).sort((a, b) => b.count - a.count).slice(0, 20),
      bigramPatterns: Array.from(bigramPatterns.values()).sort((a, b) => b.count - a.count).slice(0, 15),
      trigramPatterns: Array.from(trigramPatterns.values()).sort((a, b) => b.count - a.count).slice(0, 10),
      quadrigramPatterns: Array.from(quadrigramPatterns.values()).sort((a, b) => b.count - a.count).slice(0, 8),
      confidenceDistribution,
      entityLengthDistribution,
      centralityScores,
      clusterAnalysis: [],
      uniqueEntitiesRatio,
      anomalyScores
    };
    
    return stats;
  }, [nerData]);
  
  return advancedStats;
};