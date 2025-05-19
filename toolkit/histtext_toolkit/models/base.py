"""Base model classes for NER, tokenization, and embeddings.

This module defines abstract base classes that all model implementations
must inherit from, ensuring a consistent interface across different backends.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

import numpy as np


class ModelType(Enum):
    """Enumeration of supported model types.

    Defines all the possible model types that can be used within the system.
    These values are used for model configuration and instantiation.
    """

    SPACY = "spacy"
    TRANSFORMERS = "transformers"
    GLINER = "gliner"
    CHINESE_SEGMENTER = "chinese_segmenter"
    FASTTEXT = "fasttext"
    WORD2VEC = "word2vec"
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    COLLECTION_ALIGNED = "collection_aligned"
    WORD_EMBEDDINGS = "word_embeddings"


class AggregationStrategy(Enum):
    """Enumeration of supported token aggregation strategies.

    Defines strategies for combining token-level information into entity-level
    information, particularly for transformer-based models.
    """

    NONE = "none"  # No aggregation
    SIMPLE = "simple"  # Simple concatenation
    FIRST = "first"  # Use first token
    MAX = "max"  # Use maximum value
    AVERAGE = "average"  # Use average value


@dataclass
class Entity:
    """Representation of a named entity.

    Stores information about an entity extracted from text, including its
    position, type, and confidence score.

    Attributes:
        text: The entity text
        labels: List of entity type labels
        start_pos: Starting character position in the original text
        end_pos: Ending character position in the original text
        confidence: Confidence score (-1.0 if not available)

    """

    text: str
    labels: list[str]
    start_pos: int
    end_pos: int
    confidence: float = -1.0


@dataclass
class Token:
    """Representation of a token.

    Stores information about a token extracted from text during tokenization,
    including its position and confidence score.

    Attributes:
        text: The token text
        start_pos: Starting character position in the original text
        end_pos: Ending character position in the original text
        confidence: Confidence score (-1.0 if not available)

    """

    text: str
    start_pos: int
    end_pos: int
    confidence: float = -1.0


@dataclass
class Embedding:
    """Representation of a word or text embedding.

    Stores a vector representation of text along with the original text
    and optional metadata.

    Attributes:
        text: The original text
        vector: The embedding vector as a numpy array
        metadata: Optional dictionary of additional information

    """

    text: str
    vector: np.ndarray
    metadata: Optional[dict[str, Any]] = None


class BaseModel(ABC):
    """Base class for all models.

    Defines the common interface that all model implementations must follow,
    including methods for loading and unloading the model.
    """

    @abstractmethod
    def load(self) -> bool:
        """Load the model into memory.

        Implementations should handle all resource allocation and initialization.

        Returns:
            bool: True if successful, False otherwise

        """
        pass

    @abstractmethod
    def unload(self) -> bool:
        """Unload the model from memory.

        Implementations should properly release all resources to prevent memory leaks.

        Returns:
            bool: True if successful, False otherwise

        """
        pass

    @property
    @abstractmethod
    def is_loaded(self) -> bool:
        """Check if the model is loaded.

        Returns:
            bool: True if the model is loaded, False otherwise

        """
        pass


class NERModel(BaseModel):
    """Base class for Named Entity Recognition models.

    Extends the BaseModel with methods specific to named entity recognition,
    including entity extraction and formatting.
    """

    @abstractmethod
    def extract_entities(self, text: str) -> list[Entity]:
        """Extract named entities from text.

        Implementations should process the input text and identify entities
        with their positions, types, and confidence scores.

        Args:
            text: Input text to analyze

        Returns:
            List[Entity]: List of extracted entities

        """
        pass

    def short_format(self, entities: list[Entity]) -> list[dict[str, Any]]:
        """Convert entities to a shortened format.

        Transforms Entity objects into dictionaries with short field names,
        suitable for efficient storage and transmission.

        Args:
            entities: List of Entity objects

        Returns:
            List[Dict[str, Any]]: Entities with fields renamed to:
                t (text), l (labels), s (start), e (end), c (confidence)

        """
        return [
            {
                "t": entity.text,
                "l": entity.labels,
                "s": entity.start_pos,
                "e": entity.end_pos,
                "c": entity.confidence,
            }
            for entity in entities
        ]


class TokenizationModel(BaseModel):
    """Base class for tokenization models.

    Extends the BaseModel with methods specific to text tokenization,
    defining the interface for breaking text into tokens.
    """

    @abstractmethod
    def tokenize(self, text: str) -> list[Token]:
        """Tokenize text.

        Implementations should process the input text and break it into tokens
        with their positions and optional confidence scores.

        Args:
            text: Input text to tokenize

        Returns:
            List[Token]: List of extracted tokens

        """
        pass


class EmbeddingsModel(BaseModel):
    """Base class for text embedding models.

    Extends the BaseModel with methods for generating vector representations
    of text, including single and batch processing capabilities.
    """

    @abstractmethod
    def embed_text(self, text: str) -> Optional[np.ndarray]:
        """Generate embeddings for a single text.

        Implementations should convert the input text into a numerical vector
        representation using the underlying embedding model.

        Args:
            text: Input text to embed

        Returns:
            Optional[np.ndarray]: Embedding vector or None if failed

        """
        pass

    @abstractmethod
    def embed_batch(self, texts: list[str]) -> list[Optional[np.ndarray]]:
        """Generate embeddings for a batch of texts.

        Implementations should efficiently process multiple texts at once,
        taking advantage of batching optimizations when available.

        Args:
            texts: List of texts to embed

        Returns:
            List[Optional[np.ndarray]]: List of embedding vectors, with None for any failures

        """
        pass

    @abstractmethod
    def get_dimension(self) -> int:
        """Get the dimensionality of the embedding vectors.

        Returns:
            int: Dimension of embedding vectors

        """
        pass

    def save_embeddings(
        self,
        embeddings: list[tuple[str, np.ndarray]],
        output_path: str,
        format: str = "vec",
    ) -> bool:
        """Save embeddings to a file.

        Writes embedding vectors to a file in the specified format,
        supporting common embedding formats.

        Args:
            embeddings: List of (text, vector) tuples
            output_path: Path to save the embeddings
            format: Format to save in ('vec', 'txt', 'binary')

        Returns:
            bool: True if successful, False otherwise

        Raises:
            ValueError: If an unsupported format is specified

        """
        if not embeddings:
            return False

        try:
            if format.lower() == "vec":
                # FastText .vec format
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(f"{len(embeddings)} {self.get_dimension()}\n")
                    for text, vector in embeddings:
                        vector_str = " ".join(map(str, vector.tolist()))
                        f.write(f"{text} {vector_str}\n")
            elif format.lower() == "txt":
                # Word2Vec text format
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(f"{len(embeddings)} {self.get_dimension()}\n")
                    for text, vector in embeddings:
                        vector_str = " ".join(map(str, vector.tolist()))
                        f.write(f"{text} {vector_str}\n")
            elif format.lower() == "binary":
                # Numpy binary format
                texts = [text for text, _ in embeddings]
                vectors = np.array([vector for _, vector in embeddings])
                np.savez(output_path, texts=texts, vectors=vectors)
            else:
                raise ValueError(f"Unsupported format: {format}")

            return True
        except Exception as e:
            # Use logger instead of print for consistency
            from ..core.logging import get_logger

            logger = get_logger(__name__)
            logger.error(f"Error saving embeddings: {e}")
            return False
