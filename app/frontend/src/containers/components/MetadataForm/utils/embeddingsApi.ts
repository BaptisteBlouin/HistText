import axios from 'axios';

interface NeighborsResponse {
  neighbors: Array<{
    word: string;
    similarity?: number;
  }>;
  has_embeddings: boolean;
  query_word: string;
  k: number;
  threshold: number;
}

interface SimilarityResponse {
  word1: string;
  word2: string;
  similarity: number;
  metric: string;
  both_found: boolean;
}

interface AnalogyResponse {
  analogy: string;
  candidates: Array<{
    word: string;
    similarity?: number;
  }>;
  all_words_found: boolean;
}

export const fetchNeighbors = async (
  inputValue: string,
  solrDatabaseId: number,
  selectedAlias: string,
  accessToken: string
): Promise<string[]> => {
  if (!inputValue || !solrDatabaseId) return [];

  try {
    const response = await axios.post<NeighborsResponse>('/api/embeddings/neighbors', {
      word: inputValue,
      solr_database_id: solrDatabaseId,
      collection_name: selectedAlias,
      k: 10,
      threshold: 0.3,
      include_scores: true,
      metric: 'cosine',
    }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.data.has_embeddings && response.data.neighbors.length > 0) {
      return response.data.neighbors.map(n => n.word);
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching neighbors:', error);
    return [];
  }
};

export const computeSimilarity = async (
  word1: string,
  word2: string,
  solrDatabaseId: number,
  selectedAlias: string,
  accessToken: string
): Promise<SimilarityResponse | null> => {
  if (!word1 || !word2 || !solrDatabaseId) return null;

  try {
    const response = await axios.post<SimilarityResponse>('/api/embeddings/similarity', {
      word1,
      word2,
      solr_database_id: solrDatabaseId,
      collection_name: selectedAlias,
      metric: 'cosine',
    }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return response.data;
  } catch (error) {
    console.error('Error computing similarity:', error);
    return null;
  }
};

export const computeAnalogy = async (
  wordA: string,
  wordB: string,
  wordC: string,
  solrDatabaseId: number,
  selectedAlias: string,
  accessToken: string
): Promise<AnalogyResponse | null> => {
  if (!wordA || !wordB || !wordC || !solrDatabaseId) return null;

  try {
    const response = await axios.post<AnalogyResponse>('/api/embeddings/analogy', {
      word_a: wordA,
      word_b: wordB,
      word_c: wordC,
      solr_database_id: solrDatabaseId,
      collection_name: selectedAlias,
      k: 5,
    }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return response.data;
  } catch (error) {
    console.error('Error computing analogy:', error);
    return null;
  }
};