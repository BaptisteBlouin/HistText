# toolkit/histtext_toolkit/models/universal_transformers.py
"""Universal transformers NER model for any HuggingFace model."""

import logging
import time
import math
from typing import Any, Dict, List, Optional, Iterator, Union, Tuple
import numpy as np
import torch
from transformers import (
    AutoTokenizer, AutoModelForTokenClassification, AutoConfig,
    pipeline, BitsAndBytesConfig
)

from ..core.logging import get_logger
from .base import EnhancedNERModel, EntitySpan, ProcessingStats, ProcessingMode, GPUMemoryManager

logger = get_logger(__name__)


class DocumentChunker:
    """Smart document chunking for long documents."""
    
    def __init__(self, max_length: int = 512, overlap: int = 50):
        self.max_length = max_length
        self.overlap = overlap
    
    def chunk_text(self, text: str, tokenizer) -> List[Tuple[str, int, int]]:
        """
        Chunk text into overlapping segments.
        
        Returns:
            List of (chunk_text, start_offset, end_offset)
        """
        if len(text) <= self.max_length:
            return [(text, 0, len(text))]
        
        chunks = []
        # Tokenize the full text to understand boundaries
        tokens = tokenizer.tokenize(text)
        
        if len(tokens) <= self.max_length:
            return [(text, 0, len(text))]
        
        # Create overlapping chunks
        start_idx = 0
        while start_idx < len(tokens):
            end_idx = min(start_idx + self.max_length, len(tokens))
            
            # Convert token indices back to character positions
            chunk_tokens = tokens[start_idx:end_idx]
            
            # Reconstruct text from tokens (approximate)
            chunk_text = tokenizer.convert_tokens_to_string(chunk_tokens)
            
            # Find actual character positions in original text
            if start_idx == 0:
                start_char = 0
            else:
                # Find approximate character position
                start_char = text.find(chunk_text[:50])
                if start_char == -1:
                    start_char = int(len(text) * start_idx / len(tokens))
            
            if end_idx >= len(tokens):
                end_char = len(text)
            else:
                # Find end position
                remaining_text = text[start_char:]
                end_char = start_char + len(chunk_text)
                if end_char > len(text):
                    end_char = len(text)
            
            # Extract actual chunk from original text
            actual_chunk = text[start_char:end_char]
            chunks.append((actual_chunk, start_char, end_char))
            
            # Break if we've reached the end
            if end_idx >= len(tokens):
                break
            
            # Move start with overlap
            start_idx = end_idx - self.overlap
        
        return chunks
    
    def merge_entities(self, chunk_entities: List[List[EntitySpan]], chunk_offsets: List[Tuple[int, int]]) -> List[EntitySpan]:
        """Merge entities from overlapping chunks, removing duplicates."""
        all_entities = []
        
        for entities, (start_offset, _) in zip(chunk_entities, chunk_offsets):
            for entity in entities:
                # Adjust entity positions to global coordinates
                adjusted_entity = EntitySpan(
                    text=entity.text,
                    labels=entity.labels,
                    start_pos=entity.start_pos + start_offset,
                    end_pos=entity.end_pos + start_offset,
                    confidence=entity.confidence,
                    probability_distribution=entity.probability_distribution,
                    entity_id=entity.entity_id,
                    normalized_text=entity.normalized_text,
                    linking_candidates=entity.linking_candidates,
                    metadata=entity.metadata
                )
                all_entities.append(adjusted_entity)
        
        # Remove duplicates and overlapping entities
        return self._deduplicate_entities(all_entities)
    
    def _deduplicate_entities(self, entities: List[EntitySpan]) -> List[EntitySpan]:
        """Remove duplicate and overlapping entities."""
        if not entities:
            return []
        
        # Sort by start position
        entities.sort(key=lambda x: x.start_pos)
        
        deduplicated = []
        for entity in entities:
            # Check for overlap with existing entities
            is_duplicate = False
            
            for existing in deduplicated:
                # Check for significant overlap
                overlap_start = max(entity.start_pos, existing.start_pos)
                overlap_end = min(entity.end_pos, existing.end_pos)
                overlap_length = max(0, overlap_end - overlap_start)
                
                entity_length = entity.end_pos - entity.start_pos
                existing_length = existing.end_pos - existing.start_pos
                
                # If overlap is significant (>80% of either entity)
                if (overlap_length > 0.8 * entity_length or 
                    overlap_length > 0.8 * existing_length):
                    
                    # Keep the one with higher confidence
                    if entity.confidence <= existing.confidence:
                        is_duplicate = True
                        break
                    else:
                        # Remove the existing one and add this one
                        deduplicated.remove(existing)
                        break
            
            if not is_duplicate:
                deduplicated.append(entity)
        
        return deduplicated


