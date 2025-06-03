"""Unified model registry for all model types."""

from typing import Dict, Type, Optional, Any
from ..core.config import ModelConfig
from ..core.logging import get_logger
from .base import EmbeddingsModel, ModelType, NERModel, TokenizationModel

logger = get_logger(__name__)

# Model registries for different tasks
_NER_REGISTRY: Dict[str, Type[NERModel]] = {}
_TOKENIZATION_REGISTRY: Dict[str, Type[TokenizationModel]] = {}
_EMBEDDINGS_REGISTRY: Dict[str, Type[EmbeddingsModel]] = {}


def register_ner_model(model_type: str, model_class: Type[NERModel]):
    """Register a NER model type."""
    _NER_REGISTRY[model_type.lower()] = model_class
    logger.debug(f"Registered NER model: {model_type}")


def register_tokenization_model(model_type: str, model_class: Type[TokenizationModel]):
    """Register a tokenization model type."""
    _TOKENIZATION_REGISTRY[model_type.lower()] = model_class
    logger.debug(f"Registered tokenization model: {model_type}")


def register_embeddings_model(model_type: str, model_class: Type[EmbeddingsModel]):
    """Register an embeddings model type."""
    _EMBEDDINGS_REGISTRY[model_type.lower()] = model_class
    logger.debug(f"Registered embeddings model: {model_type}")


def _load_all_models():
    """Load and register all available model classes."""
    
    # === NER MODELS ===
    
    # Transformers models - Load first as it's most common
    try:
        from .transformers_ner import TransformersNERModel
        
        # Create a wrapper for the enhanced model to match expected interface
        class BasicTransformersNERModel(TransformersNERModel):
            def __init__(self, model_name: str, **kwargs):
                super().__init__(
                    model_name=model_name,
                    aggregation_strategy=kwargs.get('aggregation_strategy', 'simple'),
                    max_length=kwargs.get('max_length', 512),
                    domain='general',
                    enable_pattern_enhancement=False,
                    enable_historical_processing=False,
                    auto_detect_language=False,
                    force_pattern_only=False,
                    **kwargs
                )
        
        register_ner_model("transformers", BasicTransformersNERModel)
        register_ner_model("nuner", BasicTransformersNERModel)
        register_ner_model("bert", BasicTransformersNERModel)
        
        # Enhanced versions
        class MultilingualNERModel(TransformersNERModel):
            def __init__(self, model_name: str, **kwargs):
                super().__init__(
                    model_name=model_name,
                    domain='general',
                    enable_pattern_enhancement=True,
                    auto_detect_language=True,
                    **kwargs
                )
        
        class HistoricalNERModel(TransformersNERModel):
            def __init__(self, model_name: str, **kwargs):
                super().__init__(
                    model_name=model_name,
                    domain='historical',
                    enable_pattern_enhancement=True,
                    enable_historical_processing=True,
                    auto_detect_language=True,
                    **kwargs
                )
        
        register_ner_model("multilingual", MultilingualNERModel)
        register_ner_model("historical", HistoricalNERModel)
        
    except ImportError as e:
        logger.debug(f"Transformers models not available: {e}")
    
    # GLiNER models
    try:
        from .gliner_ner import GLiNERModel
        register_ner_model("gliner", GLiNERModel)
        register_ner_model("gliner_enhanced", GLiNERModel)
        register_ner_model("nunerzero", GLiNERModel)
    except ImportError:
        logger.debug("GLiNER not available")
    
    # spaCy models
    try:
        from .spacy_ner import SpacyNERModel
        register_ner_model("spacy", SpacyNERModel)
    except ImportError:
        logger.debug("spaCy models not available")
    
    # Flair models
    try:
        from .flair_ner import FlairNERModel
        register_ner_model("flair", FlairNERModel)
    except ImportError:
        logger.debug("Flair models not available")
    
    # Stanza models
    try:
        from .stanza_ner import StanzaNERModel, ChineseStanzaNERModel
        register_ner_model("stanza", StanzaNERModel)
        register_ner_model("stanza_zh", ChineseStanzaNERModel)
    except ImportError:
        logger.debug("Stanza models not available")
    
    # LLM models
    try:
        from .llm_ner import LLMNERModel
        register_ner_model("llm_ner", LLMNERModel)
        register_ner_model("llama_ner", LLMNERModel)
        register_ner_model("mistral_ner", LLMNERModel)
        register_ner_model("qwen_ner", LLMNERModel)
    except ImportError:
        logger.debug("LLM models not available")
    
    # AllenNLP models
    try:
        from .allennlp_ner import AllenNLPNERModel
        register_ner_model("allennlp", AllenNLPNERModel)
    except ImportError:
        logger.debug("AllenNLP models not available")
    
    # Chinese models
    try:
        from .chinese_ner import LAC_NERModel, HanLP_NERModel, PKUSEG_NERModel
        register_ner_model("lac", LAC_NERModel)
        register_ner_model("hanlp", HanLP_NERModel)
        register_ner_model("pkuseg", PKUSEG_NERModel)
    except ImportError:
        logger.debug("Chinese NER models not available")
    
    try:
        from .fastnlp_ner import FastNLPNERModel, ChineseFastNLPModel
        register_ner_model("fastnlp", FastNLPNERModel)
        register_ner_model("fastnlp_zh", ChineseFastNLPModel)
    except ImportError:
        logger.debug("FastNLP models not available")
    
    try:
        from .fasthan_ner import (
            FastHanNERModel, FastHanBaseModel, 
            FastHanLargeModel, FastHanSmallModel
        )
        register_ner_model("fasthan", FastHanNERModel)
        register_ner_model("fasthan_base", FastHanBaseModel)
        register_ner_model("fasthan_large", FastHanLargeModel)
        register_ner_model("fasthan_small", FastHanSmallModel)
    except ImportError:
        logger.debug("FastHan models not available")
    
    # === TOKENIZATION MODELS ===
    
    try:
        from .spacy_model import SpacyTokenizationModel
        register_tokenization_model("spacy", SpacyTokenizationModel)
    except ImportError:
        logger.debug("spaCy tokenization not available")
    
    try:
        from .transformers_model import TransformersTokenizationModel
        register_tokenization_model("transformers", TransformersTokenizationModel)
    except ImportError:
        logger.debug("Transformers tokenization not available")
    
    try:
        from .chinese_segmenter import ChineseSegmenterModel
        register_tokenization_model("chinese_segmenter", ChineseSegmenterModel)
    except ImportError:
        logger.debug("Chinese segmenter not available")
    
    # === EMBEDDINGS MODELS ===
    
    try:
        from .fasttext_model import (
            FastTextEmbeddingsModel,
            SentenceTransformersEmbeddingsModel,
            Word2VecEmbeddingsModel,
        )
        register_embeddings_model("fasttext", FastTextEmbeddingsModel)
        register_embeddings_model("word2vec", Word2VecEmbeddingsModel)
        register_embeddings_model("sentence_transformers", SentenceTransformersEmbeddingsModel)
    except ImportError:
        logger.debug("FastText models not available")
    
    try:
        from .word_embeddings_model import CollectionWordEmbeddingsModel
        register_embeddings_model("word_embeddings", CollectionWordEmbeddingsModel)
    except ImportError:
        logger.debug("Word embeddings not available")


