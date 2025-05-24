//! Multi-format embedding file loaders using finalfusion library.

use crate::histtext::embeddings::types::{
    Embedding, EmbeddingConfig, EmbeddingError, EmbeddingMap, EmbeddingResult, EmbeddingStats,
};

use finalfusion::prelude::*;
use finalfusion::storage::{Storage, NdArray};
use finalfusion::vocab::{Vocab, SimpleVocab, SubwordVocab};
use finalfusion::compat::fasttext::FastTextIndexer;
use log::{debug, info};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::time::Instant;

/// Load embeddings from a file using finalfusion library
pub async fn load_embeddings(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, EmbeddingStats)> {
    let start_time = Instant::now();
    info!("Loading embeddings from: {}", path);

    // Check if file exists
    if !Path::new(path).exists() {
        return Err(EmbeddingError::FileNotFound(path.to_string()));
    }

    // Get file size
    let file_size = std::fs::metadata(path)?.len();
    
    // Try different finalfusion loaders
    let loaders = vec![
        ("FinalFusion FastText", LoaderType::FastText),
        ("FinalFusion Word2Vec", LoaderType::Word2Vec),
        ("FinalFusion Text", LoaderType::Text),
        ("FinalFusion Binary", LoaderType::Binary),
        ("Custom Text Parser", LoaderType::CustomText),
    ];
    
    for (name, loader_type) in loaders {
        info!("Trying loader: {}", name);
        
        match try_load_with_finalfusion(path, &loader_type, config).await {
            Ok((embeddings, dimension, encoding_used)) => {
                if embeddings.is_empty() {
                    debug!("Loader {} loaded 0 embeddings, trying next", name);
                    continue;
                }
                
                let load_time_ms = start_time.elapsed().as_millis() as u64;
                let memory_usage = estimate_memory_usage(&embeddings);
                
                let stats = EmbeddingStats {
                    word_count: embeddings.len(),
                    dimension,
                    format: name.to_string(),
                    file_size,
                    load_time_ms,
                    memory_usage,
                    normalized: config.normalize_on_load,
                    encoding: encoding_used,
                    was_compressed: path.ends_with(".gz"),
                };
                
                info!(
                    "Successfully loaded {} embeddings using {} in {}ms ({}MB memory)",
                    embeddings.len(),
                    name,
                    load_time_ms,
                    memory_usage / 1024 / 1024
                );
                
                return Ok((embeddings, stats));
            }
            Err(e) => {
                debug!("Failed to load with {}: {}", name, e);
                continue;
            }
        }
    }
    
    Err(EmbeddingError::Format(
        "Could not load file with any supported format".to_string()
    ))
}

#[derive(Debug, Clone)]
enum LoaderType {
    Text,
    Binary,
    FastText,
    Word2Vec,
    CustomText,
}

async fn try_load_with_finalfusion(
    path: &str,
    loader_type: &LoaderType,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize, Option<String>)> {
    match loader_type {
        LoaderType::Text => load_with_finalfusion_text(path, config).await,
        LoaderType::Binary => load_with_finalfusion_binary(path, config).await,
        LoaderType::FastText => load_with_finalfusion_fasttext(path, config).await,
        LoaderType::Word2Vec => load_with_finalfusion_word2vec(path, config).await,
        LoaderType::CustomText => load_custom_text_format(path, config).await,
    }
}

/// Load using finalfusion's text format loader
async fn load_with_finalfusion_text(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize, Option<String>)> {
    let embeddings_result = tokio::task::spawn_blocking({
        let path = path.to_string();
        move || -> Result<Embeddings<SimpleVocab, NdArray>, Box<dyn std::error::Error + Send + Sync>> {
            let file = File::open(&path)?;
            let mut buf_reader = BufReader::new(file);
            let embeddings = Embeddings::read_text(&mut buf_reader)?;
            Ok(embeddings)
        }
    }).await;
    
    match embeddings_result {
        Ok(Ok(embeddings)) => convert_finalfusion_embeddings(embeddings, config).await,
        Ok(Err(e)) => Err(EmbeddingError::Format(format!("FinalFusion text error: {}", e))),
        Err(e) => Err(EmbeddingError::Format(format!("Task error: {}", e))),
    }
}

