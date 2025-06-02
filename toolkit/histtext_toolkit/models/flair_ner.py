# toolkit/histtext_toolkit/models/flair_ner.py
"""Flair NER implementation."""

from typing import List, Optional
from .ner_base import BaseNERModel, EntitySpan, logger


class FlairNERModel(BaseNERModel):
    """Flair NER model implementation."""
    
    def __init__(
        self,
        model_name: str = "ner",
        use_crf: bool = True,
        **kwargs
    ):
        super().__init__(model_name, **kwargs)
        self.use_crf = use_crf
        self._tagger = None
    
    def load(self) -> bool:
        """Load Flair model."""
        try:
            from flair.models import SequenceTagger
            import flair
            
            logger.info(f"Loading Flair model: {self.model_name}")
            
            # Set device
            import torch
            if torch.cuda.is_available():
                flair.device = torch.device("cuda")
            
            self._tagger = SequenceTagger.load(self.model_name)
            
            self._loaded = True
            logger.info("Successfully loaded Flair model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load Flair model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload Flair model."""
        if self._tagger is not None:
            del self._tagger
            self._tagger = None
        
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using Flair."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            from flair.data import Sentence
            
            # Create sentence
            sentence = Sentence(text)
            
            # Predict
            self._tagger.predict(sentence)
            
            # Extract entities
            entities = []
            for entity in sentence.get_spans('ner'):
                if entity_types is None or entity.tag in entity_types:
                    entities.append(EntitySpan(
                        text=entity.text,
                        labels=[entity.tag],
                        start_pos=entity.start_position,
                        end_pos=entity.end_position,
                        confidence=entity.score
                    ))
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in Flair entity extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def extract_entities_batch(self, texts: List[str], entity_types: Optional[List[str]] = None) -> List[List[EntitySpan]]:
        """Batch processing with Flair."""
        if not texts:
            return []
        
        try:
            from flair.data import Sentence
            
            # Create sentences
            sentences = [Sentence(text) for text in texts if text.strip()]
            
            # Batch predict
            self._tagger.predict(sentences)
            
            # Extract results
            results = []
            sentence_idx = 0
            
            for text in texts:
                if text.strip():
                    if sentence_idx < len(sentences):
                        sentence = sentences[sentence_idx]
                        entities = []
                        for entity in sentence.get_spans('ner'):
                            if entity_types is None or entity.tag in entity_types:
                                entities.append(EntitySpan(
                                    text=entity.text,
                                    labels=[entity.tag],
                                    start_pos=entity.start_position,
                                    end_pos=entity.end_position,
                                    confidence=entity.score
                                ))
                        results.append(entities)
                        sentence_idx += 1
                    else:
                        results.append([])
                else:
                    results.append([])
            
            return results
            
        except Exception as e:
            logger.error(f"Error in Flair batch processing: {e}")
            return [[] for _ in texts]
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types."""
        if "ontonotes" in self.model_name.lower():
            return [
                "PERSON", "NORP", "FAC", "ORG", "GPE", "LOC", "PRODUCT",
                "EVENT", "WORK_OF_ART", "LAW", "LANGUAGE", "DATE", "TIME",
                "PERCENT", "MONEY", "QUANTITY", "ORDINAL", "CARDINAL"
            ]
        else:
            return ["PER", "LOC", "ORG", "MISC"]