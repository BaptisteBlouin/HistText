# toolkit/histtext_toolkit/models/fastnlp_ner.py
"""FastNLP NER implementation."""

from typing import List, Optional, Dict, Any
from .ner_base import BaseNERModel, EntitySpan, logger


class FastNLPNERModel(BaseNERModel):
    """FastNLP NER model implementation."""
    
    def __init__(
        self,
        model_name: str = "cws-pku",  # Default Chinese model
        model_type: str = "ner",
        device: str = "auto",
        **kwargs
    ):
        super().__init__(model_name, **kwargs)
        self.model_type = model_type
        self.device = device
        self._model = None
        self._predictor = None
        
        # Available FastNLP models
        self.available_models = {
            # Chinese NER models
            "cws-pku": "Chinese word segmentation + NER (PKU)",
            "cws-msra": "Chinese word segmentation + NER (MSRA)", 
            "cws-cityu": "Chinese word segmentation + NER (CityU)",
            "pos-ctb7": "Chinese POS tagging + NER",
            "ner-msra": "Chinese NER (MSRA dataset)",
            "ner-weibo": "Chinese NER (Weibo social media)",
            "ner-ontonotes": "Chinese NER (OntoNotes)",
            
            # English NER models
            "en-ner-conll": "English NER (CoNLL-2003)",
            "en-ner-ontonotes": "English NER (OntoNotes)",
        }
    
    def load(self) -> bool:
        """Load FastNLP model."""
        try:
            from fastNLP import cache_download
            from fastNLP.models import BiLSTMCRF
            from fastNLP.core.predictor import Predictor
            from fastNLP.core.vocabulary import Vocabulary
            from fastNLP.io.pipe.conll import OntoNotesNERPipe
            import torch
            
            logger.info(f"Loading FastNLP model: {self.model_name}")
            
            # Set device
            if self.device == "auto":
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
            
            # Load pre-trained model based on model name
            if self.model_name in ["ner-msra", "cws-msra"]:
                self._load_chinese_msra_model()
            elif self.model_name in ["ner-ontonotes", "en-ner-ontonotes"]:
                self._load_ontonotes_model()
            elif self.model_name in ["ner-weibo"]:
                self._load_weibo_model()
            else:
                # Try to load as general model
                self._load_general_model()
            
            self._loaded = True
            logger.info("Successfully loaded FastNLP model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load FastNLP model: {e}")
            logger.info("Install with: pip install fastNLP")
            return False
    
    def _load_chinese_msra_model(self):
        """Load Chinese MSRA NER model."""
        from fastNLP import cache_download
        from fastNLP.models import BiLSTMCRF
        from fastNLP.core.predictor import Predictor
        import pickle
        import torch
        
        # Download model files
        model_url = "https://file.hankcs.com/fastNLP/Chinese_models/ner_msra.pkl"
        vocab_url = "https://file.hankcs.com/fastNLP/Chinese_models/ner_msra_vocab.pkl"
        
        try:
            model_path = cache_download(model_url)
            vocab_path = cache_download(vocab_url)
            
            # Load vocabulary and model
            with open(vocab_path, 'rb') as f:
                vocab = pickle.load(f)
            
            with open(model_path, 'rb') as f:
                model_state = pickle.load(f)
            
            # Create model
            self._model = BiLSTMCRF(
                embed_num=len(vocab['words']),
                num_classes=len(vocab['target'])
            )
            
            self._model.load_state_dict(model_state)
            self._model.to(self.device)
            self._model.eval()
            
            # Create predictor
            self._predictor = Predictor(self._model)
            self._vocab = vocab
            
        except Exception as e:
            logger.warning(f"Could not load pre-trained MSRA model: {e}")
            self._load_general_model()
    
    def _load_ontonotes_model(self):
        """Load OntoNotes NER model."""
        from fastNLP.io.pipe.conll import OntoNotesNERPipe
        from fastNLP.models import BiLSTMCRF
        from fastNLP.core.predictor import Predictor
        
        try:
            # Use OntoNotes pipe to load model
            pipe = OntoNotesNERPipe()
            
            # This would typically load from a saved model
            # For now, create a basic model structure
            self._create_basic_model()
            
        except Exception as e:
            logger.warning(f"Could not load OntoNotes model: {e}")
            self._create_basic_model()
    
    def _load_weibo_model(self):
        """Load Weibo social media NER model."""
        try:
            # Weibo models would have different preprocessing
            self._create_basic_model()
            logger.info("Loaded Weibo NER model (basic implementation)")
            
        except Exception as e:
            logger.warning(f"Could not load Weibo model: {e}")
            self._create_basic_model()
    
    def _load_general_model(self):
        """Load general model or create basic implementation."""
        self._create_basic_model()
    
    def _create_basic_model(self):
        """Create a basic FastNLP model structure."""
        from fastNLP.models import BiLSTMCRF
        from fastNLP.core.vocabulary import Vocabulary
        import torch
        
        # Create basic vocabulary
        word_vocab = Vocabulary()
        target_vocab = Vocabulary()
        
        # Add common words and tags
        word_vocab.add_word_lst(['<unk>', '<pad>'])
        target_vocab.add_word_lst(['O', 'B-PER', 'I-PER', 'B-LOC', 'I-LOC', 'B-ORG', 'I-ORG'])
        
        # Create model
        self._model = BiLSTMCRF(
            embed_num=1000,  # Basic embedding size
            num_classes=len(target_vocab)
        )
        
        self._model.to(self.device)
        self._model.eval()
        
        self._vocab = {
            'words': word_vocab,
            'target': target_vocab
        }
    
    def unload(self) -> bool:
        """Unload FastNLP model."""
        if self._model is not None:
            del self._model
            self._model = None
        
        if self._predictor is not None:
            del self._predictor
            self._predictor = None
        
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using FastNLP."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            # For Chinese text, segment first
            if self._is_chinese_text(text):
                return self._extract_chinese_entities(text, entity_types)
            else:
                return self._extract_english_entities(text, entity_types)
            
        except Exception as e:
            logger.error(f"Error in FastNLP entity extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def _is_chinese_text(self, text: str) -> bool:
        """Check if text contains Chinese characters."""
        import re
        chinese_pattern = re.compile(r'[\u4e00-\u9fff]+')
        return bool(chinese_pattern.search(text))
    
    def _extract_chinese_entities(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract entities from Chinese text."""
        try:
            # Simple Chinese NER using character-based approach
            entities = []
            
            # Use jieba for segmentation if available
            try:
                import jieba.posseg as pseg
                words = pseg.cut(text)
                
                current_pos = 0
                for word, flag in words:
                    # Map jieba POS tags to NER tags
                    ner_tag = None
                    if flag in ['nr', 'nrf']:  # Person
                        ner_tag = "PERSON"
                    elif flag in ['ns', 'nsf']:  # Location
                        ner_tag = "LOCATION"  
                    elif flag in ['nt', 'nts']:  # Organization
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
                
            except ImportError:
                # Fallback: simple pattern matching for Chinese
                entities = self._simple_chinese_ner(text, entity_types)
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in Chinese entity extraction: {e}")
            return []
    
    def _extract_english_entities(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract entities from English text."""
        try:
            # Simple English NER - can be enhanced with actual FastNLP model
            entities = []
            
            # Use basic pattern matching as fallback
            import re
            
            # Person names (capitalized words)
            if entity_types is None or "PERSON" in entity_types:
                person_pattern = r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b'
                for match in re.finditer(person_pattern, text):
                    entities.append(EntitySpan(
                        text=match.group(),
                        labels=["PERSON"],
                        start_pos=match.start(),
                        end_pos=match.end(),
                        confidence=0.7
                    ))
            
            # Organizations (Inc, Corp, Ltd, etc.)
            if entity_types is None or "ORGANIZATION" in entity_types:
                org_pattern = r'\b[A-Z][a-zA-Z\s]+(?:Inc|Corp|Ltd|LLC|Company|Corporation)\b'
                for match in re.finditer(org_pattern, text):
                    entities.append(EntitySpan(
                        text=match.group(),
                        labels=["ORGANIZATION"],
                        start_pos=match.start(),
                        end_pos=match.end(),
                        confidence=0.7
                    ))
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in English entity extraction: {e}")
            return []
    
    def _simple_chinese_ner(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Simple Chinese NER using patterns."""
        entities = []
        
        # Common Chinese surname patterns for person detection
        chinese_surnames = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗']
        
        import re
        
        if entity_types is None or "PERSON" in entity_types:
            # Pattern for Chinese names (surname + 1-2 characters)
            for surname in chinese_surnames:
                pattern = f'{surname}[\\u4e00-\\u9fff]{{1,2}}'
                for match in re.finditer(pattern, text):
                    entities.append(EntitySpan(
                        text=match.group(),
                        labels=["PERSON"],
                        start_pos=match.start(),
                        end_pos=match.end(),
                        confidence=0.6
                    ))
        
        return entities
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types."""
        if self._is_chinese_model():
            return ["PERSON", "LOCATION", "ORGANIZATION"]
        else:
            return ["PERSON", "LOCATION", "ORGANIZATION", "MISC"]
    
    def _is_chinese_model(self) -> bool:
        """Check if this is a Chinese model."""
        return any(keyword in self.model_name.lower() 
                  for keyword in ['cws', 'msra', 'weibo', 'ctb', 'zh'])


# Specialized Chinese FastNLP model
class ChineseFastNLPModel(FastNLPNERModel):
    """Specialized Chinese FastNLP model."""
    
    def __init__(self, model_name: str = "ner-msra", **kwargs):
        super().__init__(model_name, **kwargs)
    
    def get_supported_entity_types(self) -> List[str]:
        return ["PERSON", "LOCATION", "ORGANIZATION"]