"""FastText model implementation for generating text embeddings.

This module provides an implementation of EmbeddingsModel using the FastText library
with robust error handling.
"""

import os
from typing import Optional

import numpy as np

from ..core.errors import (
    EmbeddingError,
    MemoryError,
    ModelError,
    ResourceError,
    handle_embedding_errors,
    safe_embed,
)
from ..core.logging import get_logger
from .base import EmbeddingsModel

logger = get_logger(__name__)

# Try to import FastText without failing if unavailable
try:
    import fasttext

    FASTTEXT_AVAILABLE = True
except ImportError:
    logger.warning("FastText not available. Install with `pip install fasttext`")
    FASTTEXT_AVAILABLE = False


class FastTextEmbeddingsModel(EmbeddingsModel):
    """FastText implementation of text embedding model.

    This model uses FastText to generate vector representations of texts.
    It supports loading both binary and text models.

    Attributes:
        model_path (str): Path to FastText model file or model name.
        use_precomputed (bool): Whether to use a precomputed model.
        dim (int): Dimension of embeddings.
        tokenization_model: Optional tokenization model for preprocessing.

    """

    def __init__(
        self,
        model_path: str,
        use_precomputed: bool = True,
        dim: int = 300,
        tokenization_model=None,
    ):
        """Initialize the FastText model.

        Args:
            model_path: Path to FastText model or model name.
            use_precomputed: Whether to use a precomputed model or train from scratch.
            dim: Dimension of embeddings (used when training from scratch).
            tokenization_model: Optional tokenization model to preprocess texts.

        """
        if not FASTTEXT_AVAILABLE:
            raise ImportError("FastText is not installed. Please install it with `pip install fasttext`")

        self.model_path = model_path
        self.use_precomputed = use_precomputed
        self.dim = dim
        self.tokenization_model = tokenization_model
        self._model = None
        self.is_loaded_flag = False

        # Determine if this is a pretrained model from Facebook
        self.is_facebook_model = model_path.startswith("cc.") or model_path.startswith("wiki.")

    @handle_embedding_errors()
    def load(self) -> bool:
        """Load the FastText model with enhanced error handling.

        Handles different model formats and provides memory usage warnings.

        Returns:
            bool: True if model loaded successfully, False otherwise.

        """
        if not FASTTEXT_AVAILABLE:
            raise ModelError(
                "FastText is not installed",
                model_name=self.model_path,
                model_type="fasttext",
            )

        try:
            if self.use_precomputed:
                if os.path.isfile(self.model_path):
                    # Load from local file
                    logger.info(f"Loading FastText model from file: {self.model_path}")

                    # Check if file is readable
                    if not os.access(self.model_path, os.R_OK):
                        raise ResourceError(
                            f"FastText model file is not readable: {self.model_path}",
                            "file",
                            self.model_path,
                        )

                    # Check file size to warn about potential memory issues
                    file_size_gb = os.path.getsize(self.model_path) / (1024**3)
                    if file_size_gb > 4.0:
                        logger.warning(f"Large model file detected: {file_size_gb:.2f} GB. " f"This may require significant memory.")

                        # Check available memory
                        try:
                            import psutil

                            available_memory_gb = psutil.virtual_memory().available / (1024**3)
                            if available_memory_gb < file_size_gb * 1.5:
                                logger.warning(
                                    f"Available memory ({available_memory_gb:.2f} GB) " f"may be insufficient for model of size {file_size_gb:.2f} GB"
                                )
                        except ImportError:
                            pass

                    # Determine if this is a binary or text model
                    if self.model_path.endswith(".bin"):
                        try:
                            self._model = fasttext.load_model(self.model_path)
                        except RuntimeError as e:
                            if "memory allocation failed" in str(e).lower():
                                raise MemoryError(
                                    f"Failed to load FastText model due to memory allocation failure: {e}",
                                    f"{file_size_gb:.2f} GB",
                                    None,
                                    {"model_path": self.model_path},
                                ) from e
                            else:
                                raise ModelError(
                                    f"Failed to load FastText model: {e}",
                                    model_name=self.model_path,
                                    model_type="fasttext",
                                ) from e
                    elif self.model_path.endswith(".vec"):
                        # For .vec files, use custom loader
                        success = self._load_vec_file(self.model_path)
                        if not success:
                            raise ModelError(
                                "Failed to load FastText .vec file",
                                model_name=self.model_path,
                                model_type="fasttext",
                            )
                    else:
                        # Default to binary format
                        logger.warning(f"Unknown file extension for FastText model: {self.model_path}. " f"Assuming binary format.")
                        self._model = fasttext.load_model(self.model_path)
                elif self.is_facebook_model:
                    # Try to load pretrained model directly
                    logger.info(f"Loading FastText pretrained model: {self.model_path}")
                    try:
                        self._model = fasttext.load_model(self.model_path)
                    except RuntimeError as e:
                        raise ModelError(
                            f"Failed to load pretrained FastText model: {e}",
                            model_name=self.model_path,
                            model_type="fasttext",
                        ) from e
                else:
                    raise ResourceError(
                        f"Model file not found: {self.model_path}",
                        "file",
                        self.model_path,
                    )
            else:
                # Training not implemented yet
                raise NotImplementedError("Training FastText models from scratch not yet implemented")

            self.is_loaded_flag = True
            self.dim = self._model.get_dimension()
            logger.info(f"Loaded FastText model with dimension {self.dim}")

            return True
        except (ResourceError, ModelError, MemoryError):
            # Re-raise HistText errors
            raise
        except NotImplementedError:
            # Re-raise NotImplementedError
            raise
        except Exception as e:
            # Convert other exceptions to ModelError
            raise ModelError(
                f"Unexpected error loading FastText model: {e}",
                model_name=self.model_path,
                model_type="fasttext",
                details={"error_type": type(e).__name__},
            ) from e

    @handle_embedding_errors()
    def _load_vec_file(self, vec_path: str) -> bool:
        """Load a .vec file into a simple dictionary-based model.

        Args:
            vec_path: Path to the .vec file.

        Returns:
            bool: True if successful, False otherwise.

        Raises:
            ModelError: If the .vec file is invalid or cannot be loaded.

        """
        try:
            word_vectors = {}

            with open(vec_path, encoding="utf-8") as f:
                # Read header
                header = f.readline().strip().split()
                if len(header) != 2:
                    raise ModelError(
                        f"Invalid .vec file header: {' '.join(header)}",
                        model_name=vec_path,
                        model_type="fasttext",
                    )

                try:
                    _, dim = int(header[0]), int(header[1])
                except ValueError as e:
                    raise ModelError(
                        f"Invalid .vec file header format: {' '.join(header)}",
                        model_name=vec_path,
                        model_type="fasttext",
                    ) from e

                self.dim = dim

                # Read vectors
                line_count = 0
                error_count = 0
                max_errors = 10  # Maximum number of errors to report

                for i, line in enumerate(f):
                    line_count += 1
                    tokens = line.strip().split()

                    if len(tokens) < dim + 1:
                        error_count += 1
                        if error_count <= max_errors:
                            logger.warning(f"Skipping invalid line {i+1} in {vec_path}: " f"expected {dim+1} tokens, got {len(tokens)}")
                        continue

                    word = tokens[0]
                    try:
                        vector = np.array([float(val) for val in tokens[1 : dim + 1]])
                        word_vectors[word] = vector
                    except ValueError:
                        error_count += 1
                        if error_count <= max_errors:
                            logger.warning(f"Skipping line {i+1} in {vec_path} due to " f"invalid vector values")
                        continue

            if error_count > max_errors:
                logger.warning(f"{error_count - max_errors} more errors were suppressed")

            if not word_vectors:
                raise ModelError(
                    f"No valid word vectors found in {vec_path}",
                    model_name=vec_path,
                    model_type="fasttext",
                )

            # Create a simple model-like class with get_word_vector method
            class VecModel:
                def __init__(self, word_vectors, dim):
                    self.word_vectors = word_vectors
                    self.dim = dim

                def get_word_vector(self, word):
                    return self.word_vectors.get(word, np.zeros(self.dim))

                def get_dimension(self):
                    return self.dim

            self._model = VecModel(word_vectors, dim)
            logger.info(f"Loaded {len(word_vectors)} word vectors with dimension {dim} from {vec_path}")
            return True

        except ModelError:
            # Re-raise ModelError
            raise
        except Exception as e:
            # Convert other exceptions
            raise ModelError(
                f"Error loading .vec file: {e}",
                model_name=vec_path,
                model_type="fasttext",
                details={"error_type": type(e).__name__},
            ) from e

    @handle_embedding_errors()
    def unload(self) -> bool:
        """Unload the FastText model from memory.

        Returns:
            bool: True if successful, False otherwise.

        """
        if hasattr(self, "_model") and self._model is not None:
            del self._model
            self._model = None
            self.is_loaded_flag = False

            # Force garbage collection
            import gc

            gc.collect()

            logger.info("Unloaded FastText model")
            return True
        return False

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded.

        Returns:
            bool: True if the model is loaded, False otherwise.

        """
        return self.is_loaded_flag and self._model is not None

    def preprocess_text(self, text: str) -> str:
        """Preprocess text before embedding.

        Applies tokenization if a tokenization model is provided.

        Args:
            text: Input text.

        Returns:
            str: Preprocessed text.

        """
        if not text:
            return ""

        # Apply tokenization if a tokenization model is provided
        if self.tokenization_model:
            try:
                if hasattr(self.tokenization_model, "tokenize_text"):
                    return self.tokenization_model.tokenize_text(text)
                elif hasattr(self.tokenization_model, "tokenize"):
                    tokens = self.tokenization_model.tokenize(text)
                    return " ".join([token.text for token in tokens])
            except Exception as e:
                logger.warning(f"Error during tokenization preprocessing: {e}")

        # Default preprocessing: lowercase and normalize whitespace
        return " ".join(text.lower().split())

    @safe_embed(logger)
    def embed_text(self, text: str) -> Optional[np.ndarray]:
        """Generate embeddings for a single text.

        Args:
            text: Input text to embed.

        Returns:
            Optional[np.ndarray]: Embedding vector or None if failed.

        Raises:
            EmbeddingError: If embedding fails for any reason.

        """
        if not self.is_loaded:
            if not self.load():
                logger.error("Failed to load model for embedding")
                return None

        if not text:
            # Return zero vector for empty text
            return np.zeros(self.dim)

        try:
            # Preprocess text
            processed_text = self.preprocess_text(text)

            # Limit text length to prevent memory issues
            max_text_length = 100000  # Set a reasonable limit
            if len(processed_text) > max_text_length:
                logger.warning(f"Text length ({len(processed_text)}) exceeds maximum " f"({max_text_length}). Truncating.")
                processed_text = processed_text[:max_text_length]

            # Get embedding from model
            if hasattr(self._model, "get_sentence_vector"):
                vector = self._model.get_sentence_vector(processed_text)
            else:
                # Fallback to averaging word vectors
                words = processed_text.split()
                if not words:
                    return np.zeros(self.dim)

                vectors = [self._model.get_word_vector(word) for word in words]
                vector = np.mean(vectors, axis=0)

            # Check for NaN values in the vector
            if np.isnan(vector).any():
                logger.warning("NaN values detected in embedding vector. Replacing with zeros.")
                vector = np.nan_to_num(vector)

            return vector
        except Exception as e:
            raise EmbeddingError(
                f"Error embedding text: {e}",
                model_name=self.model_path,
                model_type="fasttext",
                text_sample=text[:100],
            ) from e

    @safe_embed(logger, default_return=[])
    def embed_batch(self, texts: list[str]) -> list[Optional[np.ndarray]]:
        """Generate embeddings for a batch of texts with enhanced error handling.

        Args:
            texts: List of texts to embed.

        Returns:
            List[Optional[np.ndarray]]: List of embedding vectors.

        """
        if not self.is_loaded:
            if not self.load():
                logger.error("Failed to load model for batch embedding")
                return [None] * len(texts)

        results = []
        error_count = 0
        max_reported_errors = 5  # Maximum number of errors to log individually

        for i, text in enumerate(texts):
            try:
                results.append(self.embed_text(text))
            except EmbeddingError as e:
                error_count += 1
                if error_count <= max_reported_errors:
                    logger.error(f"Error embedding text {i}: {e.message}")
                results.append(None)

        if error_count > max_reported_errors:
            logger.error(f"{error_count - max_reported_errors} more embedding errors suppressed")

        return results

    def get_dimension(self) -> int:
        """Get the dimensionality of the embedding vectors.

        Returns:
            int: Dimension of embedding vectors.

        """
        if not self.is_loaded:
            if not self.load():
                return self.dim

        if hasattr(self._model, "get_dimension"):
            return self._model.get_dimension()
        return self.dim


class Word2VecEmbeddingsModel(EmbeddingsModel):
    """Word2Vec implementation of text embedding model.

    This model uses Word2Vec to generate vector representations of texts.
    It loads Word2Vec models using gensim and averages word vectors to create text embeddings.

    Attributes:
        model_path (str): Path to Word2Vec model file.
        binary (bool): Whether the model is in binary format.
        dim (int): Dimension of embeddings.
        tokenization_model: Optional tokenization model for preprocessing.

    """

    def __init__(
        self,
        model_path: str,
        binary: bool = True,
        dim: int = 300,
        tokenization_model=None,
    ):
        """Initialize the Word2Vec model.

        Args:
            model_path: Path to Word2Vec model.
            binary: Whether the model is in binary format.
            dim: Dimension of embeddings.
            tokenization_model: Optional tokenization model to preprocess texts.

        """
        self.model_path = model_path
        self.binary = binary
        self.dim = dim
        self.tokenization_model = tokenization_model
        self._model = None
        self.is_loaded_flag = False

    @handle_embedding_errors(model_type="word2vec")
    def load(self) -> bool:
        """Load the Word2Vec model.

        Loads the model from the specified path, with memory usage checks.

        Returns:
            bool: True if model loaded successfully, False otherwise.

        Raises:
            ModelError: If the model cannot be loaded.
            ResourceError: If the model file is not found or readable.
            MemoryError: If there is insufficient memory to load the model.

        """
        try:
            # Try to import gensim
            import gensim

            if not os.path.isfile(self.model_path):
                raise ResourceError(f"Model file not found: {self.model_path}", "file", self.model_path)

            # Check if file is readable
            if not os.access(self.model_path, os.R_OK):
                raise ResourceError(
                    f"Word2Vec model file is not readable: {self.model_path}",
                    "file",
                    self.model_path,
                )

            # Check file size to warn about potential memory issues
            file_size_gb = os.path.getsize(self.model_path) / (1024**3)
            if file_size_gb > 4.0:
                logger.warning(f"Large model file detected: {file_size_gb:.2f} GB. " f"This may require significant memory.")

                # Check available memory
                try:
                    import psutil

                    available_memory_gb = psutil.virtual_memory().available / (1024**3)
                    if available_memory_gb < file_size_gb * 1.5:
                        logger.warning(
                            f"Available memory ({available_memory_gb:.2f} GB) " f"may be insufficient for model of size {file_size_gb:.2f} GB"
                        )
                except ImportError:
                    pass

            logger.info(f"Loading Word2Vec model from {self.model_path}")
            try:
                self._model = gensim.models.KeyedVectors.load_word2vec_format(self.model_path, binary=self.binary)
                self.dim = self._model.vector_size
                self.is_loaded_flag = True
                logger.info(f"Loaded Word2Vec model with dimension {self.dim}")
                return True
            except MemoryError as e:
                raise MemoryError(
                    f"Failed to load Word2Vec model due to memory error: {e}",
                    f"{file_size_gb:.2f} GB",
                    None,
                    {"model_path": self.model_path},
                ) from e
            except Exception as e:
                raise ModelError(
                    f"Failed to load Word2Vec model: {e}",
                    model_name=self.model_path,
                    model_type="word2vec",
                ) from e

        except ImportError as e:
            raise ModelError(
                "Gensim not installed. Please install with `pip install gensim`",
                model_type="word2vec",
            ) from e
        except (ResourceError, ModelError, MemoryError):
            # Re-raise HistText errors
            raise
        except Exception as e:
            # Convert other exceptions to ModelError
            raise ModelError(
                f"Unexpected error loading Word2Vec model: {e}",
                model_name=self.model_path,
                model_type="word2vec",
                details={"error_type": type(e).__name__},
            ) from e

    @handle_embedding_errors(model_type="word2vec")
    def unload(self) -> bool:
        """Unload the Word2Vec model from memory.

        Returns:
            bool: True if successful, False otherwise.

        """
        if hasattr(self, "_model") and self._model is not None:
            del self._model
            self._model = None
            self.is_loaded_flag = False

            # Force garbage collection
            import gc

            gc.collect()

            logger.info("Unloaded Word2Vec model")
            return True
        return False

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded.

        Returns:
            bool: True if the model is loaded, False otherwise.

        """
        return self.is_loaded_flag and self._model is not None

    def preprocess_text(self, text: str) -> str:
        """Preprocess text before embedding.

        Applies tokenization if a tokenization model is provided.

        Args:
            text: Input text.

        Returns:
            str: Preprocessed text.

        """
        if not text:
            return ""

        # Apply tokenization if a tokenization model is provided
        if self.tokenization_model:
            try:
                if hasattr(self.tokenization_model, "tokenize_text"):
                    return self.tokenization_model.tokenize_text(text)
                elif hasattr(self.tokenization_model, "tokenize"):
                    tokens = self.tokenization_model.tokenize(text)
                    return " ".join([token.text for token in tokens])
            except Exception as e:
                logger.warning(f"Error during tokenization preprocessing: {e}")

        # Default preprocessing: lowercase and normalize whitespace
        return " ".join(text.lower().split())

    @safe_embed(logger)
    def embed_text(self, text: str) -> Optional[np.ndarray]:
        """Generate embeddings for a single text.

        Creates embeddings by averaging word vectors for all words in the text.

        Args:
            text: Input text to embed.

        Returns:
            Optional[np.ndarray]: Embedding vector or None if failed.

        Raises:
            EmbeddingError: If embedding fails for any reason.

        """
        if not self.is_loaded:
            if not self.load():
                logger.error("Failed to load model for embedding")
                return None

        if not text:
            # Return zero vector for empty text
            return np.zeros(self.dim)

        try:
            # Preprocess text
            processed_text = self.preprocess_text(text)

            # Limit text length to prevent memory issues
            max_text_length = 100000
            if len(processed_text) > max_text_length:
                logger.warning(f"Text length ({len(processed_text)}) exceeds maximum " f"({max_text_length}). Truncating.")
                processed_text = processed_text[:max_text_length]

            words = processed_text.split()

            if not words:
                return np.zeros(self.dim)

            # Average word vectors
            vectors = []
            for word in words:
                try:
                    if word in self._model:
                        vectors.append(self._model[word])
                except Exception:
                    pass

            if vectors:
                vector = np.mean(vectors, axis=0)

                # Check for NaN values in the vector
                if np.isnan(vector).any():
                    logger.warning("NaN values detected in embedding vector. " "Replacing with zeros.")
                    vector = np.nan_to_num(vector)

                return vector
            else:
                return np.zeros(self.dim)

        except Exception as e:
            raise EmbeddingError(
                f"Error embedding text: {e}",
                model_name=self.model_path,
                model_type="word2vec",
                text_sample=text[:100],
            ) from e

    @safe_embed(logger, default_return=[])
    def embed_batch(self, texts: list[str]) -> list[Optional[np.ndarray]]:
        """Generate embeddings for a batch of texts.

        Args:
            texts: List of texts to embed.

        Returns:
            List[Optional[np.ndarray]]: List of embedding vectors.

        """
        if not self.is_loaded:
            if not self.load():
                logger.error("Failed to load model for batch embedding")
                return [None] * len(texts)

        results = []
        error_count = 0
        max_reported_errors = 5

        for i, text in enumerate(texts):
            try:
                results.append(self.embed_text(text))
            except EmbeddingError as e:
                error_count += 1
                if error_count <= max_reported_errors:
                    logger.error(f"Error embedding text {i}: {e.message}")
                results.append(None)

        if error_count > max_reported_errors:
            logger.error(f"{error_count - max_reported_errors} more embedding errors suppressed")

        return results

    def get_dimension(self) -> int:
        """Get the dimensionality of the embedding vectors.

        Returns:
            int: Dimension of embedding vectors.

        """
        if not self.is_loaded:
            if not self.load():
                return self.dim

        if hasattr(self._model, "vector_size"):
            return self._model.vector_size
        return self.dim


