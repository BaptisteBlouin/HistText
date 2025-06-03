import warnings
from typing import List, Optional, Dict, Any
import torch
from transformers import (
    pipeline, AutoTokenizer, AutoModelForTokenClassification, 
    AutoConfig, AutoModel
)

from .ner_base import BaseNERModel, EntitySpan, logger
from .domain_utils import DomainUtils, HistoricalTextProcessor, MultilingualProcessor

# Add this at the top of the class or as a module-level constant
COMPREHENSIVE_ENTITY_MAPPING = {
    # Standard CoNLL-2003 entities
    'PER': 'PERSON',
    'PERSON': 'PERSON',
    'LOC': 'LOCATION', 
    'LOCATION': 'LOCATION',
    'ORG': 'ORGANIZATION',
    'ORGANIZATION': 'ORGANIZATION',
    'MISC': 'MISCELLANEOUS',
    'MISCELLANEOUS': 'MISCELLANEOUS',
    
    # OntoNotes 5.0 entities
    'NORP': 'NORP',  # Nationalities, religious, political groups
    'FAC': 'FACILITY',
    'FACILITY': 'FACILITY',
    'GPE': 'GEOPOLITICAL',  # Countries, cities, states
    'GEOPOLITICAL': 'GEOPOLITICAL',
    'PRODUCT': 'PRODUCT',
    'EVENT': 'EVENT',
    'WORK_OF_ART': 'WORK_OF_ART',
    'LAW': 'LAW',
    'LANGUAGE': 'LANGUAGE',
    
    # Temporal entities
    'DATE': 'DATE',
    'TIME': 'TIME',
    
    # Numeric entities
    'PERCENT': 'PERCENT',
    'PERCENTAGE': 'PERCENT',
    'MONEY': 'MONEY',
    'QUANTITY': 'QUANTITY',
    'ORDINAL': 'ORDINAL',
    'CARDINAL': 'CARDINAL',
    'NUMBER': 'CARDINAL',
    
    # Biomedical entities (for bio models)
    'CHEMICAL': 'CHEMICAL',
    'DISEASE': 'DISEASE',
    'DRUG': 'DRUG',
    'GENE': 'GENE',
    'PROTEIN': 'PROTEIN',
    'CELL_TYPE': 'CELL_TYPE',
    'CELL_LINE': 'CELL_LINE',
    'DNA': 'DNA',
    'RNA': 'RNA',
    
    # Financial entities
    'TICKER': 'TICKER',
    'STOCK': 'STOCK',
    'CURRENCY': 'CURRENCY',
    
    # Legal entities
    'COURT': 'COURT',
    'JUDGE': 'JUDGE',
    'LAWYER': 'LAWYER',
    'CASE': 'CASE',
    
    # Academic/Scientific
    'UNIVERSITY': 'UNIVERSITY',
    'JOURNAL': 'JOURNAL',
    'CONFERENCE': 'CONFERENCE',
    
    # Technology
    'SOFTWARE': 'SOFTWARE',
    'ALGORITHM': 'ALGORITHM',
    'PROGRAMMING_LANGUAGE': 'PROGRAMMING_LANGUAGE',
    
    # Geographic
    'CONTINENT': 'CONTINENT',
    'COUNTRY': 'COUNTRY',
    'STATE': 'STATE',
    'CITY': 'CITY',
    'RIVER': 'RIVER',
    'MOUNTAIN': 'MOUNTAIN',
    
    # Historical
    'DYNASTY': 'DYNASTY',
    'EMPIRE': 'EMPIRE',
    'TITLE': 'TITLE',
    'ARTIFACT': 'ARTIFACT',
    
    # Default fallback
    'ENT': 'ENTITY',
    'ENTITY': 'ENTITY',
    'UNK': 'UNKNOWN',
    'UNKNOWN': 'UNKNOWN',
    'OTHER': 'OTHER',
}




