import { ProcessingConfig } from '../types/ner-types';

const PROCESSING_CONFIG: ProcessingConfig = {
  CHUNK_SIZE: 500,
  DELAY_BETWEEN_CHUNKS: 50,
  MAX_ENTITIES_FOR_FULL_ANALYSIS: 15000,
  MAX_COOCCURRENCE_PAIRS: 1000,
  MAX_PATTERNS_PER_TYPE: 100,
  RELATIONSHIP_BATCH_SIZE: 50,
  PATTERN_BATCH_SIZE: 25
};

/**
 * Utility class to process large lists of items in chunks asynchronously.
 * This prevents UI blocking and allows progress reporting and cancellation.
 */
export class ChunkedProcessor {
  /**
   * Process an array of items in chunks with optional progress callback and cancellation.
   * @param items Array of items to process
   * @param processor Function that processes a chunk of items, returning results or a Promise of results
   * @param chunkSize Size of each chunk (default from config)
   * @param onProgress Optional callback with progress percent and status message
   * @param signal Optional AbortSignal to cancel processing
   * @returns Promise resolving to concatenated results from all chunks
   */
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
      if (signal?.aborted) {
        console.log('Processing cancelled by signal');
        throw new Error('Processing cancelled');
      }

      try {
        const chunk = items.slice(i, i + chunkSize);
        const currentChunk = Math.floor(i / chunkSize) + 1;

        console.log(`Processing chunk ${currentChunk}/${totalChunks} (${chunk.length} items)`);

        const progress = Math.min((processedItems / items.length) * 100, 100);
        onProgress?.(progress, `Processing chunk ${currentChunk}/${totalChunks}`);

        // Protect chunk processing with a 10-second timeout
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

        // Yield to event loop with delay to avoid blocking UI
        if (i + chunkSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, PROCESSING_CONFIG.DELAY_BETWEEN_CHUNKS));
        }

      } catch (error) {
        console.error(`Error processing chunk ${Math.floor(i / chunkSize) + 1}:`, error);

        if (error instanceof Error && error.message === 'Processing cancelled') {
          throw error;
        }

        console.warn('Skipping failed chunk and continuing...');
        processedItems += Math.min(chunkSize, items.length - i);
      }
    }

    console.log(`Chunked processing complete: ${results.length} results`);
    return results;
  }

  /**
   * Get the processing configuration constants.
   */
  static getConfig(): ProcessingConfig {
    return PROCESSING_CONFIG;
  }
}