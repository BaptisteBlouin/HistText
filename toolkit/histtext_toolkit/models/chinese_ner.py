# toolkit/histtext_toolkit/models/chinese_ner.py
"""Chinese-specialized NER implementations."""

from typing import List, Optional
from .ner_base import BaseNERModel, EntitySpan, logger


class LAC_NERModel(BaseNERModel):
    """Baidu LAC (Lexical Analysis of Chinese) NER model."""
    
    def __init__(self, model_name: str = "lac", mode: str = "ner", **kwargs):
        super().__init__(model_name, **kwargs)
        self.mode = mode
        self._lac = None
    
    def load(self) -> bool:
        """Load LAC model."""
        try:
            from LAC import LAC
            
            logger.info("Loading Baidu LAC model for Chinese NER")
            
            self._lac = LAC(mode=self.mode)
            
            self._loaded = True
            logger.info("Successfully loaded LAC model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load LAC model: {e}")
            logger.info("Install with: pip install lac")
            return False
    
    def unload(self) -> bool:
        """Unload LAC model."""
        if self._lac is not None:
            del self._lac
            self._lac = None
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using LAC."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            # Run LAC
            lac_result = self._lac.run(text)
            words = lac_result[0]
            tags = lac_result[1]
            
            # Extract entities
            entities = []
            current_pos = 0
            
            for word, tag in zip(words, tags):
                # Map LAC tags to standard NER tags
                if tag in ['PER', 'LOC', 'ORG']:
                    if entity_types is None or tag in entity_types:
                        start_pos = text.find(word, current_pos)
                        if start_pos >= 0:
                            entities.append(EntitySpan(
                                text=word,
                                labels=[tag],
                                start_pos=start_pos,
                                end_pos=start_pos + len(word),
                                confidence=0.9
                            ))
                
                current_pos += len(word)
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in LAC entity extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def get_supported_entity_types(self) -> List[str]:
        return ["PER", "LOC", "ORG"]


class HanLP_NERModel(BaseNERModel):
    """HanLP Chinese NER model."""
    
    def __init__(self, model_name: str = "MSRA_NER_BERT_BASE_ZH", **kwargs):
        super().__init__(model_name, **kwargs)
        self._hanlp = None
    
    def load(self) -> bool:
        """Load HanLP model."""
        try:
            import hanlp
            
            logger.info(f"Loading HanLP model: {self.model_name}")
            
            self._hanlp = hanlp.load(self.model_name)
            
            self._loaded = True
            logger.info("Successfully loaded HanLP model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load HanLP model: {e}")
            logger.info("Install with: pip install hanlp")
            return False
    
    def unload(self) -> bool:
        """Unload HanLP model."""
        if self._hanlp is not None:
            del self._hanlp
            self._hanlp = None
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using HanLP."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            # Run HanLP NER
            result = self._hanlp(text)
            
            entities = []
            for entity in result:
                entity_text = entity[0]
                entity_tag = entity[1]
                start_pos = entity[2]
                end_pos = entity[3]
                
                if entity_types is None or entity_tag in entity_types:
                    entities.append(EntitySpan(
                        text=entity_text,
                        labels=[entity_tag],
                        start_pos=start_pos,
                        end_pos=end_pos,
                        confidence=0.9
                    ))
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in HanLP entity extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def get_supported_entity_types(self) -> List[str]:
        return ["PERSON", "LOCATION", "ORGANIZATION"]


class PKUSEG_NERModel(BaseNERModel):
    """PKU Segmentation with NER for Chinese."""
    
    def __init__(self, model_name: str = "default", **kwargs):
        super().__init__(model_name, **kwargs)
        self._seg = None
    
    def load(self) -> bool:
        """Load PKUSEG model."""
        try:
            import pkuseg
            
            logger.info(f"Loading PKUSEG model: {self.model_name}")
            
            self._seg = pkuseg.pkuseg(model_name=self.model_name, postag=True)
            
            self._loaded = True
            logger.info("Successfully loaded PKUSEG model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load PKUSEG model: {e}")
            logger.info("Install with: pip install pkuseg")
            return False
    
    def unload(self) -> bool:
        """Unload PKUSEG model."""
        if self._seg is not None:
            del self._seg
            self._seg = None
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using PKUSEG."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            # Segment and tag
            result = self._seg.cut(text)
            
            entities = []
            current_pos = 0
            
            for word, tag in result:
                # Map POS tags to NER tags
                ner_tag = None
                if tag in ['nr', 'nrf', 'nrg']:  # Person names
                    ner_tag = "PERSON"
                elif tag in ['ns', 'nsf']:  # Place names
                    ner_tag = "LOCATION"
                elif tag in ['nt', 'ntc', 'ntcf']:  # Organization names
                    ner_tag = "ORGANIZATION"
                
                if ner_tag and (entity_types is None or ner_tag in entity_types):
                    start_pos = text.find(word, current_pos)
                    if start_pos >= 0:
                        entities.append(EntitySpan(
                            text=word,
                            labels=[ner_tag],
                            start_pos=start_pos,
                            end_pos=start_pos + len(word),
                            confidence=0.8
                        ))
                
                current_pos += len(word)
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in PKUSEG entity extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def get_supported_entity_types(self) -> List[str]:
        return ["PERSON", "LOCATION", "ORGANIZATION"]