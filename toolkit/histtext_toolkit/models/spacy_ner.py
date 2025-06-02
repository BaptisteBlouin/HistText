# toolkit/histtext_toolkit/models/spacy_ner.py
"""spaCy NER implementation."""

from typing import List, Optional
from .ner_base import BaseNERModel, EntitySpan, logger


class SpacyNERModel(BaseNERModel):
    """spaCy NER model implementation."""
    
    def __init__(
        self,
        model_name: str,
        exclude: Optional[List[str]] = None,
        **kwargs
    ):
        super().__init__(model_name, **kwargs)
        self.exclude = exclude or ["parser", "tagger", "lemmatizer", "attribute_ruler"]
        self._nlp = None
    
    def load(self) -> bool:
        """Load spaCy model."""
        try:
            import spacy
            
            logger.info(f"Loading spaCy model: {self.model_name}")
            
            self._nlp = spacy.load(self.model_name, exclude=self.exclude)
            
            self._loaded = True
            logger.info("Successfully loaded spaCy model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load spaCy model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload spaCy model."""
        if self._nlp is not None:
            del self._nlp
            self._nlp = None
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using spaCy."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
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
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types."""
        return [
            "PERSON", "NORP", "FAC", "ORG", "GPE", "LOC", "PRODUCT",
            "EVENT", "WORK_OF_ART", "LAW", "LANGUAGE", "DATE", "TIME",
            "PERCENT", "MONEY", "QUANTITY", "ORDINAL", "CARDINAL"
        ]