"""GLiNER model implementation for named entity recognition.

This module provides an implementation of NERModel using the GLiNER library
for zero-shot and few-shot named entity recognition.
"""


import torch

from ..core.logging import get_logger
from .base import Entity, NERModel

logger = get_logger(__name__)

# Try to import GLiNER without failing if unavailable
try:
    from gliner import GLiNER

    GLINER_AVAILABLE = True
except ImportError:
    logger.warning("GLiNER not available. Install with `pip install gliner`")
    GLINER_AVAILABLE = False


# Default mapping from GLiNER labels to short codes
DEFAULT_LABEL_MAPPING = {
    "Person": "P",
    "Nationality": "N",
    "Facility": "F",
    "Organization": "O",
    "Geopolitical entity": "G",
    "Location": "L",
    "Product": "PR",
    "Event": "E",
    "Work of art": "W",
    "Law": "LA",
    "Date": "D",
    "Time": "T",
    "Percent": "PE",
    "Money": "M",
    "Quantity": "Q",
    "Ordinal": "OR",
    "Cardinal": "C",
    "Language": "LG",
    "Misc": "MI",
}


class GLiNERModel(NERModel):
    """GLiNER implementation of named entity recognition model.

    This model uses GLiNER, a generative large language model-based approach
    for named entity recognition that can be used in zero-shot or few-shot scenarios.

    Attributes:
        model_path (str): Path or name of the model to load.
        max_chunk_size (int): Maximum chunk size for processing long texts.
        threshold (float): Confidence threshold for entity detection.
        device (str): Device used for processing ('cuda' or 'cpu').
        label_mapping (Dict[str, str]): Mapping from GLiNER labels to short codes.

    """

    def __init__(
        self,
        model_path: str,
        max_chunk_size: int = 296,
        threshold: float = 0.5,
        use_gpu: bool = None,
        label_mapping: dict[str, str] = None,
    ):
        """Initialize the GLiNER model.

        Args:
            model_path: Path or name of the model.
            max_chunk_size: Maximum chunk size for processing long texts.
            threshold: Confidence threshold for entity detection (0.0 to 1.0).
            use_gpu: Force GPU usage if True, CPU if False, auto-detect if None.
            label_mapping: Custom mapping from GLiNER labels to short codes.

        Raises:
            ImportError: If GLiNER is not installed.

        """
        if not GLINER_AVAILABLE:
            raise ImportError("GLiNER is not installed. Please install it with `pip install gliner`")

        self.model_path = model_path
        self.max_chunk_size = max_chunk_size
        self.threshold = threshold
        self.use_gpu = use_gpu
        self.label_mapping = label_mapping or DEFAULT_LABEL_MAPPING
        self._model = None

        # Determine device
        if self.use_gpu is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = "cuda" if self.use_gpu and torch.cuda.is_available() else "cpu"

    def load(self) -> bool:
        """Load the GLiNER model.

        Loads the model from the specified path and sets it to the appropriate device.

        Returns:
            bool: True if model loaded successfully, False otherwise.

        """
        if not GLINER_AVAILABLE:
            logger.error("GLiNER is not installed")
            return False

        try:
            self._model = GLiNER.from_pretrained(
                self.model_path,
                use_auth_token=False,
                trust_remote_code=True,
            )

            # Set default values for tokenizer parameters
            if hasattr(self._model, "tokenizer") and self._model.tokenizer is not None:
                self._model.tokenizer.model_max_length = 512

            self._model.to(self.device)
            logger.info(f"Loaded GLiNER model from {self.model_path} on {self.device}")
            return True
        except Exception as e:
            logger.error(f"Failed to load GLiNER model: {e}")
            return False

    def unload(self) -> bool:
        """Unload the GLiNER model from memory.

        Returns:
            bool: True if successful, False otherwise.

        """
        if hasattr(self, "_model") and self._model is not None:
            del self._model

        self._model = None

        # Force GPU memory cleanup if available
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return True

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded.

        Returns:
            bool: True if the model is loaded, False otherwise.

        """
        return self._model is not None

    def extract_entities(self, text: str) -> list[Entity]:
        """Extract named entities from text using GLiNER.

        Processes the text in chunks to handle long documents and extracts
        entities based on the configured threshold.

        Args:
            text: Input text to analyze.

        Returns:
            List[Entity]: List of extracted entities with their positions and labels.

        """
        if not self.is_loaded:
            if not self.load():
                return []

        # Get available labels
        labels_gliner = list(self.label_mapping.keys())

        # Process text in chunks if needed
        doc_len = len(text)
        offset = 0
        entities = []
        error_count = 0
        max_errors = 5  # Maximum consecutive errors before giving up on document

        while offset < doc_len:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            # Calculate chunk size dynamically if we're having trouble
            chunk_size = self.max_chunk_size
            if error_count > 0:
                # Reduce chunk size if we're encountering errors
                chunk_size = max(50, chunk_size // (error_count + 1))

            end = min(offset + chunk_size, doc_len)
            chunk = text[offset:end]

            # Skip empty chunks
            if not chunk or chunk.isspace():
                offset = end
                continue

            # Try different chunk sizes if we encounter errors
            success = False
            retry_sizes = [chunk_size, chunk_size // 2, chunk_size // 4, 50]

            for size in retry_sizes:
                if size <= 0:
                    continue

                retry_end = min(offset + size, doc_len)
                retry_chunk = text[offset:retry_end]

                if not retry_chunk or retry_chunk.isspace():
                    offset = retry_end
                    success = True
                    break

                try:
                    chunk_ents = self._model.predict_entities(retry_chunk, labels_gliner, threshold=self.threshold)

                    # Process entities if any
                    if chunk_ents:
                        # Sort by start position for stable ordering
                        chunk_ents.sort(key=lambda x: x["start"])

                        # Convert to our format
                        for ent in chunk_ents:
                            entities.append(
                                Entity(
                                    text=ent["text"],
                                    labels=[self.label_mapping.get(ent["label"], ent["label"])],
                                    start_pos=ent["start"] + offset,
                                    end_pos=ent["end"] + offset,
                                    confidence=float(ent["score"]),
                                )
                            )

                        # Avoid splitting entity across chunks by advancing to end of last entity
                        offset += chunk_ents[-1]["end"]
                    else:
                        # No entities in this chunk, move to next
                        offset = retry_end

                    # Reset error count on success
                    error_count = 0
                    success = True
                    break

                except IndexError:
                    # Try smaller chunk
                    logger.debug(f"GLiNER indexing error with chunk size {size}, trying smaller chunk")
                    continue

                except Exception as e:
                    # Try smaller chunk for other errors too
                    logger.debug(f"GLiNER error with chunk size {size}: {e}")
                    continue

            if not success:
                # If all retries failed, log warning and skip ahead
                logger.warning(f"GLiNER encountered an indexing error on chunk at position {offset}. Skipping chunk.")
                error_count += 1
                if error_count >= max_errors:
                    logger.warning("Too many consecutive errors, skipping the rest of the document")
                    break

                # Skip ahead more aggressively
                offset += 10

        return entities
