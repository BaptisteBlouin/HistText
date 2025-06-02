# Update toolkit/histtext_toolkit/models/ner_registry.py

from typing import Dict, Type, Optional
from ..core.config import ModelConfig
from ..core.logging import get_logger
from .ner_base import BaseNERModel

logger = get_logger(__name__)

# Model registry
_MODEL_REGISTRY: Dict[str, Type[BaseNERModel]] = {}


def register_model(model_type: str, model_class: Type[BaseNERModel]):
    """Register a model type."""
    _MODEL_REGISTRY[model_type.lower()] = model_class


def create_ner_model(config: ModelConfig) -> Optional[BaseNERModel]:
    """Create NER model from configuration."""
    model_type = config.type.lower()
    model_path = config.path.lower()
    
    # Special handling for NuNer Zero (it's actually GLiNER)
    if "nunerzero" in model_path or "nuner_zero" in model_path or "nunerzero" in model_type:
        logger.info("Detected NuNer Zero - using GLiNER implementation")
        model_type = "gliner"
    
    # Try to load model classes dynamically
    if model_type not in _MODEL_REGISTRY:
        _load_model_classes()
    
    if model_type not in _MODEL_REGISTRY:
        logger.error(f"Unknown model type: {model_type}")
        logger.info(f"Available types: {list(_MODEL_REGISTRY.keys())}")
        return None
    
    model_class = _MODEL_REGISTRY[model_type]
    
    # Build kwargs
    kwargs = {"model_name": config.path}
    
    if hasattr(config, "max_length") and config.max_length:
        kwargs["max_length"] = config.max_length
    
    if hasattr(config, "aggregation_strategy") and config.aggregation_strategy:
        kwargs["aggregation_strategy"] = config.aggregation_strategy
    
    if config.additional_params:
        kwargs.update(config.additional_params)
    
    try:
        return model_class(**kwargs)
    except Exception as e:
        logger.error(f"Failed to create {model_type} model: {e}")
        return None


def _load_model_classes():
    """Load and register all available model classes."""
    
    # GLiNER models
    try:
        from .gliner_ner import GLiNERModel
        register_model("gliner", GLiNERModel)
        register_model("gliner_enhanced", GLiNERModel)
        register_model("nunerzero", GLiNERModel)  # NuNer Zero is GLiNER
        logger.debug("Registered GLiNER models")
    except ImportError:
        logger.debug("GLiNER not available")
    
    # LLM models
    try:
        from .llm_ner import LLMNERModel
        register_model("llm_ner", LLMNERModel)
        register_model("llama_ner", LLMNERModel)
        register_model("mistral_ner", LLMNERModel)
        register_model("qwen_ner", LLMNERModel)
        logger.debug("Registered LLM models")
    except ImportError:
        logger.debug("LLM models not available")
    
    # Transformers models
    try:
        from .transformers_ner import TransformersNERModel
        register_model("transformers", TransformersNERModel)
        register_model("nuner", TransformersNERModel)
        logger.debug("Registered Transformers models")
    except ImportError:
        logger.debug("Transformers models not available")
    
    # Flair models
    try:
        from .flair_ner import FlairNERModel
        register_model("flair", FlairNERModel)
        logger.debug("Registered Flair models")
    except ImportError:
        logger.debug("Flair models not available")
    
    # spaCy models
    try:
        from .spacy_ner import SpacyNERModel
        register_model("spacy", SpacyNERModel)
        logger.debug("Registered spaCy models")
    except ImportError:
        logger.debug("spaCy models not available")


def get_available_model_types() -> Dict[str, str]:
    """Get available model types."""
    _load_model_classes()
    return {model_type: model_class.__name__ for model_type, model_class in _MODEL_REGISTRY.items()}