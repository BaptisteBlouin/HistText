//! Core types and data structures for the embedding system.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use utoipa::{IntoParams, ToSchema};

/// Type alias for mapping words to their embedding vectors
pub type EmbeddingMap = HashMap<String, Embedding>;

/// Type alias for thread-safe shared embedding maps
pub type SharedEmbeddings = Arc<EmbeddingMap>;

/// Representation of a word's embedding vector with precomputed norm
#[derive(Debug, Clone)]
pub struct Embedding {
    /// The embedding vector components
    pub vector: Vec<f32>,
    /// Precomputed L2 norm for faster similarity calculations
    pub norm: f32,
    /// Optional metadata about the embedding
    pub metadata: Option<EmbeddingMetadata>,
}

impl Embedding {
    /// Create a new embedding with automatic norm calculation
    pub fn new(vector: Vec<f32>) -> Self {
        let norm = vector.iter().map(|a| a * a).sum::<f32>().sqrt();
        Self {
            vector,
            norm,
            metadata: None,
        }
    }

    /// Create a new embedding with precomputed norm
    pub fn with_norm(vector: Vec<f32>, norm: f32) -> Self {
        Self {
            vector,
            norm,
            metadata: None,
        }
    }

    /// Create a new embedding with metadata
    pub fn with_metadata(vector: Vec<f32>, metadata: EmbeddingMetadata) -> Self {
        let norm = vector.iter().map(|a| a * a).sum::<f32>().sqrt();
        Self {
            vector,
            norm,
            metadata: Some(metadata),
        }
    }

    /// Get the dimensionality of this embedding
    pub fn dimension(&self) -> usize {
        self.vector.len()
    }

    /// Check if this embedding is normalized (norm ≈ 1.0)
    pub fn is_normalized(&self) -> bool {
        (self.norm - 1.0).abs() < 1e-6
    }

    /// Normalize this embedding in-place
    pub fn normalize(&mut self) {
        if self.norm > 0.0 {
            for component in &mut self.vector {
                *component /= self.norm;
            }
            self.norm = 1.0;
        }
    }

    /// Get a normalized copy of this embedding
    pub fn normalized(&self) -> Self {
        let mut normalized = self.clone();
        normalized.normalize();
        normalized
    }
}

/// Optional metadata for embeddings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingMetadata {
    /// Frequency of this word in the training corpus
    pub frequency: Option<u64>,
    /// Part of speech tag
    pub pos_tag: Option<String>,
    /// Source corpus or model information
    pub source: Option<String>,
    /// Quality score (0.0 to 1.0)
    pub quality_score: Option<f32>,
}

/// Request parameters for finding semantically similar words
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct NeighborsRequest {
    /// Word to find neighbors for
    #[schema(example = "democracy")]
    pub word: String,
    /// ID of the Solr database configuration
    #[schema(example = 1)]
    pub solr_database_id: i32,
    /// Collection name in Solr
    #[schema(example = "my_collection")]
    pub collection_name: String,
    /// Number of neighbors to return (default: 10, max: 100)
    #[schema(example = 10)]
    pub k: Option<usize>,
    /// Similarity threshold (0.0 to 1.0, default: 0.0)
    #[schema(example = 0.3)]
    pub threshold: Option<f32>,
    /// Whether to include similarity scores in response
    #[schema(example = true)]
    pub include_scores: Option<bool>,
}

impl NeighborsRequest {
    /// Get the number of neighbors to return, with bounds checking
    pub fn get_k(&self) -> usize {
        self.k.unwrap_or(10).min(100).max(1)
    }

    /// Get the similarity threshold
    pub fn get_threshold(&self) -> f32 {
        self.threshold.unwrap_or(0.0).clamp(0.0, 1.0)
    }

    /// Check if similarity scores should be included in response
    pub fn should_include_scores(&self) -> bool {
        self.include_scores.unwrap_or(false)
    }
}

/// Response containing semantically similar words
#[derive(Serialize, ToSchema)]
pub struct NeighborsResponse {
    /// List of semantically similar words, sorted by similarity
    pub neighbors: Vec<NeighborResult>,
    /// Whether embeddings exist for the collection
    pub has_embeddings: bool,
    /// Query word that was searched for
    pub query_word: String,
    /// Number of neighbors requested
    pub k: usize,
    /// Similarity threshold applied
    pub threshold: f32,
}

/// Individual neighbor result
#[derive(Serialize, ToSchema)]
pub struct NeighborResult {
    /// The similar word
    pub word: String,
    /// Similarity score (only included if requested)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub similarity: Option<f32>,
}

