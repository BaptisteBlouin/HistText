"""Transformers model implementation.

This module provides Hugging Face Transformers-based implementations
of the NER and tokenization models with GPU acceleration support.
"""

from collections.abc import Iterator
from typing import Optional

import numpy as np
import torch
from transformers import (
    AutoModelForTokenClassification,
    AutoTokenizer,
    PreTrainedModel,
    PreTrainedTokenizer,
    pipeline,
)

from ..core.logging import get_logger
from .base import AggregationStrategy, Entity, NERModel, Token, TokenizationModel

logger = get_logger(__name__)


class TransformersNERModel(NERModel):
    """Hugging Face Transformers implementation of named entity recognition model.

    This model uses pre-trained transformer models from Hugging Face for named entity
    recognition, with support for GPU acceleration and handling of long sequences
    through a sliding window approach.

    Attributes:
        model_path (str): Path or name of the model.
        max_length (Optional[int]): Maximum sequence length for tokenization.
        stride (int): Stride for sliding window processing of long sequences.
        aggregation_strategy (AggregationStrategy): Strategy for aggregating subword tokens.
        _device (str): Device to run the model on ('cuda:0' or 'cpu').

    """

    def __init__(
        self,
        model_path: str,
        max_length: Optional[int] = None,
        stride: int = 10,
        aggregation_strategy: str = "FIRST",
    ):
        """Initialize the Transformers NER model.

        Args:
            model_path: Path or name of the model from Hugging Face.
            max_length: Maximum sequence length for tokenization. If None, uses model default.
            stride: Stride for sliding window when processing long sequences.
            aggregation_strategy: Strategy for aggregating subwords. Options are:
                "NONE", "SIMPLE", "FIRST", "AVERAGE", or "MAX".

        """
        self.model_path = model_path
        self.max_length = max_length
        self.stride = stride
        self.aggregation_strategy = AggregationStrategy[aggregation_strategy]
        self._model: Optional[PreTrainedModel] = None
        self._tokenizer: Optional[PreTrainedTokenizer] = None
        self._device = "cuda:0" if torch.cuda.is_available() else "cpu"

    def load(self) -> bool:
        """Load the Transformers model and tokenizer.

        Returns:
            bool: True if model loaded successfully, False otherwise.

        """
        try:
            # Load tokenizer with optional max length
            tokenizer_kwargs = {}
            if self.max_length is not None:
                tokenizer_kwargs["model_max_length"] = self.max_length

            self._tokenizer = AutoTokenizer.from_pretrained(self.model_path, **tokenizer_kwargs)

            # Load model and move to appropriate device
            self._model = AutoModelForTokenClassification.from_pretrained(self.model_path)
            self._model.to(self._device)
            self._model.eval()

            logger.info(f"Loaded Transformers model from {self.model_path} on {self._device}")
            return True
        except Exception as e:
            logger.error(f"Failed to load Transformers model: {e}")
            return False

    def unload(self) -> bool:
        """Unload the Transformers model and tokenizer from memory.

        Returns:
            bool: True if successful, False otherwise.

        """
        if hasattr(self, "_model") and self._model is not None:
            del self._model
        if hasattr(self, "_tokenizer") and self._tokenizer is not None:
            del self._tokenizer

        self._model = None
        self._tokenizer = None

        # Force GPU memory cleanup if available
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return True

    @property
    def is_loaded(self) -> bool:
        """Check if the model and tokenizer are loaded.

        Returns:
            bool: True if both model and tokenizer are loaded, False otherwise.

        """
        return self._model is not None and self._tokenizer is not None

    def _encode(self, text: str) -> Iterator[dict]:
        """Encode text with the tokenizer, handling long sequences with sliding window.

        Breaks long texts into overlapping chunks that can be processed by the model,
        and yields each chunk with its metadata.

        Args:
            text: Input text to encode.

        Yields:
            dict: Encoded input batch for the model with offset mappings.

        """
        model_inputs = self._tokenizer(
            text,
            truncation=True,
            max_length=self.max_length,
            stride=self.stride,
            return_attention_mask=True,
            return_overflowing_tokens=True,
            return_special_tokens_mask=True,
            return_offsets_mapping=True,
            return_tensors="np",
        )

        num_spans = len(model_inputs["input_ids"])

        for span_idx in range(num_spans):
            span_model_inputs = {}
            for k, v in model_inputs.items():
                span_v = v[span_idx]
                if k in self._tokenizer.model_input_names:
                    tensor = torch.tensor(span_v)
                    if tensor.dtype == torch.int32:
                        tensor = tensor.long()
                    span_model_inputs[k] = tensor.unsqueeze(0).to(self._device)
                elif k == "offset_mapping":
                    ndarray = np.array(span_v)
                    span_model_inputs[k] = ndarray
                else:
                    span_model_inputs[k] = span_v

            yield span_model_inputs

    def extract_entities(self, text: str) -> list[Entity]:
        """Extract named entities from text using Transformers.

        Uses the Hugging Face pipeline approach for named entity recognition,
        converting the results to the standard Entity format.

        Args:
            text: Input text to analyze.

        Returns:
            List[Entity]: List of extracted entities with their positions and labels.

        """
        if not self.is_loaded:
            if not self.load():
                return []

        # Using the pipeline approach for simplicity and robustness
        pipe = pipeline(
            "ner",
            model=self._model,
            tokenizer=self._tokenizer,
            aggregation_strategy=self.aggregation_strategy.name.lower(),
            device=0 if torch.cuda.is_available() else -1,
        )

        # Process the text with newlines replaced for better processing
        ner_output = pipe(text.replace("\n", " "))

        # Convert to our Entity format
        entities = []
        for ent in ner_output:
            entities.append(
                Entity(
                    text=ent["word"],
                    labels=[ent["entity_group"]],
                    start_pos=ent["start"],
                    end_pos=ent["end"],
                    confidence=float(ent["score"]),
                )
            )

        return entities


