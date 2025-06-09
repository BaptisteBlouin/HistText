import { useState, useCallback, useEffect } from "react";
import {
  fetchNeighbors,
  computeSimilarity,
  computeAnalogy,
} from "../utils/embeddingsApi";

/**
 * Hook managing word embeddings interactions: fetching neighbor words,
 * computing similarity and analogy, and handling loading states.
 *
 * @param solrDatabaseId - Selected Solr database ID or null if none.
 * @param selectedAlias - Selected collection alias.
 * @param accessToken - API access token for authentication.
 * @param hasEmbeddings - Flag indicating if embeddings feature is enabled.
 *
 * @returns An object with embeddings-related states and API call methods:
 *  - neighbors: Map of fieldName to neighbor word suggestions.
 *  - loadingNeighbors: Map of fieldName to loading boolean for neighbors.
 *  - similarityResult: Latest similarity computation result.
 *  - analogyResult: Latest analogy computation result.
 *  - embeddingLoading: Whether similarity/analogy API call is in progress.
 *  - getNeighbors: Function to fetch neighbor words for a field.
 *  - removeNeighborDropdown: Function to remove neighbor suggestions for a field.
 *  - getSimilarity: Function to compute similarity between two words.
 *  - getAnalogy: Function to compute word analogy (A is to B as C is to ?).
 *  - setSimilarityResult: Setter for similarityResult.
 *  - setAnalogyResult: Setter for analogyResult.
 */
export const useEmbeddings = (
  solrDatabaseId: number | null,
  selectedAlias: string,
  accessToken: string,
  hasEmbeddings: boolean,
) => {
  const [neighbors, setNeighbors] = useState<{ [key: string]: string[] }>({});
  const [loadingNeighbors, setLoadingNeighbors] = useState<{
    [key: string]: boolean;
  }>({});
  const [similarityResult, setSimilarityResult] = useState<any>(null);
  const [analogyResult, setAnalogyResult] = useState<any>(null);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);

  useEffect(() => {
    setNeighbors({});
    setLoadingNeighbors({});
    setSimilarityResult(null);
    setAnalogyResult(null);
  }, [solrDatabaseId, selectedAlias]);

  const getNeighbors = useCallback(
    async (inputValue: string, fieldName: string) => {
      if (!inputValue || !solrDatabaseId || !hasEmbeddings) return;

      setLoadingNeighbors((prev) => ({ ...prev, [fieldName]: true }));

      try {
        const neighborWords = await fetchNeighbors(
          inputValue,
          solrDatabaseId,
          selectedAlias,
          accessToken,
        );

        if (neighborWords.length > 0) {
          setNeighbors((prev) => ({
            ...prev,
            [fieldName]: neighborWords,
          }));
        } else {
          setNeighbors((prev) => {
            const newNeighbors = { ...prev };
            delete newNeighbors[fieldName];
            return newNeighbors;
          });
        }
      } finally {
        setLoadingNeighbors((prev) => ({ ...prev, [fieldName]: false }));
      }
    },
    [solrDatabaseId, selectedAlias, accessToken, hasEmbeddings],
  );

  const removeNeighborDropdown = useCallback((fieldName: string) => {
    setNeighbors((prev) => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  }, []);

  const getSimilarity = useCallback(
    async (word1: string, word2: string) => {
      if (!word1 || !word2 || !solrDatabaseId || !hasEmbeddings) return;

      setEmbeddingLoading(true);
      try {
        const result = await computeSimilarity(
          word1,
          word2,
          solrDatabaseId,
          selectedAlias,
          accessToken,
        );
        setSimilarityResult(result);
      } finally {
        setEmbeddingLoading(false);
      }
    },
    [solrDatabaseId, selectedAlias, accessToken, hasEmbeddings],
  );

  const getAnalogy = useCallback(
    async (wordA: string, wordB: string, wordC: string) => {
      if (!wordA || !wordB || !wordC || !solrDatabaseId || !hasEmbeddings)
        return;

      setEmbeddingLoading(true);
      try {
        const result = await computeAnalogy(
          wordA,
          wordB,
          wordC,
          solrDatabaseId,
          selectedAlias,
          accessToken,
        );
        setAnalogyResult(result);
      } finally {
        setEmbeddingLoading(false);
      }
    },
    [solrDatabaseId, selectedAlias, accessToken, hasEmbeddings],
  );

  return {
    neighbors,
    loadingNeighbors,
    similarityResult,
    analogyResult,
    embeddingLoading,
    getNeighbors,
    removeNeighborDropdown,
    getSimilarity,
    getAnalogy,
    setSimilarityResult,
    setAnalogyResult,
  };
};
