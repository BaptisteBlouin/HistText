# toolkit/histtext_toolkit/models/gliner_ner.py
"""GLiNER NER implementation."""

import warnings
from typing import List, Optional
from .ner_base import BaseNERModel, EntitySpan, logger


class GLiNERModel(BaseNERModel):
    """GLiNER NER model implementation."""
    
    def __init__(
        self,
        model_name: str = "urchade/gliner_mediumv2.1",
        threshold: float = 0.3,
        max_chunk_size: int = 350,
        **kwargs
    ):
        super().__init__(model_name, **kwargs)
        self.threshold = threshold
        self.max_chunk_size = max_chunk_size
        self._model = None
    
    def load(self) -> bool:
        """Load GLiNER model."""
        try:
            from gliner import GLiNER
            
            logger.info(f"Loading GLiNER model: {self.model_name}")
            
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message=".*truncated.*")
                self._model = GLiNER.from_pretrained(self.model_name)
            
            # Move to GPU if available
            import torch
            if torch.cuda.is_available():
                self._model.to("cuda")
            
            self._loaded = True
            logger.info("Successfully loaded GLiNER model")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load GLiNER model: {e}")
            return False
    
    def unload(self) -> bool:
        """Unload GLiNER model."""
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
        """Extract entities using GLiNER."""
        if not self.is_loaded:
            if not self.load():
                return []
        
        if not text.strip():
            return []
        
        if entity_types is None:
            entity_types = ["Person", "Organization", "Location"]
        
        try:
            # Handle long texts with chunking
            if len(text) > self.max_chunk_size * 4:
                return self._extract_chunked(text, entity_types)
            else:
                return self._extract_single(text, entity_types)
        
        except Exception as e:
            logger.error(f"Error in GLiNER extraction: {e}")
            self._stats.error_count += 1
            return []
    
    def _extract_single(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Extract from single text chunk."""
        try:
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message=".*truncated.*")
                results = self._model.predict_entities(text, entity_types, threshold=self.threshold)
            
            entities = []
            for result in results:
                entities.append(EntitySpan(
                    text=result["text"],
                    labels=[result["label"]],
                    start_pos=result["start"],
                    end_pos=result["end"],
                    confidence=result["score"]
                ))
            
            self._stats.total_texts += 1
            self._stats.total_entities += len(entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error in GLiNER single extraction: {e}")
            return []
    
    def _extract_chunked(self, text: str, entity_types: List[str]) -> List[EntitySpan]:
        """Extract with chunking for long texts."""
        chunk_size = self.max_chunk_size
        overlap = 50
        chunks = []
        
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            
            # Break at word boundary
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
        """GLiNER supports any entity types."""
        return [
            "Person", "Organization", "Location", "Product", "Event",
            "Date", "Time", "Money", "Percent", "Miscellaneous"
        ]