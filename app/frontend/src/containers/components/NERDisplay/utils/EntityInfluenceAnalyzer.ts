import { LightEntity, EntityGroup } from '../types/ner-types';

export interface EntityInfluence {
  entity: string;
  influenceScore: number;
  spreadFactor: number;
  centralityScore: number;
  persistenceScore: number;
  bridgeScore: number;
  documentReach: number;
  cooccurrenceStrength: number;
}

/**
 * Analyzes entity influence using multiple metrics derived from entity occurrences,
 * co-occurrences, and document spread.
 */
export class EntityInfluenceAnalyzer {
  /**
   * Computes influence scores for entities based on distribution, connectivity,
   * persistence, bridging capability, and co-occurrence strength.
   * 
   * @param entities List of all light entities
   * @param entityGroups Map of grouped entities keyed by normalized text+label
   * @param cooccurrences Array of co-occurrence data between entities
   * @returns Sorted array of EntityInfluence objects by descending influence score
   */
  static computeEntityInfluence(
    entities: LightEntity[],
    entityGroups: Map<string, EntityGroup>,
    cooccurrences: any[]
  ): EntityInfluence[] {
    console.time('Computing entity influence scores');
    
    const totalDocuments = new Set(entities.map(e => e.documentId)).size;
    const influences: EntityInfluence[] = [];
    
    entityGroups.forEach(group => {
      const entityText = group.displayText;
      const documentReach = group.documents.size;
      const spreadFactor = documentReach / totalDocuments;

      const entityConnections = cooccurrences.filter(cooc =>
        cooc.entity1 === entityText || cooc.entity2 === entityText
      );
      const centralityScore = entityConnections.length / Math.max(entityGroups.size - 1, 1);

      const avgOccurrencesPerDocument = group.totalCount / documentReach;
      const persistenceScore = Math.min(avgOccurrencesPerDocument / 5, 1);

      // Compute bridge score based on shared entities between document pairs
      const documentsByEntity = Array.from(group.documents);
      let bridgeConnections = 0;

      documentsByEntity.forEach(doc1 => {
        documentsByEntity.forEach(doc2 => {
          if (doc1 !== doc2) {
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

      const cooccurrenceStrength = entityConnections.length > 0
        ? entityConnections.reduce((sum, cooc) => sum + (cooc.strength || 0), 0) / entityConnections.length
        : 0;

      // Weighted combination of factors to produce a composite influence score
      const influenceScore = (
        spreadFactor * 0.3 +
        centralityScore * 0.25 +
        persistenceScore * 0.2 +
        bridgeScore * 0.15 +
        Math.min(cooccurrenceStrength / 10, 1) * 0.1
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