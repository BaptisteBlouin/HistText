// app/frontend/src/containers/components/NERDisplay/utils/CooccurrenceAnalyzer.ts
import { LightEntity, EntityGroup, EntityCooccurrence } from '../types/ner-types';
import { ChunkedProcessor } from './ChunkedProcessor';

export class CooccurrenceAnalyzer {
  static async computeCooccurrences(
    entities: LightEntity[],
    entityGroups: Map<string, EntityGroup>,
    signal?: AbortSignal,
    onProgress?: (progress: number) => void
  ): Promise<EntityCooccurrence[]> {
    console.log('Starting cooccurrence analysis with', entities.length, 'entities');
    
    // Early exit for large datasets
    if (entities.length > 15000) {
      console.log('Dataset too large for cooccurrence analysis, returning empty results');
      return [];
    }

    const cooccurrenceMap = new Map<string, EntityCooccurrence>();
    const docEntityMap = new Map<string, Array<{ normalizedText: string; position: number; displayText: string }>>();
    
    // Group entities by document
    entities.forEach(entity => {
      if (!docEntityMap.has(entity.documentId)) {
        docEntityMap.set(entity.documentId, []);
      }
      docEntityMap.get(entity.documentId)!.push({
        normalizedText: entity.normalizedText,
        position: entity.position,
        displayText: entity.text
      });
    });

    const documents = Array.from(docEntityMap.entries());
    const config = ChunkedProcessor.getConfig();
    
    console.log('Processing', documents.length, 'documents for cooccurrence');

    try {
      // Process documents in smaller chunks
      await ChunkedProcessor.processInChunks(
        documents,
        (docChunk) => {
          // Synchronous processing within chunk
          return docChunk.map(([docId, docEntities]) => {
            // Limit entities per document to prevent explosion
            const limitedEntities = docEntities.slice(0, 50);
            const uniqueTexts = Array.from(new Set(limitedEntities.map(e => e.normalizedText)));
            
            // Limit unique entities per document
            const limitedUniqueTexts = uniqueTexts.slice(0, 20);
            
            // Generate pairs with limits
            for (let i = 0; i < limitedUniqueTexts.length && i < 15; i++) {
              for (let j = i + 1; j < limitedUniqueTexts.length && j < 15; j++) {
                const norm1 = limitedUniqueTexts[i];
                const norm2 = limitedUniqueTexts[j];
                
                // Get display texts
                const display1 = limitedEntities.find(e => e.normalizedText === norm1)?.displayText || norm1;
                const display2 = limitedEntities.find(e => e.normalizedText === norm2)?.displayText || norm2;
                
                const key = [norm1, norm2].sort().join('|||');
                
                if (!cooccurrenceMap.has(key)) {
                  cooccurrenceMap.set(key, {
                    entity1: display1,
                    entity2: display2,
                    count: 0,
                    documents: [],
                    strength: 0,
                    avgDistance: 0,
                    proximityScore: 0
                  });
                }
                
                const cooc = cooccurrenceMap.get(key)!;
                cooc.count++;
                if (!cooc.documents.includes(docId)) {
                  cooc.documents.push(docId);
                }
                
                // Simple distance calculation
                const pos1 = limitedEntities.find(e => e.normalizedText === norm1)?.position || 0;
                const pos2 = limitedEntities.find(e => e.normalizedText === norm2)?.position || 0;
                const distance = Math.abs(pos1 - pos2);
                
                // Update average distance
                const currentAvg = cooc.avgDistance || 0;
                const currentCount = cooc.documents.length;
                cooc.avgDistance = ((currentAvg * (currentCount - 1)) + distance) / currentCount;
              }
            }
            
            return null; // Return null instead of actual data to save memory
          });
        },
        Math.min(config.RELATIONSHIP_BATCH_SIZE, 10), // Smaller batch size
        (progress) => {
          console.log(`Cooccurrence progress: ${progress.toFixed(1)}%`);
          onProgress?.(progress);
        },
        signal
      );
    } catch (error) {
      console.error('Error in cooccurrence processing:', error);
      if (signal?.aborted) {
        throw error;
      }
      // Return partial results instead of failing
    }

    // Calculate scores and return sorted results
    const totalEntities = entities.length;
    const results = Array.from(cooccurrenceMap.values())
      .filter(cooc => cooc.count >= 2) // Only keep pairs that occur at least twice
      .map(cooc => {
        // Find entity groups for strength calculation
        const group1 = Array.from(entityGroups.values()).find(g => g.displayText === cooc.entity1);
        const group2 = Array.from(entityGroups.values()).find(g => g.displayText === cooc.entity2);
        
        const count1 = group1?.totalCount || 1;
        const count2 = group2?.totalCount || 1;
        const expected = Math.max((count1 * count2) / totalEntities, 0.1);
        
        // Statistical significance
        cooc.strength = cooc.count / expected;
        
        // Proximity score (closer = better)
        const maxDistance = 1000;
        const normalizedDistance = Math.min(cooc.avgDistance || maxDistance, maxDistance) / maxDistance;
        const proximityWeight = 1 - normalizedDistance;
        cooc.proximityScore = cooc.strength * (1 + proximityWeight);
        
        return cooc;
      })
      .sort((a, b) => b.proximityScore! - a.proximityScore!)
      .slice(0, Math.min(config.MAX_COOCCURRENCE_PAIRS, 50)); // Reduced limit

    console.log('Cooccurrence analysis complete:', results.length, 'pairs found');
    return results;
  }
}