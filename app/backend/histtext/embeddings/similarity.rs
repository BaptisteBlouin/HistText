//! Optimized similarity computations for word embeddings.
//!
//! This module provides high-performance similarity calculations using various
//! metrics and optimization techniques including SIMD operations and parallel processing.

use crate::histtext::embeddings::types::{
    Embedding, EmbeddingMap, NeighborResult, NeighborsRequest, NeighborsResponse,
};
use log::{debug, warn};
use rayon::prelude::*;
use std::cmp::Ordering;
use std::collections::BinaryHeap;

/// Similarity metrics supported by the system
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SimilarityMetric {
    /// Cosine similarity (default)
    Cosine,
    /// Euclidean distance (inverted for similarity)
    Euclidean,
    /// Dot product similarity
    DotProduct,
    /// Manhattan distance (inverted for similarity)
    Manhattan,
}

impl Default for SimilarityMetric {
    fn default() -> Self {
        Self::Cosine
    }
}

/// Optimized neighbor search with configurable similarity metrics
pub struct SimilaritySearcher {
    /// Similarity metric to use
    metric: SimilarityMetric,
    /// Whether to use parallel processing
    use_parallel: bool,
    /// Minimum batch size for parallel processing
    parallel_threshold: usize,
}

impl Default for SimilaritySearcher {
    fn default() -> Self {
        Self {
            metric: SimilarityMetric::Cosine,
            use_parallel: true,
            parallel_threshold: 1000,
        }
    }
}

impl SimilaritySearcher {
    /// Create a new similarity searcher with default settings
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a searcher with custom metric
    pub fn with_metric(metric: SimilarityMetric) -> Self {
        Self {
            metric,
            ..Self::default()
        }
    }

    /// Set whether to use parallel processing
    pub fn with_parallel(mut self, use_parallel: bool) -> Self {
        self.use_parallel = use_parallel;
        self
    }

    /// Set parallel processing threshold
    pub fn with_parallel_threshold(mut self, threshold: usize) -> Self {
        self.parallel_threshold = threshold;
        self
    }

    /// Find the most similar words to a query word
    pub fn find_neighbors(
        &self,
        request: &NeighborsRequest,
        embeddings: &EmbeddingMap,
    ) -> NeighborsResponse {
        let query_word = request.word.to_lowercase();
        let k = request.get_k();
        let threshold = request.get_threshold();
        let include_scores = request.should_include_scores();

        debug!(
            "Finding {} neighbors for '{}' with threshold {} using {:?}",
            k, query_word, threshold, self.metric
        );

        // Find the query embedding
        let query_embedding = match embeddings.get(&query_word) {
            Some(embedding) => embedding,
            None => {
                warn!("Word '{}' not found in embeddings", query_word);
                return NeighborsResponse {
                    neighbors: vec![],
                    has_embeddings: true,
                    query_word: request.word.clone(),
                    k,
                    threshold,
                };
            }
        };

        // Choose search strategy based on collection size
        let neighbors = if self.use_parallel && embeddings.len() > self.parallel_threshold {
            self.parallel_search(query_embedding, embeddings, &query_word, k, threshold, include_scores)
        } else {
            self.sequential_search(query_embedding, embeddings, &query_word, k, threshold, include_scores)
        };

        NeighborsResponse {
            neighbors,
            has_embeddings: true,
            query_word: request.word.clone(),
            k,
            threshold,
        }
    }

    /// Parallel search implementation using rayon
    fn parallel_search(
        &self,
        query_embedding: &Embedding,
        embeddings: &EmbeddingMap,
        query_word: &str,
        k: usize,
        threshold: f32,
        include_scores: bool,
    ) -> Vec<NeighborResult> {
        // Create a thread-safe heap for collecting results
        let results: Vec<_> = embeddings
            .par_iter()
            .filter(|(word, _)| *word != query_word)
            .map(|(word, embedding)| {
                let similarity = self.compute_similarity(query_embedding, embedding);
                (word.clone(), similarity)
            })
            .filter(|(_, similarity)| *similarity >= threshold)
            .collect();

        // Sort and take top-k
        self.select_top_k(results, k, include_scores)
    }

