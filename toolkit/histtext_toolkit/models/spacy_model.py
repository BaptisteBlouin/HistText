"""spaCy model implementation.

This module provides spaCy-based implementations of the NER and tokenization models
with optimized loading and processing capabilities.
"""

from typing import Optional

import spacy
from spacy.language import Language
from toolkit.histtext_toolkit.models.base import EntitySpan

from ..core.logging import get_logger
from .ner_base import Entity, NERModel, Token, TokenizationModel

logger = get_logger(__name__)


class SpacyNERModel(NERModel):
    """spaCy implementation of named entity recognition model.

    This model uses spaCy's built-in NER capabilities to extract named entities
    from text, with optimized loading by excluding unnecessary pipeline components.

    Attributes:
        model_path (str): Path to the spaCy model.
        exclude (List[str]): Components to exclude when loading the model.

    """

    def __init__(self, model_path: str, exclude: list[str] = None):
        """Initialize the spaCy NER model.

        Args:
            model_path: Path to the spaCy model or model name (e.g., "en_core_web_sm").
            exclude: Components to exclude when loading the model. Defaults to
                excluding parser, tagger, lemmatizer, and attribute_ruler to optimize
                loading time and memory usage.

        """
        self.model_path = model_path
        self.exclude = exclude or ["parser", "tagger", "lemmatizer", "attribute_ruler"]
        self._model: Optional[Language] = None

    def load(self) -> bool:
        """Load the spaCy model with only the necessary components.

        Returns:
            bool: True if model loaded successfully, False otherwise.

        """
        try:
            self._model = spacy.load(self.model_path, exclude=self.exclude)
            logger.info(f"Loaded spaCy model from {self.model_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to load spaCy model: {e}")
            return False

    def unload(self) -> bool:
        """Unload the spaCy model from memory.

        Returns:
            bool: True if successful, False otherwise.

        """
        self._model = None
        return True

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded.

        Returns:
            bool: True if the model is loaded, False otherwise.

        """
        return self._model is not None

    def extract_entities(self, text: str) -> list[Entity]:
        """Extract named entities from text using spaCy.

        Processes the text through spaCy's pipeline and extracts entities
        with their types and positions.

        Args:
            text: Input text to analyze.

        Returns:
            List[Entity]: List of extracted entities with their positions and labels.

        """
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        # Convert empty list to None
        if entity_types is not None and len(entity_types) == 0:
            entity_types = None
        
        try:
            # Process text
            doc = self._nlp(text.replace("\n", " "))
            
            # Extract entities
            entities = []
            for ent in doc.ents:
                if entity_types is None or ent.label_ in entity_types:
                    entities.append(EntitySpan(
                        text=ent.text,
                        labels=[ent.label_],
                        start_pos=ent.start_char,
                        end_pos=ent.end_char,
                        confidence=1.0  # spaCy doesn't provide confidence scores
                    ))
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in spaCy entity extraction: {e}")
            self._stats.error_count += 1
            return []


class SpacyTokenizationModel(TokenizationModel):
    """spaCy implementation of tokenization model.

    This model uses spaCy's tokenizer to split text into tokens with their positions,
    optimized for speed by excluding unnecessary pipeline components.

    Attributes:
        model_path (str): Path to the spaCy model.
        exclude (List[str]): Components to exclude when loading the model.

    """

    def __init__(self, model_path: str, exclude: list[str] = None):
        """Initialize the spaCy tokenization model.

        Args:
            model_path: Path to the spaCy model or model name (e.g., "en_core_web_sm").
            exclude: Components to exclude when loading the model. Defaults to
                excluding ner, parser, tagger, lemmatizer, and attribute_ruler since
                they're not needed for tokenization.

        """
        self.model_path = model_path
        self.exclude = exclude or [
            "ner",
            "parser",
            "tagger",
            "lemmatizer",
            "attribute_ruler",
        ]
        self._model: Optional[Language] = None

    def load(self) -> bool:
        """Load the spaCy model with only tokenization components.

        Returns:
            bool: True if model loaded successfully, False otherwise.

        """
        try:
            self._model = spacy.load(self.model_path, exclude=self.exclude)
            logger.info(f"Loaded spaCy model from {self.model_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to load spaCy model: {e}")
            return False

    def unload(self) -> bool:
        """Unload the spaCy model from memory.

        Returns:
            bool: True if successful, False otherwise.

        """
        self._model = None
        return True

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded.

        Returns:
            bool: True if the model is loaded, False otherwise.

        """
        return self._model is not None

    def tokenize(self, text: str) -> list[Token]:
        """Tokenize text using spaCy's tokenizer.

        Splits the input text into tokens with their character positions.

        Args:
            text: Input text to tokenize.

        Returns:
            List[Token]: List of extracted tokens with their positions.

        """
        if not self.is_loaded:
            if not self.load():
                return []

        # Process the text with newlines replaced by spaces for better tokenization
        doc = self._model(text.replace("\n", " "))

        # Extract tokens
        tokens = []
        for token in doc:
            tokens.append(
                Token(
                    text=token.text,
                    start_pos=token.idx,
                    end_pos=token.idx + len(token.text),
                    confidence=-1.0,  # spaCy doesn't provide confidence scores for tokens
                )
            )

        return tokens