class UniversalTransformersNERModel(EnhancedNERModel):
    """Universal NER model that works with any HuggingFace transformers model."""
    
    def __init__(
        self,
        model_name: str,
        device: Optional[str] = None,
        batch_size: int = 16,
        max_length: int = 512,
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        optimization_level: int = 1,
        use_quantization: bool = False,
        use_fp16: bool = True,
        enable_compilation: bool = True,
        custom_labels: Optional[List[str]] = None,
        aggregation_strategy: str = "simple"
    ):
        self.model_name = model_name
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.base_batch_size = batch_size
        self.max_length = max_length
        self.processing_mode = processing_mode
        self.optimization_level = optimization_level
        self.use_quantization = use_quantization
        self.use_fp16 = use_fp16 and torch.cuda.is_available()
        self.enable_compilation = enable_compilation
        self.custom_labels = custom_labels
        self.aggregation_strategy = aggregation_strategy
        
        self._model = None
        self._tokenizer = None
        self._pipeline = None
        self._config = None
        self.is_loaded_flag = False
        self._stats = ProcessingStats()
        
        # Document chunking
        self._chunker = DocumentChunker(max_length=max_length - 50)  # Leave room for special tokens
        
        # Auto-detect model capabilities
        self._model_info = self._detect_model_capabilities()
    
    def _detect_model_capabilities(self) -> Dict[str, Any]:
        """Detect model capabilities and optimal settings."""
        model_info = {
            "supports_long_context": False,
            "optimal_batch_size": self.base_batch_size,
            "memory_efficient": False,
            "model_type": "unknown"
        }
        
        model_name_lower = self.model_name.lower()
        
        # Detect model type and adjust settings
        if "bert" in model_name_lower:
            model_info.update({
                "model_type": "bert",
                "optimal_batch_size": min(32, self.base_batch_size),
                "memory_efficient": True
            })
        elif "roberta" in model_name_lower:
            model_info.update({
                "model_type": "roberta", 
                "optimal_batch_size": min(24, self.base_batch_size),
                "memory_efficient": True
            })
        elif "distilbert" in model_name_lower:
            model_info.update({
                "model_type": "distilbert",
                "optimal_batch_size": min(48, self.base_batch_size),
                "memory_efficient": True
            })
        elif "longformer" in model_name_lower:
            model_info.update({
                "model_type": "longformer",
                "supports_long_context": True,
                "optimal_batch_size": min(8, self.base_batch_size)
            })
        elif "bigbird" in model_name_lower:
            model_info.update({
                "model_type": "bigbird",
                "supports_long_context": True,
                "optimal_batch_size": min(4, self.base_batch_size)
            })
        elif any(x in model_name_lower for x in ["t5", "mt5"]):
            model_info.update({
                "model_type": "t5",
                "optimal_batch_size": min(16, self.base_batch_size)
            })
        elif any(x in model_name_lower for x in ["electra", "deberta"]):
            model_info.update({
                "model_type": "electra_deberta",
                "optimal_batch_size": min(20, self.base_batch_size),
                "memory_efficient": True
            })
        
        return model_info
    
    def load(self) -> bool:
        """Load the universal transformers model."""
        try:
            logger.info(f"Loading universal transformers model: {self.model_name}")
            
            # Load configuration first
            self._config = AutoConfig.from_pretrained(self.model_name)
            
            # Load tokenizer
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                use_fast=True,
                add_prefix_space=True
            )
            
            # Handle tokenizer padding
            if self._tokenizer.pad_token is None:
                self._tokenizer.pad_token = self._tokenizer.eos_token or "[PAD]"
            
            # Prepare model loading arguments
            model_kwargs = {}
            
            # Apply quantization if requested
            if self.use_quantization and self.device == "cuda":
                try:
                    quantization_config = BitsAndBytesConfig(
                        load_in_8bit=True,
                        llm_int8_enable_fp32_cpu_offload=True
                    )
                    model_kwargs["quantization_config"] = quantization_config
                    logger.info("Enabled 8-bit quantization")
                except Exception as e:
                    logger.warning(f"Could not enable quantization: {e}")
            
            # Set dtype for memory efficiency
            if self.use_fp16 and self.device == "cuda":
                model_kwargs["torch_dtype"] = torch.float16
            
            # Load model
            self._model = AutoModelForTokenClassification.from_pretrained(
                self.model_name,
                config=self._config,
                **model_kwargs
            )
            
            # Move to device
            if not self.use_quantization:  # Quantized models are automatically placed
                self._model.to(self.device)
            
            # Enable compilation if supported
            if self.enable_compilation and hasattr(torch, "compile"):
                try:
                    self._model = torch.compile(self._model, mode="reduce-overhead")
                    logger.info("Enabled model compilation")
                except Exception as e:
                    logger.warning(f"Could not compile model: {e}")
            
            # Create pipeline for easier inference
            self._pipeline = pipeline(
                "ner",
                model=self._model,
                tokenizer=self._tokenizer,
                aggregation_strategy=self.aggregation_strategy,
                device=0 if self.device == "cuda" else -1,
                return_all_scores=False
            )
            
            self.is_loaded_flag = True
            logger.info(f"Successfully loaded {self._model_info['model_type']} model on {self.device}")
            
            # Log model info
            logger.info(f"Model capabilities: {self._model_info}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load universal transformers model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload the model and free memory."""
        try:
            if self._pipeline is not None:
                del self._pipeline
                self._pipeline = None
            
            if self._model is not None:
                del self._model
                self._model = None
            
            if self._tokenizer is not None:
                del self._tokenizer
                self._tokenizer = None
            
            if self._config is not None:
                del self._config
                self._config = None
            
            GPUMemoryManager.clear_cache()
            self.is_loaded_flag = False
            
            logger.info("Successfully unloaded universal transformers model")
            return True
            
        except Exception as e:
            logger.error(f"Error unloading model: {e}")
            return False
    
    @property
    def is_loaded(self) -> bool:
        return self.is_loaded_flag and self._pipeline is not None
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types from model config."""
        if not self.is_loaded:
            return []
        
        if self.custom_labels:
            return self.custom_labels
        
        # Extract from model config
        if hasattr(self._config, "id2label"):
            labels = list(self._config.id2label.values())
            # Filter out 'O' (outside) labels and extract entity types
            entity_types = set()
            for label in labels:
                if label != "O" and "-" in label:
                    entity_type = label.split("-")[-1]
                    entity_types.add(entity_type)
            return list(entity_types)
        
        # Default entity types for common NER models
        return ["PER", "LOC", "ORG", "MISC"]
    
    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None
    ) -> List[EntitySpan]:
        """Extract entities from text with automatic chunking for long documents."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text or not text.strip():
            return []
        
        start_time = time.time()
        
        try:
            # Handle long documents with chunking
            if len(text) > self.max_length * 3:  # Use chunking for very long texts
                return self._extract_entities_chunked(text, entity_types)
            else:
                return self._extract_entities_single(text, entity_types)
                
        except Exception as e:
            logger.error(f"Error in universal transformers entity extraction: {e}")
            return []
        finally:
            # Update stats
            processing_time = time.time() - start_time
            self._stats.processing_time += processing_time
    
    def _extract_entities_single(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract entities from a single text chunk."""
        try:
            # Use the pipeline for inference
            results = self._pipeline(text)
            
            # Convert to EntitySpan format
            entities = []
            for result in results:
                # Filter by entity types if specified
                if entity_types:
                    entity_label = result.get("entity_group", result.get("entity", "")).split("-")[-1]
                    if entity_label not in entity_types:
                        continue
                
                entities.append(EntitySpan(
                    text=result["word"].replace("##", "").replace("▁", " ").strip(),
                    labels=[result.get("entity_group", result.get("entity", "UNK"))],
                    start_pos=result["start"],
                    end_pos=result["end"],
                    confidence=result["score"]
                ))
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in single entity extraction: {e}")
            return []
    
    def _extract_entities_chunked(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract entities from long text using chunking."""
        try:
            # Create chunks
            chunks = self._chunker.chunk_text(text, self._tokenizer)
            
            # Process each chunk
            chunk_entities = []
            chunk_offsets = []
            
            for chunk_text, start_offset, end_offset in chunks:
                entities = self._extract_entities_single(chunk_text, entity_types)
                chunk_entities.append(entities)
                chunk_offsets.append((start_offset, end_offset))
            
            # Merge entities from overlapping chunks
            merged_entities = self._chunker.merge_entities(chunk_entities, chunk_offsets)
            
            return merged_entities
            
        except Exception as e:
            logger.error(f"Error in chunked entity extraction: {e}")
            return []
    
    def extract_entities_batch(
        self, 
        texts: List[str], 
        entity_types: Optional[List[str]] = None
    ) -> List[List[EntitySpan]]:
        """Batch entity extraction with optimized processing."""
        if not texts:
            return []
        
        # Optimize batch size based on GPU memory
        batch_size = GPUMemoryManager.optimize_batch_size(
            self._model_info["optimal_batch_size"]
        )
        
        results = []
        
        try:
            # Process in optimized batches
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                batch_results = []
                
                for text in batch_texts:
                    if text and text.strip():
                        entities = self.extract_entities(text, entity_types)
                        batch_results.append(entities)
                    else:
                        batch_results.append([])
                
                results.extend(batch_results)
                
                # Memory management
                if i % (batch_size * 4) == 0:
                    GPUMemoryManager.clear_cache()
            
            return results
            
        except Exception as e:
            logger.error(f"Error in universal transformers batch processing: {e}")
            return [[] for _ in texts]
    
    def extract_entities_streaming(
        self, 
        texts: Iterator[str], 
        entity_types: Optional[List[str]] = None,
        **kwargs
    ) -> Iterator[List[EntitySpan]]:
        """Stream processing for large datasets."""
        batch_size = kwargs.get("batch_size", 32)
        batch = []
        
        for text in texts:
            batch.append(text)
            
            if len(batch) >= batch_size:
                # Process batch
                results = self.extract_entities_batch(batch, entity_types)
                for result in results:
                    yield result
                
                batch = []
                
                # Memory cleanup
                GPUMemoryManager.clear_cache()
        
        # Process remaining batch
        if batch:
            results = self.extract_entities_batch(batch, entity_types)
            for result in results:
                yield result
    
    def get_processing_stats(self) -> ProcessingStats:
        """Get processing statistics."""
        return self._stats
    
    def set_processing_mode(self, mode: ProcessingMode) -> None:
        """Set processing mode for optimization."""
        self.processing_mode = mode
        
        if mode == ProcessingMode.HIGH_THROUGHPUT:
            self.base_batch_size = min(64, self.base_batch_size * 2)
        elif mode == ProcessingMode.LOW_LATENCY:
            self.base_batch_size = max(1, self.base_batch_size // 2)
        elif mode == ProcessingMode.MEMORY_EFFICIENT:
            self.base_batch_size = max(4, self.base_batch_size // 4)