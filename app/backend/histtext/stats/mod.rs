//! Statistical analysis module for document collections.
//!
//! This module provides comprehensive statistical analysis capabilities including
//! word frequency analysis, n-gram generation, metadata distribution analysis,
//! language detection, and corpus-level statistics.

pub mod accumulator;
pub mod handlers;
pub mod processing;
pub mod types;
pub mod utils;

// Re-export main handlers
pub use handlers::calculate_statistics;

// Re-export types
pub use types::{DashboardStats, PathQueryParams};

// Re-export OpenAPI path structs for utoipa
pub use handlers::__path_calculate_statistics;
