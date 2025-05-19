"""Word embeddings model implementation.

This module provides an implementation of EmbeddingsModel for computing
word embeddings from text collections using methods like Word2Vec and FastText.
"""

import os
import traceback
from typing import Optional

import numpy as np

from ..core.logging import get_logger
from .base import EmbeddingsModel

logger = get_logger(__name__)


class CollectionWordEmbeddingsModel(EmbeddingsModel):
    """Model for computing word embeddings from a text collection.

    This model trains word embeddings directly from a collection of texts using
    various embedding algorithms like Word2Vec or FastText. Unlike other embedding
    models, this one learns from the specific corpus instead of using pre-trained models.

    Attributes:
        method (str): Word embedding method to use ('word2vec', 'fasttext').
        dim (int): Dimension of word embeddings.
        window (int): Context window size for training.
        min_count (int): Minimum word count to include in vocabulary.
        workers (int): Number of worker threads for training.
        _word_vectors: The trained word vectors (available after training).

    """

    def __init__(
        self,
        method: str = "word2vec",
        dim: int = 100,
        window: int = 5,
        min_count: int = 5,
        workers: int = 4,
    ):
        """Initialize the word embeddings model.

        Args:
            method: Word embedding method to use ('word2vec' or 'fasttext').
            dim: Dimension of word embeddings (vector size).
            window: Context window size for training.
            min_count: Minimum word count to include in vocabulary.
            workers: Number of worker threads for parallel training.

        """
        self.method = method
        self.dim = dim
        self.window = window
        self.min_count = min_count
        self.workers = workers
        self._model = None
        self.is_loaded_flag = False
        self._word_vectors = {}

    def load(self) -> bool:
        """Load necessary dependencies for word embedding training.

        Ensures that required libraries like gensim and nltk are available.

        Returns:
            bool: True if dependencies loaded successfully, False otherwise.

        """
        try:
            import nltk

            # Make sure NLTK tokenizers are available
            try:
                nltk.data.find("tokenizers/punkt")
            except LookupError:
                nltk.download("punkt")

            self.is_loaded_flag = True
            return True

        except ImportError as e:
            logger.error(f"Required library not installed: {e}")
            logger.info("Please install gensim and nltk: pip install gensim nltk")
            return False

    def train_word_embeddings(self, texts: list[str]) -> bool:
        """Train word embeddings from a collection of texts.

        Tokenizes the input texts and trains a word embedding model using
        the specified method (Word2Vec or FastText).

        Args:
            texts: List of texts from the collection for training.

        Returns:
            bool: True if training was successful, False otherwise.

        """
        if not self.is_loaded:
            if not self.load():
                return False

        try:
            from gensim.models import FastText, Word2Vec
            from nltk.tokenize import word_tokenize
            from tqdm import tqdm

            # Tokenize texts
            logger.info("Tokenizing texts...")
            sentences = []
            for text in tqdm(texts, desc="Tokenizing"):
                try:
                    words = word_tokenize(text.lower())
                    # Filter out non-alphabetic tokens and very short words
                    words = [word for word in words if word.isalpha() and len(word) > 1]
                    if words:
                        sentences.append(words)
                except Exception as e:
                    logger.debug(f"Error tokenizing text: {e}")
                    continue

            # Check if we have enough data
            if len(sentences) < 10:
                logger.error("Insufficient data for training word embeddings")
                return False

            logger.info(f"Training {self.method} model on {len(sentences)} sentences...")

            # Train model based on selected method
            if self.method.lower() == "word2vec":
                self._model = Word2Vec(
                    sentences=sentences,
                    vector_size=self.dim,
                    window=self.window,
                    min_count=self.min_count,
                    workers=self.workers,
                )
            elif self.method.lower() == "fasttext":
                self._model = FastText(
                    sentences=sentences,
                    vector_size=self.dim,
                    window=self.window,
                    min_count=self.min_count,
                    workers=self.workers,
                )
            else:
                logger.error(f"Unsupported method: {self.method}")
                return False

            # Train the model
            self._model.train(sentences, total_examples=len(sentences), epochs=5)

            # Extract word vectors for easier access
            self._word_vectors = self._model.wv

            logger.info(f"Trained model with {len(self._word_vectors)} word vectors")
            return True

        except Exception as e:
            logger.error(f"Error training word embeddings: {e}")
            logger.debug(traceback.format_exc())
            return False

    def unload(self) -> bool:
        """Unload the model and free memory resources.

        Returns:
            bool: True if successful, False otherwise.

        """
        if hasattr(self, "_model") and self._model is not None:
            del self._model
            self._model = None

        if hasattr(self, "_word_vectors") and self._word_vectors:
            del self._word_vectors
            self._word_vectors = {}

        self.is_loaded_flag = False

        # Force garbage collection
        import gc

        gc.collect()

        return True

    @property
    def is_loaded(self) -> bool:
        """Check if the model dependencies are loaded.

        Returns:
            bool: True if dependencies are loaded, False otherwise.

        """
        return self.is_loaded_flag

    def embed_text(self, text: str) -> Optional[np.ndarray]:
        """Generate embeddings for a single text.

        Note: This method is not applicable for this model as it's designed for
        training word embeddings rather than embedding texts. This implementation
        is provided to satisfy the interface.

        Args:
            text: Input text to embed.

        Returns:
            Optional[np.ndarray]: A zero vector of the model's dimension.

        """
        logger.warning("embed_text is not applicable for word embeddings model")
        return np.zeros(self.dim)

    def embed_batch(self, texts: list[str]) -> list[Optional[np.ndarray]]:
        """Generate embeddings for a batch of texts.

        Note: This method is not applicable for this model as it's designed for
        training word embeddings rather than embedding texts. This implementation
        is provided to satisfy the interface.

        Args:
            texts: List of texts to embed.

        Returns:
            List[Optional[np.ndarray]]: List of zero vectors of the model's dimension.

        """
        logger.warning("embed_batch is not applicable for word embeddings model")
        return [np.zeros(self.dim) for _ in texts]

    def get_dimension(self) -> int:
        """Get the dimensionality of the embedding vectors.

        Returns:
            int: Dimension of embedding vectors.

        """
        return self.dim

    def get_word_vector(self, word: str) -> Optional[np.ndarray]:
        """Get vector for a specific word.

        Args:
            word: Word to get vector for.

        Returns:
            Optional[np.ndarray]: Word vector or None if word is not in vocabulary.

        """
        if not self._word_vectors:
            logger.warning("Word embeddings not trained yet")
            return None

        try:
            return self._word_vectors[word]
        except KeyError:
            return None

    def get_word_vectors(self) -> dict[str, np.ndarray]:
        """Get all word vectors in the vocabulary.

        Returns:
            Dict[str, np.ndarray]: Dictionary mapping words to their vectors.

        """
        if not self._word_vectors:
            logger.warning("Word embeddings not trained yet")
            return {}

        return {word: self._word_vectors[word] for word in self._word_vectors.key_to_index}

    def save_word_vectors(self, output_path: str, format: str = "txt", include_header: bool = True) -> bool:
        """Save trained word vectors to a file.

        Args:
            output_path: Path to save the word vectors.
            format: Format to save word vectors ('txt', 'vec', 'bin', 'gensim').
            include_header: Whether to include the vocabulary size and dimension header
                           (only for txt/vec formats).

        Returns:
            bool: True if saved successfully, False otherwise.

        """
        if not self._word_vectors:
            logger.warning("Word embeddings not trained yet")
            return False

        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

            if format.lower() in ["txt", "vec"]:
                # For text formats, we can control whether to include the header
                if include_header:
                    # Standard format with header
                    self._word_vectors.save_word2vec_format(output_path, binary=False)
                else:
                    # Custom format without header
                    with open(output_path, "w", encoding="utf-8") as f:
                        for word in self._word_vectors.key_to_index:
                            vector = self._word_vectors[word]
                            vector_str = " ".join(map(str, vector.tolist()))
                            f.write(f"{word} {vector_str}\n")
            elif format.lower() == "bin":
                self._word_vectors.save_word2vec_format(output_path, binary=True)
            elif format.lower() == "gensim":
                self._word_vectors.save(output_path)
            else:
                logger.error(f"Unsupported format: {format}")
                return False

            logger.info(f"Saved {len(self._word_vectors)} word vectors to {output_path}")
            return True

        except Exception as e:
            logger.error(f"Error saving word vectors: {e}")
            logger.debug(traceback.format_exc())
            return False
