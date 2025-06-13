use crate::histtext::embeddings::stats::{record_search_time, record_similarity_time};
use crate::histtext::embeddings::types::{
    Embedding, EmbeddingMap, NeighborResult, NeighborsRequest, NeighborsResponse,
};
use log::{debug, warn};
use rayon::prelude::*;
use std::cmp::Ordering;
use std::collections::BinaryHeap;
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SimilarityMetric {
    Cosine,
    Euclidean,
    DotProduct,
    Manhattan,
}

impl Default for SimilarityMetric {
    fn default() -> Self {
        Self::Cosine
    }
}

pub struct SimilaritySearcher {
    metric: SimilarityMetric,
    use_parallel: bool,
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
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_metric(metric: SimilarityMetric) -> Self {
        Self {
            metric,
            ..Self::default()
        }
    }

    pub fn with_parallel(mut self, use_parallel: bool) -> Self {
        self.use_parallel = use_parallel;
        self
    }

    pub fn with_parallel_threshold(mut self, threshold: usize) -> Self {
        self.parallel_threshold = threshold;
        self
    }

    pub fn find_neighbors(
        &self,
        request: &NeighborsRequest,
        embeddings: &EmbeddingMap,
    ) -> NeighborsResponse {
        let search_start = Instant::now();

        let query_word = request.word.to_lowercase();
        let k = request.get_k();
        let threshold = request.get_threshold();
        let include_scores = request.should_include_scores();

        debug!(
            "Finding {} neighbors for '{}' with threshold {} using {:?}",
            k, query_word, threshold, self.metric
        );

        let query_embedding = match embeddings.get(&query_word) {
            Some(embedding) => embedding,
            None => {
                warn!("Word '{}' not found in embeddings", query_word);
                record_search_time(search_start.elapsed());
                return NeighborsResponse {
                    neighbors: vec![],
                    has_embeddings: true,
                    query_word: request.word.clone(),
                    k,
                    threshold,
                };
            }
        };

        let neighbors = if self.use_parallel && embeddings.len() > self.parallel_threshold {
            self.parallel_search(
                query_embedding,
                embeddings,
                &query_word,
                k,
                threshold,
                include_scores,
            )
        } else {
            self.sequential_search(
                query_embedding,
                embeddings,
                &query_word,
                k,
                threshold,
                include_scores,
            )
        };

        record_search_time(search_start.elapsed());

        NeighborsResponse {
            neighbors,
            has_embeddings: true,
            query_word: request.word.clone(),
            k,
            threshold,
        }
    }

    fn parallel_search(
        &self,
        query_embedding: &Embedding,
        embeddings: &EmbeddingMap,
        query_word: &str,
        k: usize,
        threshold: f32,
        include_scores: bool,
    ) -> Vec<NeighborResult> {
        let results: Vec<_> = embeddings
            .par_iter()
            .filter(|(word, _)| *word != query_word)
            .map(|(word, embedding)| {
                let sim_start = Instant::now();
                let similarity = self.compute_similarity(query_embedding, embedding);
                record_similarity_time(sim_start.elapsed());
                (word.clone(), similarity)
            })
            .filter(|(_, similarity)| *similarity >= threshold)
            .collect();

        self.select_top_k(results, k, include_scores)
    }

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

            let sim_start = Instant::now();
            let similarity = self.compute_similarity(query_embedding, embedding);
            record_similarity_time(sim_start.elapsed());

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

        let mut results: Vec<_> = heap.into_vec();
        results.sort_by(|a, b| {
            b.similarity
                .partial_cmp(&a.similarity)
                .unwrap_or(Ordering::Equal)
        });

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

    fn select_top_k(
        &self,
        mut candidates: Vec<(String, f32)>,
        k: usize,
        include_scores: bool,
    ) -> Vec<NeighborResult> {
        candidates.par_sort_unstable_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(Ordering::Equal));

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

    pub fn compute_similarity(&self, embedding1: &Embedding, embedding2: &Embedding) -> f32 {
        match self.metric {
            SimilarityMetric::Cosine => cosine_similarity(
                &embedding1.vector,
                embedding1.norm,
                &embedding2.vector,
                embedding2.norm,
            ),
            SimilarityMetric::Euclidean => {
                euclidean_similarity(&embedding1.vector, &embedding2.vector)
            }
            SimilarityMetric::DotProduct => {
                dot_product_similarity(&embedding1.vector, &embedding2.vector)
            }
            SimilarityMetric::Manhattan => {
                manhattan_similarity(&embedding1.vector, &embedding2.vector)
            }
        }
    }
}

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
        Some(self.cmp(other))
    }
}

impl Ord for ScoredNeighbor {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

#[inline]
pub fn cosine_similarity(vec1: &[f32], norm1: f32, vec2: &[f32], norm2: f32) -> f32 {
    if norm1 == 0.0 || norm2 == 0.0 {
        return 0.0;
    }

    let dot_product = dot_product(vec1, vec2);
    dot_product / (norm1 * norm2)
}

#[inline]
pub fn dot_product(vec1: &[f32], vec2: &[f32]) -> f32 {
    debug_assert_eq!(vec1.len(), vec2.len());
    dot_product_scalar(vec1, vec2)
}

#[inline]
fn dot_product_scalar(vec1: &[f32], vec2: &[f32]) -> f32 {
    vec1.iter().zip(vec2.iter()).map(|(a, b)| a * b).sum()
}

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

#[inline]
pub fn dot_product_similarity(vec1: &[f32], vec2: &[f32]) -> f32 {
    let dot = dot_product(vec1, vec2);

    let norm1: f32 = vec1.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm2: f32 = vec2.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm1 == 0.0 || norm2 == 0.0 {
        0.0
    } else {
        dot / (norm1 * norm2)
    }
}

#[inline]
pub fn manhattan_similarity(vec1: &[f32], vec2: &[f32]) -> f32 {
    let distance: f32 = vec1
        .iter()
        .zip(vec2.iter())
        .map(|(a, b)| (a - b).abs())
        .sum();

    1.0 / (1.0 + distance)
}

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
                    SimilarityMetric::Euclidean => {
                        euclidean_similarity(&query.vector, &target.vector)
                    }
                    SimilarityMetric::DotProduct => {
                        dot_product_similarity(&query.vector, &target.vector)
                    }
                    SimilarityMetric::Manhattan => {
                        manhattan_similarity(&query.vector, &target.vector)
                    }
                })
                .collect()
        })
        .collect()
}
