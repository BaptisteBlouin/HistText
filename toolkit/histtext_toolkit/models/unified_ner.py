"""Unified NER model implementation with improved loading strategies and fixes."""

import logging
import time
import json
import re
import os
import warnings
from typing import Any, Dict, List, Optional, Iterator, Union, Tuple
import numpy as np
import torch
from dataclasses import dataclass

from ..core.logging import get_logger
from .base import NERModel, EntitySpan, ProcessingStats, ProcessingMode, GPUMemoryManager

logger = get_logger(__name__)


class UnifiedNERModel(NERModel):
    """Unified NER model that automatically adapts to any model type."""
    
    def __init__(
        self,
        model_path: str,
        model_type: str = "transformers",
        device: Optional[str] = None,
        batch_size: int = 16,
        max_length: int = 512,
        threshold: float = 0.5,
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        aggregation_strategy: str = "simple",
        entity_types: Optional[List[str]] = None,
        use_fast_tokenizer: bool = True,
        use_gpu: Optional[bool] = None,
        optimization_level: int = 1,
        disable_warnings: bool = False,
        **kwargs
    ):
        self.model_path = model_path
        self.model_type = model_type.lower()
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.batch_size = batch_size
        self.max_length = max_length
        self.threshold = threshold
        self.processing_mode = processing_mode
        self.aggregation_strategy = aggregation_strategy
        self.entity_types = entity_types
        self.use_fast_tokenizer = use_fast_tokenizer
        self.use_gpu = use_gpu if use_gpu is not None else torch.cuda.is_available()
        self.optimization_level = optimization_level
        self.disable_warnings = disable_warnings
        self.kwargs = kwargs
        
        # Suppress warnings if requested
        if disable_warnings:
            warnings.filterwarnings("ignore")
        
        # Internal components
        self._model = None
        self._tokenizer = None
        self._pipeline = None
        self._native_model = None
        self.is_loaded_flag = False
        self._stats = ProcessingStats()
        
        # Model capabilities detection
        self._model_info = self._detect_model_capabilities()
        
        logger.info(f"Initialized UnifiedNERModel: {model_path} ({model_type})")
        logger.info(f"Device: {self.device}, Capabilities: {self._model_info}")
    
    def _detect_model_capabilities(self) -> Dict[str, Any]:
        """Detect model capabilities and optimal settings."""
        model_info = {
            "supports_batch": True,
            "supports_streaming": True,
            "supports_entity_filtering": True,
            "optimal_batch_size": self.batch_size,
            "memory_efficient": False,
            "requires_special_handling": False
        }
        
        model_path_lower = self.model_path.lower()
        model_type_lower = self.model_type.lower()
        
        # Detect special model characteristics
        if "gliner" in model_path_lower or model_type_lower == "gliner":
            model_info.update({
                "supports_zero_shot": True,
                "requires_entity_types": True,
                "supports_long_documents": True,
                "optimal_batch_size": min(8, self.batch_size),
                "max_chunk_size": 350
            })
        
        elif any(x in model_path_lower for x in ["llama", "mistral", "qwen", "phi"]) or "llm" in model_type_lower:
            model_info.update({
                "supports_zero_shot": True,
                "memory_efficient": False,
                "optimal_batch_size": min(2, self.batch_size),
                "requires_special_handling": True,
                "max_context_length": 4096,
                "skip_pipeline": True  # Skip pipeline for LLMs
            })
        
        elif "nunerzero" in model_path_lower or "nuner_zero" in model_path_lower or (model_type_lower == "nuner" and "zero" in model_path_lower):
            # NuNER Zero is actually GLiNER-based
            model_info.update({
                "supports_zero_shot": True,
                "requires_entity_types": True,
                "supports_long_documents": True,
                "optimal_batch_size": min(8, self.batch_size),
                "max_chunk_size": 350,
                "is_gliner_based": True
            })
        
        elif "nuner" in model_path_lower or model_type_lower == "nuner":
            model_info.update({
                "supports_zero_shot": "zero" in model_path_lower,
                "optimal_batch_size": min(16, self.batch_size),
                "memory_efficient": True,
                "requires_special_handling": True
            })
        
        elif "flair" in model_path_lower or model_type_lower == "flair":
            model_info.update({
                "supports_batch": True,
                "optimal_batch_size": min(32, self.batch_size),
                "memory_efficient": True,
                "requires_special_handling": True
            })
        
        elif any(x in model_path_lower for x in ["bert", "roberta", "distilbert"]):
            model_info.update({
                "memory_efficient": True,
                "optimal_batch_size": min(32, self.batch_size)
            })
        
        return model_info
    
    def load(self) -> bool:
        """Universal model loading with improved strategies."""
        try:
            logger.info(f"Loading model: {self.model_path} ({self.model_type})")
            
            # Define loading strategies with proper priority
            loading_strategies = []
            
            # Special handling for NuNER Zero (it's actually GLiNER-based)
            if self._model_info.get("is_gliner_based"):
                loading_strategies.append(("NuNER Zero (GLiNER)", self._try_load_nuner_zero))
            
            # Add other strategies based on model type
            if "gliner" in self.model_type or "gliner" in self.model_path.lower():
                loading_strategies.append(("GLiNER", self._try_load_gliner))
            
            if "flair" in self.model_type or "flair" in self.model_path.lower():
                loading_strategies.append(("Flair", self._try_load_flair))
            
            if "spacy" in self.model_type:
                loading_strategies.append(("spaCy", self._try_load_spacy))
            
            # LLM strategies (skip pipeline for LLMs)
            if self._model_info.get("skip_pipeline"):
                loading_strategies.append(("LLM Direct", self._try_load_llm))
            else:
                # Add standard strategies
                if "nuner" in self.model_type or "nuner" in self.model_path.lower():
                    loading_strategies.append(("NuNER Standard", self._try_load_nuner))
                
                loading_strategies.extend([
                    ("Transformers Pipeline", self._try_load_transformers_pipeline),
                    ("Manual Transformers", self._try_load_transformers_manual),
                    ("LLM Fallback", self._try_load_llm),
                ])
            
            # Try each strategy
            for strategy_name, strategy_func in loading_strategies:
                try:
                    logger.debug(f"Trying {strategy_name} loading strategy")
                    if strategy_func():
                        logger.info(f"Successfully loaded with {strategy_name} strategy")
                        return True
                except Exception as e:
                    logger.debug(f"{strategy_name} strategy failed: {e}")
                    continue
            
            logger.error(f"All loading strategies failed for {self.model_path}")
            return False
                
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def _try_load_nuner_zero(self) -> bool:
        """Load NuNER Zero using GLiNER approach."""
        try:
            from gliner import GLiNER
            
            logger.info("Loading NuNER Zero as GLiNER model")
            
            # Map the model path for NuNER Zero
            gliner_path = self.model_path
            if "numind/NuNer" in gliner_path:
                gliner_path = gliner_path.replace("numind/NuNer", "numind/NuNer")
            
            self._native_model = GLiNER.from_pretrained(gliner_path)
            self._native_model.to(self.device)
            
            # Create special wrapper for NuNER Zero
            self._pipeline = NuNERZeroWrapper(
                self._native_model, 
                self.threshold,
                max_chunk_size=self._model_info.get("max_chunk_size", 350)
            )
            
            self.is_loaded_flag = True
            return True
            
        except Exception as e:
            logger.debug(f"NuNER Zero (GLiNER) loading failed: {e}")
            return False
    
    def _try_load_gliner(self) -> bool:
        """Try loading as GLiNER model."""
        if "gliner" not in self.model_type and "gliner" not in self.model_path.lower():
            return False
        
        try:
            from gliner import GLiNER
            
            logger.info("Loading as GLiNER model")
            self._native_model = GLiNER.from_pretrained(self.model_path)
            self._native_model.to(self.device)
            
            self._pipeline = GLiNERWrapper(
                self._native_model, 
                self.threshold,
                max_chunk_size=self._model_info.get("max_chunk_size", 350)
            )
            
            self.is_loaded_flag = True
            return True
            
        except Exception as e:
            logger.debug(f"GLiNER loading failed: {e}")
            return False
    
    def _try_load_nuner(self) -> bool:
        """Try loading NuNER model with multiple approaches."""
        if "nuner" not in self.model_type and "nuner" not in self.model_path.lower():
            return False
        
        # Skip if this is NuNER Zero (handled separately)
        if "zero" in self.model_path.lower():
            return False
        
        try:
            from transformers import AutoTokenizer, AutoModelForTokenClassification, AutoConfig
            
            logger.info("Loading as NuNER model")
            
            # Try loading with different approaches
            approaches = [
                self._load_nuner_standard,
                self._load_nuner_pipeline,
                self._load_nuner_manual
            ]
            
            for approach in approaches:
                try:
                    if approach():
                        self.is_loaded_flag = True
                        return True
                except Exception as e:
                    logger.debug(f"NuNER approach failed: {e}")
                    continue
            
            return False
            
        except Exception as e:
            logger.debug(f"NuNER loading failed: {e}")
            return False
    
    def _load_nuner_standard(self) -> bool:
        """Standard NuNER loading."""
        from transformers import AutoTokenizer, AutoModelForTokenClassification, AutoConfig
        
        config = AutoConfig.from_pretrained(self.model_path)
        
        self._tokenizer = AutoTokenizer.from_pretrained(
            self.model_path,
            use_fast=True,
            add_prefix_space=True
        )
        
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore")
            self._native_model = AutoModelForTokenClassification.from_pretrained(
                self.model_path,
                config=config,
                ignore_mismatched_sizes=True
            )
        
        self._native_model.to(self.device)
        self._native_model.eval()
        
        if self._tokenizer.pad_token is None:
            if self._tokenizer.eos_token:
                self._tokenizer.pad_token = self._tokenizer.eos_token
            else:
                self._tokenizer.add_special_tokens({'pad_token': '[PAD]'})
                self._native_model.resize_token_embeddings(len(self._tokenizer))
        
        self._pipeline = NuNERWrapper(self._native_model, self._tokenizer, self.device, config)
        return True
    
    def _load_nuner_pipeline(self) -> bool:
        """Try NuNER with pipeline."""
        from transformers import pipeline
        
        self._pipeline = pipeline(
            "ner",
            model=self.model_path,
            aggregation_strategy="simple",
            device=0 if self.device == "cuda" else -1,
            ignore_mismatched_sizes=True
        )
        return True
    
    def _load_nuner_manual(self) -> bool:
        """Manual NuNER loading."""
        from transformers import AutoTokenizer, AutoModelForTokenClassification
        
        self._tokenizer = AutoTokenizer.from_pretrained(self.model_path)
        self._native_model = AutoModelForTokenClassification.from_pretrained(
            self.model_path,
            ignore_mismatched_sizes=True
        )
        
        self._native_model.to(self.device)
        self._pipeline = FixedManualTransformersWrapper(
            self._native_model, self._tokenizer, self.device, self.max_length, "simple"
        )
        return True
    
    def _try_load_transformers_pipeline(self) -> bool:
        """Try loading as Transformers pipeline with better error handling."""
        try:
            from transformers import pipeline
            
            logger.info("Loading as Transformers pipeline")
            
            with warnings.catch_warnings():
                if self.disable_warnings:
                    warnings.filterwarnings("ignore")
                
                pipeline_kwargs = {
                    "model": self.model_path,
                    "tokenizer": self.model_path,
                    "aggregation_strategy": self.aggregation_strategy,
                    "device": 0 if self.device == "cuda" else -1,
                    "use_fast": self.use_fast_tokenizer,
                    "return_all_scores": False,
                    "trust_remote_code": True
                }
                
                # Try different aggregation strategies if the default fails
                strategies = [self.aggregation_strategy, "simple", "first", "none"]
                
                for strategy in strategies:
                    try:
                        pipeline_kwargs["aggregation_strategy"] = strategy
                        self._pipeline = pipeline("ner", **pipeline_kwargs)
                        logger.info(f"Pipeline loaded with aggregation strategy: {strategy}")
                        self.is_loaded_flag = True
                        return True
                    except Exception as e:
                        logger.debug(f"Pipeline failed with {strategy}: {e}")
                        continue
                
                return False
            
        except Exception as e:
            logger.debug(f"Transformers pipeline loading failed: {e}")
            return False
    
    def _try_load_flair(self) -> bool:
        """Try loading as Flair model."""
        if "flair" not in self.model_type and "flair" not in self.model_path.lower():
            return False
        
        try:
            from flair.models import SequenceTagger
            import flair
            
            logger.info("Loading as Flair model")
            
            if self.device == "cuda":
                flair.device = torch.device("cuda")
            
            self._native_model = SequenceTagger.load(self.model_path)
            self._pipeline = FlairWrapper(self._native_model)
            
            self.is_loaded_flag = True
            return True
            
        except Exception as e:
            logger.debug(f"Flair loading failed: {e}")
            return False
    
    def _try_load_spacy(self) -> bool:
        """Try loading as spaCy model."""
        if "spacy" not in self.model_type:
            return False
        
        try:
            import spacy
            
            logger.info("Loading as spaCy model")
            
            self._native_model = spacy.load(
                self.model_path, 
                exclude=["parser", "tagger", "lemmatizer", "attribute_ruler"]
            )
            
            self._pipeline = SpacyWrapper(self._native_model)
            
            self.is_loaded_flag = True
            return True
            
        except Exception as e:
            logger.debug(f"spaCy loading failed: {e}")
            return False
    
    def _try_load_llm(self) -> bool:
        """Try loading as LLM for NER with improved flash attention handling."""
        if not any(x in self.model_type for x in ["llm", "llama", "mistral", "qwen", "phi"]) and not self._model_info.get("skip_pipeline"):
            return False
        
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM
            
            logger.info("Loading as LLM for NER")
            
            # Load tokenizer first
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_path,
                padding_side="left",
                trust_remote_code=True
            )
            
            # Prepare model loading arguments with flash attention fixes
            model_kwargs = {
                "trust_remote_code": True,
                "use_cache": True,
            }
            
            # Set dtype for optimization
            if self.optimization_level >= 1 and torch.cuda.is_available():
                model_kwargs["torch_dtype"] = torch.float16
            
            # Load with flash attention workarounds
            with warnings.catch_warnings():
                if self.disable_warnings:
                    warnings.filterwarnings("ignore")
                
                # Try loading with eager attention
                try:
                    model_kwargs["_attn_implementation"] = "eager"
                    self._native_model = AutoModelForCausalLM.from_pretrained(
                        self.model_path,
                        **model_kwargs
                    )
                except Exception as flash_error:
                    logger.debug(f"Eager attention failed, trying without attention spec: {flash_error}")
                    # Remove attention implementation and try again
                    model_kwargs.pop("_attn_implementation", None)
                    model_kwargs["attn_implementation"] = "eager"
                    
                    try:
                        self._native_model = AutoModelForCausalLM.from_pretrained(
                            self.model_path,
                            **model_kwargs
                        )
                    except Exception:
                        # Final fallback
                        model_kwargs.pop("attn_implementation", None)
                        self._native_model = AutoModelForCausalLM.from_pretrained(
                            self.model_path,
                            **{k: v for k, v in model_kwargs.items() if "attn" not in k}
                        )
            
            # Handle padding token
            if not hasattr(self._tokenizer, 'pad_token') or self._tokenizer.pad_token is None:
                if self._tokenizer.eos_token:
                    self._tokenizer.pad_token = self._tokenizer.eos_token
                else:
                    self._tokenizer.add_special_tokens({'pad_token': '[PAD]'})
                    self._native_model.resize_token_embeddings(len(self._tokenizer))
            
            self._native_model.to(self.device)
            self._native_model.eval()
            
            # Create LLM wrapper
            self._pipeline = LLMNERWrapper(
                self._native_model, 
                self._tokenizer, 
                self.device,
                self.max_length
            )
            
            self.is_loaded_flag = True
            return True
            
        except Exception as e:
            logger.debug(f"LLM loading failed: {e}")
            return False
    
    def _try_load_transformers_manual(self) -> bool:
        """Manual transformers loading as fallback with fixed array handling."""
        try:
            from transformers import AutoTokenizer, AutoModelForTokenClassification
            
            logger.info("Loading with manual Transformers approach")
            
            # Load tokenizer and model manually
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_path,
                use_fast=self.use_fast_tokenizer,
                trust_remote_code=True
            )
            
            self._native_model = AutoModelForTokenClassification.from_pretrained(
                self.model_path,
                trust_remote_code=True,
                ignore_mismatched_sizes=True
            )
            
            self._native_model.to(self.device)
            self._native_model.eval()
            
            # Create fixed manual wrapper
            self._pipeline = FixedManualTransformersWrapper(
                self._native_model,
                self._tokenizer,
                self.device,
                self.max_length,
                self.aggregation_strategy
            )
            
            self.is_loaded_flag = True
            logger.info("Successfully loaded with manual Transformers approach")
            return True
            
        except Exception as e:
            logger.debug(f"Manual Transformers loading failed: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload the model and free memory."""
        try:
            if self._pipeline is not None:
                if hasattr(self._pipeline, 'unload'):
                    self._pipeline.unload()
                del self._pipeline
                self._pipeline = None
            
            if self._native_model is not None:
                del self._native_model
                self._native_model = None
            
            if self._tokenizer is not None:
                del self._tokenizer
                self._tokenizer = None
            
            GPUMemoryManager.clear_cache()
            self.is_loaded_flag = False
            
            logger.info("Successfully unloaded model")
            return True
            
        except Exception as e:
            logger.error(f"Error unloading model: {e}")
            return False
    
    @property
    def is_loaded(self) -> bool:
        return self.is_loaded_flag and self._pipeline is not None
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types."""
        if hasattr(self._pipeline, 'get_supported_entity_types'):
            return self._pipeline.get_supported_entity_types()
        
        if self._model_info.get("supports_zero_shot"):
            return [
                "Person", "Organization", "Location", "Date", "Time",
                "Money", "Percent", "Product", "Event", "Miscellaneous"
            ]
        else:
            return ["PER", "ORG", "LOC", "MISC"]
    
    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None
    ) -> List[EntitySpan]:
        """Universal entity extraction."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text or not text.strip():
            return []
        
        if entity_types is None:
            entity_types = self.entity_types
        
        start_time = time.time()
        
        try:
            if len(text) > self._get_max_text_length():
                return self._extract_entities_chunked(text, entity_types)
            else:
                return self._extract_entities_single(text, entity_types)
                
        except Exception as e:
            logger.error(f"Error in entity extraction: {e}")
            return []
        finally:
            processing_time = time.time() - start_time
            self._stats.processing_time += processing_time
    
    def _get_max_text_length(self) -> int:
        """Get maximum text length based on model type."""
        if "gliner" in self.model_type or self._model_info.get("is_gliner_based"):
            return 1000
        elif "llm" in self.model_type:
            return 2000
        else:
            return self.max_length * 3
    
    def _extract_entities_single(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract entities from single text."""
        try:
            if hasattr(self._pipeline, 'extract_entities'):
                return self._pipeline.extract_entities(text, entity_types)
            else:
                results = self._pipeline(text)
                return self._convert_pipeline_results(results, text)
                
        except Exception as e:
            logger.error(f"Error in single entity extraction: {e}")
            return []
    
    def _extract_entities_chunked(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract entities from long text using chunking."""
        try:
            if "gliner" in self.model_type or self._model_info.get("is_gliner_based"):
                chunk_size = self._model_info.get("max_chunk_size", 350)
                overlap = 50
            elif "llm" in self.model_type:
                chunk_size = 1500
                overlap = 200
            else:
                chunk_size = self.max_length * 2
                overlap = 200
            
            chunks = []
            start = 0
            
            while start < len(text):
                end = min(start + chunk_size, len(text))
                
                if end < len(text):
                    for i in range(end - overlap, end):
                        if i > start and text[i] in '.!?\n':
                            end = i + 1
                            break
                
                chunk = text[start:end]
                chunks.append((chunk, start, end))
                
                if end >= len(text):
                    break
                    
                start = end - overlap
            
            logger.debug(f"Split text into {len(chunks)} chunks for processing")
            
            all_entities = []
            for i, (chunk_text, start_offset, _) in enumerate(chunks):
                try:
                    chunk_entities = self._extract_entities_single(chunk_text, entity_types)
                    
                    for entity in chunk_entities:
                        entity.start_pos += start_offset
                        entity.end_pos += start_offset
                        all_entities.append(entity)
                        
                except Exception as e:
                    logger.warning(f"Error processing chunk {i+1}: {e}")
                    continue
            
            return self._deduplicate_entities(all_entities)
            
        except Exception as e:
            logger.error(f"Error in chunked extraction: {e}")
            return []
    
    def _convert_pipeline_results(self, results: List[Dict], text: str) -> List[EntitySpan]:
        """Convert pipeline results to EntitySpan format."""
        entities = []
        
        for result in results:
            try:
                entity_text = result.get("word", result.get("text", ""))
                entity_label = result.get("entity_group", result.get("entity", result.get("label", "")))
                start_pos = result.get("start", 0)
                end_pos = result.get("end", len(entity_text))
                confidence = result.get("score", result.get("confidence", 0.0))
                
                if entity_text:
                    entity_text = entity_text.replace("##", "").replace("▁", " ").replace("Ġ", " ").strip()
                
                if entity_text and len(entity_text) > 0:
                    entities.append(EntitySpan(
                        text=entity_text,
                        labels=[entity_label],
                        start_pos=int(start_pos),
                        end_pos=int(end_pos),
                        confidence=float(confidence)
                    ))
                    
            except Exception as e:
                logger.debug(f"Error converting result {result}: {e}")
                continue
        
        return entities
    
    def _deduplicate_entities(self, entities: List[EntitySpan]) -> List[EntitySpan]:
        """Remove duplicate entities from overlapping chunks."""
        if not entities:
            return []
        
        entities.sort(key=lambda x: x.start_pos)
        deduplicated = []
        
        for entity in entities:
            is_duplicate = False
            
            for existing in deduplicated:
                overlap_start = max(entity.start_pos, existing.start_pos)
                overlap_end = min(entity.end_pos, existing.end_pos)
                overlap_length = max(0, overlap_end - overlap_start)
                
                entity_length = entity.end_pos - entity.start_pos
                
                if overlap_length > 0.7 * entity_length:
                    if entity.confidence <= existing.confidence:
                        is_duplicate = True
                        break
                    else:
                        deduplicated.remove(existing)
                        break
            
            if not is_duplicate:
                deduplicated.append(entity)
        
        return deduplicated
    
    def extract_entities_batch(
        self, 
        texts: List[str], 
        entity_types: Optional[List[str]] = None
    ) -> List[List[EntitySpan]]:
        """Batch entity extraction with optimization."""
        if not texts:
            return []
        
        batch_size = GPUMemoryManager.optimize_batch_size(
            self._model_info["optimal_batch_size"]
        )
        
        results = []
        
        try:
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
                
                if i % (batch_size * 4) == 0:
                    GPUMemoryManager.clear_cache()
            
            return results
            
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
            return [[] for _ in texts]
    
    def get_processing_stats(self) -> ProcessingStats:
        """Get processing statistics."""
        return self._stats


# Model-specific wrappers for unified interface

class FixedManualTransformersWrapper:
    """Fixed manual wrapper for Transformers models when pipeline fails."""
    
    def __init__(self, model, tokenizer, device: str, max_length: int, aggregation_strategy: str):
        self.model = model
        self.tokenizer = tokenizer
        self.device = device
        self.max_length = max_length
        self.aggregation_strategy = aggregation_strategy
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        try:
            # Tokenize
            inputs = self.tokenizer(
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
                outputs = self.model(**{k: v for k, v in inputs.items() if k != "offset_mapping"})
                logits = outputs.logits
                predictions = torch.nn.functional.softmax(logits, dim=-1)
                predicted_labels = torch.argmax(logits, dim=-1)
            
            # Convert to entities
            entities = self._process_token_predictions(
                text, inputs, predicted_labels[0], predictions[0]
            )
            
            return entities
            
        except Exception as e:
            logger.error(f"Fixed manual transformers extraction error: {e}")
            return []
   
    def _process_token_predictions(self, text: str, inputs: Dict, predicted_labels: torch.Tensor, predictions: torch.Tensor) -> List[EntitySpan]:
       """Process token predictions to extract entities with fixed array handling."""
       entities = []
       
       try:
           input_ids = inputs["input_ids"][0]
           tokens = self.tokenizer.convert_ids_to_tokens(input_ids)
           offset_mapping = inputs.get("offset_mapping")
           
           if offset_mapping is not None:
               offset_mapping = offset_mapping[0].cpu().numpy()
           else:
               offset_mapping = [(0, 0)] * len(tokens)
           
           # Get model's label mapping
           if hasattr(self.model.config, 'id2label'):
               id2label = self.model.config.id2label
           else:
               # Create simple mapping
               num_labels = self.model.config.num_labels
               id2label = {i: f"LABEL_{i}" for i in range(num_labels)}
               id2label[0] = "O"  # Outside
           
           # Process tokens with fixed array handling
           current_entity = []
           current_entity_type = None
           current_start = None
           
           for i, (token, offset) in enumerate(zip(tokens, offset_mapping)):
               if token in self.tokenizer.all_special_tokens:
                   continue
               
               # Fix: Convert tensor to scalar properly
               label_id = predicted_labels[i].item()  # Convert to Python int
               label = id2label.get(label_id, "O")
               
               # Fix: Get confidence score properly
               confidence = float(predictions[i].max().item())  # Convert to Python float
               
               if label.startswith("B-") or (label != "O" and current_entity_type is None):
                   # Start new entity
                   if current_entity:
                       entity = self._create_entity_from_tokens(
                           current_entity_type, current_entity, current_start, text
                       )
                       if entity:
                           entities.append(entity)
                   
                   current_entity_type = label[2:] if label.startswith("B-") else "ENT"
                   current_entity = [token]
                   current_start = offset[0] if len(offset) == 2 and offset[0] != offset[1] else None
               
               elif label.startswith("I-") and current_entity_type == label[2:]:
                   # Continue entity
                   current_entity.append(token)
               
               elif label != "O" and current_entity_type is not None:
                   # Continue entity (for models without proper BIO tagging)
                   current_entity.append(token)
               
               else:
                   # End entity
                   if current_entity:
                       entity = self._create_entity_from_tokens(
                           current_entity_type, current_entity, current_start, text
                       )
                       if entity:
                           entities.append(entity)
                   
                   current_entity = []
                   current_entity_type = None
                   current_start = None
           
           # Handle last entity
           if current_entity:
               entity = self._create_entity_from_tokens(
                   current_entity_type, current_entity, current_start, text
               )
               if entity:
                   entities.append(entity)
           
           return entities
           
       except Exception as e:
           logger.error(f"Error processing token predictions: {e}")
           return []
   
    def _create_entity_from_tokens(self, entity_type: str, tokens: List[str], start_pos: Optional[int], text: str) -> Optional[EntitySpan]:
       """Create entity from tokens."""
       try:
           if not tokens or not entity_type:
               return None
           
           # Clean and join tokens
           clean_tokens = []
           for token in tokens:
               clean_token = token.replace("##", "").replace("▁", " ").replace("Ġ", " ")
               clean_tokens.append(clean_token)
           
           entity_text = "".join(clean_tokens).strip()
           
           if not entity_text:
               return None
           
           # Find position in text
           if start_pos is not None and start_pos >= 0:
               end_pos = start_pos + len(entity_text)
               if end_pos <= len(text):
                   actual_text = text[start_pos:end_pos]
                   if actual_text.strip() == entity_text:
                       return EntitySpan(
                           text=entity_text,
                           labels=[entity_type],
                           start_pos=int(start_pos),
                           end_pos=int(end_pos),
                           confidence=0.8
                       )
           
           # Fallback: search for the text
           found_pos = text.find(entity_text)
           if found_pos >= 0:
               return EntitySpan(
                   text=entity_text,
                   labels=[entity_type],
                   start_pos=found_pos,
                   end_pos=found_pos + len(entity_text),
                   confidence=0.8
               )
           
           return None
           
       except Exception as e:
           logger.debug(f"Error creating entity from tokens: {e}")
           return None
   
    def get_supported_entity_types(self) -> List[str]:
       if hasattr(self.model.config, 'id2label'):
           labels = list(self.model.config.id2label.values())
           entity_types = set()
           for label in labels:
               if label != "O" and "-" in label:
                   entity_type = label.split("-")[-1]
                   entity_types.add(entity_type)
           return list(entity_types) if entity_types else ["ENT"]
       return ["PER", "ORG", "LOC", "MISC"]


class NuNERZeroWrapper:
   """Special wrapper for NuNER Zero (GLiNER-based) with entity merging."""
   
   def __init__(self, model, threshold: float = 0.3, max_chunk_size: int = 350):
       self.model = model
       self.threshold = threshold
       self.max_chunk_size = max_chunk_size
   
   def extract_entities(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
       if not entity_types:
           entity_types = ["Person", "Organization", "Location"]
       
       # NuNER Zero requires lowercase labels
       labels = [label.lower() for label in entity_types]
       
       try:
           # Suppress GLiNER truncation warnings
           with warnings.catch_warnings():
               warnings.filterwarnings("ignore", message="Sentence of length.*has been truncated.*")
               
               # Use chunking for long texts
               if len(text) > self.max_chunk_size * 4:
                   return self._extract_with_chunking(text, labels)
               else:
                   return self._extract_single(text, labels)
           
       except Exception as e:
           logger.error(f"NuNER Zero extraction error: {e}")
           return []
   
   def _extract_single(self, text: str, labels: List[str]) -> List[EntitySpan]:
       """Extract from single text chunk."""
       try:
           results = self.model.predict_entities(text, labels, threshold=self.threshold)
           
           # Apply entity merging as shown in the example
           merged_results = self._merge_entities(results, text)
           
           entities = []
           for result in merged_results:
               entities.append(EntitySpan(
                   text=result["text"],
                   labels=[result["label"].title()],  # Convert back to title case
                   start_pos=result["start"],
                   end_pos=result["end"],
                   confidence=result["score"]
               ))
           
           return entities
       except Exception as e:
           logger.error(f"NuNER Zero single extraction error: {e}")
           return []
   
   def _extract_with_chunking(self, text: str, labels: List[str]) -> List[EntitySpan]:
       """Extract with intelligent chunking for long texts."""
       chunk_size = self.max_chunk_size
       overlap = 50
       
       chunks = []
       start = 0
       
       while start < len(text):
           end = min(start + chunk_size, len(text))
           
           # Try to break at word boundary
           if end < len(text):
               for i in range(end - overlap, end):
                   if i > start and text[i].isspace():
                       end = i
                       break
           
           chunk = text[start:end]
           if chunk.strip():
               chunks.append((chunk, start))
           
           if end >= len(text):
               break
               
           start = end - overlap
       
       # Process chunks
       all_entities = []
       for chunk_text, offset in chunks:
           try:
               chunk_entities = self._extract_single(chunk_text, labels)
               
               # Adjust positions
               for entity in chunk_entities:
                   entity.start_pos += offset
                   entity.end_pos += offset
                   all_entities.append(entity)
                   
           except Exception as e:
               logger.debug(f"Error in NuNER Zero chunk: {e}")
               continue
       
       # Remove duplicates
       return self._deduplicate_entities(all_entities)
   
   def _merge_entities(self, entities: List[Dict], text: str) -> List[Dict]:
       """Merge adjacent entities of the same type as shown in NuNER Zero example."""
       if not entities:
           return []
       
       # Sort by start position
       entities = sorted(entities, key=lambda x: x['start'])
       
       merged = []
       current = entities[0]
       
       for next_entity in entities[1:]:
           # Check if entities should be merged
           if (next_entity['label'] == current['label'] and 
               (next_entity['start'] == current['end'] + 1 or next_entity['start'] == current['end'])):
               
               # Merge entities
               current['text'] = text[current['start']:next_entity['end']].strip()
               current['end'] = next_entity['end']
               current['score'] = max(current['score'], next_entity['score'])  # Take max confidence
           else:
               merged.append(current)
               current = next_entity
       
       # Append the last entity
       merged.append(current)
       return merged
   
   def _deduplicate_entities(self, entities: List[EntitySpan]) -> List[EntitySpan]:
       """Remove duplicate entities."""
       if not entities:
           return []
       
       entities.sort(key=lambda x: x.start_pos)
       deduplicated = []
       
       for entity in entities:
           is_duplicate = False
           
           for existing in deduplicated:
               # Check for overlap
               if (entity.start_pos < existing.end_pos and 
                   entity.end_pos > existing.start_pos):
                   
                   overlap_start = max(entity.start_pos, existing.start_pos)
                   overlap_end = min(entity.end_pos, existing.end_pos)
                   overlap_length = overlap_end - overlap_start
                   
                   entity_length = entity.end_pos - entity.start_pos
                   
                   if overlap_length > 0.8 * entity_length:
                       if entity.confidence <= existing.confidence:
                           is_duplicate = True
                           break
                       else:
                           deduplicated.remove(existing)
                           break
           
           if not is_duplicate:
               deduplicated.append(entity)
       
       return deduplicated
   
   def get_supported_entity_types(self) -> List[str]:
       return [
           "Person", "Organization", "Location", "Miscellaneous",
           "Date", "Time", "Money", "Percent", "Product", "Event",
           "Initiative", "Project"  # Common for NuNER Zero
       ]


class GLiNERWrapper:
   """Wrapper for GLiNER models with chunking support."""
   
   def __init__(self, model, threshold: float = 0.3, max_chunk_size: int = 350):
       self.model = model
       self.threshold = threshold
       self.max_chunk_size = max_chunk_size
   
   def extract_entities(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
       if not entity_types:
           entity_types = ["Person", "Organization", "Location"]
       
       try:
           # Suppress GLiNER truncation warnings
           with warnings.catch_warnings():
               warnings.filterwarnings("ignore", message="Sentence of length.*has been truncated.*")
               
               # For very long texts, use chunking
               if len(text) > self.max_chunk_size * 4:
                   return self._extract_with_chunking(text, entity_types)
               else:
                   return self._extract_single(text, entity_types)
           
       except Exception as e:
           logger.error(f"GLiNER extraction error: {e}")
           return []
   
   def _extract_single(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
       """Extract from single text chunk."""
       results = self.model.predict_entities(text, entity_types, threshold=self.threshold)
       
       entities = []
       for result in results:
           entities.append(EntitySpan(
               text=result["text"],
               labels=[result["label"]],
               start_pos=result["start"],
               end_pos=result["end"],
               confidence=result["score"]
           ))
       
       return entities
   
   def _extract_with_chunking(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
       """Extract with intelligent chunking for long texts."""
       chunk_size = self.max_chunk_size
       overlap = 50
       
       chunks = []
       start = 0
       
       while start < len(text):
           end = min(start + chunk_size, len(text))
           
           # Try to break at word boundary
           if end < len(text):
               for i in range(end - overlap, end):
                   if i > start and text[i].isspace():
                       end = i
                       break
           
           chunk = text[start:end]
           if chunk.strip():
               chunks.append((chunk, start))
           
           if end >= len(text):
               break
               
           start = end - overlap
       
       # Process chunks
       all_entities = []
       for chunk_text, offset in chunks:
           try:
               chunk_entities = self._extract_single(chunk_text, entity_types)
               
               # Adjust positions
               for entity in chunk_entities:
                   entity.start_pos += offset
                   entity.end_pos += offset
                   all_entities.append(entity)
                   
           except Exception as e:
               logger.debug(f"Error in GLiNER chunk: {e}")
               continue
       
       # Remove duplicates
       return self._deduplicate_entities(all_entities)
   
   def _deduplicate_entities(self, entities: List[EntitySpan]) -> List[EntitySpan]:
       """Remove duplicate entities."""
       if not entities:
           return []
       
       entities.sort(key=lambda x: x.start_pos)
       deduplicated = []
       
       for entity in entities:
           is_duplicate = False
           
           for existing in deduplicated:
               # Check for overlap
               if (entity.start_pos < existing.end_pos and 
                   entity.end_pos > existing.start_pos):
                   
                   overlap_start = max(entity.start_pos, existing.start_pos)
                   overlap_end = min(entity.end_pos, existing.end_pos)
                   overlap_length = overlap_end - overlap_start
                   
                   entity_length = entity.end_pos - entity.start_pos
                   
                   if overlap_length > 0.8 * entity_length:
                       if entity.confidence <= existing.confidence:
                           is_duplicate = True
                           break
                       else:
                           deduplicated.remove(existing)
                           break
           
           if not is_duplicate:
               deduplicated.append(entity)
       
       return deduplicated
   
   def get_supported_entity_types(self) -> List[str]:
       return [
           "Person", "Organization", "Location", "Miscellaneous",
           "Date", "Time", "Money", "Percent", "Product", "Event"
       ]


class NuNERWrapper:
   """Wrapper for standard NuNER models."""
   
   def __init__(self, model, tokenizer, device: str, config):
       self.model = model
       self.tokenizer = tokenizer
       self.device = device
       self.config = config
       self.max_length = 512
   
   def extract_entities(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
       try:
           # Tokenize input
           inputs = self.tokenizer(
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
               outputs = self.model(**{k: v for k, v in inputs.items() if k != "offset_mapping"})
               logits = outputs.logits
               predictions = torch.nn.functional.softmax(logits, dim=-1)
               predicted_labels = torch.argmax(logits, dim=-1)
           
           # Process predictions to extract entities
           entities = self._process_predictions(
               text, inputs, predicted_labels[0], predictions[0]
           )
           
           return entities
           
       except Exception as e:
           logger.error(f"NuNER extraction error: {e}")
           return []
   
   def _process_predictions(self, text: str, inputs: Dict, predicted_labels: torch.Tensor, predictions: torch.Tensor) -> List[EntitySpan]:
       """Process model predictions to extract entities."""
       entities = []
       
       try:
           # Get input information
           input_ids = inputs["input_ids"][0]
           tokens = self.tokenizer.convert_ids_to_tokens(input_ids)
           offset_mapping = inputs.get("offset_mapping")
           
           if offset_mapping is not None:
               offset_mapping = offset_mapping[0].cpu().numpy()
           else:
               offset_mapping = [(0, 0)] * len(tokens)
           
           # Convert predictions to labels
           if hasattr(self.config, 'id2label') and self.config.id2label:
               labels = [self.config.id2label.get(label_id.item(), "O") 
                        for label_id in predicted_labels]
           else:
               # Binary classification fallback
               labels = []
               for i, pred_id in enumerate(predicted_labels):
                   confidence = float(predictions[i].max().item())
                   if pred_id.item() == 1 and confidence > 0.5:
                       labels.append("B-Entity")
                   else:
                       labels.append("O")
           
           # Extract entities using BIO tagging
           current_entity = []
           current_offsets = []
           current_scores = []
           current_type = None
           
           for i, (token, label, offset) in enumerate(zip(tokens, labels, offset_mapping)):
               if token in self.tokenizer.all_special_tokens:
                   continue
               
               confidence = float(predictions[i].max().item())
               
               if label.startswith("B-") or label == "B-ENT":
                   # Save previous entity
                   if current_entity:
                       entity = self._create_entity(current_type, current_entity, current_offsets, current_scores, text)
                       if entity:
                           entities.append(entity)
                   
                   # Start new entity
                   current_type = label[2:] if label.startswith("B-") else "Entity"
                   current_entity = [token]
                   current_offsets = [offset]
                   current_scores = [confidence]
               
               elif label.startswith("I-") and current_type == label[2:]:
                   # Continue current entity
                   current_entity.append(token)
                   current_offsets.append(offset)
                   current_scores.append(confidence)
               
               else:
                   # Outside entity or end of entity
                   if current_entity:
                       entity = self._create_entity(current_type, current_entity, current_offsets, current_scores, text)
                       if entity:
                           entities.append(entity)
                   
                   # Reset
                   current_entity = []
                   current_offsets = []
                   current_scores = []
                   current_type = None
           
           # Handle last entity
           if current_entity:
               entity = self._create_entity(current_type, current_entity, current_offsets, current_scores, text)
               if entity:
                   entities.append(entity)
           
           return entities
           
       except Exception as e:
           logger.error(f"Error processing NuNER predictions: {e}")
           return []
   
   def _create_entity(self, entity_type: str, tokens: List[str], offsets: List[Tuple[int, int]], scores: List[float], text: str) -> Optional[EntitySpan]:
       """Create EntitySpan from tokens and offsets."""
       try:
           if not tokens or not entity_type:
               return None
           
           # Get positions from offsets
           valid_offsets = [offset for offset in offsets if len(offset) == 2 and offset != (0, 0)]
           
           if valid_offsets:
               start_pos = int(valid_offsets[0][0])
               end_pos = int(valid_offsets[-1][1])
               
               # Ensure positions are valid
               start_pos = max(0, min(start_pos, len(text)))
               end_pos = max(start_pos, min(end_pos, len(text)))
               
               # Extract text from original
               entity_text = text[start_pos:end_pos].strip()
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
                   found_pos = text.find(entity_text)
                   if found_pos >= 0:
                       start_pos = int(found_pos)
                       end_pos = int(found_pos + len(entity_text))
           
           # Calculate average confidence
           avg_confidence = float(sum(scores) / len(scores)) if scores else 0.0
           
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
           logger.error(f"Error creating entity: {e}")
           return None
   
   def get_supported_entity_types(self) -> List[str]:
       if hasattr(self.config, 'id2label') and self.config.id2label:
           labels = list(self.config.id2label.values())
           entity_types = set()
           for label in labels:
               if label != "O" and "-" in label:
                   entity_type = label.split("-")[-1]
                   entity_types.add(entity_type)
           return list(entity_types) if entity_types else ["Entity"]
       return ["PER", "ORG", "LOC", "MISC"]


class FlairWrapper:
   """Wrapper for Flair models."""
   
   def __init__(self, model):
       self.model = model
   
   def extract_entities(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
       try:
           from flair.data import Sentence
           
           sentence = Sentence(text)
           self.model.predict(sentence)
           
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
           
           return entities
       except Exception as e:
           logger.error(f"Flair extraction error: {e}")
           return []
   
   def get_supported_entity_types(self) -> List[str]:
       return ["PER", "LOC", "ORG", "MISC"]


class SpacyWrapper:
   """Wrapper for spaCy models."""
   
   def __init__(self, model):
       self.model = model
   
   def extract_entities(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
       try:
           doc = self.model(text.replace("\n", " "))
           
           entities = []
           for ent in doc.ents:
               if entity_types is None or ent.label_ in entity_types:
                   entities.append(EntitySpan(
                       text=ent.text,
                       labels=[ent.label_],
                       start_pos=ent.start_char,
                       end_pos=ent.end_char,
                       confidence=1.0  # spaCy doesn't provide confidence
                   ))
           
           return entities
       except Exception as e:
           logger.error(f"spaCy extraction error: {e}")
           return []
   
   def get_supported_entity_types(self) -> List[str]:
       return ["PERSON", "ORG", "GPE", "LOC", "PRODUCT", "EVENT", "WORK_OF_ART", "LAW", "LANGUAGE", "DATE", "TIME", "PERCENT", "MONEY", "QUANTITY", "ORDINAL", "CARDINAL"]


class LLMNERWrapper:
    """Enhanced wrapper for LLM-based NER models with improved prompting and parsing."""
    
    def __init__(self, model, tokenizer, device: str, max_length: int):
        self.model = model
        self.tokenizer = tokenizer
        self.device = device
        self.max_length = max_length
        self.max_text_length = max_length - 1000  # More room for prompt and response
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        if not entity_types:
            entity_types = ["Person", "Organization", "Location"]
        
        try:
            # Create better structured prompt
            prompt = self._create_enhanced_ner_prompt(text, entity_types)
            
            # Tokenize with proper error handling
            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length - 300,  # More conservative
                padding=True
            ).to(self.device)
            
            # Generate with improved parameters for better extraction
            with torch.no_grad():
                try:
                    outputs = self.model.generate(
                        **inputs,
                        max_new_tokens=min(300, len(text) // 3),  # More conservative
                        temperature=0.01,  # Very low temperature for consistency
                        do_sample=False,
                        pad_token_id=self.tokenizer.pad_token_id,
                        eos_token_id=self.tokenizer.eos_token_id,
                        early_stopping=True,
                        repetition_penalty=1.05,
                        use_cache=True
                    )
                except Exception as cache_error:
                    logger.debug(f"Cache error, trying without cache: {cache_error}")
                    outputs = self.model.generate(
                        **inputs,
                        max_new_tokens=min(150, len(text) // 6),
                        temperature=0.01,
                        do_sample=False,
                        pad_token_id=self.tokenizer.pad_token_id,
                        eos_token_id=self.tokenizer.eos_token_id,
                        early_stopping=True,
                        use_cache=False
                    )
            
            # Decode response
            if outputs is not None and len(outputs) > 0:
                response = self.tokenizer.decode(
                    outputs[0][inputs['input_ids'].shape[1]:], 
                    skip_special_tokens=True
                )
                
                logger.debug(f"LLM raw response: {response[:200]}...")
                
                # Parse entities from response with improved parsing
                entities = self._parse_enhanced_llm_response(response, text, entity_types)
                
                # Validate and filter entities
                entities = self._validate_and_filter_entities(entities, text, entity_types)
                
                logger.debug(f"Extracted {len(entities)} entities: {[e.text for e in entities]}")
                
                return entities
            else:
                logger.warning("LLM generated empty response")
                return []
            
        except Exception as e:
            logger.error(f"LLM NER extraction error: {e}")
            return []
    
    def _create_enhanced_ner_prompt(self, text: str, entity_types: List[str]) -> str:
        """Create enhanced structured prompt for better NER."""
        entity_types_str = ", ".join(entity_types)
        
        # Detect model type for appropriate prompting
        model_name = getattr(self.model, 'name_or_path', '').lower()
        
        # Create examples based on entity types
        examples = self._create_examples(entity_types)
        
        if "deepseek" in model_name or "qwen" in model_name:
            prompt = f"""<｜begin▁of▁sentence｜>You are an expert at named entity recognition. Extract only complete, meaningful entities from the text.

Entity Types: {entity_types_str}

Rules:
1. Extract only COMPLETE words or phrases
2. Do not extract partial words or fragments
3. Only extract entities that are clearly one of the specified types
4. Return results as a JSON array

{examples}

Text: "{text}"

Extract entities and return as JSON array with format: [{{"text": "entity", "label": "type", "start": position, "end": position}}]

JSON:"""
        
        elif "mistral" in model_name:
            prompt = f"""<s>[INST] You are an expert at named entity recognition. Extract complete entities only.

Entity types: {entity_types_str}

Rules:
- Extract only complete, meaningful entities
- No partial words or fragments
- Only entities matching the specified types

{examples}

Text: "{text}"

Return JSON array: [{{"text": "entity", "label": "type", "start": pos, "end": pos}}] [/INST]

"""
        
        elif "llama" in model_name:
            prompt = f"""<s>[INST] <<SYS>>
You are an expert named entity recognition system. Extract only complete, meaningful entities.
<</SYS>>

Entity types: {entity_types_str}

{examples}

Text: "{text}"

Return JSON array with complete entities: [{{"text": "entity", "label": "type", "start": position, "end": position}}] [/INST]

"""
        
        elif "phi" in model_name:
            prompt = f"""<|user|>
Extract named entities from text. Return only complete entities.

Types: {entity_types_str}

{examples}

Text: "{text}"

<|assistant|>
```json
"""
        
        else:
            # Generic format for other models
            prompt = f"""Extract named entities from the text. Only extract complete, meaningful entities.

Entity types: {entity_types_str}

Rules:
1. Extract only complete words or phrases
2. No partial words or fragments
3. Only specified entity types
4. Return as JSON array

{examples}

Text: "{text}"

JSON array:"""
        
        return prompt
    
    def _create_examples(self, entity_types: List[str]) -> str:
        """Create relevant examples based on entity types."""
        examples = []
        
        if "Person" in entity_types:
            examples.append('Example: "John Smith works at Google" → [{"text": "John Smith", "label": "Person", "start": 0, "end": 10}]')
        
        if "Organization" in entity_types:
            examples.append('Example: "Microsoft Corporation announced" → [{"text": "Microsoft Corporation", "label": "Organization", "start": 0, "end": 21}]')
        
        if "Location" in entity_types:
            examples.append('Example: "meeting in New York City" → [{"text": "New York City", "label": "Location", "start": 11, "end": 24}]')
        
        return "\n".join(examples)
    
    def _parse_enhanced_llm_response(self, response: str, original_text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Enhanced parsing of LLM response with better validation."""
        entities = []
        
        try:
            import json
            import re
            
            # Clean response more aggressively
            response = response.strip()
            
            # Remove code block markers
            response = re.sub(r'^```(?:json)?\s*', '', response, flags=re.IGNORECASE)
            response = re.sub(r'```\s*$', '', response)
            
            # Remove any text before first [ or {
            json_start = max(response.find('['), response.find('{'))
            if json_start > 0:
                response = response[json_start:]
            
            # Remove any text after last ] or }
            json_end_bracket = response.rfind(']')
            json_end_brace = response.rfind('}')
            json_end = max(json_end_bracket, json_end_brace)
            if json_end > 0:
                response = response[:json_end + 1]
            
            logger.debug(f"Cleaned response: {response}")
            
            # Try parsing JSON
            json_patterns = [
                response,  # Try full response first
                re.search(r'\[.*?\]', response, re.DOTALL),  # Find array
                re.search(r'\{.*?\}', response, re.DOTALL)   # Find object
            ]
            
            for pattern in json_patterns:
                if pattern is None:
                    continue
                    
                json_text = pattern.group(0) if hasattr(pattern, 'group') else pattern
                
                try:
                    parsed = json.loads(json_text)
                    
                    if isinstance(parsed, dict):
                        parsed = [parsed]
                    
                    if isinstance(parsed, list):
                        for item in parsed:
                            if isinstance(item, dict):
                                entity = self._parse_entity_item(item, original_text, entity_types)
                                if entity:
                                    entities.append(entity)
                        
                        if entities:
                            return entities
                            
                except json.JSONDecodeError as e:
                    logger.debug(f"JSON decode error: {e}")
                    continue
            
            # Enhanced fallback parsing
            if not entities:
                entities = self._enhanced_fallback_parsing(response, original_text, entity_types)
        
        except Exception as e:
            logger.debug(f"Error parsing enhanced LLM response: {e}")
        
        return entities
    
    def _parse_entity_item(self, item: Dict, original_text: str, entity_types: List[str]) -> Optional[EntitySpan]:
        """Parse individual entity item from JSON."""
        try:
            if not isinstance(item, dict):
                return None
            
            # Extract entity information
            entity_text = item.get('text', '').strip()
            entity_label = item.get('label', '').strip()
            start_pos = item.get('start')
            end_pos = item.get('end')
            
            # Validate entity text
            if not entity_text or len(entity_text) < 2:
                return None
            
            # Validate entity label
            if not entity_label or entity_label not in entity_types:
                # Try to match similar labels
                entity_label = self._match_entity_type(entity_label, entity_types)
                if not entity_label:
                    return None
            
            # Validate or find positions
            if start_pos is None or end_pos is None or start_pos < 0 or end_pos <= start_pos:
                # Find entity in text
                start_pos = original_text.find(entity_text)
                if start_pos >= 0:
                    end_pos = start_pos + len(entity_text)
                else:
                    # Try case-insensitive search
                    start_pos = original_text.lower().find(entity_text.lower())
                    if start_pos >= 0:
                        end_pos = start_pos + len(entity_text)
                        # Get actual text from original
                        entity_text = original_text[start_pos:end_pos]
                    else:
                        return None
            
            # Final validation
            if (start_pos >= 0 and end_pos <= len(original_text) and 
                start_pos < end_pos and entity_text.strip()):
                
                return EntitySpan(
                    text=entity_text,
                    labels=[entity_label],
                    start_pos=int(start_pos),
                    end_pos=int(end_pos),
                    confidence=0.8
                )
            
            return None
            
        except Exception as e:
            logger.debug(f"Error parsing entity item: {e}")
            return None
    
    def _match_entity_type(self, label: str, entity_types: List[str]) -> Optional[str]:
        """Match entity label to valid types."""
        label_lower = label.lower()
        
        for entity_type in entity_types:
            if (label_lower == entity_type.lower() or 
                label_lower in entity_type.lower() or
                entity_type.lower() in label_lower):
                return entity_type
        
        # Common mappings
        mappings = {
            'per': 'Person',
            'org': 'Organization', 
            'loc': 'Location',
            'gpe': 'Location',
            'company': 'Organization',
            'person': 'Person',
            'place': 'Location',
            'people': 'Person',
            'individual': 'Person'
        }
        
        return mappings.get(label_lower)
    
    def _enhanced_fallback_parsing(self, response: str, original_text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Enhanced fallback parsing with better patterns."""
        entities = []
        
        try:
            import re
            
            # Enhanced patterns for entity extraction
            patterns = [
                # Standard JSON-like patterns
                r'"text":\s*"([^"]+)"\s*,\s*"label":\s*"([^"]+)"',
                r'"entity":\s*"([^"]+)"\s*,\s*"type":\s*"([^"]+)"',
                
                # Simple format patterns
                r'([A-Z][a-zA-Z\s]+)\s*[-–:]\s*(Person|Organization|Location)',
                r'(Person|Organization|Location):\s*([A-Z][a-zA-Z\s]+)',
                
                # List-like patterns
                r'(?:Person|Organization|Location):\s*([A-Z][a-zA-Z\s]+)',
                
                # Quoted entities
                r'"([A-Z][a-zA-Z\s]+)"\s*(?:is a|as a)?\s*(person|organization|location)',
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, response, re.IGNORECASE | re.MULTILINE)
                for match in matches:
                    if len(match) == 2:
                        # Determine which is text and which is label
                        text1, text2 = match
                        
                        if text2.title() in entity_types:
                            entity_text, entity_label = text1.strip(), text2.title()
                        elif text1.title() in entity_types:
                            entity_text, entity_label = text2.strip(), text1.title()
                        else:
                            continue
                        
                        # Validate and add entity
                        if len(entity_text) >= 2 and entity_text.replace(' ', '').isalpha():
                            start_pos = original_text.find(entity_text)
                            if start_pos >= 0:
                                entities.append(EntitySpan(
                                    text=entity_text,
                                    labels=[entity_label],
                                    start_pos=start_pos,
                                    end_pos=start_pos + len(entity_text),
                                    confidence=0.6
                                ))
        
        except Exception as e:
            logger.debug(f"Error in enhanced fallback parsing: {e}")
        
        return entities
    
    def _validate_and_filter_entities(self, entities: List[EntitySpan], text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Validate and filter entities to remove poor quality extractions."""
        validated = []
        
        for entity in entities:
            # Skip if entity is too short
            if len(entity.text.strip()) < 2:
                continue
            
            # Skip if entity is just punctuation or numbers
            if not any(c.isalpha() for c in entity.text):
                continue
            
            # Skip if entity contains too many special characters
            special_chars = sum(1 for c in entity.text if not c.isalnum() and c != ' ')
            if special_chars > len(entity.text) // 3:
                continue
            
            # Skip if entity is a common word that's not likely a named entity
            common_words = {
                'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
                'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
                'after', 'above', 'below', 'between', 'among', 'very', 'more', 'most'
            }
            if entity.text.lower().strip() in common_words:
                continue
            
            # Skip if label is not in expected types
            if entity.labels and entity.labels[0] not in entity_types:
                continue
            
            # Validate position bounds
            if (entity.start_pos < 0 or 
                entity.end_pos > len(text) or 
                entity.start_pos >= entity.end_pos):
                continue
            
            # Verify text matches position
            actual_text = text[entity.start_pos:entity.end_pos]
            if actual_text.strip() != entity.text.strip():
                # Try to find correct position
                correct_pos = text.find(entity.text.strip())
                if correct_pos >= 0:
                    entity.start_pos = correct_pos
                    entity.end_pos = correct_pos + len(entity.text.strip())
                else:
                    continue
            
            validated.append(entity)
        
        # Remove duplicates
        seen = set()
        deduped = []
        for entity in validated:
            key = (entity.text.lower().strip(), entity.labels[0] if entity.labels else "")
            if key not in seen:
                seen.add(key)
                deduped.append(entity)
        
        return deduped
    
    def get_supported_entity_types(self) -> List[str]:
        return [
            "Person", "Organization", "Location", "Date", "Time",
            "Money", "Percent", "Product", "Event", "Miscellaneous"
        ]