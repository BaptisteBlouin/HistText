# toolkit/histtext_toolkit/models/stanza_ner.py
"""Stanza NER implementation for multilingual support."""

from typing import List, Optional
from .ner_base import BaseNERModel, EntitySpan, logger


class StanzaNERModel(BaseNERModel):
    """Stanza NER model implementation."""
    
    def __init__(
        self,
        model_name: str = "en",  # Language code
        package: Optional[str] = None,  # Specific package
        processors: str = "tokenize,ner",
        use_gpu: bool = True,
        **kwargs
    ):
        super().__init__(model_name, **kwargs)
        self.language = model_name
        self.package = package
        self.processors = processors
        self.use_gpu = use_gpu
        self._nlp = None
    
    def load(self) -> bool:
        """Load Stanza model."""
        try:
            import stanza
            
            logger.info(f"Loading Stanza model for language: {self.language}")
            
            # Download model if needed
            try:
                if self.package:
                    stanza.download(self.language, package=self.package, verbose=False)
                else:
                    stanza.download(self.language, verbose=False)
            except Exception as e:
                logger.debug(f"Download failed or model already exists: {e}")
            
            # Initialize pipeline
            config = {
                'lang': self.language,
                'processors': self.processors,
                'use_gpu': self.use_gpu,
                'verbose': False
            }
            
            if self.package:
                config['package'] = self.package
            
            self._nlp = stanza.Pipeline(**config)
            
            self._loaded = True
            logger.info(f"Successfully loaded Stanza model for {self.language}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load Stanza model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload Stanza model."""
        if self._nlp is not None:
            del self._nlp
            self._nlp = None
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using Stanza."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            # Process text
            doc = self._nlp(text)
            
            # Extract entities
            entities = []
            for sent in doc.sentences:
                for ent in sent.ents:
                    if entity_types is None or ent.type in entity_types:
                        entities.append(EntitySpan(
                            text=ent.text,
                            labels=[ent.type],
                            start_pos=ent.start_char,
                            end_pos=ent.end_char,
                            confidence=1.0  # Stanza doesn't provide confidence
                        ))
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in Stanza entity extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types for different languages."""
        if self.language == "zh" or self.language == "zh-hans":
            return ["PERSON", "ORG", "GPE", "LOC"]
        elif self.language == "de":
            return ["PER", "ORG", "LOC", "MISC"]
        else:
            return ["PERSON", "ORG", "GPE", "LOC", "MISC"]


# Specialized Chinese Stanza model
class ChineseStanzaNERModel(StanzaNERModel):
    """Specialized Chinese Stanza NER model."""
    
    def __init__(self, model_name: str = "zh-hans", **kwargs):
        super().__init__(model_name, **kwargs)
    
    def get_supported_entity_types(self) -> List[str]:
        return ["PERSON", "ORG", "GPE", "LOC", "FACILITY", "EVENT"]