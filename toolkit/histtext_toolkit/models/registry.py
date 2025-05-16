"""Model registry for easy access to all supported models.

This module provides a central registry for all model implementations,
making it easy to instantiate the right model based on configuration.
"""


from ..core.config import ModelConfig
from ..core.logging import get_logger
from .base import EmbeddingsModel, ModelType, NERModel, TokenizationModel
from .spacy_model import SpacyNERModel, SpacyTokenizationModel
from .transformers_model import TransformersNERModel, TransformersTokenizationModel

logger = get_logger(__name__)

# Import GLiNER support if available
try:
    from .gliner_model import GLINER_AVAILABLE, GLiNERModel
except ImportError:
    GLINER_AVAILABLE = False
    logger.warning("GLiNER support not available")

# Import ChineseWordSegmenter support if available
try:
    from .chinese_segmenter import CWSEG_AVAILABLE, ChineseSegmenterModel
except ImportError:
    CWSEG_AVAILABLE = False
    logger.warning("ChineseWordSegmenter support not available")

# Import embedding models if available
try:
    from .fasttext_model import (
        FASTTEXT_AVAILABLE,
        FastTextEmbeddingsModel,
        SentenceTransformersEmbeddingsModel,
        Word2VecEmbeddingsModel,
    )
except ImportError:
    FASTTEXT_AVAILABLE = False
    logger.warning("FastText support not available")

# Import word embeddings model if available
try:
    from .word_embeddings_model import CollectionWordEmbeddingsModel

    WORD_EMBEDDINGS_AVAILABLE = True
except ImportError:
    WORD_EMBEDDINGS_AVAILABLE = False
    logger.warning("Word embeddings support not available")


