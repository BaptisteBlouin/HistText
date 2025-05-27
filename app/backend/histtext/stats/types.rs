//! Type definitions for statistical operations.

use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use rustc_hash::FxHashMap;

/// Query parameters for statistics operations
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct PathQueryParams {
    /// Path to the cached statistics data file
    #[schema(example = "/tmp/stats_cache.json")]
    pub path: Option<String>,
}

/// Dashboard statistics overview
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DashboardStats {
    /// Total number of documents in the system
    #[schema(example = "41254")]
    total_docs: i64,
    
    /// Total number of collections available
    #[schema(example = "18")]
    total_collections: i64,
    
    /// Total number of users in the system
    #[schema(example = "3")]
    total_users: i64,
    
    /// Number of actively used collections
    #[schema(example = "5")]
    active_collections: i64,
}

/// Cache configuration structure for statistics processing
#[derive(Debug, Serialize, Deserialize)]
pub struct CacheConfig {
    /// Level of statistical analysis to perform
    pub stats_level: String,
    
    /// Total number of results in the dataset
    pub total_results: u64,
    
    /// Collection of documents to analyze
    pub concatenated_docs: Vec<serde_json::Value>,
    
    /// Fields relevant for analysis
    pub relevant_fields: Vec<String>,
    
    /// Text fields for content analysis
    pub text_general_fields: Vec<String>,
}

/// Data accumulator for statistical processing
#[derive(Debug, Default)]
pub struct Accumulator {
    /// Date-based document counts
    pub date_counts: FxHashMap<String, u64>,
    
    /// Metadata field value distributions
    pub metadata_distributions: FxHashMap<String, FxHashMap<String, u64>>,
    
    /// Aggregated text content for analysis
    pub aggregated_text: String,
    
    /// Word frequency counts
    pub word_counts: FxHashMap<String, u64>,
    
    /// Bigram frequency counts
    pub ngram_counts_2: FxHashMap<String, u64>,
    
    /// Trigram frequency counts
    pub ngram_counts_3: FxHashMap<String, u64>,
    
    /// Total character count across all documents
    pub total_text_length: usize,
    
    /// Total sentence count
    pub sentence_count: u64,
    
    /// Individual document lengths
    pub document_lengths: Vec<usize>,
    
    /// Word length distribution
    pub word_lengths: FxHashMap<usize, u64>,
    
    /// Count of capitalized words
    pub capitalized_words: u64,
    
    /// Collection of numeric values found
    pub numeric_values: Vec<String>,
    
    /// Detected languages with counts
    pub languages_detected: FxHashMap<String, u64>,
    
    /// Punctuation character frequencies
    pub punctuation_counts: FxHashMap<char, u64>,
    
    /// Total paragraph count
    pub paragraph_count: u64,
    
    /// Number of empty documents
    pub empty_documents: u64,
    
    /// Document counts by decade
    pub date_decades: FxHashMap<String, u64>,
    
    /// Field completeness statistics
    pub field_completeness: FxHashMap<String, u64>,
}