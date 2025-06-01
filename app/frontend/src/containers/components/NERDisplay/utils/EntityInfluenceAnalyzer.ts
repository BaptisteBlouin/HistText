// app/frontend/src/containers/components/NERDisplay/utils/EntityInfluenceAnalyzer.ts
import { LightEntity, EntityGroup } from '../types/ner-types';

export interface EntityInfluence {
  entity: string;
  influenceScore: number;
  spreadFactor: number; // How widely spread across documents
  centralityScore: number; // How connected to other entities
  persistenceScore: number; // How consistently it appears
  bridgeScore: number; // How well it connects different topics
  documentReach: number;
  cooccurrenceStrength: number;
}

export class EntityInfluenceAnalyzer {
  static computeEntityInfluence(
    entities: LightEntity[],
    entityGroups: Map<string, EntityGroup>,
    cooccurrences: any[]
  ): EntityInfluence[] {
    console.time('Computing entity influence scores');
    
    const totalDocuments = new Set(entities.map(e => e.documentId)).size;
    const influences: EntityInfluence[] = [];
    
    entityGroups.forEach((group, key) => {
      const entityText = group.displayText;
      
      // Spread Factor: How many different documents contain this entity
      const documentReach = group.documents.size;
      const spreadFactor = documentReach / totalDocuments;
      
      // Centrality Score: How connected this entity is to others
      const entityConnections = cooccurrences.filter(cooc => 
        cooc.entity1 === entityText || cooc.entity2 === entityText
      );
      const centralityScore = entityConnections.length / Math.max(entityGroups.size - 1, 1);
      
      // Persistence Score: How consistently it appears relative to document presence
      const avgOccurrencesPerDocument = group.totalCount / documentReach;
      const persistenceScore = Math.min(avgOccurrencesPerDocument / 5, 1); // Normalize to 0-1
      
      // Bridge Score: How well it connects different document clusters
      const documentsByEntity = Array.from(group.documents);
      let bridgeConnections = 0;
      
      documentsByEntity.forEach(doc1 => {
        documentsByEntity.forEach(doc2 => {
          if (doc1 !== doc2) {
            // Check if these documents share other entities (simplified)
            const doc1Entities = entities.filter(e => e.documentId === doc1).map(e => e.normalizedText);
            const doc2Entities = entities.filter(e => e.documentId === doc2).map(e => e.normalizedText);
            const sharedEntities = doc1Entities.filter(e => doc2Entities.includes(e)).length;
            
            if (sharedEntities > 1) {
              bridgeConnections++;
            }
          }
        });
      });
      
      const bridgeScore = bridgeConnections / Math.max(documentReach * (documentReach - 1), 1);
      
      // Cooccurrence Strength: Average strength of relationships
      const cooccurrenceStrength = entityConnections.length > 0
        ? entityConnections.reduce((sum, cooc) => sum + (cooc.strength || 0), 0) / entityConnections.length
        : 0;
      
      // Combined Influence Score (weighted combination)
      const influenceScore = (
        spreadFactor * 0.3 +           // 30% weight on reach
        centralityScore * 0.25 +       // 25% weight on connections
        persistenceScore * 0.2 +       // 20% weight on consistency
        bridgeScore * 0.15 +           // 15% weight on bridging
        Math.min(cooccurrenceStrength / 10, 1) * 0.1  // 10% weight on relationship strength
      );
      
      influences.push({
        entity: entityText,
        influenceScore,
        spreadFactor,
        centralityScore,
        persistenceScore,
        bridgeScore,
        documentReach,
        cooccurrenceStrength
      });
    });
    
    console.timeEnd('Computing entity influence scores');
    return influences.sort((a, b) => b.influenceScore - a.influenceScore);
  }
}