// app/frontend/src/containers/components/NERDisplay/utils/PatternAnalyzer.ts
import { LightEntity, EntityPattern } from '../types/ner-types';
import { ChunkedProcessor } from './ChunkedProcessor';
import { EntityNormalizer } from './EntityNormalizer';

export class PatternAnalyzer {
  static async computePatterns(
    entities: LightEntity[],
    signal?: AbortSignal,
    onProgress?: (progress: number) => void
  ): Promise<{
    bigrams: EntityPattern[];
    trigrams: EntityPattern[];
    quadrigrams: EntityPattern[];
  }> {
    console.log('Starting pattern analysis with', entities.length, 'entities');
    
    // Early exit for very large datasets
    if (entities.length > 20000) {
      console.log('Dataset too large for pattern analysis, returning empty results');
      return { bigrams: [], trigrams: [], quadrigrams: [] };
    }

    const docEntityMap = new Map<string, Array<{ normalizedText: string; position: number; displayText: string }>>();
    
    // Group entities by document with limits
    entities.forEach(entity => {
      if (!docEntityMap.has(entity.documentId)) {
        docEntityMap.set(entity.documentId, []);
      }
      const docEntities = docEntityMap.get(entity.documentId)!;
      
      // Limit entities per document to prevent explosion
      if (docEntities.length < 100) {
        docEntities.push({
          normalizedText: entity.normalizedText,
          position: entity.position,
          displayText: entity.text
        });
      }
    });

    const bigrams = new Map<string, EntityPattern>();
    const trigrams = new Map<string, EntityPattern>();
    const quadrigrams = new Map<string, EntityPattern>();

    const documents = Array.from(docEntityMap.entries());
    const config = ChunkedProcessor.getConfig();
    
    console.log('Processing', documents.length, 'documents for patterns');

    try {
      await ChunkedProcessor.processInChunks(
        documents,
        (docChunk) => {
          // Synchronous processing within chunk
          return docChunk.map(([docId, docEntities]) => {
            // Sort and limit entities per document
            const sorted = docEntities
              .sort((a, b) => a.position - b.position)
              .slice(0, 50); // Limit to first 50 entities per document
            
            // Generate bigrams (most reliable)
            for (let i = 0; i < Math.min(sorted.length - 1, 30); i++) {
              const distance = sorted[i + 1].position - sorted[i].position;
              if (distance > 500) continue; // Skip if too far apart
              
              const entities = [sorted[i].normalizedText, sorted[i + 1].normalizedText];
              const displayTexts = [sorted[i].displayText, sorted[i + 1].displayText];
              
              // Skip if repeated or contains filtered entities
              if (new Set(entities).size !== entities.length) continue;
              if (entities.some(e => EntityNormalizer.shouldFilter(e, '', 1.0))) continue;
              
              const key = entities.sort().join('|||');
              const pattern = displayTexts.join(' → ');
              
              if (!bigrams.has(key)) {
                bigrams.set(key, {
                  entities: displayTexts,
                  count: 0,
                  documents: [],
                  pattern,
                  type: 'bigram'
                });
              }
              
              const bigramPattern = bigrams.get(key)!;
              bigramPattern.count++;
              if (!bigramPattern.documents.includes(docId)) {
                bigramPattern.documents.push(docId);
              }
              
              // Stop if we have too many patterns
              if (bigrams.size > 1000) break;
            }
            
            // Generate trigrams (only for smaller documents)
            if (sorted.length <= 30) {
              for (let i = 0; i < Math.min(sorted.length - 2, 20); i++) {
                const maxDistance = Math.max(
                  sorted[i + 1].position - sorted[i].position,
                  sorted[i + 2].position - sorted[i + 1].position
                );
                if (maxDistance > 300) continue;
                
                const entities = [sorted[i].normalizedText, sorted[i + 1].normalizedText, sorted[i + 2].normalizedText];
                const displayTexts = [sorted[i].displayText, sorted[i + 1].displayText, sorted[i + 2].displayText];
                
                // Skip if repeated or contains filtered entities
                if (new Set(entities).size !== entities.length) continue;
                if (entities.some(e => EntityNormalizer.shouldFilter(e, '', 1.0))) continue;
                
                const key = entities.sort().join('|||');
                const pattern = displayTexts.join(' → ');
                
                if (!trigrams.has(key)) {
                  trigrams.set(key, {
                    entities: displayTexts,
                    count: 0,
                    documents: [],
                    pattern,
                    type: 'trigram'
                  });
                }
                
                const trigramPattern = trigrams.get(key)!;
                trigramPattern.count++;
                if (!trigramPattern.documents.includes(docId)) {
                  trigramPattern.documents.push(docId);
                }
                
                // Stop if we have too many patterns
                if (trigrams.size > 500) break;
              }
            }
            
            // Generate quadrigrams (only for very small documents)
            if (sorted.length <= 20) {
              for (let i = 0; i < Math.min(sorted.length - 3, 10); i++) {
                const entities = [
                  sorted[i].normalizedText, 
                  sorted[i + 1].normalizedText, 
                  sorted[i + 2].normalizedText, 
                  sorted[i + 3].normalizedText
                ];
                const displayTexts = [
                  sorted[i].displayText, 
                  sorted[i + 1].displayText, 
                  sorted[i + 2].displayText, 
                  sorted[i + 3].displayText
                ];
                
                // Skip if repeated or contains filtered entities
                if (new Set(entities).size !== entities.length) continue;
                if (entities.some(e => EntityNormalizer.shouldFilter(e, '', 1.0))) continue;
                
                const key = entities.sort().join('|||');
                const pattern = displayTexts.join(' → ');
                
                if (!quadrigrams.has(key)) {
                  quadrigrams.set(key, {
                    entities: displayTexts,
                    count: 0,
                    documents: [],
                    pattern,
                    type: 'quadrigram'
                  });
                }
                
                const quadrigramPattern = quadrigrams.get(key)!;
                quadrigramPattern.count++;
                if (!quadrigramPattern.documents.includes(docId)) {
                  quadrigramPattern.documents.push(docId);
                }
                
                // Stop if we have too many patterns
                if (quadrigrams.size > 200) break;
              }
            }
            
            return null; // Return null to save memory
          });
        },
        Math.min(config.PATTERN_BATCH_SIZE, 5), // Much smaller batch size
        (progress) => {
          console.log(`Pattern analysis progress: ${progress.toFixed(1)}%`);
          onProgress?.(progress);
        },
        signal
      );
    } catch (error) {
      console.error('Error in pattern processing:', error);
      if (signal?.aborted) {
        throw error;
      }
      // Continue with partial results
    }

    // Filter and sort results
    const result = {
      bigrams: Array.from(bigrams.values())
        .filter(pattern => pattern.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20), // Reduced limit
      trigrams: Array.from(trigrams.values())
        .filter(pattern => pattern.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10), // Reduced limit
      quadrigrams: Array.from(quadrigrams.values())
        .filter(pattern => pattern.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // Much reduced limit
    };

    console.log('Pattern analysis complete:', {
      bigrams: result.bigrams.length,
      trigrams: result.trigrams.length,
      quadrigrams: result.quadrigrams.length
    });

    return result;
  }
}