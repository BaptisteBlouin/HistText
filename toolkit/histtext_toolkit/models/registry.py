"""Unified model registry for all model types."""

from ..core.config import ModelConfig
from ..core.logging import get_logger
from .base import EmbeddingsModel, ModelType, NERModel, TokenizationModel
from .unified_ner import UnifiedNERModel

logger = get_logger(__name__)

# Import other models with fallbacks
try:
    from .spacy_model import SpacyNERModel, SpacyTokenizationModel
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    logger.debug("SpaCy not available")

try:
    from .transformers_model import TransformersTokenizationModel
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger.debug("Transformers not available")

try:
    from .chinese_segmenter import ChineseSegmenterModel
    CWSEG_AVAILABLE = True
except ImportError:
    CWSEG_AVAILABLE = False
    logger.debug("Chinese segmenter not available")

try:
    from .fasttext_model import (
        FastTextEmbeddingsModel,
        SentenceTransformersEmbeddingsModel,
        Word2VecEmbeddingsModel,
    )
    FASTTEXT_AVAILABLE = True
except ImportError:
    FASTTEXT_AVAILABLE = False
    logger.debug("FastText models not available")

try:
    from .word_embeddings_model import CollectionWordEmbeddingsModel
    WORD_EMBEDDINGS_AVAILABLE = True
except ImportError:
    WORD_EMBEDDINGS_AVAILABLE = False
    logger.debug("Word embeddings not available")


