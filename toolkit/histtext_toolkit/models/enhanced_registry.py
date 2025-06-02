# toolkit/histtext_toolkit/models/enhanced_registry.py (Fixed version)
"""Enhanced model registry for modern NER implementations."""

import logging
from typing import Dict, List, Optional, Type, Any
from dataclasses import dataclass

from ..core.config import ModelConfig
from ..core.logging import get_logger
from .base import EnhancedNERModel, ProcessingMode

logger = get_logger(__name__)

# Conditional imports for enhanced models
try:
    from .modern_ner import (
        NuNERModel, FlairNERModel, EnhancedGLiNERModel, LLMNERModel
    )
    MODERN_NER_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Modern NER models not available: {e}")
    MODERN_NER_AVAILABLE = False

try:
    from .universal_transformers import UniversalTransformersNERModel
    UNIVERSAL_TRANSFORMERS_AVAILABLE = True
except ImportError:
    UNIVERSAL_TRANSFORMERS_AVAILABLE = False
    logger.warning("Universal transformers NER not available")


@dataclass
class ModelInfo:
    """Information about available models."""
    model_class: Type[EnhancedNERModel]
    supported_entity_types: List[str]
    max_sequence_length: int = 512
    supports_zero_shot: bool = False
    supports_long_documents: bool = False
    requires_gpu: bool = False


class EnhancedModelRegistry:
    """Registry for enhanced NER models with modern capabilities."""
    
    # Model type mappings
    MODEL_REGISTRY: Dict[str, ModelInfo] = {}
    
    @classmethod
    def register_models(cls):
        """Register all available enhanced models."""
        if MODERN_NER_AVAILABLE:
            # NuNER models
            cls.MODEL_REGISTRY["nuner"] = ModelInfo(
                model_class=NuNERModel,
                supported_entity_types=[
                    "Person", "Organization", "Location", "Miscellaneous",
                    "Date", "Time", "Money", "Percent", "Product", "Event"
                ],
                max_sequence_length=512,
                supports_zero_shot=True,
                supports_long_documents=True,
                requires_gpu=True
            )
            
            # Flair models
            cls.MODEL_REGISTRY["flair"] = ModelInfo(
                model_class=FlairNERModel,
                supported_entity_types=["PER", "LOC", "ORG", "MISC"],
                max_sequence_length=1000,
                supports_zero_shot=False,
                supports_long_documents=True,
                requires_gpu=False
            )
            
            # Enhanced GLiNER - Fix the registration
            cls.MODEL_REGISTRY["gliner_enhanced"] = ModelInfo(
                model_class=EnhancedGLiNERModel,
                supported_entity_types=["Any entity type"],
                max_sequence_length=384,
                supports_zero_shot=True,
                supports_long_documents=True,
                requires_gpu=True
            )
            
            # Also register as "gliner" for backward compatibility
            cls.MODEL_REGISTRY["gliner"] = ModelInfo(
                model_class=EnhancedGLiNERModel,
                supported_entity_types=["Any entity type"],
                max_sequence_length=384,
                supports_zero_shot=True,
                supports_long_documents=True,
                requires_gpu=True
            )
            
            # LLM-based NER
            cls.MODEL_REGISTRY["llm_ner"] = ModelInfo(
                model_class=LLMNERModel,
                supported_entity_types=["Any entity type"],
                max_sequence_length=4096,
                supports_zero_shot=True,
                supports_long_documents=True,
                requires_gpu=True
            )
        
        if UNIVERSAL_TRANSFORMERS_AVAILABLE:
            # Universal transformers
            cls.MODEL_REGISTRY["universal_transformers"] = ModelInfo(
                model_class=UniversalTransformersNERModel,
                supported_entity_types=["Any entity type"],
                max_sequence_length=512,
                supports_zero_shot=False,
                supports_long_documents=True,
                requires_gpu=True
            )
    
    @classmethod
    def create_enhanced_ner_model(
        cls, 
        config: ModelConfig, 
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        optimization_level: int = 1
    ) -> EnhancedNERModel:
        """Create an enhanced NER model from configuration."""
        
        # Register models if not already done
        if not cls.MODEL_REGISTRY:
            cls.register_models()
        
        model_type = config.type.lower()
        
        if model_type not in cls.MODEL_REGISTRY:
            raise ValueError(f"Model type '{model_type}' not available in enhanced registry")
        
        model_info = cls.MODEL_REGISTRY[model_type]
        model_class = model_info.model_class
        
        # Prepare model arguments - remove problematic kwargs
        kwargs = {
            "model_name": config.path,
            "processing_mode": processing_mode
        }
        
        # Add model-specific parameters
        if hasattr(config, "max_length") and config.max_length:
            kwargs["max_length"] = config.max_length
        
        # Add additional parameters from config
        if config.additional_params:
            filtered_params = {k: v for k, v in config.additional_params.items() 
                             if k not in ['use_enhanced']}  # Remove problematic params
            kwargs.update(filtered_params)
        
        return model_class(**kwargs)
    
    @classmethod
    def get_available_models(cls) -> Dict[str, ModelInfo]:
        """Get all available enhanced models."""
        if not cls.MODEL_REGISTRY:
            cls.register_models()
        return cls.MODEL_REGISTRY.copy()
    
    @classmethod
    def get_model_info(cls, model_type: str) -> Optional[ModelInfo]:
        """Get information about a specific model type."""
        if not cls.MODEL_REGISTRY:
            cls.register_models()
        return cls.MODEL_REGISTRY.get(model_type.lower())


# Convenience function
def create_enhanced_ner_model(
    config: ModelConfig, 
    processing_mode: ProcessingMode = ProcessingMode.BATCH,
    optimization_level: int = 1
) -> EnhancedNERModel:
    """Create an enhanced NER model from configuration."""
    return EnhancedModelRegistry.create_enhanced_ner_model(
        config, processing_mode, optimization_level
    )