/// Load using finalfusion's binary format loader  
async fn load_with_finalfusion_binary(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize, Option<String>)> {
    let embeddings_result = tokio::task::spawn_blocking({
        let path = path.to_string();
        move || -> Result<Embeddings<VocabWrap, StorageWrap>, Box<dyn std::error::Error + Send + Sync>> {
            let mut file = File::open(&path)?;
            let embeddings = Embeddings::read_embeddings(&mut file)?;
            Ok(embeddings)
        }
    }).await;
    
    match embeddings_result {
        Ok(Ok(embeddings)) => convert_finalfusion_embeddings_wrapped(embeddings, config).await,
        Ok(Err(e)) => Err(EmbeddingError::Format(format!("FinalFusion binary error: {}", e))),
        Err(e) => Err(EmbeddingError::Format(format!("Task error: {}", e))),
    }
}

/// Load using finalfusion's FastText format loader
async fn load_with_finalfusion_fasttext(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize, Option<String>)> {
    let embeddings_result = tokio::task::spawn_blocking({
        let path = path.to_string();
        move || -> Result<Embeddings<SubwordVocab<FastTextIndexer>, NdArray>, Box<dyn std::error::Error + Send + Sync>> {
            let file = File::open(&path)?;
            let mut buf_reader = BufReader::new(file);
            let embeddings = Embeddings::read_fasttext(&mut buf_reader)?;
            Ok(embeddings)
        }
    }).await;
    
    match embeddings_result {
        Ok(Ok(embeddings)) => convert_finalfusion_fasttext_embeddings(embeddings, config).await,
        Ok(Err(e)) => Err(EmbeddingError::Format(format!("FinalFusion FastText error: {}", e))),
        Err(e) => Err(EmbeddingError::Format(format!("Task error: {}", e))),
    }
}

/// Load using finalfusion's Word2Vec format loader
async fn load_with_finalfusion_word2vec(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize, Option<String>)> {
    let embeddings_result = tokio::task::spawn_blocking({
        let path = path.to_string();
        move || -> Result<Embeddings<SimpleVocab, NdArray>, Box<dyn std::error::Error + Send + Sync>> {
            let file = File::open(&path)?;
            let mut buf_reader = BufReader::new(file);
            let embeddings = Embeddings::read_word2vec_binary(&mut buf_reader)?;
            Ok(embeddings)
        }
    }).await;
    
    match embeddings_result {
        Ok(Ok(embeddings)) => convert_finalfusion_embeddings(embeddings, config).await,
        Ok(Err(e)) => Err(EmbeddingError::Format(format!("FinalFusion Word2Vec error: {}", e))),
        Err(e) => Err(EmbeddingError::Format(format!("Task error: {}", e))),
    }
}

/// Convert finalfusion embeddings (SimpleVocab) to our internal format
async fn convert_finalfusion_embeddings(
    embeddings: Embeddings<SimpleVocab, NdArray>,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize, Option<String>)> {
    let vocab = embeddings.vocab();
    let storage = embeddings.storage();
    let dimension = storage.shape().1;  // Use tuple access
    let vocab_len = vocab.words().len();  // Get length from words slice
    
    info!("Converting finalfusion embeddings: {} words, {} dimensions", vocab_len, dimension);
    
    let max_words = if config.max_words > 0 {
        config.max_words.min(vocab_len)
    } else {
        vocab_len.min(200_000)
    };
    
    let mut our_embeddings = HashMap::new();
    
    for (idx, word) in vocab.words().iter().enumerate() {
        if idx >= max_words {
            break;
        }
        
        // Skip invalid words if configured
        if config.skip_invalid_words && !is_valid_word(word) {
            continue;
        }
        
        // Get the embedding vector
        if let Some(embedding_view) = embeddings.embedding(word) {
            if let Some(vector_slice) = embedding_view.as_slice() {
                let vector: Vec<f32> = vector_slice.to_vec();
                
                let mut embedding = Embedding::new(vector);
                if config.normalize_on_load {
                    embedding.normalize();
                }
                
                our_embeddings.insert(word.to_string(), embedding);
            }
        }
        
        if idx % 10000 == 0 && idx > 0 {
            debug!("Converted {} words...", idx);
        }
    }
    
    info!("Successfully converted {} embeddings", our_embeddings.len());
    Ok((our_embeddings, dimension, None))
}

