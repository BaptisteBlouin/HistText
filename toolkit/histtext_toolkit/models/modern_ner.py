# toolkit/histtext_toolkit/models/modern_ner.py
"""Modern NER model implementations with state-of-the-art libraries."""

import logging
import time
from typing import Any, Dict, List, Optional, Iterator
import numpy as np
import torch
from dataclasses import dataclass

from ..core.logging import get_logger
from .base import EnhancedNERModel, EntitySpan, ProcessingStats, ProcessingMode, GPUMemoryManager

logger = get_logger(__name__)


class NuNERModel(EnhancedNERModel):
    """NuMind's NuNER model implementation - state-of-the-art zero-shot NER."""
    
    def __init__(
        self,
        model_name: str = "numind/NuNER-Zero",
        device: Optional[str] = None,
        batch_size: int = 16,
        max_length: int = 512,
        threshold: float = 0.5,
        processing_mode: ProcessingMode = ProcessingMode.BATCH
    ):
        self.model_name = model_name
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.base_batch_size = batch_size
        self.max_length = max_length
        self.threshold = threshold
        self.processing_mode = processing_mode
        
        self._model = None
        self._tokenizer = None
        self.is_loaded_flag = False
        self._stats = ProcessingStats()
        
        # Available NuNER models
        self.available_models = [
            "numind/NuNER-Zero",
            "numind/NuNER-Zero-4k", 
            "numind/NuNER-Zero-span"
        ]
    
    def load(self) -> bool:
        """Load the NuNER model."""
        try:
            from transformers import AutoTokenizer, AutoModelForTokenClassification
            
            logger.info(f"Loading NuNER model: {self.model_name}")
            
            # Load tokenizer and model
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForTokenClassification.from_pretrained(self.model_name)
            
            # Move to device
            self._model.to(self.device)
            self._model.eval()
            
            self.is_loaded_flag = True
            logger.info(f"Successfully loaded NuNER model on {self.device}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load NuNER model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload the model and free memory."""
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
        """NuNER supports any entity types specified at inference time."""
        return [
            "Person", "Organization", "Location", "Miscellaneous",
            "Date", "Time", "Money", "Percent", "Product", "Event",
            "Law", "Language", "Nationality", "Religion", "Title"
        ]
    
    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None
    ) -> List[EntitySpan]:
        """Extract entities from text using NuNER."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
            
        start_time = time.time()
        
        # Use default entity types if none provided
        if entity_types is None:
            entity_types = ["Person", "Organization", "Location"]
        
        try:
            # Prepare input with entity types (NuNER format)
            # NuNER expects: "Entity types: [TYPE1, TYPE2, ...] Text: [TEXT]"
            formatted_input = f"Entity types: {', '.join(entity_types)} Text: {text}"
            
            # Tokenize
            inputs = self._tokenizer(
                formatted_input,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length,
                padding=True
            ).to(self.device)
            
            # Inference
            with torch.no_grad():
                outputs = self._model(**inputs)
                predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
            
            # Process predictions to extract entities
            entities = self._process_predictions(
                text, 
                inputs, 
                predictions, 
                entity_types
            )
            
            # Update stats
            processing_time = time.time() - start_time
            self._stats.total_entities += len(entities)
            self._stats.processing_time += processing_time
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in NuNER entity extraction: {e}")
            return []
    
    def extract_entities_batch(
        self, 
        texts: List[str], 
        entity_types: Optional[List[str]] = None
    ) -> List[List[EntitySpan]]:
        """Batch entity extraction for improved efficiency."""
        if not texts:
            return []
            
        # Optimize batch size based on GPU memory
        batch_size = GPUMemoryManager.optimize_batch_size(self.base_batch_size)
        
        results = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_results = []
            
            for text in batch:
                entities = self.extract_entities(text, entity_types)
                batch_results.append(entities)
            
            results.extend(batch_results)
            
            # Clear cache periodically
            if i % (batch_size * 4) == 0:
                GPUMemoryManager.clear_cache()
        
        return results
    
    def _process_predictions(
        self, 
        original_text: str, 
        inputs: Dict, 
        predictions: torch.Tensor, 
        entity_types: List[str]
    ) -> List[EntitySpan]:
        """Process model predictions to extract entities."""
        entities = []
        
        # Get predicted labels
        predicted_labels = torch.argmax(predictions, dim=-1)
        
        # Convert to numpy for easier processing
        labels = predicted_labels.cpu().numpy()[0]  # First batch item
        tokens = self._tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
        
        # Simple entity extraction (this is a simplified version)
        # In practice, you'd need more sophisticated BIO tag processing
        current_entity = None
        current_tokens = []
        
        for i, (token, label_id) in enumerate(zip(tokens, labels)):
            if token.startswith("##"):
                if current_tokens:
                    current_tokens.append(token[2:])
            elif label_id > 0:  # Assuming label 0 is 'O' (outside)
                if current_entity is None:
                    current_entity = entity_types[min(label_id - 1, len(entity_types) - 1)]
                    current_tokens = [token]
                else:
                    current_tokens.append(token)
            else:
                if current_entity and current_tokens:
                    # Create entity
                    entity_text = "".join(current_tokens).replace("▁", " ").strip()
                    if entity_text:
                        # Find position in original text
                        start_pos = original_text.find(entity_text)
                        if start_pos >= 0:
                            end_pos = start_pos + len(entity_text)
                            confidence = float(torch.max(predictions[0, i-len(current_tokens):i]).item())
                            
                            entities.append(EntitySpan(
                                text=entity_text,
                                labels=[current_entity],
                                start_pos=start_pos,
                                end_pos=end_pos,
                                confidence=confidence
                            ))
                
                current_entity = None
                current_tokens = []
        
        return entities


class FlairNERModel(EnhancedNERModel):
    """Flair NER model implementation."""
    
    def __init__(
        self,
        model_name: str = "ner",
        device: Optional[str] = None,
        batch_size: int = 32,
        use_crf: bool = True
    ):
        self.model_name = model_name
        self.device = device
        self.base_batch_size = batch_size
        self.use_crf = use_crf
        
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
            "ner-multi-fast"  # Fast multilingual NER
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
            for sentence in sentences:
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
            
            return results
            
        except Exception as e:
            logger.error(f"Error in Flair batch processing: {e}")
            return [[] for _ in texts]


class EnhancedGLiNERModel(EnhancedNERModel):
    """Enhanced GLiNER model with better GPU utilization."""
    
    def __init__(
        self,
        model_name: str = "urchade/gliner_mediumv2.1",
        device: Optional[str] = None,
        batch_size: int = 16,
        threshold: float = 0.3,
        max_length: int = 384,
        use_fp16: bool = True
    ):
        self.model_name = model_name
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.base_batch_size = batch_size
        self.threshold = threshold
        self.max_length = max_length
        self.use_fp16 = use_fp16 and torch.cuda.is_available()
        
        self._model = None
        self.is_loaded_flag = False
        self._stats = ProcessingStats()
        
        # Available GLiNER models
        self.available_models = [
            "urchade/gliner_base",
            "urchade/gliner_medium-v2.1", 
            "urchade/gliner_mediumv2.1",
            "urchade/gliner_large-v2.1",
            "numind/GLiNER-7B"
        ]
    
    def load(self) -> bool:
        """Load GLiNER model with optimizations."""
        try:
            from gliner import GLiNER
            
            logger.info(f"Loading GLiNER model: {self.model_name}")
            
            # Load model
            self._model = GLiNER.from_pretrained(self.model_name)
            
            # Apply optimizations
            if self.device == "cuda":
                self._model.to(self.device)
                
                # Enable mixed precision if supported
                if self.use_fp16:
                    self._model.half()
                    logger.info("Enabled FP16 precision")
                
                # Enable compilation if PyTorch 2.0+
                try:
                    if hasattr(torch, "compile"):
                        self._model = torch.compile(self._model)
                        logger.info("Enabled model compilation")
                except:
                    pass
            
            self.is_loaded_flag = True
            logger.info(f"Successfully loaded GLiNER model on {self.device}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load GLiNER model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload GLiNER model."""
        if self._model is not None:
            del self._model
            self._model = None
            
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
            "Cardinal", "Quantity"
        ]
    
    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None
    ) -> List[EntitySpan]:
        """Extract entities using enhanced GLiNER."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
            
        start_time = time.time()
        
        # Use default entity types if none provided
        if entity_types is None:
            entity_types = ["Person", "Organization", "Location"]
        
        try:
            # Extract entities
            raw_entities = self._model.predict_entities(
                text, 
                entity_types, 
                threshold=self.threshold
            )
            
            # Convert to EntitySpan format
            entities = []
            for entity in raw_entities:
                entities.append(EntitySpan(
                    text=entity["text"],
                    labels=[entity["label"]],
                    start_pos=entity["start"],
                    end_pos=entity["end"],
                    confidence=entity["score"]
                ))
            
            # Update stats
            processing_time = time.time() - start_time
            self._stats.total_entities += len(entities)
            self._stats.processing_time += processing_time
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in GLiNER entity extraction: {e}")
            return []
    
    def extract_entities_batch(
        self, 
        texts: List[str], 
        entity_types: Optional[List[str]] = None
    ) -> List[List[EntitySpan]]:
        """Optimized batch processing for GLiNER."""
        if not texts:
            return []
            
        # Optimize batch size based on GPU memory
        batch_size = GPUMemoryManager.optimize_batch_size(self.base_batch_size)
        
        if entity_types is None:
            entity_types = ["Person", "Organization", "Location"]
        
        results = []
        
        try:
            # Process in optimized batches
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                batch_results = []
                
                # Use GLiNER's batch processing if available
                for text in batch_texts:
                    if text.strip():
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


class LLMNERModel(EnhancedNERModel):
    """LLM-based NER using models like Llama, Mistral, etc."""
    
    def __init__(
        self,
        model_name: str = "microsoft/DialoGPT-medium",
        device: Optional[str] = None,
        batch_size: int = 4,  # Smaller for LLMs
        max_length: int = 2048,
        temperature: float = 0.1
    ):
        self.model_name = model_name
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.base_batch_size = batch_size
        self.max_length = max_length
        self.temperature = temperature
        
        self._model = None
        self._tokenizer = None
        self.is_loaded_flag = False
        self._stats = ProcessingStats()
    
    def load(self) -> bool:
        """Load LLM for NER."""
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM
            
            logger.info(f"Loading LLM for NER: {self.model_name}")
            
            # Load with optimizations
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                device_map="auto" if torch.cuda.is_available() else None
            )
            
            # Set padding token
            if self._tokenizer.pad_token is None:
                self._tokenizer.pad_token = self._tokenizer.eos_token
            
            self.is_loaded_flag = True
            logger.info("Successfully loaded LLM for NER")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load LLM: {e}")
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
            "Medical_Condition", "Drug", "Chemical", "Gene", "Protein"
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
            entity_types = ["Person", "Organization", "Location"]
        
        start_time = time.time()
        
        try:
            # Create structured prompt
            prompt = self._create_ner_prompt(text, entity_types)
            
            # Tokenize
            inputs = self._tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length,
                padding=True
            ).to(self.device)
            
            # Generate
            with torch.no_grad():
                outputs = self._model.generate(
                    **inputs,
                    max_new_tokens=512,
                    temperature=self.temperature,
                    do_sample=False,
                    pad_token_id=self._tokenizer.eos_token_id
                )
            
            # Decode response
            response = self._tokenizer.decode(
                outputs[0][inputs['input_ids'].shape[1]:], 
                skip_special_tokens=True
            )
            
            # Parse entities from response
            entities = self._parse_llm_response(response, text)
            
            # Update stats
            processing_time = time.time() - start_time
            self._stats.total_entities += len(entities)
            self._stats.processing_time += processing_time
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in LLM NER: {e}")
            return []
    
    def extract_entities_batch(
        self,
        texts: List[str], 
        entity_types: Optional[List[str]] = None
    ) -> List[List[EntitySpan]]:
        """Batch processing for LLM NER with memory optimization."""
        if not texts:
            return []
            
        # LLMs need smaller batches due to memory constraints
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
        
        return results
    
    def _create_ner_prompt(self, text: str, entity_types: List[str]) -> str:
        """Create structured prompt for NER."""
        entity_types_str = ", ".join(entity_types)
        
        prompt = f"""Extract named entities from the following text. Return results in JSON format.