class ModelRegistry:
    """Registry for all model implementations.

    This class provides a centralized registry of all available model implementations
    and factory methods to create model instances based on configuration.

    Attributes:
        NER_IMPLEMENTATIONS: Mapping of model types to NER model implementations
        TOKENIZATION_IMPLEMENTATIONS: Mapping of model types to tokenization model implementations
        EMBEDDINGS_IMPLEMENTATIONS: Mapping of model types to embedding model implementations

    """

    # Map of model types to their implementations
    NER_IMPLEMENTATIONS = {
        ModelType.SPACY: SpacyNERModel,
        ModelType.TRANSFORMERS: TransformersNERModel,
    }

    TOKENIZATION_IMPLEMENTATIONS = {
        ModelType.SPACY: SpacyTokenizationModel,
        ModelType.TRANSFORMERS: TransformersTokenizationModel,
    }

    EMBEDDINGS_IMPLEMENTATIONS = {}

    # Add ChineseWordSegmenter if available
    if CWSEG_AVAILABLE:
        TOKENIZATION_IMPLEMENTATIONS[ModelType.CHINESE_SEGMENTER] = ChineseSegmenterModel

    # Add GLiNER if available
    if GLINER_AVAILABLE:
        NER_IMPLEMENTATIONS[ModelType.GLINER] = GLiNERModel

    # Add embedding models if available
    if FASTTEXT_AVAILABLE:
        EMBEDDINGS_IMPLEMENTATIONS[ModelType.FASTTEXT] = FastTextEmbeddingsModel
        EMBEDDINGS_IMPLEMENTATIONS[ModelType.WORD2VEC] = Word2VecEmbeddingsModel
        EMBEDDINGS_IMPLEMENTATIONS[ModelType.SENTENCE_TRANSFORMERS] = SentenceTransformersEmbeddingsModel

    # Add word embeddings model if available
    if WORD_EMBEDDINGS_AVAILABLE:
        EMBEDDINGS_IMPLEMENTATIONS[ModelType.WORD_EMBEDDINGS] = CollectionWordEmbeddingsModel

    @classmethod
    def create_ner_model(cls, config: ModelConfig) -> NERModel:
        """Create a NER model based on the provided configuration.

        Args:
            config: Model configuration with type, path and parameters.

        Returns:
            NERModel: The instantiated model instance.

        Raises:
            ValueError: If the model type is not supported or no implementation is available.

        """
        try:
            model_type = ModelType(config.type.lower())
        except ValueError as e:
            raise ValueError(f"Unsupported model type: {config.type}") from e

        if model_type not in cls.NER_IMPLEMENTATIONS:
            raise ValueError(f"No NER implementation available for model type: {model_type.value}")

        model_class = cls.NER_IMPLEMENTATIONS[model_type]

        # Build kwargs based on config
        kwargs = {"model_path": config.path}

        # Add optional parameters if they exist in config
        if config.max_length is not None:
            kwargs["max_length"] = config.max_length

        if hasattr(model_class, "aggregation_strategy") and config.aggregation_strategy:
            kwargs["aggregation_strategy"] = config.aggregation_strategy

        # Add any additional parameters
        if config.additional_params:
            kwargs.update(config.additional_params)

        # Create the model instance
        return model_class(**kwargs)

    @classmethod
    def create_tokenization_model(cls, config: ModelConfig) -> TokenizationModel:
        """Create a tokenization model based on the provided configuration.

        Args:
            config: Model configuration with type, path and parameters.

        Returns:
            TokenizationModel: The instantiated model instance.

        Raises:
            ValueError: If the model type is not supported or no implementation is available.

        """
        try:
            model_type = ModelType(config.type.lower())
        except ValueError as e:
            raise ValueError(f"Unsupported model type: {config.type}") from e

        if model_type not in cls.TOKENIZATION_IMPLEMENTATIONS:
            raise ValueError(f"No tokenization implementation available for model type: {model_type.value}")

        model_class = cls.TOKENIZATION_IMPLEMENTATIONS[model_type]

        # Build kwargs based on config
        kwargs = {"model_path": config.path}

        # Add optional parameters if they exist in config
        if config.max_length is not None:
            kwargs["max_length"] = config.max_length

        # Add any additional parameters
        if config.additional_params:
            kwargs.update(config.additional_params)

        # Create the model instance
        return model_class(**kwargs)

    @classmethod
    def create_embeddings_model(cls, config: ModelConfig) -> EmbeddingsModel:
        """Create an embeddings model based on the provided configuration.

        Args:
            config: Model configuration with type, path and parameters.

        Returns:
            EmbeddingsModel: The instantiated model instance.

        Raises:
            ValueError: If the model type is not supported or no implementation is available.

        """
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

        # Add optional parameters if they exist in config
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

        # Create the model instance
        return model_class(**kwargs)

    @classmethod
    def get_available_model_types(cls) -> dict[str, list]:
        """Get all available model types and their supported tasks.

        Returns:
            Dict[str, list]: Dictionary mapping model types to supported tasks.
                             Each value is a list of tasks the model type supports
                             (e.g., ["ner", "tokenization"]).

        """
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


# Convenience functions
def create_ner_model(config: ModelConfig) -> NERModel:
    """Create a NER model based on the provided configuration.

    This is a convenience function that delegates to :meth:`ModelRegistry.create_ner_model`.

    Args:
        config: Model configuration.

    Returns:
        NERModel: The instantiated model.

    Raises:
        ValueError: If the model type is not supported.

    """
    return ModelRegistry.create_ner_model(config)


def create_tokenization_model(config: ModelConfig) -> TokenizationModel:
    """Create a tokenization model based on the provided configuration.

    This is a convenience function that delegates to :meth:`ModelRegistry.create_tokenization_model`.

    Args:
        config: Model configuration.

    Returns:
        TokenizationModel: The instantiated model.

    Raises:
        ValueError: If the model type is not supported.

    """
    return ModelRegistry.create_tokenization_model(config)


def create_embeddings_model(config: ModelConfig) -> EmbeddingsModel:
    """Create an embeddings model based on the provided configuration.

    This is a convenience function that delegates to :meth:`ModelRegistry.create_embeddings_model`.

    Args:
        config: Model configuration.

    Returns:
        EmbeddingsModel: The instantiated model.

    Raises:
        ValueError: If the model type is not supported.

    """
    return ModelRegistry.create_embeddings_model(config)


def get_available_model_types() -> dict[str, list]:
    """Get all available model types and their supported tasks.

    This is a convenience function that delegates to :meth:`ModelRegistry.get_available_model_types`.

    Returns:
        Dict[str, list]: Dictionary mapping model types to supported tasks.

    """
    return ModelRegistry.get_available_model_types()