impl NeighborResult {
    /// Create a new neighbor result without similarity score
    pub fn word_only(word: String) -> Self {
        Self {
            word,
            similarity: None,
        }
    }

    /// Create a new neighbor result with similarity score
    pub fn with_similarity(word: String, similarity: f32) -> Self {
        Self {
            word,
            similarity: Some(similarity),
        }
    }
}

/// Supported embedding file formats
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmbeddingFormat {
    /// Plain text format (word vec1 vec2 ...)
    Text,
    /// Binary format with 4-byte floats
    Binary,
    /// Word2Vec binary format
    Word2VecBinary,
    /// FastText binary format
    FastTextBinary,
    /// GloVe text format
    GloVe,
}

impl EmbeddingFormat {
    /// Detect format from file extension
    pub fn from_extension(path: &str) -> Self {
        let extension = std::path::Path::new(path)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "bin" => Self::Binary,
            "w2v" => Self::Word2VecBinary,
            "ft" | "fasttext" => Self::FastTextBinary,
            "glove" => Self::GloVe,
            "vec" | "txt" | _ => Self::Text,
        }
    }

    /// Get file extensions for this format
    pub fn extensions(&self) -> &[&str] {
        match self {
            Self::Text => &["txt", "vec"],
            Self::Binary => &["bin"],
            Self::Word2VecBinary => &["w2v", "bin"],
            Self::FastTextBinary => &["ft", "fasttext", "bin"],
            Self::GloVe => &["glove", "txt"],
        }
    }

    /// Check if this format is binary
    pub fn is_binary(&self) -> bool {
        matches!(
            self,
            Self::Binary | Self::Word2VecBinary | Self::FastTextBinary
        )
    }

    /// Get a human-readable description
    pub fn description(&self) -> &str {
        match self {
            Self::Text => "Plain text format",
            Self::Binary => "Binary format with 4-byte floats",
            Self::Word2VecBinary => "Word2Vec binary format",
            Self::FastTextBinary => "FastText binary format",
            Self::GloVe => "GloVe text format",
        }
    }
}

/// Configuration for embedding loading and processing
#[derive(Debug, Clone)]
pub struct EmbeddingConfig {
    /// Maximum number of words to load (0 = no limit)
    pub max_words: usize,
    /// Whether to normalize vectors during loading
    pub normalize_on_load: bool,
    /// Whether to validate vector dimensions
    pub validate_dimensions: bool,
    /// Expected vector dimension (0 = auto-detect)
    pub expected_dimension: usize,
    /// Whether to skip words with invalid characters
    pub skip_invalid_words: bool,
    /// Memory mapping for large files
    pub use_memory_mapping: bool,
    /// Parallel loading workers
    pub parallel_workers: usize,
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            max_words: 0,
            normalize_on_load: false,
            validate_dimensions: true,
            expected_dimension: 0,
            skip_invalid_words: true,
            use_memory_mapping: true,
            parallel_workers: num_cpus::get(),
        }
    }
}

/// Error types for embedding operations
#[derive(Debug, thiserror::Error)]
pub enum EmbeddingError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Format error: {0}")]
    Format(String),
    
    #[error("Dimension mismatch: expected {expected}, got {actual}")]
    DimensionMismatch { expected: usize, actual: usize },
    
    #[error("Invalid word: {0}")]
    InvalidWord(String),
    
    #[error("File not found: {0}")]
    FileNotFound(String),
    
    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),
    
    #[error("Parse error: {0}")]
    Parse(String),
    
    #[error("Cache error: {0}")]
    Cache(String),
}

/// Result type for embedding operations
pub type EmbeddingResult<T> = Result<T, EmbeddingError>;

/// Statistics about loaded embeddings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingStats {
    /// Number of words loaded
    pub word_count: usize,
    /// Vector dimension
    pub dimension: usize,
    /// File format used
    pub format: String,
    /// File size in bytes
    pub file_size: u64,
    /// Loading time in milliseconds
    pub load_time_ms: u64,
    /// Memory usage in bytes
    pub memory_usage: usize,
    /// Whether vectors are normalized
    pub normalized: bool,
}

/// Cache key for embeddings
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CacheKey {
    pub solr_database_id: i32,
    pub collection_name: String,
}

impl CacheKey {
    pub fn new(solr_database_id: i32, collection_name: String) -> Self {
        Self {
            solr_database_id,
            collection_name,
        }
    }

    pub fn to_string(&self) -> String {
        format!("{}:{}", self.solr_database_id, self.collection_name)
    }
}

impl std::fmt::Display for CacheKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.solr_database_id, self.collection_name)
    }
}