    /// Sequential search implementation
    fn sequential_search(
        &self,
        query_embedding: &Embedding,
        embeddings: &EmbeddingMap,
        query_word: &str,
        k: usize,
        threshold: f32,
        include_scores: bool,
    ) -> Vec<NeighborResult> {
        let mut heap = BinaryHeap::with_capacity(k);

        for (word, embedding) in embeddings {
            if word == query_word {
                continue;
            }

            let similarity = self.compute_similarity(query_embedding, embedding);
            
            if similarity < threshold {
                continue;
            }

            let neighbor = ScoredNeighbor {
                word: word.clone(),
                similarity,
            };

            if heap.len() < k {
                heap.push(neighbor);
            } else if let Some(worst) = heap.peek() {
                if similarity > worst.similarity {
                    heap.pop();
                    heap.push(neighbor);
                }
            }
        }

        // Convert heap to sorted vector
        let mut results: Vec<_> = heap.into_vec();
        results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(Ordering::Equal));

        results
            .into_iter()
            .map(|scored| {
                if include_scores {
                    NeighborResult::with_similarity(scored.word, scored.similarity)
                } else {
                    NeighborResult::word_only(scored.word)
                }
            })
            .collect()
    }

    /// Select top-k results from a list of scored candidates
    fn select_top_k(
        &self,
        mut candidates: Vec<(String, f32)>,
        k: usize,
        include_scores: bool,
    ) -> Vec<NeighborResult> {
        // Sort by similarity (descending)
        candidates.par_sort_unstable_by(|a, b| {
            b.1.partial_cmp(&a.1).unwrap_or(Ordering::Equal)
        });

        candidates
            .into_iter()
            .take(k)
            .map(|(word, similarity)| {
                if include_scores {
                    NeighborResult::with_similarity(word, similarity)
                } else {
                    NeighborResult::word_only(word)
                }
            })
            .collect()
    }

    /// Compute similarity between two embeddings based on the configured metric
    pub fn compute_similarity(&self, embedding1: &Embedding, embedding2: &Embedding) -> f32 {
        match self.metric {
            SimilarityMetric::Cosine => cosine_similarity(&embedding1.vector, embedding1.norm, &embedding2.vector, embedding2.norm),
            SimilarityMetric::Euclidean => euclidean_similarity(&embedding1.vector, &embedding2.vector),
            SimilarityMetric::DotProduct => dot_product_similarity(&embedding1.vector, &embedding2.vector),
            SimilarityMetric::Manhattan => manhattan_similarity(&embedding1.vector, &embedding2.vector),
        }
    }
}

/// Helper struct for maintaining a priority queue of neighbors
#[derive(Debug, Clone)]
struct ScoredNeighbor {
    word: String,
    similarity: f32,
}

impl PartialEq for ScoredNeighbor {
    fn eq(&self, other: &Self) -> bool {
        self.similarity == other.similarity
    }
}

impl Eq for ScoredNeighbor {}

impl PartialOrd for ScoredNeighbor {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // Reverse ordering for min-heap behavior
        Some(self.cmp(other))
    }
}

