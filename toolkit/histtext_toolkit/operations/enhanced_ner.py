"""Enhanced NER operations with modern models and comprehensive optimizations."""

import asyncio
import os
import time
import json
import hashlib
from typing import Any, Optional, List, Dict, Iterator, Tuple
from dataclasses import asdict
from pathlib import Path

import numpy as np
from tqdm import tqdm

from ..cache.manager import get_cache_manager
from ..core.config import ModelConfig, EnhancedModelConfig
from ..core.logging import get_logger
from ..models.base import EnhancedNERModel, EntitySpan, ProcessingMode, GPUMemoryManager, ProcessingStats
from ..models.enhanced_registry import create_enhanced_ner_model
from ..solr.client import SolrClient

logger = get_logger(__name__)

try:
    from ..models.enhanced_registry import create_enhanced_ner_model
    ENHANCED_REGISTRY_AVAILABLE = True
except ImportError:
    logger.warning("Enhanced registry not available, using fallback")
    ENHANCED_REGISTRY_AVAILABLE = False

class EnhancedNERProcessor:
    """Enhanced NER processor with modern optimizations and comprehensive features."""
    
    def __init__(
        self, 
        model: EnhancedNERModel, 
        cache_root: Optional[str] = None,
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        enable_caching: bool = True,
        enable_streaming: bool = False,
        memory_threshold: float = 0.8
    ):
        self.model = model
        self.cache_root = cache_root
        self.processing_mode = processing_mode
        self.enable_caching = enable_caching
        self.enable_streaming = enable_streaming
        self.memory_threshold = memory_threshold
        
        # Enhanced caching system
        self._entity_cache = {} if enable_caching else None
        self._cache_hits = 0
        self._cache_misses = 0
        
        # Processing statistics
        self._processing_stats = {
            "total_texts": 0,
            "total_entities": 0,
            "total_time": 0.0,
            "cache_hits": 0,
            "cache_misses": 0,
            "avg_entities_per_text": 0.0,
            "avg_time_per_text": 0.0,
            "throughput": 0.0,
            "memory_peaks": [],
            "batch_sizes": [],
            "error_count": 0
        }
        
        # Adaptive batch sizing
        self._optimal_batch_size = 16
        self._batch_performance_history = []
        
        # Error handling
        self._error_texts = []
        self._max_error_cache = 100

    def _get_cache_key(self, text: str, entity_types: Optional[List[str]] = None) -> str:
        """Generate cache key for text and entity types."""
        content = f"{text}_{str(entity_types)}"
        return hashlib.md5(content.encode()).hexdigest()

    def _adaptive_batch_size(self, text_lengths: List[int]) -> int:
        """Determine optimal batch size based on text lengths and memory."""
        if not text_lengths:
            return self._optimal_batch_size
        
        avg_length = sum(text_lengths) / len(text_lengths)
        max_length = max(text_lengths)
        
        # Base batch size on text characteristics
        if max_length > 10000:
            batch_size = 1
        elif avg_length > 5000:
            batch_size = 2
        elif avg_length > 2000:
            batch_size = 4
        elif avg_length > 1000:
            batch_size = 8
        else:
            batch_size = 16
        
        # Apply memory-based optimization
        memory_info = GPUMemoryManager.get_memory_info()
        if memory_info and memory_info.get("total", 0) > 0:
            utilization = memory_info.get("allocated", 0) / memory_info["total"]
            
            if utilization > self.memory_threshold:
                batch_size = max(1, batch_size // 2)
            elif utilization < 0.3:
                batch_size = min(batch_size * 2, 32)
        
        return batch_size

    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> List[EntitySpan]:
        """Extract entities with comprehensive caching and optimization."""
        
        if not text or not text.strip():
            return []
        
        # Check cache first
        if use_cache and self.enable_caching and self._entity_cache is not None:
            cache_key = self._get_cache_key(text, entity_types)
            if cache_key in self._entity_cache:
                self._cache_hits += 1
                self._processing_stats["cache_hits"] += 1
                return self._entity_cache[cache_key]
            else:
                self._cache_misses += 1
                self._processing_stats["cache_misses"] += 1
        
        start_time = time.time()
        
        try:
            # Extract entities with error handling
            entities = self.model.extract_entities(text, entity_types)
            
            # Validate entities
            entities = self._validate_entities(entities, text)
            
            # Update stats
            processing_time = time.time() - start_time
            self._processing_stats["total_texts"] += 1
            self._processing_stats["total_entities"] += len(entities)
            self._processing_stats["total_time"] += processing_time
            
            # Cache result
            if use_cache and self.enable_caching and self._entity_cache is not None:
                cache_key = self._get_cache_key(text, entity_types)
                self._entity_cache[cache_key] = entities
                
                # Prevent cache from growing too large
                if len(self._entity_cache) > 10000:
                    # Remove oldest 20% of entries
                    keys_to_remove = list(self._entity_cache.keys())[:2000]
                    for key in keys_to_remove:
                        del self._entity_cache[key]
            
            return entities
            
        except Exception as e:
            logger.error(f"Error extracting entities: {e}")
            self._processing_stats["error_count"] += 1
            
            # Cache problematic texts to avoid repeated failures
            if len(self._error_texts) < self._max_error_cache:
                self._error_texts.append(text[:200])  # Store snippet
            
            return []

    def _validate_entities(self, entities: List[EntitySpan], text: str) -> List[EntitySpan]:
        """Validate and filter extracted entities."""
        validated = []
        
        for entity in entities:
            # Check position bounds
            if (entity.start_pos < 0 or 
                entity.end_pos > len(text) or 
                entity.start_pos >= entity.end_pos):
                continue
            
            # Check if entity text matches position
            expected_text = text[entity.start_pos:entity.end_pos]
            if entity.text.strip() != expected_text.strip():
                # Try to fix minor discrepancies
                entity.text = expected_text.strip()
                if not entity.text:
                    continue
            
            # Filter out very short or very long entities
            if len(entity.text) < 2 or len(entity.text) > 200:
                continue
            
            # Filter out entities that are just punctuation or whitespace
            if entity.text.strip() in ".,;:!?-()[]{}\"'":
                continue
            
            validated.append(entity)
        
        return validated

    def extract_entities_batch(
        self,
        texts: List[str],
        entity_types: Optional[List[str]] = None,
        show_progress: bool = True,
        adaptive_batching: bool = True
    ) -> List[List[EntitySpan]]:
        """Optimized batch processing with adaptive batching and comprehensive monitoring."""
        
        if not texts:
            return []
        
        start_time = time.time()
        
        # Prepare texts and mapping
        text_mapping = []
        valid_texts = []
        text_lengths = []
        
        for i, text in enumerate(texts):
            if text and text.strip():
                text_mapping.append((i, len(valid_texts)))
                valid_texts.append(text)
                text_lengths.append(len(text))
            else:
                text_mapping.append((i, -1))  # -1 indicates empty text
        
        if not valid_texts:
            return [[] for _ in texts]
        
        # Determine batch size
        if adaptive_batching:
            batch_size = self._adaptive_batch_size(text_lengths)
        else:
            batch_size = getattr(self.model, 'base_batch_size', 16)
        
        logger.info(f"Processing {len(valid_texts)} texts with batch size {batch_size}")
        
        # Process valid texts
        valid_results = []
        memory_peaks = []
        batch_times = []
        
        # Setup progress bar
        progress_bar = None
        if show_progress:
            progress_bar = tqdm(
                total=len(valid_texts), 
                desc=f"Enhanced NER ({self.model.__class__.__name__})",
                unit="texts"
            )
        
        try:
            # Check if model supports native batch processing
            use_model_batch = (
                hasattr(self.model, 'extract_entities_batch') and 
                len(valid_texts) > 10 and
                not self.enable_streaming
            )
            
            if use_model_batch:
                # Use model's native batch processing
                logger.debug("Using model's native batch processing")
                valid_results = self.model.extract_entities_batch(valid_texts, entity_types)
                
                if progress_bar:
                    progress_bar.update(len(valid_texts))
                    
            else:
                # Process in smaller batches
                for start_idx in range(0, len(valid_texts), batch_size):
                    end_idx = min(start_idx + batch_size, len(valid_texts))
                    batch_texts = valid_texts[start_idx:end_idx]
                    
                    batch_start_time = time.time()
                    
                    # Record memory before batch
                    memory_before = GPUMemoryManager.get_memory_info()
                    
                    # Process batch
                    if self.enable_streaming and len(batch_texts) > 5:
                        # Use streaming for this batch
                        batch_results = list(self.extract_entities_streaming(
                            iter(batch_texts), entity_types, batch_size=len(batch_texts)
                        ))
                    else:
                        # Process individually
                        batch_results = []
                        for text in batch_texts:
                            entities = self.extract_entities(text, entity_types)
                            batch_results.append(entities)
                    
                    valid_results.extend(batch_results)
                    
                    # Record performance metrics
                    batch_time = time.time() - batch_start_time
                    batch_times.append(batch_time)
                    
                    memory_after = GPUMemoryManager.get_memory_info()
                    if memory_after and memory_after.get("allocated"):
                        memory_peaks.append(memory_after["allocated"])
                    
                    # Update progress
                    if progress_bar:
                        progress_bar.update(len(batch_texts))
                        progress_bar.set_postfix({
                            'batch_time': f'{batch_time:.2f}s',
                            'entities': sum(len(r) for r in batch_results),
                            'mem': f'{memory_after.get("allocated", 0):.1f}GB' if memory_after else 'N/A'
                        })
                    
                    # Adaptive memory management
                    if memory_after and memory_after.get("total", 0) > 0:
                        utilization = memory_after.get("allocated", 0) / memory_after["total"]
                        if utilization > self.memory_threshold:
                            logger.warning(f"High memory usage: {utilization:.1%}")
                            GPUMemoryManager.clear_cache()
                            
                            # Reduce batch size for next iteration
                            if adaptive_batching:
                                batch_size = max(1, batch_size // 2)
                                logger.info(f"Reduced batch size to {batch_size}")
                    
                    # Periodic cleanup
                    if start_idx % (batch_size * 10) == 0:
                        GPUMemoryManager.clear_cache()
        
        finally:
            if progress_bar:
                progress_bar.close()
        
        # Map results back to original positions
        results = []
        valid_idx = 0
        
        for original_idx, valid_pos in text_mapping:
            if valid_pos == -1:
                results.append([])  # Empty text
            else:
                if valid_idx < len(valid_results):
                    results.append(valid_results[valid_idx])
                else:
                    results.append([])  # Fallback for missing results
                valid_idx += 1
        
        # Update comprehensive stats
        processing_time = time.time() - start_time
        total_entities = sum(len(entities) for entities in results)
        
        self._processing_stats.update({
            "total_texts": self._processing_stats["total_texts"] + len(texts),
            "total_entities": self._processing_stats["total_entities"] + total_entities,
            "total_time": self._processing_stats["total_time"] + processing_time,
            "memory_peaks": self._processing_stats["memory_peaks"] + memory_peaks,
            "batch_sizes": self._processing_stats["batch_sizes"] + [batch_size] * len(batch_times)
        })
        
        # Update adaptive batch size based on performance
        if adaptive_batching and batch_times:
            avg_time_per_text = sum(batch_times) / len(valid_texts)
            self._batch_performance_history.append((batch_size, avg_time_per_text))
            
            # Keep only recent history
            if len(self._batch_performance_history) > 10:
                self._batch_performance_history = self._batch_performance_history[-10:]
            
            # Find optimal batch size
            if len(self._batch_performance_history) >= 3:
                best_performance = min(self._batch_performance_history, key=lambda x: x[1])
                self._optimal_batch_size = best_performance[0]
        
        if show_progress:
            throughput = total_entities / processing_time if processing_time > 0 else 0
            logger.info(f"Processed {len(texts)} texts, found {total_entities} entities "
                       f"in {processing_time:.2f}s ({throughput:.1f} entities/s)")
        
        return results

    def extract_entities_streaming(
    self,
    texts: Iterator[str],
    entity_types: Optional[List[str]] = None,
    batch_size: int = 32
) -> Iterator[List[EntitySpan]]:
        """Advanced streaming processing with memory optimization - Fixed recursion."""
        
        batch = []
        batch_idx = 0
        
        try:
            for text in texts:
                batch.append(text)
                
                if len(batch) >= batch_size:
                    # Process batch WITHOUT recursive calls
                    try:
                        # Process each text individually to avoid recursion
                        batch_results = []
                        for single_text in batch:
                            entities = self.extract_entities(single_text, entity_types, use_cache=True)
                            batch_results.append(entities)
                        
                        for result in batch_results:
                            yield result
                        
                    except Exception as e:
                        logger.error(f"Error in streaming batch {batch_idx}: {e}")
                        # Yield empty results for failed batch
                        for _ in batch:
                            yield []
                    
                    batch = []
                    batch_idx += 1
                    
                    # Aggressive memory cleanup for streaming
                    if batch_idx % 5 == 0:
                        GPUMemoryManager.clear_cache()
            
            # Process remaining batch
            if batch:
                try:
                    batch_results = []
                    for single_text in batch:
                        entities = self.extract_entities(single_text, entity_types, use_cache=True)
                        batch_results.append(entities)
                    
                    for result in batch_results:
                        yield result
                except Exception as e:
                    logger.error(f"Error in final streaming batch: {e}")
                    for _ in batch:
                        yield []
                        
        except Exception as e:
            logger.error(f"Error in streaming processing: {e}")
            return
        
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get comprehensive processing statistics."""
        stats = self._processing_stats.copy()
        
        # Calculate derived statistics
        if stats["total_texts"] > 0:
            stats["avg_entities_per_text"] = stats["total_entities"] / stats["total_texts"]
            stats["avg_time_per_text"] = stats["total_time"] / stats["total_texts"]
            stats["throughput"] = stats["total_entities"] / stats["total_time"] if stats["total_time"] > 0 else 0
            
        if self.enable_caching:
            total_cache_requests = stats["cache_hits"] + stats["cache_misses"]
            stats["cache_hit_rate"] = stats["cache_hits"] / total_cache_requests if total_cache_requests > 0 else 0
            stats["cache_size"] = len(self._entity_cache) if self._entity_cache else 0
        
        # Memory statistics
        if stats["memory_peaks"]:
            stats["memory_stats"] = {
                "peak": max(stats["memory_peaks"]),
                "average": sum(stats["memory_peaks"]) / len(stats["memory_peaks"]),
                "min": min(stats["memory_peaks"])
            }
        
        # Batch size statistics
        if stats["batch_sizes"]:
            stats["batch_stats"] = {
                "average": sum(stats["batch_sizes"]) / len(stats["batch_sizes"]),
                "max": max(stats["batch_sizes"]),
                "min": min(stats["batch_sizes"])
            }
        
        # Current GPU memory info
        gpu_info = GPUMemoryManager.get_memory_info()
        if gpu_info:
            stats["current_gpu_memory"] = gpu_info
        
        # Model-specific stats
        if hasattr(self.model, 'get_processing_stats'):
            model_stats = self.model.get_processing_stats()
            stats["model_stats"] = model_stats
        
        return stats

    def clear_cache(self):
        """Clear all caches and reset statistics."""
        if self._entity_cache is not None:
            cache_size = len(self._entity_cache)
            self._entity_cache.clear()
            logger.info(f"Cleared entity cache ({cache_size} entries)")
        
        self._error_texts.clear()
        self._cache_hits = 0
        self._cache_misses = 0
        
        # Reset GPU memory
        GPUMemoryManager.clear_cache()

    def save_cache_to_disk(self, cache_path: str) -> bool:
        """Save entity cache to disk for persistence."""
        if not self._entity_cache:
            return True
        
        try:
            import pickle
            
            cache_data = {
                "entities": self._entity_cache,
                "stats": self._processing_stats,
                "model_info": {
                    "class": self.model.__class__.__name__,
                    "config": getattr(self.model, 'model_name', 'unknown')
                }
            }
            
            with open(cache_path, 'wb') as f:
                pickle.dump(cache_data, f)
            
            logger.info(f"Saved cache with {len(self._entity_cache)} entries to {cache_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")
            return False

    def load_cache_from_disk(self, cache_path: str) -> bool:
        """Load entity cache from disk."""
        try:
            import pickle
            
            if not os.path.exists(cache_path):
                logger.warning(f"Cache file not found: {cache_path}")
                return False
            
            with open(cache_path, 'rb') as f:
                cache_data = pickle.load(f)
            
            if self._entity_cache is None:
                self._entity_cache = {}
            
            # Load cached entities
            self._entity_cache.update(cache_data.get("entities", {}))
            
            # Optionally restore stats (but don't overwrite current session)
            saved_stats = cache_data.get("stats", {})
            logger.info(f"Loaded cache with {len(self._entity_cache)} entries from {cache_path}")
            logger.debug(f"Cache was created with model: {cache_data.get('model_info', {})}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load cache: {e}")
            return False


async def enhanced_precompute_ner(
   solr_client: SolrClient,
   collection: str,
   text_field: str,
   model_config: ModelConfig,
   cache_root: str,
   model_name: str,
   start: int = 0,
   batch_size: int = 1000,
   num_batches: Optional[int] = None,
   filter_query: Optional[str] = None,
   entity_types: Optional[List[str]] = None,
   processing_mode: ProcessingMode = ProcessingMode.BATCH,
   optimization_level: int = 1,
   enable_streaming: bool = False,
   jsonl_prefix: Optional[str] = None,
   format_type: str = "enhanced",
   enable_persistence: bool = True,
   save_interval: int = 10,
   resume_from_cache: bool = True
) -> int:
    """Enhanced NER precomputation with comprehensive modern optimizations.

    Args:
        solr_client: Solr client instance
        collection: Collection name
        text_field: Field containing text
        model_config: Model configuration
        cache_root: Cache directory root
        model_name: Model name for caching
        start: Starting document index
        batch_size: Documents per batch
        num_batches: Maximum batches to process
        filter_query: Optional Solr filter query
        entity_types: List of entity types to extract
        processing_mode: Processing optimization mode
        optimization_level: Optimization level (0-2)
        enable_streaming: Enable streaming processing
        jsonl_prefix: Prefix for output files
        format_type: Output format ("enhanced", "standard", "compact")
        enable_persistence: Save progress to disk
        save_interval: Batches between saves
        resume_from_cache: Resume from previous session
        
    Returns:
        Number of documents processed
    """
    # Create enhanced model with full configuration
    logger.info(f"Creating enhanced NER model: {model_config.name}")
    if ENHANCED_REGISTRY_AVAILABLE:
        try:
            model = create_enhanced_ner_model(
                model_config, 
                processing_mode=processing_mode,
                optimization_level=optimization_level
            )
        except Exception as e:
            logger.warning(f"Failed to create enhanced model: {e}, falling back to regular model")
            model = None
    else:
        model = None

    # Fallback to regular model if enhanced creation failed
    if model is None:
        from ..models.registry import create_ner_model
        try:
            model = create_ner_model(model_config)
            # Wrap in enhanced interface
            model = _wrap_legacy_model(model)
        except Exception as e:
            logger.error(f"Failed to create any model: {e}")
            return 0

    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return 0
   
    # Setup comprehensive directory structure
    cache_dir = Path(cache_root) / model_name / collection / text_field
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Progress and state management
    progress_file = cache_dir / "progress.json"
    cache_file = cache_dir / "entity_cache.pkl"

    # Create enhanced processor with full configuration
    processor = EnhancedNERProcessor(
        model, 
        cache_root=str(cache_dir),
        processing_mode=processing_mode,
        enable_caching=True,
        enable_streaming=enable_streaming,
        memory_threshold=0.8
    )

    # Resume from previous session if requested
    initial_start = start
    if resume_from_cache and progress_file.exists():
        try:
            with open(progress_file, 'r') as f:
                progress_data = json.load(f)
            
            last_processed = progress_data.get('last_processed_index', start)
            if last_processed > start:
                start = last_processed
                logger.info(f"Resuming from document index {start} (was {initial_start})")
            
            # Load entity cache if available
            if cache_file.exists():
                processor.load_cache_from_disk(str(cache_file))
                
        except Exception as e:
            logger.warning(f"Could not resume from cache: {e}")

    # Comprehensive logging setup
    logger.info("="*80)
    logger.info("Enhanced NER Precomputation Started")
    logger.info("="*80)
    logger.info(f"Model: {model_config.name} ({model_config.type})")
    logger.info(f"Model Class: {model.__class__.__name__}")
    logger.info(f"Processing Mode: {processing_mode.value}")
    logger.info(f"Optimization Level: {optimization_level}")
    logger.info(f"Collection: {collection}")
    logger.info(f"Text Field: {text_field}")
    logger.info(f"Batch Size: {batch_size}")
    logger.info(f"Starting Index: {start}")
    logger.info(f"Cache Directory: {cache_dir}")
    logger.info(f"Enable Streaming: {enable_streaming}")
    logger.info(f"Format Type: {format_type}")

    if entity_types:
        logger.info(f"Entity Types: {entity_types}")

    if filter_query:
        logger.info(f"Filter Query: {filter_query}")

    logger.info("="*80)

    # Initialize counters and tracking
    current_start = start
    current_batch = 0
    total_docs = 0
    total_entities = 0
    total_errors = 0

    # Performance tracking
    session_start_time = time.time()
    batch_times = []
    entity_counts = []

    try:
        # Get total document count for better progress tracking
        try:
            count_response = await solr_client.collection_select(
                collection, {"q": "*:*", "rows": 0}
            )
            total_doc_count = count_response.get("response", {}).get("numFound", "unknown")
            logger.info(f"Total documents in collection: {total_doc_count}")
        except Exception as e:
            logger.debug(f"Could not get total document count: {e}")
            total_doc_count = "unknown"
        
        # Main processing loop
        while num_batches is None or current_batch < num_batches:
            batch_start_time = time.time()
            
            logger.info(f"Processing batch {current_batch + 1} "
                        f"(docs {current_start}-{current_start + batch_size - 1})")
            
            # Get documents from Solr
            documents = await solr_client.get_document_batch(
                collection, text_field, current_start, batch_size, filter_query
            )
            
            if not documents:
                logger.info("No more documents found - collection complete")
                break
            
            # Extract texts and IDs
            doc_ids = list(documents.keys())
            texts = list(documents.values())
            
            # Process with enhanced NER
            logger.debug(f"Processing {len(texts)} texts with enhanced NER...")
            
            if enable_streaming and len(texts) > 100:
                # Use streaming for large batches
                results = list(processor.extract_entities_streaming(
                    iter(texts), entity_types, batch_size=min(32, len(texts)//4)
                ))
            else:
                # Standard batch processing with adaptive optimization
                results = processor.extract_entities_batch(
                    texts, entity_types, show_progress=True, adaptive_batching=True
                )
            
            batch_processing_time = time.time() - batch_start_time
            
            # Convert results to cache format based on format type
            entities_for_cache = {}
            batch_entities = 0
            
            for doc_id, entities in zip(doc_ids, results):
                if entities:
                    if format_type == "enhanced":
                        # Enhanced format with comprehensive metadata
                        entities_for_cache[doc_id] = [
                            {
                                **asdict(entity),
                                "model_name": model_name,
                                "model_class": model.__class__.__name__,
                                "extraction_time": batch_processing_time / len(results),
                                "processing_mode": processing_mode.value,
                                "optimization_level": optimization_level,
                                "batch_index": current_batch,
                                "confidence_normalized": min(1.0, max(0.0, entity.confidence)),
                                "entity_length": len(entity.text),
                                "entity_word_count": len(entity.text.split())
                            }
                            for entity in entities
                        ]
                    elif format_type == "compact":
                        # Compact format for storage efficiency
                        entities_for_cache[doc_id] = [
                            {
                                "t": entity.text,
                                "l": entity.labels[0] if entity.labels else "",
                                "s": entity.start_pos,
                                "e": entity.end_pos,
                                "c": round(entity.confidence, 3)
                            }
                            for entity in entities
                        ]
                    else:
                        # Standard format
                        entities_for_cache[doc_id] = [
                            {
                                "text": entity.text,
                                "labels": entity.labels,
                                "start_pos": entity.start_pos,
                                "end_pos": entity.end_pos,
                                "confidence": entity.confidence
                            }
                            for entity in entities
                        ]
                    batch_entities += len(entities)
            
            # Cache results if any entities found
            if entities_for_cache:
                try:
                    cache_manager = get_cache_manager(cache_root)
                    cache_manager.save_annotations(
                        model_name,
                        collection,
                        text_field,
                        entities_for_cache,
                        jsonl_prefix,
                        current_start,
                        format_type
                    )
                except Exception as e:
                    logger.error(f"Failed to save batch to cache: {e}")
                    total_errors += 1
            
            # Update comprehensive counters
            total_docs += len(documents)
            total_entities += batch_entities
            batch_times.append(batch_processing_time)
            entity_counts.append(batch_entities)
            
            # Detailed batch logging
            throughput = batch_entities / batch_processing_time if batch_processing_time > 0 else 0
            logger.info(f"Batch {current_batch + 1} complete: "
                        f"{len(documents)} docs, {batch_entities} entities, "
                        f"{batch_processing_time:.2f}s ({throughput:.1f} entities/s)")
            
            # Save progress periodically
            if enable_persistence and (current_batch + 1) % save_interval == 0:
                progress_data = {
                    "last_processed_index": current_start + len(documents),
                    "total_docs_processed": total_docs,
                    "total_entities_found": total_entities,
                    "current_batch": current_batch + 1,
                    "session_start_time": session_start_time,
                    "last_update": time.time(),
                    "model_config": {
                        "name": model_config.name,
                        "type": model_config.type
                    }
                }
                
                try:
                    with open(progress_file, 'w') as f:
                        json.dump(progress_data, f, indent=2)
                    
                    # Save entity cache
                    processor.save_cache_to_disk(str(cache_file))
                    
                    logger.info(f"Progress saved at batch {current_batch + 1}")
                    
                except Exception as e:
                    logger.warning(f"Could not save progress: {e}")
            
            # Memory management and optimization
            current_stats = processor.get_processing_stats()
            
            if current_batch % 5 == 0:
                # Periodic memory cleanup
                GPUMemoryManager.clear_cache()
                
                # Log memory stats if available
                memory_info = GPUMemoryManager.get_memory_info()
                if memory_info and memory_info.get("total", 0) > 0:
                    utilization = memory_info.get("allocated", 0) / memory_info["total"]
                    logger.info(f"GPU Memory: {memory_info.get('allocated', 0):.1f}GB / "
                                f"{memory_info.get('total', 0):.1f}GB ({utilization:.1%})")
            
            # Check for completion
            if len(documents) < batch_size:
                logger.info("Completed collection - reached end of documents")
                break
            
            current_batch += 1
            current_start += batch_size
            
            # Safety check for very long runs
            if current_batch > 10000:
                logger.warning("Very long processing session - consider splitting the task")

    except KeyboardInterrupt:
        logger.info("Processing interrupted by user")
    except Exception as e:
        logger.error(f"Error during enhanced NER processing: {e}")
        total_errors += 1

    finally:
        # Save final progress
        if enable_persistence:
            final_progress = {
                "completed": True,
                "total_docs_processed": total_docs,
                "total_entities_found": total_entities,
                "total_batches": current_batch,
                "total_errors": total_errors,
                "session_duration": time.time() - session_start_time,
                "final_stats": processor.get_processing_stats()
            }
            
            try:
                with open(progress_file, 'w') as f:
                    json.dump(final_progress, f, indent=2)
                processor.save_cache_to_disk(str(cache_file))
            except Exception as e:
                logger.warning(f"Could not save final progress: {e}")
        
        # Get comprehensive final statistics
        final_stats = processor.get_processing_stats()
        session_time = time.time() - session_start_time
        
        # Generate comprehensive report
        logger.info("\n" + "="*80)
        logger.info("Enhanced NER Processing Complete")
        logger.info("="*80)
        logger.info(f"Session Duration: {session_time:.2f}s ({session_time/60:.1f} minutes)")
        logger.info(f"Documents Processed: {total_docs:,}")
        logger.info(f"Total Entities Found: {total_entities:,}")
        logger.info(f"Processing Errors: {total_errors}")
        logger.info(f"Batches Completed: {current_batch}")
        
        if total_docs > 0:
            logger.info(f"Average Entities per Document: {total_entities/total_docs:.2f}")
            logger.info(f"Average Processing Time per Document: {session_time/total_docs:.3f}s")
        
        if session_time > 0:
            logger.info(f"Overall Throughput: {total_entities/session_time:.1f} entities/s")
            logger.info(f"Document Throughput: {total_docs/session_time:.1f} docs/s")
        
        # Cache statistics
        if final_stats.get("cache_hit_rate") is not None:
            logger.info(f"Cache Hit Rate: {final_stats['cache_hit_rate']:.1%}")
            logger.info(f"Cache Size: {final_stats.get('cache_size', 0)} entries")
        
        # Memory statistics
        if final_stats.get("memory_stats"):
            mem_stats = final_stats["memory_stats"]
            logger.info(f"Peak GPU Memory: {mem_stats.get('peak', 0):.1f}GB")
            logger.info(f"Average GPU Memory: {mem_stats.get('average', 0):.1f}GB")
        
        # Batch performance
        if batch_times:
            avg_batch_time = sum(batch_times) / len(batch_times)
            max_batch_time = max(batch_times)
            min_batch_time = min(batch_times)
            logger.info(f"Batch Processing Times - Avg: {avg_batch_time:.2f}s, "
                        f"Max: {max_batch_time:.2f}s, Min: {min_batch_time:.2f}s")
        
        # Entity distribution
        if entity_counts:
            avg_entities = sum(entity_counts) / len(entity_counts)
            max_entities = max(entity_counts)
            logger.info(f"Entities per Batch - Avg: {avg_entities:.1f}, Max: {max_entities}")
        
        logger.info(f"Results Cached In: {cache_dir}")
        logger.info(f"Format: {format_type}")
        logger.info(f"Model: {model.__class__.__name__} ({model_config.name})")
        
        # Generate upload command suggestion
        upload_collection = f"{collection}-ner-enhanced"
        jsonl_pattern = str(cache_dir / "*.jsonl")
        
        logger.info("\nTo upload results to Solr:")
        logger.info(f"python -m histtext_toolkit.main upload {upload_collection} '{jsonl_pattern}'")
        
        logger.info("="*80)
        
        # Unload model and cleanup
        try:
            model.unload()
            processor.clear_cache()
        except Exception as e:
            logger.warning(f"Error during cleanup: {e}")

    return total_docs


# Integration and utility functions
async def precompute_ner_enhanced(
   solr_client: SolrClient,
   collection: str,
   text_field: str,
   model_config: ModelConfig,
   cache_root: str,
   model_name: str,
   **kwargs
) -> int:
   """Enhanced version of the original precompute_ner function with auto-detection."""
   
   # Detect if we should use enhanced processing
   use_enhanced = (
       model_config.type.lower() in ["nuner", "flair", "gliner_enhanced", "llm_ner"] or
       model_config.additional_params.get("use_enhanced", False) or
       isinstance(model_config, EnhancedModelConfig)
   )
   
   if use_enhanced:
       logger.info("Using enhanced NER processing")
       return await enhanced_precompute_ner(
           solr_client, collection, text_field, model_config,
           cache_root, model_name, **kwargs
       )
   else:
       logger.info("Using standard NER processing")
       # Fall back to original implementation
       from .ner import precompute_ner
       return await precompute_ner(
           solr_client, collection, text_field, model_config,
           cache_root, model_name, **kwargs
       )


def create_enhanced_model_config(
   model_type: str,
   model_name: str = None,
   entity_types: List[str] = None,
   processing_mode: str = "batch",
   optimization_level: int = 1,
   **kwargs
) -> EnhancedModelConfig:
   """Create an enhanced model configuration with recommended settings.
   
   Args:
       model_type: Type of model ("nuner", "gliner_enhanced", etc.)
       model_name: Specific model name/path
       entity_types: List of entity types to extract
       processing_mode: Processing mode ("batch", "streaming", "memory_efficient")
       optimization_level: Optimization level (0-2)
       **kwargs: Additional configuration parameters
       
   Returns:
       EnhancedModelConfig instance
   """
   
   # Import here to avoid circular imports
   from ..models.enhanced_registry import get_recommended_model, DEFAULT_MODEL_CONFIGS
   
   # Get recommended model if not specified
   if not model_name:
       domain = kwargs.get("domain", "general")
       language = kwargs.get("language", "en")
       performance = kwargs.get("performance_priority", "balanced")
       
       recommended_type = get_recommended_model(domain, language, performance)
       default_config = DEFAULT_MODEL_CONFIGS.get(recommended_type, {})
       model_name = default_config.get("model_name", "urchade/gliner_mediumv2.1")
   
   # Get default configuration for model type
   default_config = DEFAULT_MODEL_CONFIGS.get(model_type, {})
   
   # Build configuration
   config_params = {
       "name": model_name,
       "path": model_name,
       "type": model_type,
       "processing_mode": processing_mode,
       "optimization_level": optimization_level,
       "entity_types": entity_types,
       "enable_caching": True,
       "use_fp16": optimization_level >= 1,
       "enable_compilation": optimization_level >= 2,
       "additional_params": {
           **default_config,
           **kwargs
       }
   }
   
   return EnhancedModelConfig(**config_params)


# Example usage and testing functions
async def test_enhanced_ner(
   text: str = "Apple Inc. was founded by Steve Jobs in Cupertino, California.",
   model_type: str = "gliner_enhanced",
   entity_types: List[str] = None
) -> Dict[str, Any]:
   """Test enhanced NER functionality with a sample text.
   
   Returns:
       Dictionary with test results and performance metrics
   """
   
   if entity_types is None:
       entity_types = ["Person", "Organization", "Location"]
   
   # Create test configuration
   config = create_enhanced_model_config(
       model_type=model_type,
       entity_types=entity_types,
       optimization_level=1
   )
   
   # Create and load model
   model = create_enhanced_ner_model(config)
   if not model or not model.load():
       return {"error": "Failed to load model"}
   
   # Create processor
   processor = EnhancedNERProcessor(model, enable_caching=True)
   
   try:
       # Extract entities
       start_time = time.time()
       entities = processor.extract_entities(text, entity_types)
       processing_time = time.time() - start_time
       
       # Get statistics
       stats = processor.get_processing_stats()
       
       return {
           "text": text,
           "entities": [asdict(entity) for entity in entities],
           "processing_time": processing_time,
           "entity_count": len(entities),
           "model_type": model_type,
           "model_class": model.__class__.__name__,
           "stats": stats
       }
       
   finally:
       model.unload()
       processor.clear_cache()


# toolkit/histtext_toolkit/operations/enhanced_ner.py (Updated final part)

def convert_to_flat_format(entities: List[EntitySpan], doc_id: str) -> Dict[str, Any]:
    """Convert entities to flat format for Solr storage."""
    if not entities:
        return {}
    
    flat_doc = {
        "doc_id": [doc_id] * len(entities),
        "t": [entity.text for entity in entities],
        "l": [entity.labels[0] if entity.labels else "UNK" for entity in entities], 
        "s": [int(entity.start_pos) for entity in entities],  # Convert to int
        "e": [int(entity.end_pos) for entity in entities],    # Convert to int
        "c": [float(entity.confidence) for entity in entities]  # Convert to Python float
    }
    
    return flat_doc


async def enhanced_precompute_ner(
    solr_client: SolrClient,
    collection: str,
    text_field: str,
    model_config: ModelConfig,
    cache_root: str,
    model_name: str,
    start: int = 0,
    batch_size: int = 1000,
    num_batches: Optional[int] = None,
    filter_query: Optional[str] = None,
    entity_types: Optional[List[str]] = None,
    processing_mode: ProcessingMode = ProcessingMode.BATCH,
    optimization_level: int = 1,
    enable_streaming: bool = False,
    jsonl_prefix: Optional[str] = None,
    format_type: str = "flat",
    decimal_precision: Optional[int] = 3
) -> int:
    """Enhanced NER precomputation with automatic flat format output."""
    
    # Create enhanced model with multiple fallback strategies
    model = None
    
    if ENHANCED_REGISTRY_AVAILABLE:
        try:
            model = create_enhanced_ner_model(
                model_config, 
                processing_mode=processing_mode,
                optimization_level=optimization_level
            )
        except Exception as e:
            logger.warning(f"Failed to create enhanced model: {e}")
    
    # Fallback 1: Try regular GLiNER if enhanced failed
    if model is None and model_config.type.lower() in ["gliner", "gliner_enhanced"]:
        try:
            from ..models.gliner_model import GLiNERModel
            
            # Create regular GLiNER model
            model = GLiNERModel(
                model_path=model_config.path,
                threshold=0.3,
                use_gpu=True
            )
            
            # Wrap in enhanced interface
            model = _wrap_legacy_model(model)
            logger.info("Using regular GLiNER model as fallback")
            
        except Exception as e:
            logger.warning(f"Regular GLiNER fallback failed: {e}")
    
    # Fallback 2: Try regular model registry
    if model is None:
        try:
            from ..models.registry import create_ner_model
            model = create_ner_model(model_config)
            # Wrap in enhanced interface
            model = _wrap_legacy_model(model)
            logger.info("Using regular model registry as fallback")
        except Exception as e:
            logger.error(f"All model creation attempts failed: {e}")
            return 0
    
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return 0
    
    # Create enhanced processor
    processor = EnhancedNERProcessor(
        model, 
        cache_root=cache_root,
        processing_mode=processing_mode
    )
    
    # Setup cache directory
    cache_dir = os.path.join(cache_root, model_name, collection, text_field)
    os.makedirs(cache_dir, exist_ok=True)
    
    # Create flat format schema
    schema_path = os.path.join(cache_root, f"{collection}_ner.yaml")
    _create_flat_schema(schema_path)
    
    logger.info(f"Starting enhanced NER precomputation...")
    logger.info(f"Model: {model_config.name} ({model_config.type})")
    logger.info(f"Processing mode: {processing_mode.value}")
    logger.info(f"Output format: flat (optimized for Solr)")
    logger.info(f"Cache directory: {cache_dir}")
    logger.info(f"Schema file: {schema_path}")
    
    if entity_types:
        logger.info(f"Entity types: {entity_types}")
    
    # Process batches
    current_start = start
    current_batch = 0
    total_docs = 0
    total_entities = 0
    
    try:
        while num_batches is None or current_batch < num_batches:
            logger.info(f"Processing batch {current_batch + 1} (docs {current_start}-{current_start + batch_size - 1})")
            
            # Get documents from Solr
            documents = await solr_client.get_document_batch(
                collection, text_field, current_start, batch_size, filter_query
            )
            
            if not documents:
                logger.info("No more documents found")
                break
            
            # Extract texts and IDs
            doc_ids = list(documents.keys())
            texts = list(documents.values())
            
            # Process with enhanced NER
            batch_start_time = time.time()
            
            if enable_streaming and len(texts) > 100:
                # Use streaming for large batches
                results = list(processor.extract_entities_streaming(
                    iter(texts), entity_types, batch_size=min(32, len(texts)//4)
                ))
            else:
                # Standard batch processing
                results = processor.extract_entities_batch(texts, entity_types)
            
            batch_time = time.time() - batch_start_time
            
            # Convert results to flat format for caching
            flat_docs = []
            batch_entities = 0
            
            for doc_id, entities in zip(doc_ids, results):
                if entities:
                    # Apply decimal precision
                    if decimal_precision is not None:
                        for entity in entities:
                            entity.confidence = round(entity.confidence, decimal_precision)
                    
                    # Convert to flat format
                    flat_doc = convert_to_flat_format(entities, doc_id)
                    if flat_doc:
                        flat_docs.append(flat_doc)
                        batch_entities += len(entities)
            
            # Cache results in flat format
            if flat_docs:
                cache_manager = get_cache_manager(cache_root)
                
                # Save as JSONL with flat format
                jsonl_filename = f"batch_{current_start:08d}.jsonl"
                if jsonl_prefix:
                    jsonl_filename = f"{jsonl_prefix}_{jsonl_filename}"
                
                jsonl_path = os.path.join(cache_dir, jsonl_filename)
                
                with open(jsonl_path, 'w', encoding='utf-8') as f:
                    for flat_doc in flat_docs:
                        f.write(json.dumps(flat_doc, ensure_ascii=False) + '\n')
                
                logger.debug(f"Saved {len(flat_docs)} documents to {jsonl_path}")
            
            # Update counters
            total_docs += len(documents)
            total_entities += batch_entities
            
            # Log progress
            entities_per_sec = batch_entities / batch_time if batch_time > 0 else 0
            logger.info(f"Batch {current_batch + 1}: {len(documents)} docs, {batch_entities} entities, {batch_time:.2f}s ({entities_per_sec:.1f} entities/sec)")
            
            # Memory management
            if current_batch % 5 == 0:
                GPUMemoryManager.clear_cache()
            
            # Check for completion
            if len(documents) < batch_size:
                logger.info("Completed collection - no more documents")
                break
            
            current_batch += 1
            current_start += batch_size
    
    except Exception as e:
        logger.error(f"Error during enhanced NER processing: {e}")
        import traceback
        logger.debug(traceback.format_exc())
    
    finally:
        # Get final stats
        stats = processor.get_processing_stats()
        
        # Generate upload command
        upload_collection = f"{collection}_ner"
        jsonl_pattern = os.path.join(cache_dir, "*.jsonl")
        
        upload_command = f"python -m histtext_toolkit.main upload {upload_collection} \"{jsonl_pattern}\" --schema {schema_path}"
        
        # Log final statistics
        logger.info(f"\n{'='*60}")
        logger.info(f"Enhanced NER Processing Complete")
        logger.info(f"{'='*60}")
        logger.info(f"Documents processed: {total_docs}")
        logger.info(f"Total entities found: {total_entities}")
        logger.info(f"Average entities per document: {total_entities/total_docs if total_docs > 0 else 0:.2f}")
        logger.info(f"Processing time: {stats['total_time']:.2f}s")
        
        if stats.get('entities_per_second'):
           logger.info(f"Throughput: {stats['entities_per_second']:.2f} entities/sec")
       
        if stats.get('cache_hit_rate'):
            logger.info(f"Cache hit rate: {stats['cache_hit_rate']:.1%}")
        
        if stats.get('gpu_memory'):
            gpu_info = stats['gpu_memory']
            logger.info(f"GPU memory usage: {gpu_info.get('allocated', 0):.1f}GB / {gpu_info.get('total', 0):.1f}GB")
        
        logger.info(f"Results cached in: {cache_dir}")
        logger.info(f"Schema file: {schema_path}")
        logger.info("\nTo upload to Solr:")
        logger.info(f"  {upload_command}")
        logger.info(f"{'='*60}")
        
        # Unload model
        model.unload()

    return total_docs


def _create_flat_schema(schema_path: str) -> None:
   """Create schema for flat NER format."""
   schema_content = {
       "add-field": [
           {
               "name": "doc_id",
               "type": "strings",
               "stored": True,
               "indexed": True,
               "multiValued": True
           },
           {
               "name": "t", 
               "type": "text_general",
               "stored": True,
               "indexed": True,
               "multiValued": True
           },
           {
               "name": "l",
               "type": "string", 
               "stored": True,
               "indexed": True,
               "multiValued": True
           },
           {
               "name": "s",
               "type": "plongs",
               "stored": True, 
               "indexed": True,
               "multiValued": True
           },
           {
               "name": "e",
               "type": "plongs",
               "stored": True,
               "indexed": True, 
               "multiValued": True
           },
           {
               "name": "c",
               "type": "pdoubles",
               "stored": True,
               "indexed": True,
               "multiValued": True
           }
       ]
   }
   
   import yaml
   os.makedirs(os.path.dirname(schema_path) or ".", exist_ok=True)
   
   with open(schema_path, 'w') as f:
       yaml.dump(schema_content, f, default_flow_style=False)


def _wrap_legacy_model(model):
   """Wrap legacy model to provide enhanced interface."""
   
   class LegacyModelWrapper:
       def __init__(self, legacy_model):
           self.legacy_model = legacy_model
           self._stats = ProcessingStats()
       
       def load(self):
           return self.legacy_model.load()
       
       def unload(self):
           return self.legacy_model.unload()
       
       @property
       def is_loaded(self):
           return self.legacy_model.is_loaded
       
       def extract_entities(self, text, entity_types=None):
           entities = self.legacy_model.extract_entities(text)
           # Convert to EntitySpan if needed
           result = []
           for entity in entities:
               if hasattr(entity, 'text'):
                   result.append(entity)
               else:
                   # Convert old format
                   result.append(EntitySpan(
                       text=entity.get('text', ''),
                       labels=entity.get('labels', []),
                       start_pos=entity.get('start_pos', 0),
                       end_pos=entity.get('end_pos', 0),
                       confidence=entity.get('confidence', 0.0)
                   ))
           return result
       
       def extract_entities_batch(self, texts, entity_types=None):
           results = []
           for text in texts:
               entities = self.extract_entities(text, entity_types)
               results.append(entities)
           return results
       
       def get_processing_stats(self):
           return self._stats
   
   return LegacyModelWrapper(model)


# Integration function for backward compatibility
async def precompute_ner_enhanced(
   solr_client: SolrClient,
   collection: str,
   text_field: str,
   model_config: ModelConfig,
   cache_root: str,
   model_name: str,
   **kwargs
) -> int:
   """Enhanced version of the original precompute_ner function."""
   
   # Always use enhanced processing for better results
   return await enhanced_precompute_ner(
       solr_client, collection, text_field, model_config,
       cache_root, model_name, **kwargs
   )