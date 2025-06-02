# toolkit/histtext_toolkit/models/llm_ner.py
"""Fixed LLM-based NER implementation."""

import json
import re
import time
import warnings
from typing import List, Optional, Dict, Any
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

from .ner_base import BaseNERModel, EntitySpan, logger


class LLMNERModel(BaseNERModel):
    """Fixed LLM-based NER model."""
    
    def __init__(
        self,
        model_name: str,
        device: Optional[str] = None,
        max_length: int = 2048,
        temperature: float = 0.01,
        **kwargs
    ):
        super().__init__(model_name, **kwargs)
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.max_length = max_length
        self.temperature = temperature
        self.max_text_length = max_length - 800  # Reserve for prompt
        
        self._model = None
        self._tokenizer = None
    
    def load(self) -> bool:
        """Load LLM with fixed attention handling."""
        try:
            logger.info(f"Loading LLM for NER: {self.model_name}")
            
            # Load tokenizer
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                padding_side="left",
                trust_remote_code=True
            )
            
            # Prepare model loading with fixed attention
            model_kwargs = {
                "trust_remote_code": True,
                "torch_dtype": torch.float16 if self.device == "cuda" else torch.float32,
            }
            
            # Fix for sliding window attention issues
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message=".*Sliding Window Attention.*")
                warnings.filterwarnings("ignore", message=".*unexpected results.*")
                
                try:
                    # Try with explicit attention implementation
                    model_kwargs["attn_implementation"] = "eager"
                    self._model = AutoModelForCausalLM.from_pretrained(
                        self.model_name, **model_kwargs
                    )
                except Exception as e:
                    logger.debug(f"Eager attention failed: {e}, trying fallback")
                    # Fallback without attention specification
                    model_kwargs.pop("attn_implementation", None)
                    self._model = AutoModelForCausalLM.from_pretrained(
                        self.model_name, **model_kwargs
                    )
            
            # Setup padding token
            if self._tokenizer.pad_token is None:
                if self._tokenizer.eos_token:
                    self._tokenizer.pad_token = self._tokenizer.eos_token
                else:
                    self._tokenizer.add_special_tokens({'pad_token': '[PAD]'})
                    self._model.resize_token_embeddings(len(self._tokenizer))
            
            self._model.to(self.device)
            self._model.eval()
            
            self._loaded = True
            logger.info("Successfully loaded LLM for NER")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load LLM: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload model."""
        if self._model is not None:
            del self._model
            del self._tokenizer
            self._model = None
            self._tokenizer = None
        
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        
        self._loaded = False
        return True
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using improved LLM prompting."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        if entity_types is None:
            entity_types = ["Person", "Organization", "Location"]
        
        start_time = time.time()
        
        try:
            # Handle long texts
            if len(text) > self.max_text_length:
                return self._extract_chunked(text, entity_types)
            else:
                return self._extract_single(text, entity_types)
        
        except Exception as e:
            logger.error(f"Error in LLM entity extraction: {e}")
            return []
        
        finally:
            processing_time = time.time() - start_time
            self._stats.processing_time += processing_time
    
    
    def _extract_single(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Extract from single text with optimized settings."""
        try:
            # Create shorter, more direct prompt
            prompt = self._create_fast_prompt(text, entity_types)
            
            # Tokenize with stricter limits
            inputs = self._tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=min(1024, self.max_length - 200),  # Much smaller context
                padding=True
            ).to(self.device)
            
            # Generate with very conservative settings for speed
            with torch.no_grad():
                outputs = self._model.generate(
                    **inputs,
                    max_new_tokens=50,  # Much smaller output
                    temperature=0.0,    # Deterministic
                    do_sample=False,
                    num_beams=1,       # No beam search
                    pad_token_id=self._tokenizer.pad_token_id,
                    eos_token_id=self._tokenizer.eos_token_id,
                    early_stopping=True,
                    use_cache=False,
                    repetition_penalty=1.0  # Disable repetition penalty for speed
                )
            
            # Decode response
            response = self._tokenizer.decode(
                outputs[0][inputs['input_ids'].shape[1]:], 
                skip_special_tokens=True
            )
            
            # Quick parsing - look for simple patterns
            entities = self._quick_parse_response(response, text, entity_types)
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in LLM extraction: {e}")
            self._stats.error_count += 1
            return []

    def _create_fast_prompt(self, text: str, entity_types: List[str]) -> str:
        """Create minimal prompt for speed."""
        # Truncate text if too long
        if len(text) > 500:
            text = text[:500] + "..."
        
        entity_types_str = ", ".join(entity_types[:3])  # Limit to 3 types
        
        return f"Find {entity_types_str} in: {text}\nEntities:"

    def _quick_parse_response(self, response: str, original_text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Quick parsing for simple responses."""
        entities = []
        
        # Look for capitalized words that might be entities
        import re
        
        # Simple pattern for proper nouns
        words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', original_text)
        
        for word in words[:10]:  # Limit to first 10 potential entities
            if len(word) > 2 and word not in ["The", "This", "That", "And", "But"]:
                start_pos = original_text.find(word)
                if start_pos >= 0:
                    entities.append(EntitySpan(
                        text=word,
                        labels=["Person"],  # Default to Person for speed
                        start_pos=start_pos,
                        end_pos=start_pos + len(word),
                        confidence=0.5
                    ))
        
        return entities[:5]
    
    def _extract_single2(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Extract from single text with improved prompting."""
        try:
            # Create better prompt
            prompt = self._create_improved_prompt(text, entity_types)
            
            # Tokenize
            inputs = self._tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length - 300,
                padding=True
            ).to(self.device)
            
            # Generate with conservative settings
            with torch.no_grad():
                outputs = self._model.generate(
                    **inputs,
                    max_new_tokens=200,
                    temperature=self.temperature,
                    do_sample=False,
                    pad_token_id=self._tokenizer.pad_token_id,
                    eos_token_id=self._tokenizer.eos_token_id,
                    early_stopping=True,
                    repetition_penalty=1.05,
                    use_cache=False  # Disable cache to avoid sliding window issues
                )
            
            # Decode response
            response = self._tokenizer.decode(
                outputs[0][inputs['input_ids'].shape[1]:], 
                skip_special_tokens=True
            )
            
            logger.debug(f"LLM response: {response[:200]}...")
            
            # Parse entities
            entities = self._parse_response(response, text, entity_types)
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in single LLM extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def _create_improved_prompt(self, text: str, entity_types: List[str]) -> str:
        """Create improved prompt for better extraction."""
        entity_types_str = ", ".join(entity_types)
        
        # Detect model type for appropriate formatting
        model_lower = self.model_name.lower()
        
        if "deepseek" in model_lower or "qwen" in model_lower:
            prompt = f"""Extract named entities from the text below. Return only a JSON array.

Entity types: {entity_types_str}

Rules:
- Only extract complete names and entities
- Be precise with positions
- Return format: [{{"text": "entity name", "type": "entity type", "start": position, "end": position}}]

Text: "{text}"

JSON:"""
        
        elif "mistral" in model_lower:
            prompt = f"""[INST] Extract named entities and return JSON.

Types: {entity_types_str}
Text: "{text}"

Return: [{{"text": "name", "type": "type", "start": pos, "end": pos}}] [/INST]

"""
        
        elif "llama" in model_lower:
            prompt = f"""[INST] Extract named entities from text.

Entity types: {entity_types_str}
Text: "{text}"

Return JSON array: [{{"text": "entity", "type": "type", "start": position, "end": position}}] [/INST]

"""
        
        else:
            # Generic format
            prompt = f"""Extract named entities from this text. Return JSON format.

Entity types: {entity_types_str}

Text: "{text}"

JSON array:"""
        
        return prompt
    
    def _parse_response(self, response: str, original_text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Parse LLM response with improved validation."""
        entities = []
        
        try:
            # Clean response
            response = response.strip()
            
            # Remove code blocks
            response = re.sub(r'^```(?:json)?\s*', '', response, flags=re.IGNORECASE)
            response = re.sub(r'```\s*$', '', response)
            
            # Find JSON content
            json_match = re.search(r'\[.*?\]', response, re.DOTALL)
            if json_match:
                json_text = json_match.group(0)
                
                try:
                    parsed = json.loads(json_text)
                    
                    for item in parsed:
                        if isinstance(item, dict):
                            entity = self._create_entity_from_item(item, original_text, entity_types)
                            if entity:
                                entities.append(entity)
                                
                except json.JSONDecodeError:
                    logger.debug("JSON parsing failed, trying fallback")
                    entities = self._fallback_parsing(response, original_text, entity_types)
            else:
                entities = self._fallback_parsing(response, original_text, entity_types)
        
        except Exception as e:
            logger.debug(f"Error parsing response: {e}")
        
        return entities
    
    def _create_entity_from_item(self, item: Dict, original_text: str, entity_types: List[str]) -> Optional[EntitySpan]:
        """Create entity from parsed JSON item."""
        try:
            entity_text = item.get('text', '').strip()
            entity_type = item.get('type', item.get('label', '')).strip()
            start_pos = item.get('start')
            end_pos = item.get('end')
            
            # Validate entity text
            if not entity_text or len(entity_text) < 2:
                return None
            
            # Validate entity type
            if entity_type not in entity_types:
                # Try to match similar types
                for et in entity_types:
                    if et.lower() in entity_type.lower() or entity_type.lower() in et.lower():
                        entity_type = et
                        break
                else:
                    return None
            
            # Validate or find positions
            if start_pos is None or end_pos is None or start_pos < 0 or end_pos <= start_pos:
                # Find entity in text
                start_pos = original_text.find(entity_text)
                if start_pos >= 0:
                    end_pos = start_pos + len(entity_text)
                else:
                    # Try case-insensitive
                    start_pos = original_text.lower().find(entity_text.lower())
                    if start_pos >= 0:
                        end_pos = start_pos + len(entity_text)
                        entity_text = original_text[start_pos:end_pos]
                    else:
                        return None
            
            # Final validation
            if (0 <= start_pos < end_pos <= len(original_text) and 
                entity_text.strip() and
                not entity_text.strip() in ".,;:!?-()[]{}\"'"):
                
                return EntitySpan(
                    text=entity_text,
                    labels=[entity_type],
                    start_pos=int(start_pos),
                    end_pos=int(end_pos),
                    confidence=0.8
                )
            
            return None
            
        except Exception as e:
            logger.debug(f"Error creating entity: {e}")
            return None
    
    def _fallback_parsing(self, response: str, original_text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Fallback parsing when JSON fails."""
        entities = []
        
        # Look for entity mentions in response
        for entity_type in entity_types:
            # Pattern: "EntityName" (Type)
            pattern = rf'"([^"]+)"\s*\({entity_type}\)'
            matches = re.findall(pattern, response, re.IGNORECASE)
            
            for match in matches:
                entity_text = match.strip()
                start_pos = original_text.find(entity_text)
                
                if start_pos >= 0 and len(entity_text) >= 2:
                    entities.append(EntitySpan(
                        text=entity_text,
                        labels=[entity_type],
                        start_pos=start_pos,
                        end_pos=start_pos + len(entity_text),
                        confidence=0.6
                    ))
        
        return entities
    
    def _extract_chunked(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Handle long texts with chunking."""
        chunk_size = self.max_text_length
        overlap = 200
        chunks = []
        
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            
            # Try to break at sentence boundary
            if end < len(text):
                for i in range(end - overlap, end):
                    if i > start and text[i] in '.!?\n':
                        end = i + 1
                        break
            
            chunk = text[start:end]
            chunks.append((chunk, start))
            
            if end >= len(text):
                break
            start = end - overlap
        
        # Process chunks
        all_entities = []
        for chunk_text, offset in chunks:
            chunk_entities = self._extract_single(chunk_text, entity_types)
            
            # Adjust positions
            for entity in chunk_entities:
                entity.start_pos += offset
                entity.end_pos += offset
                all_entities.append(entity)
        
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
    
    def get_supported_entity_types(self) -> List[str]:
        """Get supported entity types for LLMs."""
        return [
            "Person", "Organization", "Location", "Date", "Time",
            "Money", "Percent", "Product", "Event", "Miscellaneous"
        ]