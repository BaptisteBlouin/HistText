# toolkit/histtext_toolkit/models/ner_base.py
"""Base NER model interfaces and common functionality."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
import time
import logging
from .ner_labels import get_compact_label, get_full_label


logger = logging.getLogger(__name__)

@dataclass
class EntitySpan:
    """Represents a named entity with position and metadata."""
    text: str
    labels: List[str]
    start_pos: int
    end_pos: int
    confidence: float = 0.0
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

    def to_compact_dict(self) -> Dict[str, Any]:
        """Convert to compact format."""
        return self.to_flat_dict(use_compact_labels=True)

    @classmethod
    def from_compact_dict(cls, data: Dict[str, Any]) -> 'EntitySpan':
        """Create EntitySpan from compact dictionary."""
        full_label = get_full_label(data.get('l', 'MI'))
        
        return cls(
            text=data.get('t', ''),
            labels=[full_label],
            start_pos=data.get('s', 0),
            end_pos=data.get('e', 0),
            confidence=data.get('c', 0.0)
        )


@dataclass
class ProcessingStats:
    """Statistics for processing performance."""
    total_texts: int = 0
    total_entities: int = 0
    processing_time: float = 0.0
    memory_usage: Optional[float] = None
    error_count: int = 0


class BaseNERModel(ABC):
    """Base class for all NER models."""
    
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
    
    @abstractmethod
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities from text."""
        pass
    
    def extract_entities_batch(self, texts: List[str], entity_types: Optional[List[str]] = None) -> List[List[EntitySpan]]:
        """Default batch processing - override for better performance."""
        results = []
        for text in texts:
            entities = self.extract_entities(text, entity_types)
            results.append(entities)
        return results
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types."""
        return ["PER", "ORG", "LOC", "MISC"]
    
    def get_stats(self) -> ProcessingStats:
        """Get processing statistics."""
        return self._stats


class GPUMemoryManager:
    """Simple GPU memory management."""
    
    @staticmethod
    def clear_cache():
        """Clear GPU cache if available."""
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
    
    @staticmethod
    def get_memory_info() -> Dict[str, float]:
        """Get GPU memory info."""
        try:
            import torch
            if torch.cuda.is_available():
                device = torch.cuda.current_device()
                total = torch.cuda.get_device_properties(device).total_memory / (1024**3)
                allocated = torch.cuda.memory_allocated(device) / (1024**3)
                return {"total": total, "allocated": allocated}
        except ImportError:
            pass
        return {}