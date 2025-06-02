# toolkit/histtext_toolkit/models/base.py (enhanced version)
"""Enhanced base model classes for NER, tokenization, and embeddings with modern capabilities."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional, Union, List, Dict, Tuple
import numpy as np


class ModelType(Enum):
    """Enumeration of supported model types with modern additions."""
    
    # Traditional models
    SPACY = "spacy"
    TRANSFORMERS = "transformers"
    GLINER = "gliner"
    CHINESE_SEGMENTER = "chinese_segmenter"
    FASTTEXT = "fasttext"
    WORD2VEC = "word2vec"
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    COLLECTION_ALIGNED = "collection_aligned"
    WORD_EMBEDDINGS = "word_embeddings"
    
    # Modern NER models
    NUNER = "nuner"
    GLINER_SPACY = "gliner_spacy"
    FLAIR = "flair"
    STANZA = "stanza"
    ALLENNLP = "allennlp"
    
    # State-of-the-art models
    LLAMA_NER = "llama_ner"
    MISTRAL_NER = "mistral_ner"
    QWEN_NER = "qwen_ner"
    
    # Multi-modal models
    LAYOUTLM = "layoutlm"
    VISUAL_NER = "visual_ner"


class ProcessingMode(Enum):
    """Processing modes for different optimization strategies."""
    
    BATCH = "batch"
    STREAMING = "streaming"
    MEMORY_EFFICIENT = "memory_efficient"
    HIGH_THROUGHPUT = "high_throughput"
    LOW_LATENCY = "low_latency"


@dataclass
class EntitySpan:
    """Enhanced entity representation with additional metadata."""
    
    text: str
    labels: List[str]
    start_pos: int
    end_pos: int
    confidence: float = -1.0
    
    # Enhanced fields
    probability_distribution: Optional[Dict[str, float]] = None
    entity_id: Optional[str] = None
    normalized_text: Optional[str] = None
    linking_candidates: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ProcessingStats:
    """Statistics for model performance monitoring."""
    
    total_entities: int = 0
    processing_time: float = 0.0
    memory_usage: Optional[float] = None
    gpu_utilization: Optional[float] = None
    throughput: Optional[float] = None  # entities per second
    
    
class EnhancedNERModel(ABC):
    """Enhanced base class for Named Entity Recognition models with modern features."""

    @abstractmethod
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract named entities with optional type filtering."""
        pass

    @abstractmethod
    def extract_entities_batch(self, texts: List[str], entity_types: Optional[List[str]] = None) -> List[List[EntitySpan]]:
        """Batch entity extraction for improved efficiency."""
        pass
    
    @abstractmethod
    def get_supported_entity_types(self) -> List[str]:
        """Get list of supported entity types."""
        pass
    
    def extract_entities_streaming(self, texts: Iterator[str], **kwargs) -> Iterator[List[EntitySpan]]:
        """Stream processing for large datasets."""
        for text in texts:
            yield self.extract_entities(text, **kwargs)
    
    def get_processing_stats(self) -> ProcessingStats:
        """Get processing statistics."""
        return ProcessingStats()
    
    def set_processing_mode(self, mode: ProcessingMode) -> None:
        """Set processing mode for optimization."""
        pass


# Keep existing Entity and Token classes for backward compatibility
Entity = EntitySpan  # Alias for backward compatibility


class GPUMemoryManager:
    """GPU memory management utilities."""
    
    @staticmethod
    def clear_cache():
        """Clear GPU cache."""
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
    
    @staticmethod
    def get_memory_info() -> Dict[str, float]:
        """Get GPU memory information."""
        try:
            import torch
            if torch.cuda.is_available():
                device = torch.cuda.current_device()
                total = torch.cuda.get_device_properties(device).total_memory / (1024**3)
                reserved = torch.cuda.memory_reserved(device) / (1024**3)
                allocated = torch.cuda.memory_allocated(device) / (1024**3)
                free = total - allocated
                return {
                    "total": total,
                    "reserved": reserved,
                    "allocated": allocated,
                    "free": free
                }
        except ImportError:
            pass
        return {}
    
    @staticmethod
    def optimize_batch_size(base_batch_size: int, memory_threshold: float = 0.8) -> int:
        """Optimize batch size based on available memory."""
        memory_info = GPUMemoryManager.get_memory_info()
        if memory_info:
            utilization = memory_info["allocated"] / memory_info["total"]
            if utilization > memory_threshold:
                return max(1, base_batch_size // 2)
            elif utilization < 0.5:
                return min(base_batch_size * 2, 128)
        return base_batch_size