# toolkit/histtext_toolkit/models/ner_base.py
"""Compatibility layer for ner_base imports."""

# Import everything from base for backward compatibility
from .base import (
    BaseModel,
    NERModel,
    EntitySpan,
    ProcessingStats,
    GPUMemoryManager,
    Entity,  # Backward compatibility alias
)

# Re-export with old names for backward compatibility
BaseNERModel = NERModel

# Import logger
from ..core.logging import get_logger
logger = get_logger(__name__)

# Re-export everything that was in the old ner_base
__all__ = [
    'BaseNERModel',
    'NERModel', 
    'BaseModel',
    'EntitySpan',
    'Entity',
    'ProcessingStats',
    'GPUMemoryManager',
    'logger'
]