class SentenceTransformersEmbeddingsModel(EmbeddingsModel):
    """SentenceTransformers implementation of text embedding model.

    This model uses SentenceTransformers (Hugging Face Transformers) to generate
    high-quality vector representations of texts.

    Attributes:
        model_path (str): Path or name of the SentenceTransformers model.
        max_length (int): Maximum sequence length for input texts.
        dim (int): Dimension of embeddings, determined after model loading.

    """

    def __init__(self, model_path: str, max_length: int = 512):
        """Initialize the SentenceTransformers model.

        Args:
            model_path: Path or name of the SentenceTransformers model.
            max_length: Maximum sequence length for tokenization.

        """
        self.model_path = model_path
        self.max_length = max_length
        self._model = None
        self.dim = 0
        self.is_loaded_flag = False

    @handle_embedding_errors(model_type="sentence_transformers")
    def load(self) -> bool:
        """Load the SentenceTransformers model.

        Loads the model and performs memory checks, with GPU detection.

        Returns:
            bool: True if model loaded successfully, False otherwise.

        Raises:
            ModelError: If the model cannot be loaded.
            ResourceError: If the model directory is not found.
            MemoryError: If there is insufficient memory to load the model.

        """
        try:
            # Try to import sentence_transformers
            from sentence_transformers import SentenceTransformer

            logger.info(f"Loading SentenceTransformers model: {self.model_path}")

            # Check if model exists if it's a local path
            if os.path.exists(self.model_path) and not os.path.isdir(self.model_path):
                raise ResourceError(
                    f"Model path is not a directory: {self.model_path}",
                    "directory",
                    self.model_path,
                )

            # Check if we have enough memory for loading
            try:
                import psutil
                import torch

                # Rough estimate of memory requirements
                required_memory_gb = 2.0  # Default estimate for medium models

                if "large" in self.model_path.lower():
                    required_memory_gb = 4.0
                elif "base" in self.model_path.lower():
                    required_memory_gb = 1.5

                available_memory_gb = psutil.virtual_memory().available / (1024**3)
                if torch.cuda.is_available():
                    device = torch.cuda.current_device()
                    gpu_memory_gb = torch.cuda.get_device_properties(device).total_memory / (1024**3)
                    logger.info(f"Using GPU with {gpu_memory_gb:.2f} GB memory")
                elif available_memory_gb < required_memory_gb:
                    logger.warning(
                        f"Available memory ({available_memory_gb:.2f} GB) " f"may be insufficient for model (est. {required_memory_gb:.2f} GB)"
                    )
            except ImportError:
                pass

            try:
                self._model = SentenceTransformer(self.model_path)

                # Set maximum sequence length
                if hasattr(self._model, "max_seq_length"):
                    self._model.max_seq_length = self.max_length
                    logger.info(f"Set maximum sequence length to {self.max_length}")

                # Get embedding dimension
                test_embedding = self._model.encode("test", convert_to_numpy=True)
                self.dim = test_embedding.shape[0]

                self.is_loaded_flag = True
                logger.info(f"Loaded SentenceTransformers model with dimension {self.dim}")
                return True
            except RuntimeError as e:
                if "CUDA out of memory" in str(e) or "out of memory" in str(e).lower():
                    raise MemoryError(
                        f"Failed to load SentenceTransformers model due to memory error: {e}",
                        None,
                        None,
                        {"model_path": self.model_path},
                    ) from e
                else:
                    raise ModelError(
                        f"Failed to load SentenceTransformers model: {e}",
                        model_name=self.model_path,
                        model_type="sentence_transformers",
                    ) from e

        except ImportError as e:
            raise ModelError(
                "SentenceTransformers not installed. Please install with `pip install sentence-transformers`",
                model_type="sentence_transformers",
            ) from e
        except (ResourceError, ModelError, MemoryError):
            # Re-raise HistText errors
            raise
        except Exception as e:
            # Convert other exceptions to ModelError
            raise ModelError(
                f"Unexpected error loading SentenceTransformers model: {e}",
                model_name=self.model_path,
                model_type="sentence_transformers",
                details={"error_type": type(e).__name__},
            ) from e

    @handle_embedding_errors(model_type="sentence_transformers")
    def unload(self) -> bool:
        """Unload the SentenceTransformers model from memory.

        Returns:
            bool: True if successful, False otherwise.

        """
        if hasattr(self, "_model") and self._model is not None:
            del self._model
            self._model = None
            self.is_loaded_flag = False

            # Force GPU memory cleanup if available
            try:
                import torch

                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass

            # Force garbage collection
            import gc

            gc.collect()

            logger.info("Unloaded SentenceTransformers model")
            return True
        return False

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded.

        Returns:
            bool: True if the model is loaded, False otherwise.

        """
        return self.is_loaded_flag and self._model is not None

    @safe_embed(logger)
    def embed_text(self, text: str) -> Optional[np.ndarray]:
        """Generate embeddings for a single text.

        Uses the SentenceTransformers model to create an embedding vector.

        Args:
            text: Input text to embed.

        Returns:
            Optional[np.ndarray]: Embedding vector or None if failed.

        Raises:
            EmbeddingError: If embedding fails for any reason.

        """
        if not self.is_loaded:
            if not self.load():
                logger.error("Failed to load model for embedding")
                return None

        if not text:
            # Return zero vector for empty text
            return np.zeros(self.dim)

        try:
            # Check for very long texts that might cause memory issues
            if len(text) > self.max_length * 4:
                logger.warning(
                    f"Input text length ({len(text)}) is very long. " f"This may cause memory issues. Truncating to {self.max_length * 4} chars."
                )
                text = text[: self.max_length * 4]

            # Encode text with SentenceTransformers
            try:
                vector = self._model.encode(text, convert_to_numpy=True)

                # Check for NaN values in the vector
                if np.isnan(vector).any():
                    logger.warning("NaN values detected in embedding vector. " "Replacing with zeros.")
                    vector = np.nan_to_num(vector)

                return vector
            except RuntimeError as e:
                if "CUDA out of memory" in str(e) or "out of memory" in str(e).lower():
                    # Try to recover from out of memory by clearing GPU cache
                    try:
                        import torch

                        if torch.cuda.is_available():
                            torch.cuda.empty_cache()
                            logger.warning("CUDA out of memory. Cleared cache and retrying with shorter input...")
                            # Retry with shorter input
                            shorter_text = text[: len(text) // 2]
                            return self._model.encode(shorter_text, convert_to_numpy=True)
                    except Exception:
                        pass

                # Re-raise the error if we couldn't recover
                raise

        except Exception as e:
            raise EmbeddingError(
                f"Error embedding text: {e}",
                model_name=self.model_path,
                model_type="sentence_transformers",
                text_sample=text[:100],
            ) from e

    @safe_embed(logger, default_return=[])
    def embed_batch(self, texts: list[str]) -> list[Optional[np.ndarray]]:
        """Generate embeddings for a batch of texts.

        Uses adaptive batch sizes based on text lengths to avoid memory issues.

        Args:
            texts: List of texts to embed.

        Returns:
            List[Optional[np.ndarray]]: List of embedding vectors.

        """
        if not self.is_loaded:
            if not self.load():
                logger.error("Failed to load model for batch embedding")
                return [None] * len(texts)

        try:
            # Filter out empty texts
            valid_indices = []
            valid_texts = []

            for i, text in enumerate(texts):
                if text:
                    # Check for very long texts
                    if len(text) > self.max_length * 4:
                        logger.warning(f"Text at index {i} is very long ({len(text)} chars). " f"Truncating to {self.max_length * 4} chars.")
                        text = text[: self.max_length * 4]

                    valid_indices.append(i)
                    valid_texts.append(text)

            # Create result list with None for empty texts
            results = [None] * len(texts)

            if valid_texts:
                # Use adaptive batch sizes based on text lengths to avoid memory issues
                batch_size = self._determine_batch_size(valid_texts)
                logger.debug(f"Using batch size of {batch_size} for {len(valid_texts)} texts")

                # Process in smaller batches
                for start_idx in range(0, len(valid_texts), batch_size):
                    end_idx = min(start_idx + batch_size, len(valid_texts))
                    batch_texts = valid_texts[start_idx:end_idx]
                    batch_indices = valid_indices[start_idx:end_idx]

                    try:
                        # Encode batch with SentenceTransformers
                        batch_vectors = self._model.encode(batch_texts, convert_to_numpy=True)

                        # Put vectors back in the original order
                        for i, vector in zip(batch_indices, batch_vectors):
                            if np.isnan(vector).any():
                                logger.warning(f"NaN values in vector for text {i}. Replacing with zeros.")
                                vector = np.nan_to_num(vector)
                            results[i] = vector

                    except RuntimeError as e:
                        if "CUDA out of memory" in str(e) or "out of memory" in str(e).lower():
                            # Try to recover from out of memory by clearing GPU cache and retrying with smaller batch
                            logger.warning(f"CUDA out of memory with batch size {len(batch_texts)}. " f"Trying to recover...")

                            try:
                                import torch

                                if torch.cuda.is_available():
                                    torch.cuda.empty_cache()

                                # Process one by one for this batch
                                for i, text in zip(batch_indices, batch_texts):
                                    try:
                                        vector = self._model.encode(text, convert_to_numpy=True)
                                        if np.isnan(vector).any():
                                            vector = np.nan_to_num(vector)
                                        results[i] = vector
                                    except Exception as inner_e:
                                        logger.error(f"Error embedding text {i}: {inner_e}")
                            except Exception:
                                logger.error(f"Failed to recover from memory error in batch {start_idx}:{end_idx}")
                        else:
                            logger.error(f"Error in batch {start_idx}:{end_idx}: {e}")

                # Fill in zeros for empty texts
                for i in range(len(texts)):
                    if results[i] is None:
                        results[i] = np.zeros(self.dim)

            return results

        except Exception as e:
            logger.error(f"Error embedding batch: {e}")
            return [None] * len(texts)

    def _determine_batch_size(self, texts: list[str]) -> int:
        """Determine an appropriate batch size based on text lengths.

        Args:
            texts: List of texts to process.

        Returns:
            int: Recommended batch size.

        """
        if not texts:
            return 16  # Default for empty list

        # Calculate average text length
        avg_length = sum(len(text) for text in texts) / len(texts)

        # Initialize default batch size based on text length
        batch_size = 32  # Default value

        # Adjust batch size based on text length - these are heuristics
        if avg_length > 10000:
            batch_size = 1  # Very long texts, process one by one
        elif avg_length > 5000:
            batch_size = 2  # Long texts
        elif avg_length > 1000:
            batch_size = 8  # Medium long texts
        elif avg_length > 500:
            batch_size = 16  # Medium texts
        else:
            batch_size = 32  # Short texts

        # Check GPU memory if available
        try:
            import torch

            if torch.cuda.is_available():
                device = torch.cuda.current_device()
                gpu_memory_gb = torch.cuda.get_device_properties(device).total_memory / (1024**3)

                # Scale batch size based on GPU memory
                if gpu_memory_gb < 4:
                    return min(8, batch_size)  # Small GPU
                elif gpu_memory_gb < 8:
                    return min(16, batch_size)  # Medium GPU
                elif gpu_memory_gb < 16:
                    return min(32, batch_size)  # Large GPU
                else:
                    return min(64, batch_size)  # Very large GPU
        except Exception:
            pass

        return batch_size

    def get_dimension(self) -> int:
        """Get the dimensionality of the embedding vectors.

        Returns:
            int: Dimension of embedding vectors.

        """
        if not self.is_loaded:
            if not self.load():
                return 0

        return self.dim