class TransformersNERModel(BaseNERModel):
    """Enhanced Transformers-based NER model with robust model detection."""
    
    def __init__(
        self,
        model_name: str,
        aggregation_strategy: str = "simple",
        max_length: int = 512,
        domain: str = "general",
        enable_pattern_enhancement: bool = True,
        enable_historical_processing: bool = False,
        auto_detect_language: bool = True,
        force_pattern_only: bool = False,
        **kwargs  # Catch any additional parameters
    ):
        # Filter out any duplicate parameters from kwargs
        filtered_kwargs = {}
        for key, value in kwargs.items():
            if key not in ['model_name', 'aggregation_strategy', 'max_length', 'domain', 
                          'enable_pattern_enhancement', 'enable_historical_processing', 
                          'auto_detect_language', 'force_pattern_only']:
                filtered_kwargs[key] = value
        
        super().__init__(model_name, **filtered_kwargs)
        self.aggregation_strategy = self._get_optimal_aggregation_strategy(model_name)
        self.max_length = max_length
        self.domain = domain
        self.enable_pattern_enhancement = enable_pattern_enhancement
        self.enable_historical_processing = enable_historical_processing
        self.auto_detect_language = auto_detect_language
        self.force_pattern_only = force_pattern_only
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        self._pipeline = None
        self._tokenizer = None
        self._model = None
        self._detected_language = "en"
        self._model_type = "unknown"  # Track what type of model we loaded
        self._supports_ner = False
        
        # Auto-recommend model if using generic name
        if model_name in ["auto", "multilingual", "historical"]:
            self.model_name = self._get_recommended_model(model_name)
            logger.info(f"Auto-selected model: {self.model_name}")
    
    
    
    def normalize_entity_type(self, entity_type: str) -> str:
        """Normalize entity type using comprehensive mapping."""
        if not entity_type:
            return 'UNKNOWN'
        
        # Remove B-, I-, L-, U- prefixes from BIO tagging
        clean_type = entity_type
        if entity_type.startswith(('B-', 'I-', 'L-', 'U-')):
            clean_type = entity_type[2:]
        
        # Convert to uppercase for consistent lookup
        clean_type = clean_type.upper().strip()
        
        # Apply mapping
        normalized = COMPREHENSIVE_ENTITY_MAPPING.get(clean_type, clean_type)
        
        return normalized

    def _get_optimal_aggregation_strategy(self, model_name: str) -> str:
        """Automatically select the best aggregation strategy based on the model."""
        model_lower = model_name.lower()
        
        # Model-specific optimal strategies based on empirical performance
        strategy_mapping = {
            # BERT-based models
            'bert': 'first',
            'distilbert': 'first',
            'roberta': 'first',
            'xlm-roberta': 'first',
            
            # Large language models
            'gpt': 'first',
            'llama': 'first', 
            'mistral': 'first',
            'qwen': 'first',
            
            # Specialized NER models
            'ner': 'simple',
            'conll': 'simple',
            'ontonotes': 'average',
            
            # Multilingual models
            'multilingual': 'simple',
            'mbert': 'simple',
            'xlm': 'simple',
            
            # Fast/efficient models
            'distil': 'first',
            'mobile': 'first',
            'tiny': 'first',
            'mini': 'first',
            
            # Domain-specific
            'bio': 'average',
            'clinical': 'average',
            'legal': 'simple',
            'financial': 'simple',
            'news': 'simple',
            
            # Historical/specialized
            'historic': 'simple',
            'ancient': 'simple',
            'medieval': 'simple',
        }
        
        # Check for specific model patterns
        for pattern, strategy in strategy_mapping.items():
            if pattern in model_lower:
                logger.info(f"Auto-selected aggregation strategy '{strategy}' for {pattern} model")
                return strategy
        
        # Check by model size indicators
        if any(size in model_lower for size in ['large', 'xl', 'xxl']):
            logger.info("Auto-selected 'average' aggregation for large model")
            return 'average'
        elif any(size in model_lower for size in ['small', 'tiny', 'mini']):
            logger.info("Auto-selected 'first' aggregation for small/fast model")
            return 'first'
        elif 'base' in model_lower:
            logger.info("Auto-selected 'simple' aggregation for base model")
            return 'simple'
        
        # Default fallback
        logger.info("Using default 'simple' aggregation strategy")
        return 'simple'

    
    def _get_recommended_model(self, model_type: str) -> str:
        """Get recommended model based on type."""
        recommendations = {
            "auto": "xlm-roberta-base-finetuned-conll03-english",
            "multilingual": "xlm-roberta-large-finetuned-conll03-english", 
            "historical": "dbmdz/bert-base-historic-multilingual-cased",
        }
        return recommendations.get(model_type, model_type)
    
    def _check_model_compatibility(self) -> Dict[str, Any]:
        """Check if model is compatible with NER tasks."""
        try:
            # Try to load config to understand model capabilities
            config = AutoConfig.from_pretrained(self.model_name)
            
            info = {
                "has_token_classification": hasattr(config, 'num_labels') and hasattr(config, 'id2label'),
                "has_labels": hasattr(config, 'id2label') and config.id2label is not None,
                "num_labels": getattr(config, 'num_labels', 0),
                "labels": getattr(config, 'id2label', {}),
                "model_type": getattr(config, 'model_type', 'unknown'),
                "architectures": getattr(config, 'architectures', [])
            }
            
            # Check if this looks like a NER model
            if info["has_token_classification"] and info["num_labels"] > 2:
                info["likely_ner_model"] = True
            elif any("TokenClassification" in arch for arch in info["architectures"]):
                info["likely_ner_model"] = True
            else:
                info["likely_ner_model"] = False
            
            return info
            
        except Exception as e:
            logger.warning(f"Could not check model compatibility: {e}")
            return {"likely_ner_model": False, "error": str(e)}
    
    def load(self) -> bool:
        """Load transformers model with comprehensive compatibility checking."""
        try:
            logger.info(f"Loading Enhanced Transformers model: {self.model_name}")
            
            # Check model compatibility first
            compat_info = self._check_model_compatibility()
            logger.info(f"Model compatibility: {compat_info}")
            
            if self.force_pattern_only:
                logger.info("Force pattern-only mode enabled")
                self._model_type = "pattern_only"
                self._supports_ner = False
                self._loaded = True
                return True
            
            # If model doesn't look like a NER model, warn but try anyway
            if not compat_info.get("likely_ner_model", False):
                logger.warning(f"Model {self.model_name} may not be designed for NER tasks")
                logger.warning("Will attempt to load but may fall back to pattern-based extraction")
            
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore")
                
                # Strategy 1: Try NER pipeline
                success = self._try_ner_pipeline()
                if success:
                    logger.info("✅ Successfully loaded as NER pipeline")
                    return True
                
                # Strategy 2: Try manual token classification loading
                success = self._try_manual_token_classification()
                if success:
                    logger.info("✅ Successfully loaded as manual token classification")
                    return True
                
                # Strategy 3: Try as base model with pattern extraction
                success = self._try_base_model_with_patterns()
                if success:
                    logger.warning("⚠️ Loaded as base model - using pattern-based NER only")
                    return True
                
                # Strategy 4: Pattern-only fallback
                logger.error(f"❌ Could not load {self.model_name} as transformer model")
                logger.info("Falling back to pattern-based NER only")
                self._model_type = "pattern_only"
                self._supports_ner = False
                self._loaded = True
                return True
            
        except Exception as e:
            logger.error(f"Failed to load model with all strategies: {e}")
            return False
    
    def _try_ner_pipeline(self) -> bool:
        """Try loading as NER pipeline with proper aggregation."""
        try:
            logger.info(f"Attempting to load {self.model_name} as NER pipeline...")
            
            # Remove the problematic parameter
            pipeline_kwargs = {
                "model": self.model_name,
                "aggregation_strategy": self.aggregation_strategy,
                "device": 0 if self.device == "cuda" else -1,
                "trust_remote_code": True,
                # "return_all_scores": False,  # Remove this line - it's causing the error
            }
            
            self._pipeline = pipeline("ner", **pipeline_kwargs)
            
            # Test the pipeline with a simple example
            test_text = "John Smith works at Microsoft in Seattle."
            test_result = self._pipeline(test_text)
            
            logger.info(f"Pipeline test successful: found {len(test_result)} entities")
            if test_result:
                logger.info(f"Sample entity: {test_result[0]}")
                # Check if aggregation worked
                entity_texts = [r.get('word', r.get('entity_group', '')) for r in test_result]
                logger.info(f"Entity texts: {entity_texts}")
            
            self._model_type = "pipeline"
            self._supports_ner = True
            self._loaded = True
            logger.info("Successfully loaded as NER pipeline with aggregation")
            return True
            
        except Exception as e:
            logger.warning(f"NER pipeline loading failed: {e}")
            return False
    
    def _try_manual_token_classification(self) -> bool:
        """Try manual token classification loading."""
        try:
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForTokenClassification.from_pretrained(self.model_name)
            self._model.to(self.device)
            self._model.eval()
            
            # Verify model has proper config for NER
            if not hasattr(self._model.config, 'id2label'):
                raise ValueError("Model config missing id2label mapping")
            
            self._model_type = "manual_token_classification"
            self._supports_ner = True
            self._loaded = True
            logger.info("Successfully loaded as manual token classification model")
            return True
            
        except Exception as e:
            logger.debug(f"Manual token classification loading failed: {e}")
            # Clean up partial loading
            if self._tokenizer:
                del self._tokenizer
                self._tokenizer = None
            if self._model:
                del self._model
                self._model = None
            return False
    
    def _try_base_model_with_patterns(self) -> bool:
        """Try loading as base model for embeddings + patterns."""
        try:
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModel.from_pretrained(self.model_name)
            self._model.to(self.device)
            self._model.eval()
            
            self._model_type = "base_model_with_patterns"
            self._supports_ner = False  # No direct NER capability
            self._loaded = True
            logger.info("Successfully loaded as base model (will use pattern-based NER)")
            return True
            
        except Exception as e:
            logger.debug(f"Base model loading failed: {e}")
            # Clean up partial loading
            if self._tokenizer:
                del self._tokenizer
                self._tokenizer = None
            if self._model:
                del self._model
                self._model = None
            return False
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Enhanced entity extraction with robust fallbacks."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            # Detect language if enabled
            if self.auto_detect_language:
                self._detected_language = DomainUtils.detect_language(text)
                logger.debug(f"Detected language: {self._detected_language}")
            
            # Preprocess text based on domain
            processed_text = self._preprocess_text(text)
            
            # Extract entities based on model type
            transformer_entities = []
            
            if self._supports_ner and self._model_type == "pipeline":
                transformer_entities = self._extract_with_pipeline(processed_text, entity_types)
            elif self._supports_ner and self._model_type == "manual_token_classification":
                transformer_entities = self._extract_with_manual_model(processed_text, entity_types)
            else:
                logger.debug(f"Model type {self._model_type} doesn't support direct NER, using patterns only")
            
            # Always use pattern enhancement (especially important for non-NER models)
            pattern_entities = []
            if self.enable_pattern_enhancement or not self._supports_ner:
                pattern_entities = DomainUtils.enhance_entities_with_patterns(
                    transformer_entities, text, self._detected_language, self.domain
                )
            
            # Combine entities
            all_entities = transformer_entities + pattern_entities
            final_entities = self._deduplicate_entities(all_entities) if all_entities else []
            
            # Adjust positions if text was preprocessed
            if processed_text != text and final_entities:
                final_entities = self._adjust_entity_positions(final_entities, text, processed_text)
            
            logger.debug(f"Extracted: {len(transformer_entities)} transformer + {len(pattern_entities)} pattern = {len(final_entities)} final")
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(final_entities)
            
            return final_entities
            
        except Exception as e:
            logger.error(f"Error in Enhanced Transformers extraction: {e}")
            self._stats.error_count += 1
            
            # Final fallback: pattern-only extraction
            try:
                logger.info("Attempting pattern-only fallback extraction")
                pattern_entities = DomainUtils.enhance_entities_with_patterns(
                    [], text, self._detected_language, self.domain
                )
                return pattern_entities
            except Exception as fallback_error:
                logger.error(f"Even pattern fallback failed: {fallback_error}")
                return []
    
    def _preprocess_text(self, text: str) -> str:
        """Preprocess text based on domain and language."""
        processed_text = text
        
        if self.enable_historical_processing or self.domain == "historical":
            processed_text = HistoricalTextProcessor.normalize_historical_spelling(processed_text)
            logger.debug("Applied historical text preprocessing")
        
        if self.auto_detect_language and self._detected_language in ['zh', 'ja', 'ko']:
            processed_text, _ = MultilingualProcessor.detect_and_process(processed_text)
            logger.debug("Applied multilingual preprocessing")
        
        return processed_text
    
    def _extract_with_pipeline(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract using NER pipeline."""
        try:
            results = self._pipeline(text)
            
            entities = []
            for result in results:
                # Get the entity label
                entity_label = result.get("entity_group", result.get("entity", "UNKNOWN"))
                
                # Clean the label (remove B-, I- prefixes if present)
                if entity_label.startswith(('B-', 'I-')):
                    entity_label = entity_label[2:]
                
                # Filter by entity types if specified
                if entity_types:
                    # Handle both direct match and BIO tag match
                    if entity_label not in entity_types:
                        continue
                
                # Clean up entity text
                entity_text = result["word"].replace("##", "").replace("▁", " ").strip()
                
                if entity_text and len(entity_text) > 0:
                    entities.append(EntitySpan(
                        text=entity_text,
                        labels=[entity_label],  # Use the actual NER label
                        start_pos=result["start"],
                        end_pos=result["end"],
                        confidence=result["score"]
                    ))
            
            return entities
            
        except Exception as e:
            logger.error(f"Pipeline extraction error: {e}")
        return []
    
    def _extract_with_manual_model(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract using manual token classification model."""
        try:
            # Tokenize
            inputs = self._tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length,
                padding=True,
                return_offsets_mapping=True,
                add_special_tokens=True
            ).to(self.device)
            
            # Get predictions
            with torch.no_grad():
                outputs = self._model(**{k: v for k, v in inputs.items() if k != "offset_mapping"})
                logits = outputs.logits
                predictions = torch.nn.functional.softmax(logits, dim=-1)
                predicted_labels = torch.argmax(logits, dim=-1)
            
            # Convert to entities
            entities = self._process_token_predictions(
                text, inputs, predicted_labels[0], predictions[0], entity_types
            )
            
            return entities
            
        except Exception as e:
            logger.error(f"Manual model extraction error: {e}")
            return []
    
    def _process_token_predictions(self, text: str, inputs: dict, predicted_labels: torch.Tensor, 
                             predictions: torch.Tensor, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Process token predictions with proper BIO aggregation."""
        entities = []
        
        try:
            input_ids = inputs["input_ids"][0]
            tokens = self._tokenizer.convert_ids_to_tokens(input_ids)
            offset_mapping = inputs.get("offset_mapping")
            
            if offset_mapping is not None:
                offset_mapping = offset_mapping[0].cpu().numpy()
            else:
                # Create approximate offset mapping
                offset_mapping = []
                current_pos = 0
                for token in tokens:
                    clean_token = token.replace("##", "").replace("▁", " ").replace("Ġ", " ")
                    start_pos = text.find(clean_token, current_pos)
                    if start_pos >= 0:
                        end_pos = start_pos + len(clean_token)
                        offset_mapping.append((start_pos, end_pos))
                        current_pos = end_pos
                    else:
                        offset_mapping.append((current_pos, current_pos))
            
            # Get label mapping
            if hasattr(self._model.config, 'id2label'):
                id2label = self._model.config.id2label
            else:
                id2label = {i: f"LABEL_{i}" for i in range(self._model.config.num_labels)}
            
            # Process tokens with proper BIO aggregation
            current_entity_tokens = []
            current_entity_type = None
            current_entity_start = None
            current_entity_end = None
            
            for i, (token, offset) in enumerate(zip(tokens, offset_mapping)):
                if token in self._tokenizer.all_special_tokens:
                    continue
                
                label_id = predicted_labels[i].item()
                label = id2label.get(label_id, "O")
                
                # Handle BIO tagging properly
                if label.startswith("B-"):
                    # Beginning of new entity - save previous entity if exists
                    if current_entity_tokens and current_entity_type:
                        entity = self._create_aggregated_entity(
                            current_entity_tokens, current_entity_type, 
                            current_entity_start, current_entity_end, text
                        )
                        if entity and self._entity_matches_filter(entity, entity_types):
                            entities.append(entity)
                    
                    # Start new entity
                    current_entity_type = label[2:]  # Remove B- prefix
                    current_entity_tokens = [token]
                    current_entity_start = offset[0] if len(offset) == 2 else None
                    current_entity_end = offset[1] if len(offset) == 2 else None
                    
                elif label.startswith("I-") and current_entity_type == label[2:]:
                    # Inside entity - continue current entity
                    current_entity_tokens.append(token)
                    if len(offset) == 2:
                        current_entity_end = offset[1]  # Extend end position
                        
                else:
                    # Outside entity or different entity type - save current entity
                    if current_entity_tokens and current_entity_type:
                        entity = self._create_aggregated_entity(
                            current_entity_tokens, current_entity_type,
                            current_entity_start, current_entity_end, text
                        )
                        if entity and self._entity_matches_filter(entity, entity_types):
                            entities.append(entity)
                    
                    # Reset
                    current_entity_tokens = []
                    current_entity_type = None
                    current_entity_start = None
                    current_entity_end = None
            
            # Handle last entity
            if current_entity_tokens and current_entity_type:
                entity = self._create_aggregated_entity(
                    current_entity_tokens, current_entity_type,
                    current_entity_start, current_entity_end, text
                )
                if entity and self._entity_matches_filter(entity, entity_types):
                    entities.append(entity)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error processing token predictions: {e}")
            return []

    def _create_aggregated_entity(self, tokens: List[str], entity_type: str, 
                                start_pos: Optional[int], end_pos: Optional[int], 
                                text: str) -> Optional[EntitySpan]:
        """Create entity from aggregated tokens."""
        try:
            if not tokens or not entity_type:
                return None
            
            # Aggregate tokens properly
            entity_text = ""
            for i, token in enumerate(tokens):
                clean_token = token.replace("##", "").replace("▁", " ").replace("Ġ", " ")
                if i == 0:
                    entity_text = clean_token
                else:
                    # Add space between tokens unless it's a subword
                    if token.startswith("##"):
                        entity_text += clean_token  # No space for subwords
                    else:
                        entity_text += " " + clean_token
            
            entity_text = entity_text.strip()
            
            if not entity_text:
                return None
            
            # Normalize entity type
            normalized_type = self.normalize_entity_type(entity_type)
            
            # Use provided positions or find in text
            if start_pos is not None and end_pos is not None:
                return EntitySpan(
                    text=entity_text,
                    labels=[normalized_type],
                    start_pos=int(start_pos),
                    end_pos=int(end_pos),
                    confidence=0.8
                )
            else:
                # Fallback: find in text
                found_pos = text.find(entity_text)
                if found_pos >= 0:
                    return EntitySpan(
                        text=entity_text,
                        labels=[normalized_type],
                        start_pos=found_pos,
                        end_pos=found_pos + len(entity_text),
                        confidence=0.8
                    )
            
            return None
            
        except Exception as e:
            logger.debug(f"Error creating aggregated entity: {e}")
            return None
    
    def _entity_matches_filter(self, entity: EntitySpan, entity_types: Optional[List[str]]) -> bool:
        """Check if entity matches the filter criteria."""
        if entity_types is None:
            return True
        
        for label in entity.labels:
            # Handle both direct match and BIO tag match
            label_base = label.split("-")[-1] if "-" in label else label
            if label_base in entity_types:
                return True
        
        return False
    
    def _create_entity_from_tokens(self, entity_type: str, tokens: List[str], 
                             start_pos: Optional[int], text: str) -> Optional[EntitySpan]:
        """Create entity from tokens with comprehensive type normalization."""
        try:
            if not tokens or not entity_type:
                return None
            
            # Clean and join tokens
            clean_tokens = []
            for token in tokens:
                clean_token = token.replace("##", "").replace("▁", " ").replace("Ġ", " ")
                clean_tokens.append(clean_token)
            
            entity_text = "".join(clean_tokens).strip()
            
            if not entity_text or len(entity_text) < 1:
                return None
            
            # Normalize entity type using comprehensive mapping
            normalized_entity_type = self.normalize_entity_type(entity_type)
            
            # Find position in text
            if start_pos is not None and start_pos >= 0:
                end_pos = start_pos + len(entity_text)
                if end_pos <= len(text):
                    return EntitySpan(
                        text=entity_text,
                        labels=[normalized_entity_type],
                        start_pos=int(start_pos),
                        end_pos=int(end_pos),
                        confidence=0.8
                    )
            
            # Fallback: search for the text
            found_pos = text.find(entity_text)
            if found_pos >= 0:
                return EntitySpan(
                    text=entity_text,
                    labels=[normalized_entity_type],
                    start_pos=found_pos,
                    end_pos=found_pos + len(entity_text),
                    confidence=0.8
                )
            
            return None
        
        except Exception as e:
            logger.debug(f"Error creating entity from tokens: {e}")
            return None
    
    def _adjust_entity_positions(self, entities: List[EntitySpan], original_text: str, processed_text: str) -> List[EntitySpan]:
        """Adjust entity positions from processed text back to original text."""
        adjusted_entities = []
        
        for entity in entities:
            # Try to find the entity in the original text
            start_pos = original_text.find(entity.text)
            if start_pos >= 0:
                adjusted_entities.append(EntitySpan(
                    text=entity.text,
                    labels=entity.labels,
                    start_pos=start_pos,
                    end_pos=start_pos + len(entity.text),
                    confidence=entity.confidence
                ))
            else:
                # If not found exactly, try case-insensitive
                start_pos = original_text.lower().find(entity.text.lower())
                if start_pos >= 0:
                    actual_text = original_text[start_pos:start_pos + len(entity.text)]
                    adjusted_entities.append(EntitySpan(
                        text=actual_text,
                        labels=entity.labels,
                        start_pos=start_pos,
                        end_pos=start_pos + len(actual_text),
                        confidence=entity.confidence
                    ))
                else:
                    # Keep original positions as approximation
                    adjusted_entities.append(entity)
        
        return adjusted_entities
    
    def _deduplicate_entities(self, entities: List[EntitySpan]) -> List[EntitySpan]:
        """Remove duplicate entities from different sources."""
        if not entities:
            return []
        
        entities.sort(key=lambda x: x.start_pos)
        deduplicated = []
        
        for entity in entities:
            is_duplicate = False
            
            for i, existing in enumerate(deduplicated):
                overlap_start = max(entity.start_pos, existing.start_pos)
                overlap_end = min(entity.end_pos, existing.end_pos)
                overlap_length = max(0, overlap_end - overlap_start)
                
                entity_length = entity.end_pos - entity.start_pos
                
                if overlap_length > 0.7 * entity_length:
                    # Keep the one with higher confidence
                    if entity.confidence > existing.confidence:
                        deduplicated[i] = entity
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                deduplicated.append(entity)
        
        return deduplicated
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types based on model and domain."""
        # Try to get from model config if available
        if self._supports_ner and hasattr(self._model, 'config') and hasattr(self._model.config, 'id2label'):
            labels = list(self._model.config.id2label.values())
            entity_types = set()
            for label in labels:
                if label != "O" and "-" in label:
                    entity_type = label.split("-")[-1]
                    entity_types.add(entity_type)
            if entity_types:
                return list(entity_types)
        
        # Fallback based on domain and language
        base_types = ["PER", "ORG", "LOC", "MISC"]
        
        if self.domain == "historical":
            return base_types + ["TITLE", "DYNASTY", "ARTIFACT"]
        elif self._detected_language in ['zh', 'ja', 'ko']:
            return ["PERSON", "LOCATION", "ORGANIZATION", "MISC"]
        else:
            return base_types
    
    def get_model_info(self) -> dict:
        """Get comprehensive model information."""
        info = {
            "model_name": self.model_name,
            "model_type": self._model_type,
            "supports_ner": self._supports_ner,
            "domain": self.domain,
            "detected_language": self._detected_language,
            "pattern_enhancement": self.enable_pattern_enhancement,
            "historical_processing": self.enable_historical_processing,
            "auto_language_detection": self.auto_detect_language,
            "is_loaded": self.is_loaded
        }
        
        if self._supports_ner and hasattr(self._model, 'config'):
            info["num_labels"] = getattr(self._model.config, 'num_labels', 0)
            info["labels"] = getattr(self._model.config, 'id2label', {})
        
        return info

    def unload(self) -> bool:
        """Unload model with proper cleanup."""
        if self._pipeline is not None:
            del self._pipeline
            self._pipeline = None
        
        if self._model is not None:
            del self._model
            del self._tokenizer
            self._model = None
            self._tokenizer = None
        
        try:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        
        self._loaded = False
        return True