/// Convert finalfusion FastText embeddings to our internal format
async fn convert_finalfusion_fasttext_embeddings(
    embeddings: Embeddings<SubwordVocab<FastTextIndexer>, NdArray>,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize, Option<String>)> {
    let vocab = embeddings.vocab();
    let storage = embeddings.storage();
    let dimension = storage.shape().1;  // Use tuple access
    let vocab_len = vocab.words().len();  // Get length from words slice
    
    info!("Converting FastText embeddings: {} words, {} dimensions", vocab_len, dimension);
    
    let max_words = if config.max_words > 0 {
        config.max_words.min(vocab_len)
    } else {
        vocab_len.min(200_000)
    };
    
    let mut our_embeddings = HashMap::new();
    
    for (idx, word) in vocab.words().iter().enumerate() {
        if idx >= max_words {
            break;
        }
        
        // Skip invalid words if configured
        if config.skip_invalid_words && !is_valid_word(word) {
            continue;
        }
        
        // Get the embedding vector
        if let Some(embedding_view) = embeddings.embedding(word) {
            if let Some(vector_slice) = embedding_view.as_slice() {
                let vector: Vec<f32> = vector_slice.to_vec();
                
                let mut embedding = Embedding::new(vector);
                if config.normalize_on_load {
                    embedding.normalize();
                }
                
                our_embeddings.insert(word.to_string(), embedding);
            }
        }
        
        if idx % 10000 == 0 && idx > 0 {
            debug!("Converted {} words...", idx);
        }
    }
    
    info!("Successfully converted {} FastText embeddings", our_embeddings.len());
    Ok((our_embeddings, dimension, None))
}

/// Convert finalfusion wrapped embeddings to our internal format
async fn convert_finalfusion_embeddings_wrapped(
    embeddings: Embeddings<VocabWrap, StorageWrap>,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize, Option<String>)> {
    let vocab = embeddings.vocab();
    let storage = embeddings.storage();
    let dimension = storage.shape().1;  // Use tuple access
    
    // Get vocab size based on the wrapped type
    let vocab_len = match vocab {
        VocabWrap::SimpleVocab(v) => v.words().len(),
        VocabWrap::FastTextSubwordVocab(v) => v.words().len(),
        VocabWrap::ExplicitSubwordVocab(v) => v.words().len(),
        VocabWrap::FloretSubwordVocab(subword_vocab) => todo!(),
        VocabWrap::BucketSubwordVocab(subword_vocab) => todo!(),
    };
    
    info!("Converting wrapped embeddings: {} words, {} dimensions", vocab_len, dimension);
    
    let max_words = if config.max_words > 0 {
        config.max_words.min(vocab_len)
    } else {
        vocab_len.min(200_000)
    };
    
    let mut our_embeddings = HashMap::new();
    
    // Get words iterator based on vocab type
    let words: Vec<&str> = match vocab {
        VocabWrap::SimpleVocab(v) => v.words().iter().map(|s| s.as_str()).collect(),
        VocabWrap::FastTextSubwordVocab(v) => v.words().iter().map(|s| s.as_str()).collect(),
        VocabWrap::ExplicitSubwordVocab(v) => v.words().iter().map(|s| s.as_str()).collect(),
        VocabWrap::FloretSubwordVocab(subword_vocab) => todo!(),
        VocabWrap::BucketSubwordVocab(subword_vocab) => todo!(),
    };
    
    for (idx, word) in words.iter().enumerate() {
        if idx >= max_words {
            break;
        }
        
        // Skip invalid words if configured
        if config.skip_invalid_words && !is_valid_word(word) {
            continue;
        }
        
        // Get the embedding vector
        if let Some(embedding_view) = embeddings.embedding(word) {
            if let Some(vector_slice) = embedding_view.as_slice() {
                let vector: Vec<f32> = vector_slice.to_vec();
                
                let mut embedding = Embedding::new(vector);
                if config.normalize_on_load {
                    embedding.normalize();
                }
                
                our_embeddings.insert(word.to_string(), embedding);
            }
        }
        
        if idx % 10000 == 0 && idx > 0 {
            debug!("Converted {} words...", idx);
        }
    }
    
    info!("Successfully converted {} wrapped embeddings", our_embeddings.len());
    Ok((our_embeddings, dimension, None))
}

