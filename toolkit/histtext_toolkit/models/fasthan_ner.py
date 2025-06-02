# toolkit/histtext_toolkit/models/fasthan_ner.py
"""FastHan Chinese NER implementation."""

from typing import List, Optional
from .ner_base import BaseNERModel, EntitySpan, logger


class FastHanNERModel(BaseNERModel):
    """FastHan Chinese NER model implementation."""
    
    def __init__(
        self,
        model_name: str = "base",  # base, large, or specific model
        device: str = "auto",
        use_seg: bool = True,
        use_pos: bool = True,
        use_ner: bool = True,
        **kwargs
    ):
        super().__init__(model_name, **kwargs)
        self.device = device
        self.use_seg = use_seg
        self.use_pos = use_pos
        self.use_ner = use_ner
        self._model = None
        
        # Available FastHan models
        self.available_models = {
            "base": "FastHan base model (default)",
            "large": "FastHan large model (better accuracy)",
            "small": "FastHan small model (faster)",
        }
    
    def load(self) -> bool:
        """Load FastHan model."""
        try:
            from fasthan import FastHan
            import torch
            
            logger.info(f"Loading FastHan model: {self.model_name}")
            
            # Set device
            if self.device == "auto":
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
            
            # Create FastHan model
            model_kwargs = {
                'model_type': self.model_name,
                'device': self.device,
                'use_seg': self.use_seg,
                'use_pos': self.use_pos, 
                'use_ner': self.use_ner
            }
            
            self._model = FastHan(**model_kwargs)
            
            self._loaded = True
            logger.info("Successfully loaded FastHan model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load FastHan model: {e}")
            logger.info("Install with: pip install fasthan")
            return False
    
    def unload(self) -> bool:
        """Unload FastHan model."""
        if self._model is not None:
            del self._model
            self._model = None
        
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using FastHan."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            # Process text with FastHan
            result = self._model(text)
            
            entities = []
            
            # FastHan returns different formats based on enabled tasks
            if isinstance(result, list):
                # Multiple sentences
                for sent_result in result:
                    entities.extend(self._extract_from_sentence(sent_result, text, entity_types))
            else:
                # Single sentence
                entities = self._extract_from_sentence(result, text, entity_types)
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in FastHan entity extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def _extract_from_sentence(self, sent_result, original_text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract entities from a single sentence result."""
        entities = []
        
        try:
            # FastHan returns results in different formats
            if hasattr(sent_result, 'get_ner_result'):
                # New API
                ner_result = sent_result.get_ner_result()
            elif isinstance(sent_result, dict) and 'NER' in sent_result:
                # Dictionary format
                ner_result = sent_result['NER']
            elif hasattr(sent_result, 'ner'):
                # Attribute access
                ner_result = sent_result.ner
            else:
                # Try to parse as list
                ner_result = sent_result
            
            # Process NER results
            if isinstance(ner_result, list):
                current_pos = 0
                
                for item in ner_result:
                    if isinstance(item, tuple) and len(item) >= 2:
                        word, tag = item[0], item[1]
                        
                        # Map FastHan tags to standard NER tags
                        ner_tag = self._map_fasthan_tag(tag)
                        
                        if ner_tag and (entity_types is None or ner_tag in entity_types):
                            # Find position in original text
                            start_pos = original_text.find(word, current_pos)
                            if start_pos >= 0:
                                entities.append(EntitySpan(
                                    text=word,
                                    labels=[ner_tag],
                                    start_pos=start_pos,
                                    end_pos=start_pos + len(word),
                                    confidence=0.9
                                ))
                        
                        current_pos += len(word)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error processing FastHan sentence result: {e}")
            return []
    
    def _map_fasthan_tag(self, tag: str) -> Optional[str]:
        """Map FastHan NER tags to standard tags."""
        # FastHan uses BIO tagging with specific entity types
        if tag.startswith('B-') or tag.startswith('I-'):
            entity_type = tag[2:]
            
            # Map FastHan entity types
            mapping = {
                'PER': 'PERSON',
                'PERSON': 'PERSON',
                'LOC': 'LOCATION', 
                'LOCATION': 'LOCATION',
                'ORG': 'ORGANIZATION',
                'ORGANIZATION': 'ORGANIZATION',
                'GPE': 'LOCATION',  # Geopolitical entity -> Location
                'MISC': 'MISCELLANEOUS'
            }
            
            return mapping.get(entity_type, entity_type)
        
        return None
    
    def extract_entities_batch(self, texts: List[str], entity_types: Optional[List[str]] = None) -> List[List[EntitySpan]]:
        """Batch processing with FastHan."""
        if not texts:
            return []
        
        try:
            # FastHan supports batch processing
            if hasattr(self._model, 'batch_process'):
                # Use native batch processing if available
                batch_results = self._model.batch_process(texts)
                
                results = []
                for i, result in enumerate(batch_results):
                    entities = self._extract_from_sentence(result, texts[i], entity_types)
                    results.append(entities)
                
                return results
            else:
                # Process individually
                return super().extract_entities_batch(texts, entity_types)
            
        except Exception as e:
            logger.error(f"Error in FastHan batch processing: {e}")
            return [[] for _ in texts]
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types for FastHan."""
        return ["PERSON", "LOCATION", "ORGANIZATION", "MISCELLANEOUS"]
    
    def get_model_info(self) -> dict:
        """Get information about the loaded model."""
        info = {
            "model_name": self.model_name,
            "device": self.device,
            "use_seg": self.use_seg,
            "use_pos": self.use_pos,
            "use_ner": self.use_ner,
            "is_loaded": self.is_loaded
        }
        
        if self._model and hasattr(self._model, 'model_type'):
            info["actual_model_type"] = self._model.model_type
        
        return info


# Specialized models for different use cases
class FastHanBaseModel(FastHanNERModel):
    """FastHan base model - balanced speed and accuracy."""
    
    def __init__(self, **kwargs):
        super().__init__(model_name="base", **kwargs)


class FastHanLargeModel(FastHanNERModel):
    """FastHan large model - best accuracy."""
    
    def __init__(self, **kwargs):
        super().__init__(model_name="large", **kwargs)


class FastHanSmallModel(FastHanNERModel):
    """FastHan small model - fastest speed."""
    
    def __init__(self, **kwargs):
        super().__init__(model_name="small", **kwargs)