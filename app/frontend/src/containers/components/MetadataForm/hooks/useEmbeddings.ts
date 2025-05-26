import { useState, useCallback } from 'react';
import { fetchNeighbors, computeSimilarity, computeAnalogy } from '../utils/embeddingsApi';

export const useEmbeddings = (
  solrDatabaseId: number | null,
  selectedAlias: string,
  accessToken: string,
  hasEmbeddings: boolean
) => {
  const [neighbors, setNeighbors] = useState<{ [key: string]: string[] }>({});
  const [loadingNeighbors, setLoadingNeighbors] = useState<{ [key: string]: boolean }>({});
  const [similarityResult, setSimilarityResult] = useState<any>(null);
  const [analogyResult, setAnalogyResult] = useState<any>(null);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);

  const getNeighbors = useCallback(async (inputValue: string, fieldName: string) => {
    if (!inputValue || !solrDatabaseId || !hasEmbeddings) return;
    
    setLoadingNeighbors(prev => ({ ...prev, [fieldName]: true }));
    
    try {
      const neighborWords = await fetchNeighbors(inputValue, solrDatabaseId, selectedAlias, accessToken);
      
      if (neighborWords.length > 0) {
        setNeighbors(prev => ({
          ...prev,
          [fieldName]: neighborWords,
        }));
      } else {
        setNeighbors(prev => {
          const newNeighbors = { ...prev };
          delete newNeighbors[fieldName];
          return newNeighbors;
        });
      }
    } finally {
      setLoadingNeighbors(prev => ({ ...prev, [fieldName]: false }));
    }
  }, [solrDatabaseId, selectedAlias, accessToken, hasEmbeddings]);

  const removeNeighborDropdown = useCallback((fieldName: string) => {
    setNeighbors(prev => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  }, []);

  const getSimilarity = useCallback(async (word1: string, word2: string) => {
    if (!word1 || !word2 || !solrDatabaseId || !hasEmbeddings) return;
    
    setEmbeddingLoading(true);
    try {
      const result = await computeSimilarity(word1, word2, solrDatabaseId, selectedAlias, accessToken);
      setSimilarityResult(result);
    } finally {
      setEmbeddingLoading(false);
    }
  }, [solrDatabaseId, selectedAlias, accessToken, hasEmbeddings]);

  const getAnalogy = useCallback(async (wordA: string, wordB: string, wordC: string) => {
    if (!wordA || !wordB || !wordC || !solrDatabaseId || !hasEmbeddings) return;
    
    setEmbeddingLoading(true);
    try {
      const result = await computeAnalogy(wordA, wordB, wordC, solrDatabaseId, selectedAlias, accessToken);
      setAnalogyResult(result);
    } finally {
      setEmbeddingLoading(false);
    }
  }, [solrDatabaseId, selectedAlias, accessToken, hasEmbeddings]);

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
    setAnalogyResult
  };
};