impl Ord for ScoredNeighbor {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

/// Compute cosine similarity between two vectors with precomputed norms
#[inline]
pub fn cosine_similarity(vec1: &[f32], norm1: f32, vec2: &[f32], norm2: f32) -> f32 {
    if norm1 == 0.0 || norm2 == 0.0 {
        return 0.0;
    }

    let dot_product = dot_product(vec1, vec2);
    dot_product / (norm1 * norm2)
}

/// Compute dot product of two vectors with SIMD optimization
#[inline]
pub fn dot_product(vec1: &[f32], vec2: &[f32]) -> f32 {
    debug_assert_eq!(vec1.len(), vec2.len());
    
    // For now, use the safe scalar implementation to avoid segfaults
    // TODO: Fix SIMD implementations with proper memory alignment checks
    dot_product_scalar(vec1, vec2)
    
    /* DISABLED SIMD CODE - causing segfaults
    // Use SIMD if available and vectors are large enough
    #[cfg(target_arch = "x86_64")]
    {
        if vec1.len() >= 8 && is_x86_feature_detected!("avx") {
            return unsafe { dot_product_avx(vec1, vec2) };
        } else if vec1.len() >= 4 && is_x86_feature_detected!("sse") {
            return unsafe { dot_product_sse(vec1, vec2) };
        }
    }
    
    #[cfg(target_arch = "aarch64")]
    {
        if vec1.len() >= 4 && std::arch::is_aarch64_feature_detected!("neon") {
            return unsafe { dot_product_neon(vec1, vec2) };
        }
    }
    */
}   

/// Scalar dot product implementation
#[inline]
fn dot_product_scalar(vec1: &[f32], vec2: &[f32]) -> f32 {
    vec1.iter()
        .zip(vec2.iter())
        .map(|(a, b)| a * b)
        .sum()
}

/// AVX-optimized dot product for x86_64
#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx")]
unsafe fn dot_product_avx(vec1: &[f32], vec2: &[f32]) -> f32 {
    use std::arch::x86_64::*;
    
    let len = vec1.len();
    let chunks = len / 8;
    let remainder = len % 8;
    
    let mut sum = _mm256_setzero_ps();
    
    let ptr1 = vec1.as_ptr();
    let ptr2 = vec2.as_ptr();
    
    // Process 8 elements at a time
    for i in 0..chunks {
        let offset = i * 8;
        let a = _mm256_load_ps(ptr1.add(offset));
        let b = _mm256_load_ps(ptr2.add(offset));
        let product = _mm256_mul_ps(a, b);
        sum = _mm256_add_ps(sum, product);
    }
    
    // Horizontal sum of the 8 elements in sum
    let mut result = [0f32; 8];
    _mm256_store_ps(result.as_mut_ptr(), sum);
    let mut total = result.iter().sum::<f32>();
    
    // Handle remainder
    let start = chunks * 8;
    for i in 0..remainder {
        total += vec1[start + i] * vec2[start + i];
    }
    
    total
}

/// SSE-optimized dot product for x86_64
#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "sse")]
unsafe fn dot_product_sse(vec1: &[f32], vec2: &[f32]) -> f32 {
    use std::arch::x86_64::*;
    
    let len = vec1.len();
    let chunks = len / 4;
    let remainder = len % 4;
    
    let mut sum = _mm_setzero_ps();
    
    let ptr1 = vec1.as_ptr();
    let ptr2 = vec2.as_ptr();
    
    // Process 4 elements at a time
    for i in 0..chunks {
        let offset = i * 4;
        let a = _mm_load_ps(ptr1.add(offset));
        let b = _mm_load_ps(ptr2.add(offset));
        let product = _mm_mul_ps(a, b);
        sum = _mm_add_ps(sum, product);
    }
    
    // Horizontal sum of the 4 elements in sum
    let mut result = [0f32; 4];
    _mm_store_ps(result.as_mut_ptr(), sum);
    let mut total = result.iter().sum::<f32>();
    
    // Handle remainder
    let start = chunks * 4;
    for i in 0..remainder {
        total += vec1[start + i] * vec2[start + i];
    }
    
    total
}

/// NEON-optimized dot product for ARM64
#[cfg(target_arch = "aarch64")]
#[target_feature(enable = "neon")]
unsafe fn dot_product_neon(vec1: &[f32], vec2: &[f32]) -> f32 {
    use std::arch::aarch64::*;
    
    let len = vec1.len();
    let chunks = len / 4;
    let remainder = len % 4;
    
    let mut sum = vdupq_n_f32(0.0);
    
    let ptr1 = vec1.as_ptr();
    let ptr2 = vec2.as_ptr();
    
    // Process 4 elements at a time
    for i in 0..chunks {
        let offset = i * 4;
        let a = vld1q_f32(ptr1.add(offset));
        let b = vld1q_f32(ptr2.add(offset));
        sum = vfmaq_f32(sum, a, b);
    }
    
    // Horizontal sum
    let mut total = vaddvq_f32(sum);
    
    // Handle remainder
    let start = chunks * 4;
    for i in 0..remainder {
        total += vec1[start + i] * vec2[start + i];
    }
    
    total
}

/// Compute Euclidean distance and convert to similarity (1 / (1 + distance))
#[inline]
pub fn euclidean_similarity(vec1: &[f32], vec2: &[f32]) -> f32 {
    let distance_squared: f32 = vec1
        .iter()
        .zip(vec2.iter())
        .map(|(a, b)| {
            let diff = a - b;
            diff * diff
        })
        .sum();
    
    let distance = distance_squared.sqrt();
    1.0 / (1.0 + distance)
}

/// Compute dot product similarity (normalized dot product)
#[inline]
pub fn dot_product_similarity(vec1: &[f32], vec2: &[f32]) -> f32 {
    let dot = dot_product(vec1, vec2);
    
    // Normalize by vector lengths
    let norm1: f32 = vec1.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm2: f32 = vec2.iter().map(|x| x * x).sum::<f32>().sqrt();
    
    if norm1 == 0.0 || norm2 == 0.0 {
        0.0
    } else {
        dot / (norm1 * norm2)
    }
}

/// Compute Manhattan distance and convert to similarity
#[inline]
pub fn manhattan_similarity(vec1: &[f32], vec2: &[f32]) -> f32 {
    let distance: f32 = vec1
        .iter()
        .zip(vec2.iter())
        .map(|(a, b)| (a - b).abs())
        .sum();
    
    1.0 / (1.0 + distance)
}

/// Batch similarity computation for multiple queries
pub fn batch_similarities(
    queries: &[&Embedding],
    targets: &[&Embedding],
    metric: SimilarityMetric,
) -> Vec<Vec<f32>> {
    queries
        .par_iter()
        .map(|query| {
            targets
                .iter()
                .map(|target| match metric {
                    SimilarityMetric::Cosine => {
                        cosine_similarity(&query.vector, query.norm, &target.vector, target.norm)
                    }
                    SimilarityMetric::Euclidean => euclidean_similarity(&query.vector, &target.vector),
                    SimilarityMetric::DotProduct => dot_product_similarity(&query.vector, &target.vector),
                    SimilarityMetric::Manhattan => manhattan_similarity(&query.vector, &target.vector),
                })
                .collect()
        })
        .collect()
}

/// Find nearest neighbors using approximate methods for very large collections
pub struct ApproximateSearcher {
    /// Number of random projections for LSH
    num_projections: usize,
    /// Number of candidates to examine
    num_candidates: usize,
}

impl ApproximateSearcher {
    pub fn new(num_projections: usize, num_candidates: usize) -> Self {
        Self {
            num_projections,
            num_candidates,
        }
    }

