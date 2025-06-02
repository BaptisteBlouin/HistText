# toolkit/histtext_toolkit/models/transformers_ner.py
"""Transformers-based NER implementation."""

import warnings
from typing import List, Optional
import torch
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification

from .ner_base import BaseNERModel, EntitySpan, logger


class TransformersNERModel(BaseNERModel):
    """Transformers-based NER model."""
    
    def __init__(
        self,
        model_name: str,
        aggregation_strategy: str = "simple",
        max_length: int = 512,
        **kwargs
    ):
        super().__init__(model_name, **kwargs)
        self.aggregation_strategy = aggregation_strategy
        self.max_length = max_length
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        self._pipeline = None
        self._tokenizer = None
        self._model = None
    
    def load(self) -> bool:
        """Load transformers model."""
        try:
            logger.info(f"Loading Transformers model: {self.model_name}")
            
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore")
                
                # Try pipeline first
                try:
                    self._pipeline = pipeline(
                        "ner",
                        model=self.model_name,
                        aggregation_strategy=self.aggregation_strategy,
                        device=0 if self.device == "cuda" else -1,
                        trust_remote_code=True
                    )
                    
                    self._loaded = True
                    logger.info("Successfully loaded with pipeline")
                    return True
                    
                except Exception as e:
                    logger.debug(f"Pipeline failed: {e}, trying manual loading")
                    
                    # Manual loading as fallback
                    self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                    self._model = AutoModelForTokenClassification.from_pretrained(self.model_name)
                    self._model.to(self.device)
                    self._model.eval()
                    
                    self._loaded = True
                    logger.info("Successfully loaded with manual approach")
                    return True
            
        except Exception as e:
            logger.error(f"Failed to load Transformers model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload model."""
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
    
    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities using transformers."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        try:
            if self._pipeline is not None:
                return self._extract_with_pipeline(text, entity_types)
            else:
                return self._extract_manual(text, entity_types)
        
        except Exception as e:
            logger.error(f"Error in Transformers extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def _extract_with_pipeline(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Extract using pipeline."""
        try:
            results = self._pipeline(text)
            
            entities = []
            for result in results:
                # Filter by entity types if specified
                if entity_types:
                    entity_label = result.get("entity_group", result.get("entity", ""))
                    if entity_label.split("-")[-1] not in entity_types:
                        continue
                
                # Clean up entity text
                entity_text = result["word"].replace("##", "").replace("▁", " ").strip()
                
                if entity_text:
                    entities.append(EntitySpan(
                        text=entity_text,
                        labels=[result.get("entity_group", result.get("entity", "UNK"))],
                        start_pos=result["start"],
                        end_pos=result["end"],
                        confidence=result["score"]
                    ))
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Pipeline extraction error: {e}")
            return []
    
    def _extract_manual(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Manual extraction fallback."""
        try:
            # Tokenize
            inputs = self._tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length,
                padding=True,
                return_offsets_mapping=True
            ).to(self.device)
            
            # Predict
            with torch.no_grad():
                outputs = self._model(**{k: v for k, v in inputs.items() if k != "offset_mapping"})
                predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
                predicted_labels = torch.argmax(outputs.logits, dim=-1)
            
            # Convert to entities
            entities = self._process_predictions(text, inputs, predicted_labels[0], predictions[0])
            
            # Filter by entity types
            if entity_types:
                filtered_entities = []
                for entity in entities:
                    for label in entity.labels:
                        entity_type = label.split("-")[-1] if "-" in label else label
                        if entity_type in entity_types:
                            filtered_entities.append(entity)
                            break
                entities = filtered_entities
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Manual extraction error: {e}")
            return []
   
    def _process_predictions(self, text: str, inputs: dict, predicted_labels: torch.Tensor, predictions: torch.Tensor) -> List[EntitySpan]:
       """Process predictions to extract entities."""
       entities = []
       
       try:
           input_ids = inputs["input_ids"][0]
           tokens = self._tokenizer.convert_ids_to_tokens(input_ids)
           offset_mapping = inputs.get("offset_mapping")
           
           if offset_mapping is not None:
               offset_mapping = offset_mapping[0].cpu().numpy()
           else:
               offset_mapping = [(0, 0)] * len(tokens)
           
           # Get label mapping
           if hasattr(self._model.config, 'id2label'):
               id2label = self._model.config.id2label
           else:
               id2label = {i: f"LABEL_{i}" for i in range(self._model.config.num_labels)}
               id2label[0] = "O"
           
           # Process tokens
           current_entity = []
           current_entity_type = None
           current_start = None
           
           for i, (token, offset) in enumerate(zip(tokens, offset_mapping)):
               if token in self._tokenizer.all_special_tokens:
                   continue
               
               label_id = predicted_labels[i].item()
               label = id2label.get(label_id, "O")
               confidence = float(predictions[i].max().item())
               
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
           logger.error(f"Error processing predictions: {e}")
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