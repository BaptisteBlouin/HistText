# toolkit/histtext_toolkit/models/allennlp_ner.py
"""AllenNLP NER implementation."""

from typing import List, Optional
from .ner_base import BaseNERModel, EntitySpan, logger


class AllenNLPNERModel(BaseNERModel):
    """AllenNLP NER model implementation."""
    
    def __init__(
        self,
        model_name: str = "ner-model-2020.02.10.tar.gz",
        predictor_name: str = "sentence-tagger",
        **kwargs
    ):
        super().__init__(model_name, **kwargs)
        self.predictor_name = predictor_name
        self._predictor = None
    
    def load(self) -> bool:
        """Load AllenNLP model."""
        try:
            from allennlp.predictors.predictor import Predictor
            import allennlp_models.tagging  # Required for NER models
            
            logger.info(f"Loading AllenNLP model: {self.model_name}")
            
            # Load predictor
            if self.model_name.startswith("http") or self.model_name.endswith(".tar.gz"):
                # Load from URL or file
                self._predictor = Predictor.from_path(self.model_name)
            else:
                # Load from model name
                self._predictor = Predictor.from_path(
                    f"https://storage.googleapis.com/allennlp-public-models/{self.model_name}"
                )
            
            self._loaded = True
            logger.info("Successfully loaded AllenNLP model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load AllenNLP model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload AllenNLP model."""
        if self._predictor is not None:
            del self._predictor
            self._predictor = None
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using AllenNLP."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            # Predict
            result = self._predictor.predict(sentence=text)
            
            # Extract entities
            entities = []
            words = result.get('words', [])
            tags = result.get('tags', [])
            
            current_entity = []
            current_tag = None
            current_start = 0
            
            for i, (word, tag) in enumerate(zip(words, tags)):
                if tag.startswith('B-'):
                    # Start new entity
                    if current_entity:
                        entity = self._create_entity_from_words(
                            current_entity, current_tag, current_start, text
                        )
                        if entity and (entity_types is None or current_tag in entity_types):
                            entities.append(entity)
                    
                    current_entity = [word]
                    current_tag = tag[2:]
                    current_start = self._find_word_start(text, word, i)
                
                elif tag.startswith('I-') and current_tag == tag[2:]:
                    # Continue entity
                    current_entity.append(word)
                
                else:
                    # End entity
                    if current_entity:
                        entity = self._create_entity_from_words(
                            current_entity, current_tag, current_start, text
                        )
                        if entity and (entity_types is None or current_tag in entity_types):
                            entities.append(entity)
                    
                    current_entity = []
                    current_tag = None
            
            # Handle last entity
            if current_entity:
                entity = self._create_entity_from_words(
                    current_entity, current_tag, current_start, text
                )
                if entity and (entity_types is None or current_tag in entity_types):
                    entities.append(entity)
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in AllenNLP entity extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def _find_word_start(self, text: str, word: str, word_index: int) -> int:
        """Find the start position of a word in text."""
        # Simple implementation - can be improved
        words_so_far = text.split()[:word_index]
        estimated_pos = len(' '.join(words_so_far))
        if estimated_pos > 0:
            estimated_pos += 1  # Add space
        
        # Try to find exact position
        actual_pos = text.find(word, estimated_pos)
        return actual_pos if actual_pos >= 0 else estimated_pos
    
    def _create_entity_from_words(self, words: List[str], tag: str, start_pos: int, text: str) -> Optional[EntitySpan]:
        """Create entity from word list."""
        if not words or not tag:
            return None
        
        entity_text = ' '.join(words)
        
        # Find actual position in text
        actual_pos = text.find(entity_text, start_pos)
        if actual_pos >= 0:
            return EntitySpan(
                text=entity_text,
                labels=[tag],
                start_pos=actual_pos,
                end_pos=actual_pos + len(entity_text),
                confidence=0.9
            )
        
        return None
    
    def get_supported_entity_types(self) -> List[str]:
        return ["PER", "ORG", "LOC", "MISC"]