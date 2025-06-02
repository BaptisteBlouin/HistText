# toolkit/histtext_toolkit/models/modern_ner.py (Complete Enhanced version)
"""Modern NER model implementations with state-of-the-art libraries."""

import logging
import time
import json
import re
from typing import Any, Dict, List, Optional, Iterator, Union, Tuple
import numpy as np
import torch
from dataclasses import dataclass

from ..core.logging import get_logger
from .base import EnhancedNERModel, EntitySpan, ProcessingStats, ProcessingMode, GPUMemoryManager

logger = get_logger(__name__)


class NuNERModel(EnhancedNERModel):
    """Enhanced NuMind's NuNER model implementation supporting multiple versions."""
    
    def __init__(
        self,
        model_name: str = "numind/NuNER_Zero",
        device: Optional[str] = None,
        batch_size: int = 16,
        max_length: int = 512,
        threshold: float = 0.5,
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        use_pipeline: bool = True,
        **kwargs
    ):
        self.model_name = model_name
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.base_batch_size = batch_size
        self.max_length = max_length
        self.threshold = threshold
        self.processing_mode = processing_mode
        self.use_pipeline = use_pipeline
        
        # Handle additional parameters from kwargs
        self.optimization_level = kwargs.get('optimization_level', 1)
        self.entity_types = kwargs.get('entity_types', None)
        self.enable_caching = kwargs.get('enable_caching', True)
        self.use_fp16 = kwargs.get('use_fp16', True)
        self.enable_compilation = kwargs.get('enable_compilation', True)
        
        self._model = None
        self._tokenizer = None
        self._pipeline = None
        self._config = None
        self.is_loaded_flag = False
        self._stats = ProcessingStats()
        
        # Available NuNER models
        self.available_models = [
            "numind/NuNER_Zero",
            "numind/NuNER_Zero-4k", 
            "numind/NuNER_Zero-span",
            "numind/NuNER-v2.0",
            "numind/NuNER-v1.0"
        ]
        
        # Detect model version and type
        self._model_version = self._detect_model_version()
        self._is_zero_shot = "zero" in model_name.lower()
    
    def _detect_model_version(self) -> str:
        """Detect the NuNER model version and type."""
        model_lower = self.model_name.lower()
        
        if "v2.0" in model_lower:
            return "v2.0"
        elif "v1.0" in model_lower:
            return "v1.0"
        elif "zero" in model_lower:
            if "4k" in model_lower:
                return "zero-4k"
            elif "span" in model_lower:
                return "zero-span"
            else:
                return "zero"
        else:
            return "unknown"
    
    def load(self) -> bool:
        """Load the NuNER model with proper label handling."""
        try:
            from transformers import (
                AutoTokenizer, AutoModelForTokenClassification, 
                AutoConfig, pipeline
            )
            
            logger.info(f"Loading NuNER model: {self.model_name} (version: {self._model_version})")
            
            # Load configuration first
            self._config = AutoConfig.from_pretrained(self.model_name)
            
            # Check and fix label mapping for NuNER v2.0
            if self._model_version == "v2.0" and hasattr(self._config, 'id2label'):
                original_labels = self._config.id2label
                logger.info(f"Original model labels: {original_labels}")
                
                # NuNER v2.0 might have generic labels, let's map them to proper NER labels
                if len(original_labels) == 2 and 'LABEL_' in str(original_labels):
                    # This seems to be a binary classification model
                    # Map to simple entity detection
                    self._config.id2label = {0: "O", 1: "B-ENT"}
                    self._config.label2id = {"O": 0, "B-ENT": 1}
                    logger.info("Mapped generic labels to simple entity detection: O, B-ENT")
            
            # Load tokenizer
            tokenizer_kwargs = {
                "use_fast": True,
                "add_prefix_space": True if self._model_version in ["v2.0", "v1.0"] else False
            }
            
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_name, **tokenizer_kwargs
            )
            
            # Load model with warning suppression
            import warnings
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message="Some weights.*were not initialized.*")
                warnings.filterwarnings("ignore", message="You should probably TRAIN this model.*")
                
                self._model = AutoModelForTokenClassification.from_pretrained(
                    self.model_name,
                    config=self._config,
                    ignore_mismatched_sizes=True
                )
            
            # Move to device and set to eval mode
            self._model.to(self.device)
            self._model.eval()
            
            # Handle tokenizer special tokens
            if self._tokenizer.pad_token is None:
                if self._tokenizer.eos_token:
                    self._tokenizer.pad_token = self._tokenizer.eos_token
                else:
                    self._tokenizer.add_special_tokens({'pad_token': '[PAD]'})
                    self._model.resize_token_embeddings(len(self._tokenizer))
            
            # Create pipeline with minimal parameters
            if self.use_pipeline:
                try:
                    # For v2.0, use simple aggregation since it's binary classification
                    aggregation_strategy = "simple"
                    
                    self._pipeline = pipeline(
                        "ner",
                        model=self._model,
                        tokenizer=self._tokenizer,
                        aggregation_strategy=aggregation_strategy,
                        device=0 if self.device == "cuda" else -1
                    )
                    
                    logger.info("Successfully created NER pipeline")
                    
                except Exception as e:
                    logger.warning(f"Could not create pipeline: {e}. Will use manual processing.")
                    self._pipeline = None
                    self.use_pipeline = False
            
            self.is_loaded_flag = True
            logger.info(f"Successfully loaded NuNER {self._model_version} on {self.device}")
            
            # Log final model info
            if hasattr(self._config, 'id2label'):
                num_labels = len(self._config.id2label)
                logger.info(f"Model has {num_labels} labels: {list(self._config.id2label.values())}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load NuNER model: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return False
    
    def unload(self) -> bool:
        """Unload the model and free memory."""
        try:
            if self._pipeline is not None:
                del self._pipeline
                self._pipeline = None
            
            if self._model is not None:
                del self._model
                self._model = None
            
            if self._tokenizer is not None:
                del self._tokenizer
                self._tokenizer = None
            
            if self._config is not None:
                del self._config
                self._config = None
            
            GPUMemoryManager.clear_cache()
            self.is_loaded_flag = False
            logger.info("Successfully unloaded NuNER model")
            return True
            
        except Exception as e:
            logger.error(f"Error unloading NuNER model: {e}")
            return False
    
    @property
    def is_loaded(self) -> bool:
        return (self.is_loaded_flag and self._model is not None)
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types based on model version."""
        if self._model_version == "v2.0":
            # NuNER v2.0 appears to be a binary entity detector
            return ["Entity"]  # Generic entity type
        elif self._is_zero_shot:
            # Zero-shot models support any entity types
            return [
                "Person", "Organization", "Location", "Miscellaneous",
                "Date", "Time", "Money", "Percent", "Product", "Event",
                "Law", "Language", "Nationality", "Religion", "Title",
                "Facility", "Geopolitical_Entity", "Work_of_Art"
            ]
        else:
            # Regular NuNER models have predefined types
            if hasattr(self._config, "id2label") and self._config:
                labels = list(self._config.id2label.values())
                entity_types = set()
                for label in labels:
                    if label != "O" and "-" in label:
                        entity_type = label.split("-")[-1]
                        entity_types.add(entity_type)
                return list(entity_types) if entity_types else ["Entity"]
            
            # Default
            return ["PER", "ORG", "LOC", "MISC"]
    
    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None
    ) -> List[EntitySpan]:
        """Extract entities using NuNER with robust processing."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        start_time = time.time()
        
        try:
            # Always try pipeline first, then fallback to manual
            if self._pipeline is not None:
                try:
                    return self._extract_with_pipeline(text, entity_types)
                except Exception as e:
                    logger.warning(f"Pipeline extraction failed: {e}, falling back to manual")
            
            # Fallback to manual processing
            if self._is_zero_shot:
                return self._manual_zero_shot_extraction(text, entity_types)
            else:
                return self._manual_standard_extraction(text, entity_types)
                
        except Exception as e:
            logger.error(f"Error in NuNER entity extraction: {e}")
            return []
        finally:
            # Update stats
            processing_time = time.time() - start_time
            self._stats.processing_time += processing_time
    
    def _extract_with_pipeline(
        self, 
        text: str, 
        entity_types: Optional[List[str]]
    ) -> List[EntitySpan]:
        """Extract entities using the transformers pipeline."""
        try:
            # Use pipeline to get results
            results = self._pipeline(text)
            
            # Convert to EntitySpan format
            entities = []
            for result in results:
                # Get entity label
                entity_label = result.get("entity_group", result.get("entity", "ENT"))
                
                # For binary classification models, map to generic entity
                if entity_label in ["LABEL_1", "B-ENT"]:
                    entity_label = "Entity"
                elif entity_label == "LABEL_0":
                    continue  # Skip non-entities
                
                # Filter by entity types if specified
                if entity_types:
                    # For generic entity detection, accept if "Entity" is requested
                    if "Entity" not in entity_types:
                        continue
                
                # Clean up the entity text
                entity_text = result["word"]
                if isinstance(entity_text, str):
                    entity_text = entity_text.replace("##", "").replace("▁", " ").replace("Ġ", " ").strip()
                
                if entity_text:  # Only add non-empty entities
                    entities.append(EntitySpan(
                        text=entity_text,
                        labels=[entity_label],
                        start_pos=int(result["start"]),  # Convert to int
                        end_pos=int(result["end"]),      # Convert to int
                        confidence=float(result["score"])  # Convert to Python float
                    ))
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in pipeline extraction: {e}")
            raise  # Re-raise to trigger fallback
    
    def _manual_standard_extraction(
        self, 
        text: str, 
        entity_types: Optional[List[str]]
    ) -> List[EntitySpan]:
        """Manual extraction for standard NuNER models."""
        try:
            # Tokenize input
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
            
            # Process predictions to extract entities
            entities = self._process_predictions_to_entities(
                text, inputs, predicted_labels[0], predictions[0]
            )
            
            # Filter by entity types if specified
            if entity_types:
                filtered_entities = []
                for entity in entities:
                    for label in entity.labels:
                        entity_type = label.split("-")[-1] if "-" in label else label
                        if entity_type in entity_types:
                            filtered_entities.append(entity)
                            break
                return filtered_entities
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in manual standard extraction: {e}")
            return []
    
    def _manual_zero_shot_extraction(
        self, 
        text: str, 
        entity_types: List[str]
    ) -> List[EntitySpan]:
        """Manual zero-shot extraction when pipeline is not available."""
        try:
            if entity_types is None:
                entity_types = ["Person", "Organization", "Location"]
            
            # For zero-shot, we'll use a simpler approach without special formatting
            # since the model might not be properly trained for the GLiNER-style prompts
            
            # Just use the text directly and see what entities we can find
            return self._manual_standard_extraction(text, entity_types)
            
        except Exception as e:
            logger.error(f"Error in manual zero-shot extraction: {e}")
            return []
    
    def _process_predictions_to_entities(
        self, 
        original_text: str, 
        inputs: Dict, 
        predicted_labels: torch.Tensor, 
        predictions: torch.Tensor
    ) -> List[EntitySpan]:
        """Process model predictions to extract entities using BIO tagging."""
        entities = []
        
        try:
            # Get input information
            input_ids = inputs["input_ids"][0]
            tokens = self._tokenizer.convert_ids_to_tokens(input_ids)
            
            # Get offset mapping
            offset_mapping = inputs.get("offset_mapping")
            if offset_mapping is not None:
                offset_mapping = offset_mapping[0].cpu().numpy()
            else:
                offset_mapping = [(0, 0)] * len(tokens)
            
            # Convert label IDs to labels
            if hasattr(self._config, 'id2label') and self._config.id2label:
                labels = [self._config.id2label.get(label_id.item(), "O") 
                         for label_id in predicted_labels]
            else:
                # Fallback: create simple labels based on predictions
                labels = []
                for i, pred_id in enumerate(predicted_labels):
                    if pred_id.item() == 0:
                        labels.append("O")
                    else:
                        # Simple heuristic for entity detection
                        confidence = float(torch.max(predictions[i]).item())  # Convert to Python float
                        if confidence > self.threshold:
                            labels.append("B-Entity")
                        else:
                            labels.append("O")
            
            # Extract entities using BIO tagging logic
            current_entity_tokens = []
            current_entity_offsets = []
            current_entity_scores = []
            current_entity_type = None
            
            for i, (token, label, offset) in enumerate(zip(tokens, labels, offset_mapping)):
                # Skip special tokens
                if token in self._tokenizer.all_special_tokens:
                    continue
                
                # Get confidence score
                confidence = float(torch.max(predictions[i]).item())  # Convert to Python float
                
                if label.startswith("B-") or (label == "B-ENT"):
                    # Beginning of new entity
                    if current_entity_tokens:
                        # Save previous entity
                        entity = self._create_entity_from_prediction_data(
                            current_entity_type, current_entity_tokens, 
                            current_entity_offsets, current_entity_scores, original_text
                        )
                        if entity:
                            entities.append(entity)
                    
                    # Start new entity
                    current_entity_type = label[2:] if label.startswith("B-") else "Entity"
                    current_entity_tokens = [token]
                    current_entity_offsets = [offset]
                    current_entity_scores = [confidence]
                
                elif label.startswith("I-") and current_entity_type == label[2:]:
                    # Inside current entity
                    current_entity_tokens.append(token)
                    current_entity_offsets.append(offset)
                    current_entity_scores.append(confidence)
                
                # For binary classification, treat LABEL_1 as entity
                elif label == "LABEL_1" or (predicted_labels[i].item() == 1 and confidence > self.threshold):
                    if not current_entity_tokens:
                        # Start new entity
                        current_entity_type = "Entity"
                        current_entity_tokens = [token]
                        current_entity_offsets = [offset]
                        current_entity_scores = [confidence]
                    else:
                        # Continue current entity
                        current_entity_tokens.append(token)
                        current_entity_offsets.append(offset)
                        current_entity_scores.append(confidence)
                
                else:
                    # Outside entity or end of entity
                    if current_entity_tokens:
                        # Save current entity
                        entity = self._create_entity_from_prediction_data(
                            current_entity_type, current_entity_tokens, 
                            current_entity_offsets, current_entity_scores, original_text
                        )
                        if entity:
                            entities.append(entity)
                    
                    # Reset
                    current_entity_tokens = []
                    current_entity_offsets = []
                    current_entity_scores = []
                    current_entity_type = None
            
            # Handle last entity
            if current_entity_tokens:
                entity = self._create_entity_from_prediction_data(
                    current_entity_type, current_entity_tokens, 
                    current_entity_offsets, current_entity_scores, original_text
                )
                if entity:
                    entities.append(entity)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error processing predictions to entities: {e}")
            return []
    
    def _create_entity_from_prediction_data(
        self, 
        entity_type: str, 
        tokens: List[str], 
        offsets: List[Tuple[int, int]], 
        scores: List[float], 
        original_text: str
    ) -> Optional[EntitySpan]:
        """Create EntitySpan from prediction data."""
        try:
            if not tokens or not entity_type:
                return None
            
            # Get start and end positions from offsets
            valid_offsets = [offset for offset in offsets if len(offset) == 2 and offset != (0, 0)]
            
            if valid_offsets:
                start_pos = int(valid_offsets[0][0])  # Convert to int
                end_pos = int(valid_offsets[-1][1])   # Convert to int
                
                # Ensure positions are valid
                start_pos = max(0, min(start_pos, len(original_text)))
                end_pos = max(start_pos, min(end_pos, len(original_text)))
                
                # Extract text from original
                entity_text = original_text[start_pos:end_pos].strip()
            else:
                # Fallback: reconstruct from tokens
                entity_text = ""
                start_pos = 0
                end_pos = 0
            
            # If we couldn't extract from positions, reconstruct from tokens
            if not entity_text:
                clean_tokens = []
                for token in tokens:
                    clean_token = token.replace("##", "").replace("▁", " ").replace("Ġ", " ")
                    if clean_token.strip():
                        clean_tokens.append(clean_token)
                
                entity_text = "".join(clean_tokens).strip()
                
                # Try to find this text in the original
                if entity_text:
                    found_pos = original_text.find(entity_text)
                    if found_pos >= 0:
                        start_pos = int(found_pos)  # Convert to int
                        end_pos = int(found_pos + len(entity_text))  # Convert to int
            
            # Calculate average confidence
            avg_confidence = float(sum(scores) / len(scores)) if scores else 0.0  # Convert to Python float
            
            if entity_text and len(entity_text.strip()) > 0:
                return EntitySpan(
                    text=entity_text,
                    labels=[entity_type],
                    start_pos=start_pos,
                    end_pos=end_pos,
                    confidence=avg_confidence
                )
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating entity from prediction data: {e}")
            return None
    
    def extract_entities_batch(
        self, 
        texts: List[str], 
        entity_types: Optional[List[str]] = None
    ) -> List[List[EntitySpan]]:
        """Batch entity extraction with optimized processing."""
        if not texts:
            return []
        
        results = []
        
        try:
            # Process each text individually for now
            # (batch processing with transformers can be tricky)
            for text in texts:
                if text and text.strip():
                    entities = self.extract_entities(text, entity_types)
                    results.append(entities)
                else:
                    results.append([])
                
                # Periodic memory cleanup
                if len(results) % 50 == 0:
                    GPUMemoryManager.clear_cache()
            
            return results
            
        except Exception as e:
            logger.error(f"Error in NuNER batch processing: {e}")
            return [[] for _ in texts]


class FlairNERModel(EnhancedNERModel):
    """Enhanced Flair NER model implementation."""
    
    def __init__(
        self,
        model_name: str = "ner",
        device: Optional[str] = None,
        batch_size: int = 32,
        use_crf: bool = True,
        processing_mode: ProcessingMode = ProcessingMode.BATCH
    ):
        self.model_name = model_name
        self.device = device
        self.base_batch_size = batch_size
        self.use_crf = use_crf
        self.processing_mode = processing_mode
        
        self._tagger = None
        self.is_loaded_flag = False
        self._stats = ProcessingStats()
        
        # Available Flair models
        self.available_models = [
            "ner",  # English NER (4-class)
            "ner-large",  # English NER (4-class, large)
            "ner-ontonotes",  # OntoNotes NER (18-class)
            "ner-ontonotes-large",  # OntoNotes NER (18-class, large)
            "ner-multi",  # Multilingual NER
            "ner-multi-fast",  # Fast multilingual NER
            "ner-german",  # German NER
            "ner-german-large"  # German NER large
        ]
    
    def load(self) -> bool:
        """Load the Flair model."""
        try:
            from flair.models import SequenceTagger
            import flair
            
            # Set device if specified
            if self.device:
                flair.device = torch.device(self.device)
            
            logger.info(f"Loading Flair model: {self.model_name}")
            self._tagger = SequenceTagger.load(self.model_name)
            
            self.is_loaded_flag = True
            logger.info("Successfully loaded Flair model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load Flair model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload the model."""
        if self._tagger is not None:
            del self._tagger
            self._tagger = None
            
        GPUMemoryManager.clear_cache()
        self.is_loaded_flag = False
        return True
    
    @property
    def is_loaded(self) -> bool:
        return self.is_loaded_flag and self._tagger is not None
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types based on model."""
        if "ontonotes" in self.model_name:
            return [
                "PERSON", "NORP", "FAC", "ORG", "GPE", "LOC", "PRODUCT",
                "EVENT", "WORK_OF_ART", "LAW", "LANGUAGE", "DATE", "TIME",
                "PERCENT", "MONEY", "QUANTITY", "ORDINAL", "CARDINAL"
            ]
        else:
            return ["PER", "LOC", "ORG", "MISC"]
    
    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None
    ) -> List[EntitySpan]:
        """Extract entities using Flair."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
            
        start_time = time.time()
        
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
            
            # Update stats
            processing_time = time.time() - start_time
            self._stats.total_entities += len(entities)
            self._stats.processing_time += processing_time
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in Flair entity extraction: {e}")
            return []
    
    def extract_entities_batch(
        self, 
        texts: List[str], 
        entity_types: Optional[List[str]] = None
    ) -> List[List[EntitySpan]]:
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



class EnhancedGLiNERModel(EnhancedNERModel):
    """Enhanced GLiNER model with proper token-aware chunking to handle long texts."""
    
    def __init__(
        self,
        model_name: str = "urchade/gliner_mediumv2.1",
        device: Optional[str] = None,
        batch_size: int = 16,
        threshold: float = 0.3,
        max_length: int = 384,
        use_fp16: bool = True,
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        optimization_level: int = 1,
        entity_types: Optional[List[str]] = None,
        enable_caching: bool = True,
        enable_compilation: bool = True,
        chunk_overlap: int = 50,
        **kwargs
    ):
        self.model_name = model_name
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.base_batch_size = batch_size
        self.threshold = threshold
        self.max_length = max_length
        self.use_fp16 = use_fp16 and torch.cuda.is_available()
        self.processing_mode = processing_mode
        self.optimization_level = optimization_level
        self.entity_types = entity_types
        self.enable_caching = enable_caching
        self.enable_compilation = enable_compilation
        self.chunk_overlap = chunk_overlap
        
        self._model = None
        self._tokenizer = None
        self.is_loaded_flag = False
        self._stats = ProcessingStats()
        
        # Conservative chunk size - GLiNER needs room for entity type prompts
        # The model internally formats as "Entity types: [types] Text: [text]"
        self.max_text_tokens = max_length - 100  # Leave 100 tokens for prompt overhead
        self.chunk_overlap_tokens = min(chunk_overlap, self.max_text_tokens // 4)
        
        logger.info(f"GLiNER configured: max_length={max_length}, max_text_tokens={self.max_text_tokens}, overlap={self.chunk_overlap_tokens}")
    
    def load(self) -> bool:
        """Load GLiNER model with optimizations."""
        try:
            from gliner import GLiNER
            from transformers import AutoTokenizer
            
            logger.info(f"Loading GLiNER model: {self.model_name}")
            
            # Load GLiNER model
            self._model = GLiNER.from_pretrained(self.model_name)
            
            # Load tokenizer for proper token counting
            try:
                self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            except:
                # Fallback to a generic tokenizer for token counting
                try:
                    self._tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
                    logger.warning("Using fallback tokenizer for token counting")
                except:
                    logger.warning("Could not load tokenizer, using character-based estimation")
                    self._tokenizer = None
            
            # Apply optimizations
            if self.device == "cuda":
                self._model.to(self.device)
                
                # Enable mixed precision if supported
                if self.use_fp16:
                    try:
                        self._model.half()
                        logger.info("Enabled FP16 precision")
                    except Exception as e:
                        logger.warning(f"Could not enable FP16: {e}")
                
                # Enable compilation if PyTorch 2.0+
                if self.enable_compilation:
                    try:
                        if hasattr(torch, "compile"):
                            self._model = torch.compile(self._model, mode="reduce-overhead")
                            logger.info("Enabled model compilation")
                    except Exception as e:
                        logger.warning(f"Could not compile model: {e}")
            
            self.is_loaded_flag = True
            logger.info(f"Successfully loaded GLiNER model on {self.device}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load GLiNER model: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return False
    
    def unload(self) -> bool:
        """Unload GLiNER model."""
        if self._model is not None:
            del self._model
            self._model = None
            
        if self._tokenizer is not None:
            del self._tokenizer
            self._tokenizer = None
            
        GPUMemoryManager.clear_cache()
        self.is_loaded_flag = False
        return True
    
    @property
    def is_loaded(self) -> bool:
        return self.is_loaded_flag and self._model is not None
    
    def get_supported_entity_types(self) -> List[str]:
        """GLiNER supports any entity types."""
        return [
            "Person", "Organization", "Location", "Miscellaneous",
            "Date", "Time", "Money", "Percent", "Product", "Event",
            "Geopolitical entity", "Facility", "Work of art", "Law",
            "Language", "Nationality", "Religion", "Title", "Ordinal",
            "Cardinal", "Quantity", "Medical condition", "Drug", "Chemical"
        ]
    
    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None
    ) -> List[EntitySpan]:
        """Extract entities with proper token-aware chunking."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text or not text.strip():
            return []
        
        # Use provided entity types or default
        if entity_types is None:
            entity_types = self.entity_types or ["Person", "Organization", "Location", "Product"]
            
        start_time = time.time()
        
        try:
            # Check if text needs chunking based on actual token count
            needs_chunking = self._needs_chunking(text)
            
            if needs_chunking:
                logger.debug(f"Text needs chunking, using chunked extraction")
                return self._extract_entities_chunked(text, entity_types)
            else:
                logger.debug(f"Text fits in single chunk, using direct extraction")
                return self._extract_entities_single(text, entity_types)
                
        except Exception as e:
            logger.error(f"Error in GLiNER entity extraction: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return []
        finally:
            processing_time = time.time() - start_time
            self._stats.processing_time += processing_time
    
    def _needs_chunking(self, text: str) -> bool:
        """Check if text needs chunking based on token count."""
        if self._tokenizer is not None:
            try:
                # Get actual token count
                tokens = self._tokenizer.encode(text, add_special_tokens=False)
                token_count = len(tokens)
                logger.debug(f"Text has {token_count} tokens (max: {self.max_text_tokens})")
                return token_count > self.max_text_tokens
            except:
                logger.debug("Token counting failed, falling back to character estimation")
        
        # Fallback to character-based estimation (conservative)
        # Average ~4 characters per token for English
        estimated_tokens = len(text) // 3  # More conservative estimate
        logger.debug(f"Estimated {estimated_tokens} tokens (max: {self.max_text_tokens})")
        return estimated_tokens > self.max_text_tokens
    
    def _extract_entities_chunked(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Extract entities from long text using token-aware overlapping chunks."""
        try:
            # Create token-aware chunks
            chunks = self._create_token_aware_chunks(text)
            logger.debug(f"Created {len(chunks)} token-aware chunks for text of length {len(text)}")
            
            # Process each chunk
            all_entities = []
            for i, (chunk_text, start_offset, end_offset) in enumerate(chunks):
                logger.debug(f"Processing chunk {i+1}/{len(chunks)} (chars {start_offset}-{end_offset}, length {len(chunk_text)})")
                
                # Verify chunk size
                if self._tokenizer:
                    try:
                        chunk_tokens = len(self._tokenizer.encode(chunk_text, add_special_tokens=False))
                        logger.debug(f"Chunk {i+1} has {chunk_tokens} tokens")
                        if chunk_tokens > self.max_text_tokens:
                            #logger.warning(f"Chunk {i+1} still too long ({chunk_tokens} tokens), truncating further")
                            chunk_text = self._truncate_to_tokens(chunk_text, self.max_text_tokens)
                    except:
                        pass
                
                # Extract entities from this chunk
                try:
                    chunk_entities = self._extract_entities_single(chunk_text, entity_types)
                    logger.debug(f"Chunk {i+1} found {len(chunk_entities)} entities")
                    
                    # Adjust entity positions to global coordinates
                    for entity in chunk_entities:
                        adjusted_entity = EntitySpan(
                            text=entity.text,
                            labels=entity.labels,
                            start_pos=entity.start_pos + start_offset,
                            end_pos=entity.end_pos + start_offset,
                            confidence=entity.confidence,
                            probability_distribution=entity.probability_distribution,
                            entity_id=entity.entity_id,
                            normalized_text=entity.normalized_text,
                            linking_candidates=entity.linking_candidates,
                            metadata=entity.metadata
                        )
                        all_entities.append(adjusted_entity)
                        
                except Exception as e:
                    logger.warning(f"Error processing chunk {i+1}: {e}")
                    continue
            
            # Remove duplicates from overlapping chunks
            deduplicated_entities = self._deduplicate_entities(all_entities)
            logger.debug(f"Found {len(all_entities)} total entities, {len(deduplicated_entities)} after deduplication")
            
            return deduplicated_entities
            
        except Exception as e:
            logger.error(f"Error in chunked GLiNER extraction: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return []
    
    def _create_token_aware_chunks(self, text: str) -> List[Tuple[str, int, int]]:
        """Create overlapping text chunks that respect token limits."""
        chunks = []
        
        if self._tokenizer is not None:
            # Use tokenizer-based chunking
            try:
                return self._create_tokenizer_chunks(text)
            except Exception as e:
                logger.warning(f"Tokenizer-based chunking failed: {e}, falling back to character-based")
        
        # Fallback to character-based chunking
        return self._create_character_chunks(text)
    
    def _create_tokenizer_chunks(self, text: str) -> List[Tuple[str, int, int]]:
        """Create chunks using actual tokenizer."""
        chunks = []
        
        # Encode the entire text
        full_tokens = self._tokenizer.encode(text, add_special_tokens=False)
        
        if len(full_tokens) <= self.max_text_tokens:
            # Text fits in one chunk
            return [(text, 0, len(text))]
        
        # Create overlapping token chunks
        start_token = 0
        while start_token < len(full_tokens):
            end_token = min(start_token + self.max_text_tokens, len(full_tokens))
            
            # Extract token chunk
            chunk_tokens = full_tokens[start_token:end_token]
            
            # Decode back to text
            chunk_text = self._tokenizer.decode(chunk_tokens, skip_special_tokens=True)
            
            # Find character positions in original text
            start_char = self._find_char_position(text, chunk_text, start_token == 0)
            end_char = start_char + len(chunk_text)
            
            # Ensure we don't go beyond text bounds
            end_char = min(end_char, len(text))
            actual_chunk_text = text[start_char:end_char]
            
            if actual_chunk_text.strip():
                chunks.append((actual_chunk_text, start_char, end_char))
                logger.debug(f"Token-based chunk: tokens {start_token}-{end_token}, chars {start_char}-{end_char}")
            
            # Move to next chunk with overlap
            if end_token >= len(full_tokens):
                break
            
            start_token = end_token - self.chunk_overlap_tokens
            
            # Ensure progress
            if start_token <= 0:
                start_token = max(1, end_token - self.chunk_overlap_tokens // 2)
        
        return chunks
    
    def _create_character_chunks(self, text: str) -> List[Tuple[str, int, int]]:
        """Fallback character-based chunking with conservative token estimation."""
        chunks = []
        
        # Very conservative character-to-token ratio
        chars_per_token = 2.5  # Conservative estimate
        chunk_size_chars = int(self.max_text_tokens * chars_per_token)
        overlap_chars = int(self.chunk_overlap_tokens * chars_per_token)
        
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = min(start + chunk_size_chars, text_length)
            
            # Try to break at sentence boundaries if not at end
            if end < text_length:
                # Look for sentence endings within reasonable range
                search_start = max(end - overlap_chars, start + chunk_size_chars // 2)
                search_end = min(end + overlap_chars // 2, text_length)
                
                sentence_endings = []
                for i in range(search_start, search_end):
                    if text[i] in '.!?\n':
                        sentence_endings.append(i + 1)
                
                if sentence_endings:
                    end = sentence_endings[-1]
                else:
                    # Break at word boundary
                    while end > start and end < text_length and not text[end].isspace():
                        end -= 1
                    if end == start:
                        end = min(start + chunk_size_chars, text_length)
            
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunks.append((chunk_text, start, end))
                logger.debug(f"Character-based chunk: chars {start}-{end}, length {len(chunk_text)}")
            
            if end >= text_length:
                break
            
            # Next chunk with overlap
            next_start = end - overlap_chars
            if next_start <= start:
                next_start = start + max(1, chunk_size_chars // 2)
            
            start = next_start
        
        return chunks
    
    def _find_char_position(self, text: str, chunk_text: str, is_first: bool) -> int:
        """Find character position of chunk in original text."""
        if is_first:
            return 0
        
        # Try to find the chunk text in the original
        pos = text.find(chunk_text)
        if pos >= 0:
            return pos
        
        # Fallback: find the first few words
        chunk_words = chunk_text.split()[:3]
        if chunk_words:
            search_phrase = ' '.join(chunk_words)
            pos = text.find(search_phrase)
            if pos >= 0:
                return pos
        
        # Last resort: return 0
        return 0
    
    def _truncate_to_tokens(self, text: str, max_tokens: int) -> str:
        """Truncate text to specific token count."""
        if not self._tokenizer:
            # Fallback to character truncation
            return text[:max_tokens * 3]
        
        try:
            tokens = self._tokenizer.encode(text, add_special_tokens=False)
            if len(tokens) <= max_tokens:
                return text
            
            truncated_tokens = tokens[:max_tokens]
            return self._tokenizer.decode(truncated_tokens, skip_special_tokens=True)
        except:
            return text[:max_tokens * 3]
    
    def _extract_entities_single(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Extract entities from a single text chunk."""
        try:
            # Use GLiNER to extract entities
            raw_entities = self._model.predict_entities(
                text, 
                entity_types, 
                threshold=self.threshold
            )
            
            # Convert to EntitySpan format
            entities = []
            for entity in raw_entities:
                try:
                    entity_span = EntitySpan(
                        text=entity["text"],
                        labels=[entity["label"]],
                        start_pos=int(entity["start"]),
                        end_pos=int(entity["end"]),
                        confidence=float(entity["score"])
                    )
                    entities.append(entity_span)
                except Exception as e:
                    logger.warning(f"Error converting entity {entity}: {e}")
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in single GLiNER extraction: {e}")
            return []
    
    def _deduplicate_entities(self, entities: List[EntitySpan]) -> List[EntitySpan]:
        """Remove duplicate entities from overlapping chunks."""
        if not entities:
            return []
        
        # Sort entities by start position
        entities.sort(key=lambda x: (x.start_pos, x.end_pos))
        
        deduplicated = []
        
        for entity in entities:
            is_duplicate = False
            
            for i, existing in enumerate(deduplicated):
                # Calculate overlap
                overlap_start = max(entity.start_pos, existing.start_pos)
                overlap_end = min(entity.end_pos, existing.end_pos)
                overlap_length = max(0, overlap_end - overlap_start)
                
                entity_length = entity.end_pos - entity.start_pos
                existing_length = existing.end_pos - existing.start_pos
                
                # Calculate overlap ratios
                entity_overlap_ratio = overlap_length / entity_length if entity_length > 0 else 0
                existing_overlap_ratio = overlap_length / existing_length if existing_length > 0 else 0
                
                # Consider duplicate if significant overlap (>70%) or exact text match nearby
                is_overlap_duplicate = entity_overlap_ratio > 0.7 or existing_overlap_ratio > 0.7
                is_text_duplicate = (
                    entity.text.strip().lower() == existing.text.strip().lower() and
                    abs(entity.start_pos - existing.start_pos) < 100
                )
                
                if is_overlap_duplicate or is_text_duplicate:
                    # Keep the entity with higher confidence
                    if entity.confidence > existing.confidence:
                        deduplicated[i] = entity
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                deduplicated.append(entity)
        
        return deduplicated
    
    def extract_entities_batch(
        self, 
        texts: List[str], 
        entity_types: Optional[List[str]] = None
    ) -> List[List[EntitySpan]]:
        """Batch entity extraction with memory optimization."""
        if not texts:
            return []
            
        # Optimize batch size based on GPU memory
        batch_size = GPUMemoryManager.optimize_batch_size(self.base_batch_size)
        
        results = []
        
        try:
            # Process in batches
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                batch_results = []
                
                for text in batch_texts:
                    if text and text.strip():
                        entities = self.extract_entities(text, entity_types)
                        batch_results.append(entities)
                    else:
                        batch_results.append([])
                
                results.extend(batch_results)
                
                # Memory management
                if i % (batch_size * 2) == 0:
                    GPUMemoryManager.clear_cache()
            
            return results
            
        except Exception as e:
            logger.error(f"Error in GLiNER batch processing: {e}")
            return [[] for _ in texts]
    
    def extract_entities_streaming(
        self, 
        texts: Iterator[str], 
        entity_types: Optional[List[str]] = None,
        **kwargs
    ) -> Iterator[List[EntitySpan]]:
        """Stream processing for large datasets."""
        batch_size = kwargs.get("batch_size", 32)
        batch = []
        
        for text in texts:
            batch.append(text)
            
            if len(batch) >= batch_size:
                results = self.extract_entities_batch(batch, entity_types)
                for result in results:
                    yield result
                
                batch = []
                GPUMemoryManager.clear_cache()
        
        # Process remaining batch
        if batch:
            results = self.extract_entities_batch(batch, entity_types)
            for result in results:
                yield result
    
    def get_processing_stats(self) -> ProcessingStats:
        """Get processing statistics."""
        return self._stats
    
    def set_processing_mode(self, mode: ProcessingMode) -> None:
        """Set processing mode for optimization."""
        self.processing_mode = mode
        
        if mode == ProcessingMode.HIGH_THROUGHPUT:
            self.base_batch_size = min(64, self.base_batch_size * 2)
        elif mode == ProcessingMode.LOW_LATENCY:
            self.base_batch_size = max(1, self.base_batch_size // 2)
        elif mode == ProcessingMode.MEMORY_EFFICIENT:
            self.base_batch_size = max(4, self.base_batch_size // 4)

# toolkit/histtext_toolkit/models/modern_ner.py (Fixed LLMNERModel)

class LLMNERModel(EnhancedNERModel):
    """LLM-based NER using models like Llama, Mistral, Qwen, etc."""
    
    def __init__(
        self,
        model_name: str = "microsoft/DialoGPT-medium",
        device: Optional[str] = None,
        batch_size: int = 4,  # Smaller for LLMs
        max_length: int = 2048,
        temperature: float = 0.1,
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        use_quantization: bool = False,
        # Add missing parameters to match enhanced interface
        optimization_level: int = 1,
        entity_types: Optional[List[str]] = None,
        enable_caching: bool = True,
        enable_compilation: bool = False,  # Usually not beneficial for LLMs
        use_fp16: bool = True,
        threshold: float = 0.5,
        **kwargs  # Accept additional kwargs
    ):
        self.model_name = model_name
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.base_batch_size = batch_size
        self.max_length = max_length
        self.temperature = temperature
        self.processing_mode = processing_mode
        self.use_quantization = use_quantization
        self.optimization_level = optimization_level
        self.entity_types = entity_types
        self.enable_caching = enable_caching
        self.enable_compilation = enable_compilation
        self.use_fp16 = use_fp16
        self.threshold = threshold
        
        self._model = None
        self._tokenizer = None
        self.is_loaded_flag = False
        self._stats = ProcessingStats()
        
        # Calculate effective text length (leave room for prompt and response)
        self.max_text_length = max_length - 800  # Reserve tokens for prompt and response
        
        # Available LLM models for NER
        self.available_models = [
            "microsoft/DialoGPT-medium",
            "microsoft/DialoGPT-large", 
            "microsoft/DialoGPT-small",
            "meta-llama/Llama-2-7b-chat-hf",
            "meta-llama/Llama-2-13b-chat-hf",
            "mistralai/Mistral-7B-Instruct-v0.1",
            "mistralai/Mistral-7B-Instruct-v0.2",
            "mistralai/Mistral-7B-Instruct-v0.3",
            "Qwen/Qwen-7B-Chat",
            "Qwen/Qwen-14B-Chat",
            "microsoft/Phi-3-mini-4k-instruct",
            "microsoft/Phi-3-small-8k-instruct"
        ]
        
        logger.info(f"LLM NER configured: model={model_name}, max_text_length={self.max_text_length}")
    
    def load(self) -> bool:
        """Load LLM for NER with optimizations."""
        try:
            from transformers import (
                AutoTokenizer, AutoModelForCausalLM, 
                BitsAndBytesConfig
            )
            
            logger.info(f"Loading LLM for NER: {self.model_name}")
            
            # Prepare model loading arguments
            model_kwargs = {}
            
            # Apply quantization if requested
            if self.use_quantization:
                try:
                    quantization_config = BitsAndBytesConfig(
                        load_in_4bit=True,
                        bnb_4bit_compute_dtype=torch.float16,
                        bnb_4bit_use_double_quant=True,
                        bnb_4bit_quant_type="nf4"
                    )
                    model_kwargs["quantization_config"] = quantization_config
                    model_kwargs["device_map"] = "auto"
                    logger.info("Enabled 4-bit quantization")
                except Exception as e:
                    logger.warning(f"Could not enable quantization: {e}")
            
            # Set dtype for memory efficiency
            if not self.use_quantization and torch.cuda.is_available() and self.use_fp16:
                model_kwargs["torch_dtype"] = torch.float16
            
            # Load tokenizer and model
            logger.info("Loading tokenizer...")
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                padding_side="left",  # Important for batch generation
                trust_remote_code=True
            )
            
            logger.info("Loading model...")
            self._model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                trust_remote_code=True,
                **model_kwargs
            )
            
            # Move to device if not using device_map
            if "device_map" not in model_kwargs:
                self._model.to(self.device)
            
            # Set padding token
            if self._tokenizer.pad_token is None:
                if self._tokenizer.eos_token:
                    self._tokenizer.pad_token = self._tokenizer.eos_token
                elif self._tokenizer.bos_token:
                    self._tokenizer.pad_token = self._tokenizer.bos_token
                else:
                    self._tokenizer.add_special_tokens({'pad_token': '[PAD]'})
                    self._model.resize_token_embeddings(len(self._tokenizer))
            
            # Set model to eval mode
            self._model.eval()
            
            self.is_loaded_flag = True
            logger.info("Successfully loaded LLM for NER")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load LLM: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return False
    
    def unload(self) -> bool:
        """Unload LLM."""
        if self._model is not None:
            del self._model
            del self._tokenizer
            self._model = None
            self._tokenizer = None
            
        GPUMemoryManager.clear_cache()
        self.is_loaded_flag = False
        return True
    
    @property
    def is_loaded(self) -> bool:
        return self.is_loaded_flag and self._model is not None
    
    def get_supported_entity_types(self) -> List[str]:
        """LLMs can handle any entity types."""
        return [
            "Person", "Organization", "Location", "Date", "Time",
            "Money", "Percent", "Product", "Event", "Law", "Language",
            "Nationality", "Religion", "Title", "Skill", "Technology",
            "Medical_Condition", "Drug", "Chemical", "Gene", "Protein",
            "Disease", "Treatment", "Symptom", "Vehicle", "Weapon",
            "Building", "Natural_Feature", "Food", "Animal", "Plant",
            "Brand", "Software", "Hardware", "Book", "Movie", "Song"
        ]
    
    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None
    ) -> List[EntitySpan]:
        """Extract entities using LLM with structured prompting."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
            
        if entity_types is None:
            entity_types = self.entity_types or ["Person", "Organization", "Location"]
        
        start_time = time.time()
        
        try:
            # Handle long documents
            if len(text) > self.max_text_length:
                logger.debug("Using chunked extraction for long document")
                return self._extract_entities_chunked(text, entity_types)
            else:
                logger.debug("Using single extraction")
                return self._extract_entities_single(text, entity_types)
                
        except Exception as e:
            logger.error(f"Error in LLM NER: {e}")
            return []
        finally:
            # Update stats
            processing_time = time.time() - start_time
            self._stats.processing_time += processing_time
    
    def _extract_entities_single(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Extract entities from single text using LLM."""
        try:
            # Create structured prompt
            prompt = self._create_ner_prompt(text, entity_types)
            
            # Tokenize
            inputs = self._tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length - 200,  # Leave room for response
                padding=True
            ).to(self.device)
            
            # Generate with careful parameters
            with torch.no_grad():
                outputs = self._model.generate(
                    **inputs,
                    max_new_tokens=min(400, len(text) // 2),  # Reasonable response length
                    temperature=self.temperature,
                    do_sample=self.temperature > 0,
                    pad_token_id=self._tokenizer.pad_token_id,
                    eos_token_id=self._tokenizer.eos_token_id,
                    early_stopping=True,
                    repetition_penalty=1.1,
                    no_repeat_ngram_size=3
                )
            
            # Decode response
            response = self._tokenizer.decode(
                outputs[0][inputs['input_ids'].shape[1]:], 
                skip_special_tokens=True
            )
            
            logger.debug(f"LLM response: {response[:200]}...")
            
            # Parse entities from response
            entities = self._parse_llm_response(response, text)
            
            logger.debug(f"Extracted {len(entities)} entities from LLM response")
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in single LLM extraction: {e}")
            return []
    
    def _extract_entities_chunked(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Extract entities from long text using chunking."""
        try:
            # Split into chunks
            chunks = self._create_text_chunks(text)
            logger.debug(f"Created {len(chunks)} chunks for long text")
            
            # Process each chunk
            all_entities = []
            for i, (chunk_text, start_offset, end_offset) in enumerate(chunks):
                logger.debug(f"Processing chunk {i+1}/{len(chunks)} (chars {start_offset}-{end_offset})")
                
                chunk_entities = self._extract_entities_single(chunk_text, entity_types)
                
                # Adjust positions
                for entity in chunk_entities:
                    adjusted_entity = EntitySpan(
                        text=entity.text,
                        labels=entity.labels,
                        start_pos=entity.start_pos + start_offset,
                        end_pos=entity.end_pos + start_offset,
                        confidence=entity.confidence
                    )
                    all_entities.append(adjusted_entity)
            
            # Remove duplicates
            return self._deduplicate_entities(all_entities)
            
        except Exception as e:
            logger.error(f"Error in chunked LLM extraction: {e}")
            return []
    
    def _create_text_chunks(self, text: str) -> List[Tuple[str, int, int]]:
        """Create text chunks for long documents."""
        chunks = []
        chunk_size = self.max_text_length
        overlap = 200  # Character overlap
        
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            
            # Try to break at sentence boundaries
            if end < len(text):
                # Look for sentence endings
                for i in range(end - overlap, end):
                    if i > start and text[i] in '.!?\n':
                        end = i + 1
                        break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append((chunk, start, end))
            
            if end >= len(text):
                break
                
            start = end - overlap
        
        return chunks
    
    def _deduplicate_entities(self, entities: List[EntitySpan]) -> List[EntitySpan]:
        """Remove duplicate entities."""
        if not entities:
            return []
        
        entities.sort(key=lambda x: x.start_pos)
        deduplicated = []
        
        for entity in entities:
            is_duplicate = False
            for existing in deduplicated:
                # Check for significant overlap
                overlap_start = max(entity.start_pos, existing.start_pos)
                overlap_end = min(entity.end_pos, existing.end_pos)
                overlap_length = max(0, overlap_end - overlap_start)
                
                entity_length = entity.end_pos - entity.start_pos
                
                if overlap_length > 0.7 * entity_length:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                deduplicated.append(entity)
        
        return deduplicated
    
    def extract_entities_batch(
        self,
        texts: List[str], 
        entity_types: Optional[List[str]] = None
    ) -> List[List[EntitySpan]]:
        """Batch processing for LLM NER with memory optimization."""
        if not texts:
            return []
            
        # LLMs need very small batches due to memory constraints
        batch_size = min(self.base_batch_size, 2)
        
        results = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_results = []
            
            for text in batch:
                entities = self.extract_entities(text, entity_types)
                batch_results.append(entities)
            
            results.extend(batch_results)
            
            # Aggressive memory cleanup for LLMs
            GPUMemoryManager.clear_cache()
            
            # Progress logging
            if i % (batch_size * 10) == 0:
                logger.info(f"LLM NER processed {i + len(batch)}/{len(texts)} texts")
        
        return results
    
    def _create_ner_prompt(self, text: str, entity_types: List[str]) -> str:
        """Create structured prompt for NER."""
        entity_types_str = ", ".join(entity_types)
        
        # Create few-shot examples based on model type
        examples = self._get_few_shot_examples(entity_types)
        
        # Detect model type for appropriate prompting
        model_lower = self.model_name.lower()
        
        if "mistral" in model_lower:
            # Mistral prefers specific formatting
            prompt = f"""<s>[INST] You are an expert named entity recognition system. Extract named entities from the text and return them in JSON format.

Entity types to extract: {entity_types_str}

{examples}

Text: "{text}"

Return only a valid JSON array where each entity has: "text", "label", "start", "end". Be precise with positions. [/INST]

JSON: """
        
        elif "llama" in model_lower:
            # Llama format
            prompt = f"""<s>[INST] <<SYS>>
You are an expert named entity recognition system. Extract named entities from text and return them as JSON.
<</SYS>>

Extract entities of these types: {entity_types_str}

{examples}

Text: "{text}"

Return a JSON array with entities having: "text", "label", "start", "end" [/INST]

"""
        
        elif "phi" in model_lower:
            # Phi format
            prompt = f"""<|user|>
Extract named entities from the text. Return JSON format.

Entity types: {entity_types_str}

{examples}

Text: "{text}"

<|assistant|>
```json
"""
        
        else:
            # Generic format
            prompt = f"""Extract named entities from the following text. Return results in JSON format.

Entity types to extract: {entity_types_str}

Instructions:
1. Find all entities of the specified types in the text
2. Return results as a JSON array
3. Each entity should have: "text", "label", "start", "end"
4. Be precise with start and end positions

{examples}

Text: "{text}"

JSON:"""
        
        return prompt
    
    def _get_few_shot_examples(self, entity_types: List[str]) -> str:
        """Generate few-shot examples based on entity types."""
        examples = []
        
        if "Person" in entity_types:
            examples.append("""Example:
Text: "John Smith works at Microsoft."
JSON: [{"text": "John Smith", "label": "Person", "start": 0, "end": 10}]""")
        
        if "Organization" in entity_types:
            examples.append("""Example:
Text: "Apple Inc. was founded in 1976."
JSON: [{"text": "Apple Inc.", "label": "Organization", "start": 0, "end": 10}]""")
        
        if "Location" in entity_types:
            examples.append("""Example:
Text: "I visited Paris last summer."
JSON: [{"text": "Paris", "label": "Location", "start": 10, "end": 15}]""")
        
        return "\n\n".join(examples[:2])  # Limit to 2 examples to save tokens
    
    def _parse_llm_response(self, response: str, original_text: str) -> List[EntitySpan]:
        """Parse LLM response to extract entities."""
        entities = []
        
        try:
            import json
            import re
            
            # Clean response
            response = response.strip()
            
            # Remove common prefixes/suffixes
            response = re.sub(r'^(```json\s*|```\s*)', '', response, flags=re.IGNORECASE)
            response = re.sub(r'(```\s*)$', '', response)
            
            # Try to find JSON in response
            json_patterns = [
                r'\[.*?\]',  # Array
                r'\{.*?\}',  # Single object
            ]
            
            for pattern in json_patterns:
                matches = re.findall(pattern, response, re.DOTALL)
                for match in matches:
                    try:
                        parsed = json.loads(match)
                        
                        # Handle single object vs array
                        if isinstance(parsed, dict):
                            parsed = [parsed]
                        
                        for item in parsed:
                            if isinstance(item, dict) and all(k in item for k in ['text', 'label']):
                                # Get positions
                                start_pos = item.get('start')
                                end_pos = item.get('end')
                                entity_text = item['text']
                                
                                # Validate or find positions
                                if start_pos is None or end_pos is None:
                                    start_pos = original_text.find(entity_text)
                                    if start_pos >= 0:
                                        end_pos = start_pos + len(entity_text)
                                    else:
                                        continue
                                
                                # Validate positions
                                if (start_pos >= 0 and end_pos <= len(original_text) and 
                                    start_pos < end_pos):
                                    
                                    entities.append(EntitySpan(
                                        text=entity_text,
                                        labels=[item['label']],
                                        start_pos=int(start_pos),
                                        end_pos=int(end_pos),
                                        confidence=0.8  # Default confidence for LLM
                                    ))
                        
                        # If we found valid entities, return them
                        if entities:
                            return entities
                            
                    except json.JSONDecodeError:
                        continue
            
            # Fallback: try to parse line by line
            if not entities:
                entities = self._fallback_parsing(response, original_text)
        
        except Exception as e:
            logger.debug(f"Error parsing LLM response: {e}")
        
        return entities
    
    def _fallback_parsing(self, response: str, original_text: str) -> List[EntitySpan]:
        """Fallback parsing when JSON parsing fails."""
        entities = []
        
        # Try to extract entities using regex patterns
        patterns = [
            r'"text":\s*"([^"]+)"\s*,\s*"label":\s*"([^"]+)"',
            r'Entity:\s*([^,\n]+),?\s*Type:\s*([^\n,]+)',
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-–]\s*([A-Z_][A-Za-z_]+)',
            r'(\w+(?:\s+\w+)*)\s*\(([^)]+)\)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, response, re.IGNORECASE)
            for match in matches:
                entity_text = match[0].strip()
                entity_label = match[1].strip()
                
                # Find position in original text
                start_pos = original_text.find(entity_text)
                if start_pos >= 0:
                    end_pos = start_pos + len(entity_text)
                    entities.append(EntitySpan(
                        text=entity_text,
                        labels=[entity_label],
                        start_pos=start_pos,
                        end_pos=end_pos,
                        confidence=0.6  # Lower confidence for fallback
                    ))
        
        return entities
    
    def get_processing_stats(self) -> ProcessingStats:
        """Get processing statistics."""
        return self._stats
    
    def set_processing_mode(self, mode: ProcessingMode) -> None:
        """Set processing mode for optimization."""
        self.processing_mode = mode
        
        if mode == ProcessingMode.HIGH_THROUGHPUT:
            self.base_batch_size = min(4, self.base_batch_size * 2)
        elif mode == ProcessingMode.LOW_LATENCY:
            self.base_batch_size = 1
        elif mode == ProcessingMode.MEMORY_EFFICIENT:
            self.base_batch_size = 1
            self.use_quantization = True