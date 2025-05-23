//! Multi-format embedding file loaders with optimized parsing.
//!
//! This module supports loading embeddings from various formats including:
//! - Plain text (.vec, .txt)
//! - Binary formats (.bin)
//! - Word2Vec binary format
//! - FastText binary format
//! - GloVe format

use crate::histtext::embeddings::types::{
    Embedding, EmbeddingConfig, EmbeddingError, EmbeddingFormat, EmbeddingMap, EmbeddingResult,
    EmbeddingStats,
};

use log::{debug, info, warn};
use rayon::prelude::*;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::Path;
use std::time::Instant;

/// Load embeddings from a file with automatic format detection
pub async fn load_embeddings(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, EmbeddingStats)> {
    let format = EmbeddingFormat::from_extension(path);
    load_embeddings_with_format(path, format, config).await
}

/// Load embeddings from a file with specified format
pub async fn load_embeddings_with_format(
    path: &str,
    format: EmbeddingFormat,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, EmbeddingStats)> {
    let start_time = Instant::now();
    info!("Loading embeddings from {} (format: {:?})", path, format);

    // Check if file exists
    if !Path::new(path).exists() {
        return Err(EmbeddingError::FileNotFound(path.to_string()));
    }

    // Get file size
    let file_size = std::fs::metadata(path)
        .map_err(EmbeddingError::Io)?
        .len();

    // Load based on format
    let (embeddings, dimension) = match format {
        EmbeddingFormat::Text => load_text_format(path, config).await?,
        EmbeddingFormat::Binary => load_binary_format(path, config).await?,
        EmbeddingFormat::Word2VecBinary => load_word2vec_binary(path, config).await?,
        EmbeddingFormat::FastTextBinary => load_fasttext_binary(path, config).await?,
        EmbeddingFormat::GloVe => load_glove_format(path, config).await?,
    };

    let load_time_ms = start_time.elapsed().as_millis() as u64;
    let memory_usage = estimate_memory_usage(&embeddings);

    let stats = EmbeddingStats {
        word_count: embeddings.len(),
        dimension,
        format: format!("{:?}", format),
        file_size,
        load_time_ms,
        memory_usage,
        normalized: config.normalize_on_load,
    };

    info!(
        "Successfully loaded {} embeddings in {}ms ({}MB memory)",
        embeddings.len(),
        load_time_ms,
        memory_usage / 1024 / 1024
    );

    Ok((embeddings, stats))
}

/// Load plain text format embeddings
async fn load_text_format(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    let file = File::open(path).map_err(EmbeddingError::Io)?;
    let reader = BufReader::new(file);
    
    let mut embeddings = HashMap::new();
    let mut dimension = 0;
    let mut line_count = 0;
    let mut error_count = 0;

    // Process lines in parallel chunks for better performance
    let lines: Vec<String> = reader
        .lines()
        .collect::<Result<Vec<_>, _>>()
        .map_err(EmbeddingError::Io)?;

    let chunk_size = (lines.len() / config.parallel_workers).max(1000);
    let results: Vec<_> = lines
        .par_chunks(chunk_size)
        .map(|chunk| process_text_chunk(chunk, config))
        .collect();

    // Merge results
    for (chunk_embeddings, chunk_dimension, chunk_errors) in results {
        if dimension == 0 {
            dimension = chunk_dimension;
        } else if config.validate_dimensions && chunk_dimension != 0 && chunk_dimension != dimension {
            return Err(EmbeddingError::DimensionMismatch {
                expected: dimension,
                actual: chunk_dimension,
            });
        }

        embeddings.extend(chunk_embeddings);
        error_count += chunk_errors;
        line_count += lines.len();

        if config.max_words > 0 && embeddings.len() >= config.max_words {
            break;
        }
    }

    if error_count > 0 {
        warn!("Encountered {} parsing errors out of {} lines", error_count, line_count);
    }

    debug!("Detected dimension: {}", dimension);
    Ok((embeddings, dimension))
}

/// Process a chunk of text lines in parallel
fn process_text_chunk(
    lines: &[String],
    config: &EmbeddingConfig,
) -> (HashMap<String, Embedding>, usize, usize) {
    let mut embeddings = HashMap::new();
    let mut dimension = 0;
    let mut error_count = 0;

    for line in lines {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        match parse_text_line(line, config) {
            Ok((word, embedding)) => {
                if dimension == 0 {
                    dimension = embedding.dimension();
                } else if config.validate_dimensions && embedding.dimension() != dimension {
                    error_count += 1;
                    continue;
                }
                embeddings.insert(word, embedding);
            }
            Err(_) => {
                error_count += 1;
            }
        }
    }

    (embeddings, dimension, error_count)
}