Entity types to extract: {entity_types_str}

Text: "{text}"

Return a JSON array where each entity has:
- "text": the entity text
- "label": the entity type
- "start": start position
- "end": end position

JSON:"""
        
        return prompt
    
    def _parse_llm_response(self, response: str, original_text: str) -> List[EntitySpan]:
        """Parse LLM response to extract entities."""
        entities = []
        
        try:
            import json
            import re
            
            # Try to find JSON in response
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                parsed = json.loads(json_str)
                
                for item in parsed:
                    if isinstance(item, dict) and all(k in item for k in ['text', 'label']):
                        # Try to find positions if not provided
                        start_pos = item.get('start')
                        end_pos = item.get('end')
                        
                        if start_pos is None or end_pos is None:
                            # Find in original text
                            entity_text = item['text']
                            start_pos = original_text.find(entity_text)
                            if start_pos >= 0:
                                end_pos = start_pos + len(entity_text)
                            else:
                                continue
                        
                        entities.append(EntitySpan(
                            text=item['text'],
                            labels=[item['label']],
                            start_pos=start_pos,
                            end_pos=end_pos,
                            confidence=0.8  # Default confidence for LLM
                        ))
        
        except Exception as e:
            logger.debug(f"Error parsing LLM response: {e}")
            # Fallback: simple regex-based extraction
            entities = self._fallback_extraction(response, original_text)
        
        return entities
    
    def _fallback_extraction(self, response: str, original_text: str) -> List[EntitySpan]:
        """Fallback extraction method."""
        entities = []
        # Simple pattern matching as fallback
        # This is a basic implementation - can be enhanced
        return entities