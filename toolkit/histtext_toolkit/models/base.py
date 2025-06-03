"""Unified base model classes for NER, tokenization, and embeddings."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional, Union, List, Dict, Tuple, Iterator
import numpy as np


class ModelType(Enum):
    """Enumeration of supported model types."""
    
    # Core model types
    SPACY = "spacy"
    TRANSFORMERS = "transformers"
    GLINER = "gliner"
    CHINESE_SEGMENTER = "chinese_segmenter"
    FASTTEXT = "fasttext"
    WORD2VEC = "word2vec"
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    WORD_EMBEDDINGS = "word_embeddings"
    
    # Modern NER models - all treated equally
    NUNER = "nuner"
    FLAIR = "flair"
    STANZA = "stanza"
    ALLENNLP = "allennlp"
    UNIVERSAL_TRANSFORMERS = "universal_transformers"
    
    # LLM-based models
    LLM_NER = "llm_ner"
    LLAMA_NER = "llama_ner"
    MISTRAL_NER = "mistral_ner"
    QWEN_NER = "qwen_ner"
    
    # Specialized variants
    GLINER_ENHANCED = "gliner_enhanced"
    GLINER_BIO = "gliner_bio"
    GLINER_NEWS = "gliner_news"
    GLINER_MULTI = "gliner_multi"
    
    # Chinese models
    FASTHAN = "fasthan"
    FASTNLP = "fastnlp"
    LAC = "lac"
    HANLP = "hanlp"
    PKUSEG = "pkuseg"
    
    # Multilingual
    MULTILINGUAL = "multilingual"
    HISTORICAL = "historical"


class ProcessingMode(Enum):
    """Processing modes for different optimization strategies."""
    
    BATCH = "batch"
    STREAMING = "streaming"
    MEMORY_EFFICIENT = "memory_efficient"
    HIGH_THROUGHPUT = "high_throughput"
    LOW_LATENCY = "low_latency"


class AggregationStrategy(Enum):
    """Aggregation strategies for subword tokens."""
    
    NONE = "none"
    SIMPLE = "simple"
    FIRST = "first"
    AVERAGE = "average"
    MAX = "max"


@dataclass
class EntitySpan:
    """Unified entity representation."""
    
    text: str
    labels: List[str]
    start_pos: int
    end_pos: int
    confidence: float = 0.0
    
    # Optional metadata
    probability_distribution: Optional[Dict[str, float]] = None
    entity_id: Optional[str] = None
    normalized_text: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "text": self.text,
            "labels": self.labels,
            "start_pos": self.start_pos,
            "end_pos": self.end_pos,
            "confidence": self.confidence,
            "metadata": self.metadata or {}
        }

    def to_flat_dict(self, use_compact_labels: bool = True) -> Dict[str, Any]:
        """Convert to flat format for Solr with optional compact labels."""
        from .ner_labels import get_compact_label
        
        label = self.labels[0] if self.labels else "MISC"
        
        if use_compact_labels:
            label = get_compact_label(label)
        
        return {
            "t": self.text,
            "l": label,
            "s": self.start_pos,
            "e": self.end_pos,
            "c": self.confidence
        }


@dataclass
class Token:
    """Token representation with position and confidence."""
    
    text: str
    start_pos: int
    end_pos: int
    confidence: float = 1.0
    
    # Additional metadata
    token_type: Optional[str] = None
    normalized_text: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ProcessingStats:
    """Statistics for model performance monitoring."""
    
    total_texts: int = 0
    total_entities: int = 0
    processing_time: float = 0.0
    memory_usage: Optional[float] = None
    gpu_utilization: Optional[float] = None
    throughput: Optional[float] = None
    error_count: int = 0


# Backward compatibility
Entity = EntitySpan


class BaseModel(ABC):
    """Base class for all models."""
    
    def __init__(self, model_name: str, **kwargs):
        self.model_name = model_name
        self.kwargs = kwargs
        self._loaded = False
        self._stats = ProcessingStats()
    
    @abstractmethod
    def load(self) -> bool:
        """Load the model."""
        pass
    
    @abstractmethod
    def unload(self) -> bool:
        """Unload the model."""
        pass
    
    @property
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._loaded


class NERModel(BaseModel):
    """Unified base class for Named Entity Recognition models."""
    
    @abstractmethod
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract named entities from text with optional type filtering."""
        if entity_types is not None and len(entity_types) == 0:
            entity_types = None
        
        # Call the actual implementation
        return self._extract_entities_impl(text, entity_types)
    
    def extract_entities_batch(self, texts: List[str], entity_types: Optional[List[str]] = None) -> List[List[EntitySpan]]:
        """Batch entity extraction - default implementation."""
        results = []
        for text in texts:
            entities = self.extract_entities(text, entity_types)
            results.append(entities)
        return results
    
    def get_supported_entity_types(self) -> List[str]:
        """Get list of supported entity types - override if known."""
        return ["PER", "ORG", "LOC", "MISC"]  # Common default
    
    def extract_entities_streaming(self, texts: Iterator[str], **kwargs) -> Iterator[List[EntitySpan]]:
        """Stream processing for large datasets."""
        for text in texts:
            yield self.extract_entities(text, **kwargs)
    
    def get_processing_stats(self) -> ProcessingStats:
        """Get processing statistics."""
        return self._stats
    
    def short_format(self, entities: List[EntitySpan]) -> List[Dict[str, Any]]:
        """Convert entities to short format."""
        return [
            {
                "t": entity.text,
                "l": entity.labels[0] if entity.labels else "UNK",
                "s": entity.start_pos,
                "e": entity.end_pos,
                "c": entity.confidence
            }
            for entity in entities
        ]


class TokenizationModel(BaseModel):
    """Base class for tokenization models."""
    
    @abstractmethod
    def tokenize(self, text: str) -> List[Token]:
        """Tokenize text into tokens."""
        pass
    
    def tokenize_batch(self, texts: List[str]) -> List[List[Token]]:
        """Tokenize a batch of texts."""
        return [self.tokenize(text) for text in texts]


class EmbeddingsModel(BaseModel):
    """Base class for text embedding models."""
    
    @abstractmethod
    def embed_text(self, text: str) -> Optional[np.ndarray]:
        """Generate embeddings for a single text."""
        pass
    
    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[Optional[np.ndarray]]:
        """Generate embeddings for a batch of texts."""
        pass
    
    @abstractmethod
    def get_dimension(self) -> int:
        """Get the dimensionality of embeddings."""
        pass


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