/// Parse a single line from text format
fn parse_text_line(line: &str, config: &EmbeddingConfig) -> EmbeddingResult<(String, Embedding)> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    
    if parts.len() < 2 {
        return Err(EmbeddingError::Format("Line too short".to_string()));
    }

    let word = parts[0].to_string();
    
    // Skip invalid words if configured
    if config.skip_invalid_words && !is_valid_word(&word) {
        return Err(EmbeddingError::InvalidWord(word));
    }

    let vector: Result<Vec<f32>, _> = parts[1..]
        .iter()
        .map(|s| s.parse::<f32>())
        .collect();

    let vector = vector.map_err(|e| EmbeddingError::Parse(e.to_string()))?;
    
    if vector.is_empty() {
        return Err(EmbeddingError::Format("Empty vector".to_string()));
    }

    let mut embedding = Embedding::new(vector);
    
    if config.normalize_on_load {
        embedding.normalize();
    }

    Ok((word, embedding))
}

/// Load binary format embeddings (custom 4-byte float format)
async fn load_binary_format(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    let mut file = File::open(path).map_err(EmbeddingError::Io)?;
    let mut embeddings = HashMap::new();
    
    // Read header: word_count (4 bytes) + dimension (4 bytes)
    let mut header = [0u8; 8];
    file.read_exact(&mut header).map_err(EmbeddingError::Io)?;
    
    let word_count = u32::from_le_bytes([header[0], header[1], header[2], header[3]]) as usize;
    let dimension = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
    
    info!("Binary file contains {} words with dimension {}", word_count, dimension);
    
    let max_words = if config.max_words > 0 {
        config.max_words.min(word_count)
    } else {
        word_count
    };

    for _ in 0..max_words {
        // Read word length (4 bytes)
        let mut word_len_bytes = [0u8; 4];
        file.read_exact(&mut word_len_bytes).map_err(EmbeddingError::Io)?;
        let word_len = u32::from_le_bytes(word_len_bytes) as usize;
        
        // Read word
        let mut word_bytes = vec![0u8; word_len];
        file.read_exact(&mut word_bytes).map_err(EmbeddingError::Io)?;
        let word = String::from_utf8(word_bytes)
            .map_err(|e| EmbeddingError::Format(format!("Invalid UTF-8: {}", e)))?;
        
        // Skip invalid words if configured
        if config.skip_invalid_words && !is_valid_word(&word) {
            // Skip the vector data
            file.seek(SeekFrom::Current((dimension * 4) as i64))
                .map_err(EmbeddingError::Io)?;
            continue;
        }
        
        // Read vector
        let mut vector_bytes = vec![0u8; dimension * 4];
        file.read_exact(&mut vector_bytes).map_err(EmbeddingError::Io)?;
        
        let vector: Vec<f32> = vector_bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect();
        
        let mut embedding = Embedding::new(vector);
        
        if config.normalize_on_load {
            embedding.normalize();
        }
        
        embeddings.insert(word, embedding);
    }

    Ok((embeddings, dimension))
}


/// Load Word2Vec binary format
async fn load_word2vec_binary(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    let mut file = File::open(path).map_err(EmbeddingError::Io)?;
    let mut embeddings = HashMap::new();
    
    // Read header line (space-separated numbers)
    let mut header_line = String::new();
    let mut reader = BufReader::new(&mut file);
    reader.read_line(&mut header_line).map_err(EmbeddingError::Io)?;
    
    let header_parts: Vec<&str> = header_line.split_whitespace().collect();
    if header_parts.len() != 2 {
        return Err(EmbeddingError::Format("Invalid Word2Vec header".to_string()));
    }
    
    let word_count: usize = header_parts[0].parse()
        .map_err(|e: std::num::ParseIntError| EmbeddingError::Parse(e.to_string()))?;
    let dimension: usize = header_parts[1].parse()
        .map_err(|e: std::num::ParseIntError| EmbeddingError::Parse(e.to_string()))?;
    
    info!("Word2Vec file contains {} words with dimension {}", word_count, dimension);
    
    let max_words = if config.max_words > 0 {
        config.max_words.min(word_count)
    } else {
        word_count
    };

    // Read binary data
    let file = reader.into_inner();
    
    for _ in 0..max_words {
        // Read word (null-terminated)
        let mut word_bytes = Vec::new();
        let mut byte = [0u8; 1];
        
        loop {
            file.read_exact(&mut byte).map_err(EmbeddingError::Io)?;
            if byte[0] == 0 || byte[0] == b' ' || byte[0] == b'\n' {
                break;
            }
            word_bytes.push(byte[0]);
        }
        
        let word = String::from_utf8(word_bytes)
            .map_err(|e| EmbeddingError::Format(format!("Invalid UTF-8: {}", e)))?;
        
        // Skip invalid words if configured
        if config.skip_invalid_words && !is_valid_word(&word) {
            // Skip the vector data
            file.seek(SeekFrom::Current((dimension * 4) as i64))
                .map_err(EmbeddingError::Io)?;
            continue;
        }
        
        // Read vector
        let mut vector_bytes = vec![0u8; dimension * 4];
        file.read_exact(&mut vector_bytes).map_err(EmbeddingError::Io)?;
        
        let vector: Vec<f32> = vector_bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect();
        
        let mut embedding = Embedding::new(vector);
        
        if config.normalize_on_load {
            embedding.normalize();
        }
        
        embeddings.insert(word, embedding);
    }

    Ok((embeddings, dimension))
}

