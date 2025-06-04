import { LightEntity, EntityPattern } from '../types/ner-types';
import { ChunkedProcessor } from './ChunkedProcessor';
import { EntityNormalizer } from './EntityNormalizer';

/**
 * Class to analyze and extract frequent entity patterns (n-grams) from entity sequences.
 * Supports bigrams, trigrams, and quadrigrams with filtering based on proximity and frequency.
 */
export class PatternAnalyzer {
  /**
   * Computes bigram, trigram, and quadrigram patterns from entity data.
   * Limits processing on large datasets for performance.
   * 
   * @param entities - List of entities with position info
   * @param signal - Optional abort signal to cancel processing
   * @param onProgress - Optional callback for progress reporting (0-100%)
   * @returns Promise resolving to an object with arrays of detected patterns by type
   */
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
    
    if (entities.length > 20000) {
      console.log('Dataset too large for pattern analysis, returning empty results');
      return { bigrams: [], trigrams: [], quadrigrams: [] };
    }

    // Group entities by document with limits to avoid explosion of patterns
    const docEntityMap = new Map<string, Array<{ normalizedText: string; position: number; displayText: string }>>();
    entities.forEach(entity => {
      if (!docEntityMap.has(entity.documentId)) {
        docEntityMap.set(entity.documentId, []);
      }
      const docEntities = docEntityMap.get(entity.documentId)!;
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
          return docChunk.map(([docId, docEntities]) => {
            // Sort entities by position and limit per document
            const sorted = docEntities
              .sort((a, b) => a.position - b.position)
              .slice(0, 50);

            // Generate bigrams: pairs of adjacent entities close enough in position
            for (let i = 0; i < Math.min(sorted.length - 1, 30); i++) {
              const distance = sorted[i + 1].position - sorted[i].position;
              if (distance > 500) continue;

              const entities = [sorted[i].normalizedText, sorted[i + 1].normalizedText];
              const displayTexts = [sorted[i].displayText, sorted[i + 1].displayText];

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

              if (bigrams.size > 1000) break;
            }

            // Generate trigrams for smaller documents only
            if (sorted.length <= 30) {
              for (let i = 0; i < Math.min(sorted.length - 2, 20); i++) {
                const maxDistance = Math.max(
                  sorted[i + 1].position - sorted[i].position,
                  sorted[i + 2].position - sorted[i + 1].position
                );
                if (maxDistance > 300) continue;

                const entities = [sorted[i].normalizedText, sorted[i + 1].normalizedText, sorted[i + 2].normalizedText];
                const displayTexts = [sorted[i].displayText, sorted[i + 1].displayText, sorted[i + 2].displayText];

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

                if (trigrams.size > 500) break;
              }
            }

            // Generate quadrigrams for very small documents only
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

                if (quadrigrams.size > 200) break;
              }
            }

            return null;
          });
        },
        Math.min(config.PATTERN_BATCH_SIZE, 5),
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
    }

    const result = {
      bigrams: Array.from(bigrams.values())
        .filter(pattern => pattern.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      trigrams: Array.from(trigrams.values())
        .filter(pattern => pattern.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      quadrigrams: Array.from(quadrigrams.values())
        .filter(pattern => pattern.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    };

    console.log('Pattern analysis complete:', {
      bigrams: result.bigrams.length,
      trigrams: result.trigrams.length,
      quadrigrams: result.quadrigrams.length
    });

    return result;
  }
}