/// Custom text format loader for cases where finalfusion fails
async fn load_custom_text_format(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize, Option<String>)> {
    let file = File::open(path)?;
    let buf_reader = BufReader::new(file);
    let mut embeddings = HashMap::new();
    let mut dimension = 0;
    let mut words_loaded = 0;
    let max_words = if config.max_words > 0 {
        config.max_words
    } else {
        200_000 // Default limit
    };
    
    for (line_num, line_result) in buf_reader.lines().enumerate() {
        if words_loaded >= max_words {
            info!("Reached maximum word limit of {}", max_words);
            break;
        }
        
        let line = line_result?;
        let line = line.trim();
        
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        
        // Skip first line if it looks like a header (vocab_size dimension)
        if line_num == 0 {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() == 2 && parts[0].parse::<usize>().is_ok() && parts[1].parse::<usize>().is_ok() {
                info!("Skipping header line: {}", line);
                continue;
            }
        }
        
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        
        let word = parts[0].to_string();
        
        // Skip invalid words if configured
        if config.skip_invalid_words && !is_valid_word(&word) {
            continue;
        }
        
        // Parse vector
        let vector_parts = &parts[1..];
        let mut vector = Vec::with_capacity(vector_parts.len());
        
        for part in vector_parts {
            match part.parse::<f32>() {
                Ok(value) => vector.push(value),
                Err(_) => continue, // Skip malformed lines
            }
        }
        
        if vector.is_empty() {
            continue;
        }
        
        // Set dimension from first valid vector
        if dimension == 0 {
            dimension = vector.len();
        } else if config.validate_dimensions && vector.len() != dimension {
            continue; // Skip vectors with wrong dimension
        }
        
        let mut embedding = Embedding::new(vector);
        if config.normalize_on_load {
            embedding.normalize();
        }
        
        embeddings.insert(word, embedding);
        words_loaded += 1;
    }
    
    Ok((embeddings, dimension, None))
}

/// Check if a word is valid (now more permissive for international text)
fn is_valid_word(word: &str) -> bool {
    !word.is_empty() 
        && word.len() <= 200  // Increased for Chinese characters
        && !word.chars().any(|c| c.is_control())
        && word.chars().count() <= 100 // Character count limit (important for Chinese)
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

/// Convert text format to binary format for faster loading
pub async fn convert_to_binary(
    input_path: &str,
    output_path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<EmbeddingStats> {
    info!("Converting {} to binary format: {}", input_path, output_path);
    
    use std::io::Write;
    
    let (embeddings, dimension, _) = load_custom_text_format(input_path, config).await?;
    
    let mut file = File::create(output_path)?;
    
    // Write header
    file.write_all(&(embeddings.len() as u32).to_le_bytes())?;
    file.write_all(&(dimension as u32).to_le_bytes())?;
    
    // Write embeddings
    for (word, embedding) in &embeddings {
        let word_bytes = word.as_bytes();
        file.write_all(&(word_bytes.len() as u32).to_le_bytes())?;
        file.write_all(word_bytes)?;
        
        for &value in &embedding.vector {
            file.write_all(&value.to_le_bytes())?;
        }
    }
    
    file.flush()?;
    
    let file_size = std::fs::metadata(input_path)?.len();
    
    let stats = EmbeddingStats {
        word_count: embeddings.len(),
        dimension,
        format: "Binary".to_string(),
        file_size,
        load_time_ms: 0,
        memory_usage: estimate_memory_usage(&embeddings),
        normalized: config.normalize_on_load,
        encoding: None,
        was_compressed: false,
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
    async fn test_custom_text_format_loading() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "hello 0.1 0.2 0.3").unwrap();
        writeln!(temp_file, "world 0.4 0.5 0.6").unwrap();
        
        let config = EmbeddingConfig::default();
        let (embeddings, dimension, _) = load_custom_text_format(
            temp_file.path().to_str().unwrap(),
            &config
        ).await.unwrap();
        
        assert_eq!(embeddings.len(), 2);
        assert_eq!(dimension, 3);
        assert!(embeddings.contains_key("hello"));
        assert!(embeddings.contains_key("world"));
    }

    #[test]
    fn test_word_validation() {
        assert!(is_valid_word("hello"));
        assert!(is_valid_word("测试")); // Chinese characters should be valid
        assert!(is_valid_word("北京")); // Beijing in Chinese
        assert!(is_valid_word("test123"));
        assert!(!is_valid_word(""));
        assert!(!is_valid_word("hello\n")); // contains control character
    }
}