/// Load FastText binary format (simplified implementation)
async fn load_fasttext_binary(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    // For now, treat as regular binary format
    // A full FastText implementation would need to handle subword information
    warn!("FastText binary format support is basic - treating as regular binary");
    load_binary_format(path, config).await
}

/// Load GloVe format (similar to text format but may have different conventions)
async fn load_glove_format(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    // GloVe format is essentially the same as text format
    load_text_format(path, config).await
}

/// Check if a word is valid (basic validation)
fn is_valid_word(word: &str) -> bool {
    !word.is_empty() 
        && word.len() <= 100  // Reasonable max length
        && !word.chars().any(|c| c.is_control() || c.is_whitespace())
        && word.is_ascii() // Can be relaxed for multilingual support
}

/// Estimate memory usage of embeddings
fn estimate_memory_usage(embeddings: &EmbeddingMap) -> usize {
    let mut total = 0;
    
    for (word, embedding) in embeddings {
        // Word string
        total += word.len() + std::mem::size_of::<String>();
        
        // Vector data
        total += embedding.vector.len() * std::mem::size_of::<f32>();
        
        // Embedding struct overhead
        total += std::mem::size_of::<Embedding>();
        
        // HashMap overhead (approximate)
        total += 32; // rough estimate for HashMap entry overhead
    }
    
    total
}

/// Save embeddings to binary format for faster loading
pub async fn save_binary_format(
    embeddings: &EmbeddingMap,
    path: &str,
    dimension: usize,
) -> EmbeddingResult<()> {
    use std::io::Write;
    
    let mut file = File::create(path).map_err(EmbeddingError::Io)?;
    
    // Write header
    let word_count = embeddings.len() as u32;
    let dim = dimension as u32;
    
    file.write_all(&word_count.to_le_bytes()).map_err(EmbeddingError::Io)?;
    file.write_all(&dim.to_le_bytes()).map_err(EmbeddingError::Io)?;
    
    // Write embeddings
    for (word, embedding) in embeddings {
        // Write word length and word
        let word_bytes = word.as_bytes();
        let word_len = word_bytes.len() as u32;
        
        file.write_all(&word_len.to_le_bytes()).map_err(EmbeddingError::Io)?;
        file.write_all(word_bytes).map_err(EmbeddingError::Io)?;
        
        // Write vector
        for &component in &embedding.vector {
            file.write_all(&component.to_le_bytes()).map_err(EmbeddingError::Io)?;
        }
    }
    
    file.flush().map_err(EmbeddingError::Io)?;
    info!("Saved {} embeddings to binary format: {}", embeddings.len(), path);
    
    Ok(())
}

/// Convert text format to binary format for faster loading
pub async fn convert_to_binary(
    input_path: &str,
    output_path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<EmbeddingStats> {
    info!("Converting {} to binary format: {}", input_path, output_path);
    
    let (embeddings, dimension) = load_text_format(input_path, config).await?;
    save_binary_format(&embeddings, output_path, dimension).await?;
    
    // Create EmbeddingStats manually since load_text_format only returns dimension
    let file_size = std::fs::metadata(input_path)
        .map_err(EmbeddingError::Io)?
        .len();
    
    let stats = EmbeddingStats {
        word_count: embeddings.len(),
        dimension,
        format: "Text".to_string(),
        file_size,
        load_time_ms: 0, // We don't track this in the conversion
        memory_usage: estimate_memory_usage(&embeddings),
        normalized: config.normalize_on_load,
    };
    
    info!("Conversion completed: {} words", embeddings.len());
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use std::io::Write;

    #[tokio::test]
    async fn test_text_format_loading() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "hello 0.1 0.2 0.3").unwrap();
        writeln!(temp_file, "world 0.4 0.5 0.6").unwrap();
        
        let config = EmbeddingConfig::default();
        let (embeddings, dimension) = load_text_format(
            temp_file.path().to_str().unwrap(),
            &config
        ).await.unwrap();
        
        assert_eq!(embeddings.len(), 2);
        assert_eq!(dimension, 3);
        assert!(embeddings.contains_key("hello"));
        assert!(embeddings.contains_key("world"));
    }

    #[tokio::test]
    async fn test_format_detection() {
        assert_eq!(EmbeddingFormat::from_extension("test.vec"), EmbeddingFormat::Text);
        assert_eq!(EmbeddingFormat::from_extension("test.bin"), EmbeddingFormat::Binary);
        assert_eq!(EmbeddingFormat::from_extension("test.w2v"), EmbeddingFormat::Word2VecBinary);
    }

    #[test]
    fn test_word_validation() {
        assert!(is_valid_word("hello"));
        assert!(is_valid_word("test123"));
        assert!(!is_valid_word(""));
        assert!(!is_valid_word("hello world")); // contains space
        assert!(!is_valid_word("hello\n")); // contains newline
    }
}