class TransformersTokenizationModel(TokenizationModel):
    """Hugging Face Transformers implementation of tokenization model.

    This model uses pre-trained transformer tokenizers to split text into tokens,
    preserving token positions and handling subword tokenization.

    Attributes:
        model_path (str): Path or name of the model.
        max_length (Optional[int]): Maximum sequence length for tokenization.
        stride (int): Stride for sliding window processing of long sequences.
        _device (str): Device to run the model on ('cuda:0' or 'cpu').

    """

    def __init__(self, model_path: str, max_length: Optional[int] = None, stride: int = 10):
        """Initialize the Transformers tokenization model.

        Args:
            model_path: Path or name of the model from Hugging Face.
            max_length: Maximum sequence length for tokenization. If None, uses model default.
            stride: Stride for sliding window when processing long sequences.

        """
        self.model_path = model_path
        self.max_length = max_length
        self.stride = stride
        self._model: Optional[PreTrainedModel] = None
        self._tokenizer: Optional[PreTrainedTokenizer] = None
        self._device = "cuda:0" if torch.cuda.is_available() else "cpu"

    def load(self) -> bool:
        """Load the Transformers tokenizer and model.

        The model is loaded for token classification to help with token boundaries.

        Returns:
            bool: True if model loaded successfully, False otherwise.

        """
        try:
            # Load tokenizer with optional max length
            tokenizer_kwargs = {}
            if self.max_length is not None:
                tokenizer_kwargs["model_max_length"] = self.max_length

            self._tokenizer = AutoTokenizer.from_pretrained(self.model_path, **tokenizer_kwargs)

            # Load model (for token classification to get token boundaries)
            self._model = AutoModelForTokenClassification.from_pretrained(self.model_path)
            self._model.to(self._device)
            self._model.eval()

            logger.info(f"Loaded Transformers model from {self.model_path} on {self._device}")
            return True
        except Exception as e:
            logger.error(f"Failed to load Transformers model: {e}")
            return False

    def unload(self) -> bool:
        """Unload the Transformers model and tokenizer from memory.

        Returns:
            bool: True if successful, False otherwise.

        """
        if hasattr(self, "_model") and self._model is not None:
            del self._model
        if hasattr(self, "_tokenizer") and self._tokenizer is not None:
            del self._tokenizer

        self._model = None
        self._tokenizer = None

        # Force GPU memory cleanup if available
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return True

    @property
    def is_loaded(self) -> bool:
        """Check if the model and tokenizer are loaded.

        Returns:
            bool: True if both model and tokenizer are loaded, False otherwise.

        """
        return self._model is not None and self._tokenizer is not None

    def tokenize(self, text: str) -> list[Token]:
        """Tokenize text using the Transformers tokenizer.

        Breaks the text into tokens, preserving the original positions in the text,
        and filtering out special tokens and empty spans.

        Args:
            text: Input text to tokenize.

        Returns:
            List[Token]: List of extracted tokens with their positions.

        """
        if not self.is_loaded:
            if not self.load():
                return []

        # Tokenize using the tokenizer, with metadata for positions
        encoded = self._tokenizer(
            text.replace("\n", " "),
            return_offsets_mapping=True,
            return_special_tokens_mask=True,
            add_special_tokens=False,
        )

        tokens = []
        for i, (start, end) in enumerate(encoded.offset_mapping):
            # Skip special tokens (like [CLS], [SEP], etc.)
            if encoded.special_tokens_mask[i]:
                continue

            # Skip empty spans
            if start == end:
                continue

            # Get the token text
            token_text = text[start:end]

            tokens.append(
                Token(
                    text=token_text,
                    start_pos=start,
                    end_pos=end,
                    confidence=1.0,  # Transformer tokenizers don't provide confidence scores
                )
            )

        return tokens