    /// Build LSH index for approximate nearest neighbor search
    pub fn build_lsh_index(&self, embeddings: &EmbeddingMap) -> LshIndex {
        // This is a simplified LSH implementation
        // In practice, you might want to use a more sophisticated library
        LshIndex::new(embeddings, self.num_projections)
    }

    /// Find approximate nearest neighbors
    pub fn find_approximate_neighbors(
        &self,
        query: &Embedding,
        index: &LshIndex,
        k: usize,
    ) -> Vec<String> {
        let candidates = index.get_candidates(query, self.num_candidates);
        
        // Compute exact similarities for candidates
        let mut scored_candidates: Vec<_> = candidates
            .into_iter()
            .map(|word| {
                let embedding = index.get_embedding(&word).unwrap();
                let similarity = cosine_similarity(&query.vector, query.norm, &embedding.vector, embedding.norm);
                (word, similarity)
            })
            .collect();
        
        // Sort and return top-k
        scored_candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(Ordering::Equal));
        scored_candidates
            .into_iter()
            .take(k)
            .map(|(word, _)| word)
            .collect()
    }
}

/// Simple LSH index for approximate nearest neighbor search
pub struct LshIndex {
    /// Random projection vectors
    projections: Vec<Vec<f32>>,
    /// Hash buckets mapping hash codes to word lists
    buckets: std::collections::HashMap<Vec<bool>, Vec<String>>,
    /// Word to embedding mapping
    embeddings: std::collections::HashMap<String, Embedding>,
}