def create_ner_model(config: ModelConfig) -> Optional[NERModel]:
    """Create a NER model based on configuration."""
    model_type = config.type.lower()
    
    # Load models if not already loaded
    if model_type not in _NER_REGISTRY:
        _load_all_models()
    
    if model_type not in _NER_REGISTRY:
        logger.error(f"Unknown NER model type: {model_type}")
        logger.info(f"Available NER types: {list(_NER_REGISTRY.keys())}")
        return None
    
    model_class = _NER_REGISTRY[model_type]
    
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


def create_tokenization_model(config: ModelConfig) -> Optional[TokenizationModel]:
    """Create a tokenization model based on configuration."""
    model_type = config.type.lower()
    
    if model_type not in _TOKENIZATION_REGISTRY:
        _load_all_models()
    
    if model_type not in _TOKENIZATION_REGISTRY:
        logger.error(f"Unknown tokenization model type: {model_type}")
        logger.info(f"Available tokenization types: {list(_TOKENIZATION_REGISTRY.keys())}")
        return None
    
    model_class = _TOKENIZATION_REGISTRY[model_type]
    
    kwargs = {"model_path": config.path}
    if config.max_length is not None:
        kwargs["max_length"] = config.max_length
    if config.additional_params:
        kwargs.update(config.additional_params)
    
    try:
        return model_class(**kwargs)
    except Exception as e:
        logger.error(f"Failed to create {model_type} tokenization model: {e}")
        return None


def create_embeddings_model(config: ModelConfig) -> Optional[EmbeddingsModel]:
    """Create an embeddings model based on configuration."""
    model_type = config.type.lower()
    
    if model_type not in _EMBEDDINGS_REGISTRY:
        _load_all_models()
    
    if model_type not in _EMBEDDINGS_REGISTRY:
        logger.error(f"Unknown embeddings model type: {model_type}")
        logger.info(f"Available embeddings types: {list(_EMBEDDINGS_REGISTRY.keys())}")
        return None
    
    model_class = _EMBEDDINGS_REGISTRY[model_type]
    
    # Special handling for word embeddings model
    if model_type == "word_embeddings":
        return model_class(
            method=config.additional_params.get("method", "word2vec"),
            dim=config.additional_params.get("dim", 100),
            window=config.additional_params.get("window", 5),
            min_count=config.additional_params.get("min_count", 5),
            workers=config.additional_params.get("workers", 4),
        )
    
    kwargs = {"model_path": config.path}
    if config.max_length is not None:
        kwargs["max_length"] = config.max_length
    if hasattr(config, "dim") and config.dim is not None:
        kwargs["dim"] = config.dim
    if model_type == "word2vec" and hasattr(config, "binary"):
        kwargs["binary"] = config.binary
    if model_type == "fasttext" and hasattr(config, "use_precomputed"):
        kwargs["use_precomputed"] = config.use_precomputed
    if config.additional_params:
        kwargs.update(config.additional_params)
    
    try:
        return model_class(**kwargs)
    except Exception as e:
        logger.error(f"Failed to create {model_type} embeddings model: {e}")
        return None


def get_available_model_types() -> Dict[str, list]:
    """Get all available model types and their supported tasks."""
    _load_all_models()
    
    available = {}
    
    # Add NER models
    for model_type in _NER_REGISTRY.keys():
        if model_type not in available:
            available[model_type] = []
        available[model_type].append("ner")
    
    # Add tokenization models
    for model_type in _TOKENIZATION_REGISTRY.keys():
        if model_type not in available:
            available[model_type] = []
        available[model_type].append("tokenization")
    
    # Add embeddings models
    for model_type in _EMBEDDINGS_REGISTRY.keys():
        if model_type not in available:
            available[model_type] = []
        available[model_type].append("embeddings")
    
    return available