class UnifiedModelRegistry:
    """Unified registry for all model implementations."""

    # NER implementations - UnifiedNERModel handles all types
    NER_IMPLEMENTATIONS = {
        # All NER model types use UnifiedNERModel
        ModelType.TRANSFORMERS: UnifiedNERModel,
        ModelType.GLINER: UnifiedNERModel,
        ModelType.NUNER: UnifiedNERModel,
        ModelType.FLAIR: UnifiedNERModel,
        ModelType.STANZA: UnifiedNERModel,
        ModelType.ALLENNLP: UnifiedNERModel,
        ModelType.UNIVERSAL_TRANSFORMERS: UnifiedNERModel,
        ModelType.LLM_NER: UnifiedNERModel,
        ModelType.LLAMA_NER: UnifiedNERModel,
        ModelType.MISTRAL_NER: UnifiedNERModel,
        ModelType.QWEN_NER: UnifiedNERModel,
        ModelType.GLINER_ENHANCED: UnifiedNERModel,
        ModelType.GLINER_BIO: UnifiedNERModel,
        ModelType.GLINER_NEWS: UnifiedNERModel,
        ModelType.GLINER_MULTI: UnifiedNERModel,
    }

    TOKENIZATION_IMPLEMENTATIONS = {}
    EMBEDDINGS_IMPLEMENTATIONS = {}

    # Add spaCy if available (kept for tokenization)
    if SPACY_AVAILABLE:
        NER_IMPLEMENTATIONS[ModelType.SPACY] = SpacyNERModel
        TOKENIZATION_IMPLEMENTATIONS[ModelType.SPACY] = SpacyTokenizationModel

    # Add transformers tokenization if available
    if TRANSFORMERS_AVAILABLE:
        TOKENIZATION_IMPLEMENTATIONS[ModelType.TRANSFORMERS] = TransformersTokenizationModel

    # Add Chinese segmenter if available
    if CWSEG_AVAILABLE:
        TOKENIZATION_IMPLEMENTATIONS[ModelType.CHINESE_SEGMENTER] = ChineseSegmenterModel

    # Add embedding models if available
    if FASTTEXT_AVAILABLE:
        EMBEDDINGS_IMPLEMENTATIONS[ModelType.FASTTEXT] = FastTextEmbeddingsModel
        EMBEDDINGS_IMPLEMENTATIONS[ModelType.WORD2VEC] = Word2VecEmbeddingsModel
        EMBEDDINGS_IMPLEMENTATIONS[ModelType.SENTENCE_TRANSFORMERS] = SentenceTransformersEmbeddingsModel

    if WORD_EMBEDDINGS_AVAILABLE:
        EMBEDDINGS_IMPLEMENTATIONS[ModelType.WORD_EMBEDDINGS] = CollectionWordEmbeddingsModel

    @classmethod
    def create_ner_model(cls, config: ModelConfig) -> NERModel:
        """Create a unified NER model based on configuration."""
        try:
            model_type = ModelType(config.type.lower())
        except ValueError as e:
            raise ValueError(f"Unsupported model type: {config.type}") from e

        if model_type not in cls.NER_IMPLEMENTATIONS:
            raise ValueError(f"No NER implementation available for model type: {model_type.value}")

        model_class = cls.NER_IMPLEMENTATIONS[model_type]

        # Build kwargs for UnifiedNERModel
        kwargs = {
            "model_path": config.path,
            "model_type": config.type
        }

        # Add optional parameters
        if hasattr(config, "max_length") and config.max_length is not None:
            kwargs["max_length"] = config.max_length

        if hasattr(config, "aggregation_strategy") and config.aggregation_strategy:
            kwargs["aggregation_strategy"] = config.aggregation_strategy

        # Add any additional parameters
        if config.additional_params:
            # Filter out problematic parameters
            filtered_params = {
                k: v for k, v in config.additional_params.items() 
                if k not in ['use_enhanced']  # Remove legacy parameters
            }
            kwargs.update(filtered_params)

        # Special handling for legacy spaCy models
        if model_type == ModelType.SPACY and model_class != UnifiedNERModel:
            # Use legacy spaCy implementation
            return model_class(model_path=config.path)

        # Create unified model instance
        return model_class(**kwargs)

    @classmethod
    def create_tokenization_model(cls, config: ModelConfig) -> TokenizationModel:
        """Create a tokenization model based on configuration."""
        try:
            model_type = ModelType(config.type.lower())
        except ValueError as e:
            raise ValueError(f"Unsupported model type: {config.type}") from e

        if model_type not in cls.TOKENIZATION_IMPLEMENTATIONS:
            raise ValueError(f"No tokenization implementation available for model type: {model_type.value}")

        model_class = cls.TOKENIZATION_IMPLEMENTATIONS[model_type]

        # Build kwargs based on config
        kwargs = {"model_path": config.path}

        # Add optional parameters
        if config.max_length is not None:
            kwargs["max_length"] = config.max_length

        # Add any additional parameters
        if config.additional_params:
            kwargs.update(config.additional_params)

        return model_class(**kwargs)

    @classmethod
    def create_embeddings_model(cls, config: ModelConfig) -> EmbeddingsModel:
        """Create an embeddings model based on configuration."""
        try:
            model_type = ModelType(config.type.lower())
        except ValueError as e:
            raise ValueError(f"Unsupported model type: {config.type}") from e

        if model_type not in cls.EMBEDDINGS_IMPLEMENTATIONS:
            raise ValueError(f"No embeddings implementation available for model type: {model_type.value}")

        model_class = cls.EMBEDDINGS_IMPLEMENTATIONS[model_type]

        # Special handling for word embeddings model
        if model_type == ModelType.WORD_EMBEDDINGS:
            return model_class(
                method=config.additional_params.get("method", "word2vec"),
                dim=config.additional_params.get("dim", 100),
                window=config.additional_params.get("window", 5),
                min_count=config.additional_params.get("min_count", 5),
                workers=config.additional_params.get("workers", 4),
            )

        # Build kwargs based on config
        kwargs = {"model_path": config.path}

        # Add optional parameters
        if config.max_length is not None:
            kwargs["max_length"] = config.max_length

        # Add dimension if specified
        if hasattr(config, "dim") and config.dim is not None:
            kwargs["dim"] = config.dim

        # Add binary flag for Word2Vec models
        if model_type == ModelType.WORD2VEC and hasattr(config, "binary"):
            kwargs["binary"] = config.binary

        # Add use_precomputed flag for FastText models
        if model_type == ModelType.FASTTEXT and hasattr(config, "use_precomputed"):
            kwargs["use_precomputed"] = config.use_precomputed

        # Add any additional parameters
        if config.additional_params:
            kwargs.update(config.additional_params)

        return model_class(**kwargs)

    @classmethod
    def get_available_model_types(cls) -> dict[str, list]:
        """Get all available model types and their supported tasks."""
        available = {}

        for model_type in ModelType:
            tasks = []

            if model_type in cls.NER_IMPLEMENTATIONS:
                tasks.append("ner")

            if model_type in cls.TOKENIZATION_IMPLEMENTATIONS:
                tasks.append("tokenization")

            if model_type in cls.EMBEDDINGS_IMPLEMENTATIONS:
                tasks.append("embeddings")

            if tasks:
                available[model_type.value] = tasks

        return available


# Convenience functions for backward compatibility
def create_ner_model(config: ModelConfig) -> NERModel:
    """Create a NER model based on configuration."""
    return UnifiedModelRegistry.create_ner_model(config)


def create_tokenization_model(config: ModelConfig) -> TokenizationModel:
    """Create a tokenization model based on configuration."""
    return UnifiedModelRegistry.create_tokenization_model(config)


def create_embeddings_model(config: ModelConfig) -> EmbeddingsModel:
    """Create an embeddings model based on configuration."""
    return UnifiedModelRegistry.create_embeddings_model(config)


def get_available_model_types() -> dict[str, list]:
    """Get all available model types and their supported tasks."""
    return UnifiedModelRegistry.get_available_model_types()