impl LshIndex {
    pub fn new(embeddings: &EmbeddingMap, num_projections: usize) -> Self {
        use rand::Rng;
        
        // Determine embedding dimension
        let dimension = embeddings.values().next().map(|e| e.dimension()).unwrap_or(0);
        
        // Generate random projection vectors
        let mut rng = rand::rng();
        let projections: Vec<Vec<f32>> = (0..num_projections)
            .map(|_| {
                (0..dimension)
                    .map(|_| rng.random_range(-1.0..1.0))
                    .collect()
            })
            .collect();
        
        // Build hash buckets
        let mut buckets = std::collections::HashMap::new();
        let mut embedding_map = std::collections::HashMap::new();
        
        for (word, embedding) in embeddings {
            let hash_code = Self::compute_hash(&embedding.vector, &projections);
            buckets.entry(hash_code).or_insert_with(Vec::new).push(word.clone());
            embedding_map.insert(word.clone(), embedding.clone());
        }
        
        Self {
            projections,
            buckets,
            embeddings: embedding_map,
        }
    }
    
    fn compute_hash(vector: &[f32], projections: &[Vec<f32>]) -> Vec<bool> {
        projections
            .iter()
            .map(|proj| dot_product_scalar(vector, proj) > 0.0)
            .collect()
    }
    
    pub fn get_candidates(&self, query: &Embedding, max_candidates: usize) -> Vec<String> {
        let hash_code = Self::compute_hash(&query.vector, &self.projections);
        
        // Get exact matches first
        let mut candidates =self.buckets
            .get(&hash_code).cloned()
            .unwrap_or_default();
        
        // If we don't have enough candidates, look in nearby buckets
        if candidates.len() < max_candidates {
            for (bucket_hash, words) in &self.buckets {
                if bucket_hash != &hash_code {
                    candidates.extend(words.iter().cloned());
                    if candidates.len() >= max_candidates {
                        break;
                    }
                }
            }
        }
        
        candidates.truncate(max_candidates);
        candidates
    }
    
    pub fn get_embedding(&self, word: &str) -> Option<&Embedding> {
        self.embeddings.get(word)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_dot_product_scalar() {
        let vec1 = vec![1.0, 2.0, 3.0];
        let vec2 = vec![4.0, 5.0, 6.0];
        let result = dot_product_scalar(&vec1, &vec2);
        assert_eq!(result, 32.0); // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    }

    #[test]
    fn test_cosine_similarity() {
        let vec1 = vec![1.0, 0.0, 0.0];
        let vec2 = vec![0.0, 1.0, 0.0];
        let norm1 = 1.0;
        let norm2 = 1.0;
        
        let similarity = cosine_similarity(&vec1, norm1, &vec2, norm2);
        assert_eq!(similarity, 0.0); // Orthogonal vectors
        
        let vec3 = vec![1.0, 0.0, 0.0];
        let similarity_self = cosine_similarity(&vec1, norm1, &vec3, norm1);
        assert_eq!(similarity_self, 1.0); // Identical vectors
    }

    #[test]
    fn test_similarity_searcher() {
        let mut embeddings = HashMap::new();
        embeddings.insert("hello".to_string(), Embedding::new(vec![1.0, 0.0, 0.0]));
        embeddings.insert("world".to_string(), Embedding::new(vec![0.0, 1.0, 0.0]));
        embeddings.insert("test".to_string(), Embedding::new(vec![1.0, 0.1, 0.0]));
        
        let searcher = SimilaritySearcher::new();
        let request = NeighborsRequest {
            word: "hello".to_string(),
            solr_database_id: 1,
            collection_name: "test".to_string(),
            k: Some(2),
            threshold: Some(0.0),
            include_scores: Some(true),
        };
        
        let response = searcher.find_neighbors(&request, &embeddings);
        
        assert_eq!(response.neighbors.len(), 2);
        assert!(response.has_embeddings);
        assert_eq!(response.query_word, "hello");
    }

    #[test]
    fn test_euclidean_similarity() {
        let vec1 = vec![0.0, 0.0];
        let vec2 = vec![1.0, 1.0];
        
        let similarity = euclidean_similarity(&vec1, &vec2);
        assert!(similarity > 0.0 && similarity < 1.0);
        
        let similarity_self = euclidean_similarity(&vec1, &vec1);
        assert_eq!(similarity_self, 1.0); // Same vector should have similarity 1
    }
}