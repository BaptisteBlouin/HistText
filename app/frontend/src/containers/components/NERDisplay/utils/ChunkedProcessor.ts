// app/frontend/src/containers/components/NERDisplay/utils/ChunkedProcessor.ts
import { ProcessingConfig } from '../types/ner-types';

const PROCESSING_CONFIG: ProcessingConfig = {
  CHUNK_SIZE: 500, // Reduced chunk size
  DELAY_BETWEEN_CHUNKS: 50, // Increased delay
  MAX_ENTITIES_FOR_FULL_ANALYSIS: 15000,
  MAX_COOCCURRENCE_PAIRS: 1000, // Reduced limits
  MAX_PATTERNS_PER_TYPE: 100,
  RELATIONSHIP_BATCH_SIZE: 50, // Reduced batch size
  PATTERN_BATCH_SIZE: 25
};

export class ChunkedProcessor {
  static async processInChunks<T, R>(
    items: T[],
    processor: (chunk: T[]) => Promise<R[]> | R[],
    chunkSize: number = PROCESSING_CONFIG.CHUNK_SIZE,
    onProgress?: (progress: number, current: string) => void,
    signal?: AbortSignal
  ): Promise<R[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const results: R[] = [];
    const totalChunks = Math.ceil(items.length / chunkSize);
    let processedItems = 0;

    console.log(`Starting chunked processing: ${items.length} items in ${totalChunks} chunks`);

    for (let i = 0; i < items.length; i += chunkSize) {
      // Check for cancellation first
      if (signal?.aborted) {
        console.log('Processing cancelled by signal');
        throw new Error('Processing cancelled');
      }

      try {
        const chunk = items.slice(i, i + chunkSize);
        const currentChunk = Math.floor(i / chunkSize) + 1;
        
        console.log(`Processing chunk ${currentChunk}/${totalChunks} (${chunk.length} items)`);
        
        // Update progress before processing
        const progress = Math.min((processedItems / items.length) * 100, 100);
        onProgress?.(progress, `Processing chunk ${currentChunk}/${totalChunks}`);
        
        // Process chunk with timeout protection
        const chunkResults = await Promise.race([
          Promise.resolve(processor(chunk)),
          new Promise<R[]>((_, reject) => 
            setTimeout(() => reject(new Error('Chunk processing timeout')), 10000)
          )
        ]);
        
        if (Array.isArray(chunkResults)) {
          results.push(...chunkResults);
        }
        
        processedItems += chunk.length;
        
        // Yield control to prevent UI blocking - increased delay
        if (i + chunkSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, PROCESSING_CONFIG.DELAY_BETWEEN_CHUNKS));
        }
        
      } catch (error) {
        console.error(`Error processing chunk ${Math.floor(i / chunkSize) + 1}:`, error);
        
        // Continue with next chunk instead of failing completely
        if (error instanceof Error && error.message === 'Processing cancelled') {
          throw error;
        }
        
        // Log error but continue processing
        console.warn('Skipping failed chunk and continuing...');
        processedItems += Math.min(chunkSize, items.length - i);
      }
    }

    console.log(`Chunked processing complete: ${results.length} results`);
    return results;
  }

  static getConfig(): ProcessingConfig {
    return PROCESSING_CONFIG;
  }
}