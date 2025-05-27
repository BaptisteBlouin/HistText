//! Text tokenization module for multilingual text processing.
//! 
//! This module provides comprehensive tokenization capabilities supporting both
//! Latin-based languages and CJK (Chinese, Japanese, Korean) languages with
//! optimized processing for large text volumes and batch operations.

pub mod types;
pub mod handlers;
pub mod engines;
pub mod utils;

// Re-export main handlers
pub use handlers::{tokenize, batch_tokenize};

// Re-export types
pub use types::{TokenizeRequest, TokenizeResponse};

// Re-export core functions for internal use
pub use engines::tokenize_text_fast;

// Re-export OpenAPI path structs for utoipa
pub use handlers::__path_tokenize;