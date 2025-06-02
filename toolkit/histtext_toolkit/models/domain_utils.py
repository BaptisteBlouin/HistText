# toolkit/histtext_toolkit/models/domain_utils.py
"""Domain-specific utilities for NER models."""

import re
from typing import List, Optional, Dict, Any, Tuple
from ..core.logging import get_logger

logger = get_logger(__name__)


class DomainUtils:
    """Utilities for domain-specific NER processing."""
    
    @staticmethod
    def detect_language(text: str) -> str:
        """Detect the primary language of the text."""
        language_patterns = {
            'zh': r'[\u4e00-\u9fff]',      # Chinese
            'ja': r'[\u3040-\u309f\u30a0-\u30ff]',  # Japanese
            'ko': r'[\uac00-\ud7af]',      # Korean
            'ar': r'[\u0600-\u06ff]',      # Arabic
            'th': r'[\u0e00-\u0e7f]',      # Thai
            'hi': r'[\u0900-\u097f]',      # Hindi
            'ru': r'[\u0400-\u04ff]',      # Russian
            'el': r'[\u0370-\u03ff]',      # Greek
            'he': r'[\u0590-\u05ff]',      # Hebrew
        }
        
        lang_scores = {}
        text_length = len(text)
        
        if text_length == 0:
            return 'en'
        
        for lang, pattern in language_patterns.items():
            matches = len(re.findall(pattern, text))
            if matches > 0:
                lang_scores[lang] = matches / text_length
        
        if lang_scores:
            detected_lang = max(lang_scores.items(), key=lambda x: x[1])[0]
            logger.debug(f"Detected language: {detected_lang}")
            return detected_lang
        else:
            return 'en'  # Default to English
    
    @staticmethod
    def preprocess_historical_text(text: str) -> str:
        """Preprocess historical text for better NER."""
        # Normalize historical spelling variations
        normalizations = {
            # Old English/Latin long s
            r'ſ': 's',
            r'\bf\b': 's',  # Sometimes f was used for s
            
            # u/v variations in historical texts
            r'\bu\b(?=[aeiou])': 'v',
            r'\bv\b(?=[^aeiou])': 'u',
            
            # i/j variations
            r'\bi\b(?=[aeiou])': 'j',
            r'\bj\b(?=[^aeiou])': 'i',
            
            # Historical contractions and abbreviations
            r'&': 'and',
            r'\byᵉ\b': 'the',
            r'\byᵗ\b': 'that',
            r'\bwᶜʰ\b': 'which',
            r'\bwᵗʰ\b': 'with',
            
            # Normalize spacing around punctuation
            r'\s*([,.;:!?])\s*': r'\1 ',
            
            # Remove excessive punctuation
            r'([.!?]){2,}': r'\1',
        }
        
        processed_text = text
        for pattern, replacement in normalizations.items():
            processed_text = re.sub(pattern, replacement, processed_text, flags=re.IGNORECASE)
        
        # Normalize whitespace
        processed_text = re.sub(r'\s+', ' ', processed_text).strip()
        
        return processed_text
    
    @staticmethod
    def get_multilingual_model_recommendations() -> Dict[str, Dict[str, Any]]:
        """Get model recommendations for different languages and domains."""
        return {
            # Best multilingual models
            "xlm-roberta-large-finetuned-conll03-english": {
                "languages": ["en", "de", "fr", "es", "nl", "it", "pt"],
                "domain": "general",
                "description": "Best overall multilingual NER",
                "entity_types": ["PER", "ORG", "LOC", "MISC"]
            },
            "xlm-roberta-base-finetuned-conll03-english": {
                "languages": ["en", "de", "fr", "es", "nl", "it", "pt"],
                "domain": "general",
                "description": "Faster multilingual NER",
                "entity_types": ["PER", "ORG", "LOC", "MISC"]
            },
            
            # Historical documents
            "dbmdz/bert-base-historic-multilingual-cased": {
                "languages": ["en", "de", "fr", "es", "it"],
                "domain": "historical",
                "description": "Specialized for historical texts",
                "entity_types": ["PER", "ORG", "LOC", "MISC"]
            },
            
            # Chinese models
            "ckiplab/bert-base-chinese-ner": {
                "languages": ["zh"],
                "domain": "general",
                "description": "Chinese NER",
                "entity_types": ["PERSON", "LOCATION", "ORGANIZATION"]
            },
            
            # Japanese models
            "cl-tohoku/bert-base-japanese-char-whole-word-masking": {
                "languages": ["ja"],
                "domain": "general",
                "description": "Japanese BERT for NER",
                "entity_types": ["PERSON", "LOCATION", "ORGANIZATION"]
            },
            
            # Korean models
            "klue/bert-base": {
                "languages": ["ko"],
                "domain": "general",
                "description": "Korean BERT for NER",
                "entity_types": ["PERSON", "LOCATION", "ORGANIZATION"]
            },
            
            # Arabic models
            "aubmindlab/bert-base-arabertv2": {
                "languages": ["ar"],
                "domain": "general",
                "description": "Arabic BERT for NER",
                "entity_types": ["PERSON", "LOCATION", "ORGANIZATION"]
            },
        }
    
    @staticmethod
    def enhance_entities_with_patterns(
        entities: List, 
        text: str, 
        language: str, 
        domain: str = "general"
    ) -> List:
        """Enhance transformer results with pattern-based extraction."""
        from ..models.ner_base import EntitySpan
        
        additional_entities = []
        
        # Get language-specific patterns
        patterns = DomainUtils.get_language_patterns(language, domain)
        
        for entity_type, type_patterns in patterns.items():
            for pattern in type_patterns:
                for match in re.finditer(pattern, text, re.UNICODE | re.IGNORECASE):
                    entity_text = match.group().strip()
                    
                    # Check if this entity is already found by transformer
                    is_duplicate = False
                    for existing_entity in entities:
                        if (abs(existing_entity.start_pos - match.start()) < 5 and
                            abs(existing_entity.end_pos - match.end()) < 5):
                            is_duplicate = True
                            break
                    
                    if not is_duplicate and len(entity_text) > 1:
                        additional_entities.append(EntitySpan(
                            text=entity_text,
                            labels=[entity_type],
                            start_pos=match.start(),
                            end_pos=match.end(),
                            confidence=0.7  # Lower confidence for pattern-based
                        ))
        
        return additional_entities
    
    @staticmethod
    def get_language_patterns(language: str, domain: str = "general") -> Dict[str, List[str]]:
        """Get language and domain-specific NER patterns."""
        patterns = {
            "PERSON": [],
            "LOCATION": [],
            "ORGANIZATION": [],
        }
        
        # Base Latin script patterns
        if language in ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl']:
            patterns["PERSON"].extend([
                r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b',
                r'\b(?:Mr|Mrs|Ms|Dr|Prof|Sir|Lady|Lord|Duke|Earl)\.?\s+[A-Z][a-z]+\b',
            ])
            patterns["LOCATION"].extend([
                r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:City|Town|Village|Province|County|State))\b',
            ])
            patterns["ORGANIZATION"].extend([
                r'\b[A-Z][a-zA-Z\s]+(?:Inc|Corp|Ltd|Company|Corporation|University|College)\b',
            ])
        
        # Chinese patterns
        if language == 'zh':
            patterns["PERSON"].extend([
                r'[\u4e00-\u9fff]{2,4}(?=\s|$|[，。！？])',
            ])
            patterns["LOCATION"].extend([
                r'[\u4e00-\u9fff]{2,6}(?:市|省|县|区|镇|村|国)',
            ])
            patterns["ORGANIZATION"].extend([
                r'[\u4e00-\u9fff]{3,10}(?:公司|大学|学院|研究所|银行)',
            ])
        
        # Japanese patterns
        if language == 'ja':
            patterns["PERSON"].extend([
                r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]{2,6}(?:さん|氏|君|先生)',
            ])
            patterns["LOCATION"].extend([
                r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]{2,8}(?:市|県|町|村|区|国)',
            ])
            patterns["ORGANIZATION"].extend([
                r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]{3,12}(?:会社|大学|学校|研究所)',
            ])
        
        # Korean patterns
        if language == 'ko':
            patterns["PERSON"].extend([
                r'[\uac00-\ud7af]{2,4}(?:\s+[\uac00-\ud7af]{1,3})?',
            ])
            patterns["LOCATION"].extend([
                r'[\uac00-\ud7af]{2,6}(?:시|도|군|구|동|국)',
            ])
            patterns["ORGANIZATION"].extend([
                r'[\uac00-\ud7af]{3,10}(?:회사|대학교|학교|연구소)',
            ])
        
        # Historical domain enhancements
        if domain == "historical":
            patterns["PERSON"].extend([
                r'\b(?:King|Queen|Prince|Princess|Emperor|Empress|Pope|Saint|St\.)\s+[A-Z][a-z]+\b',
                r'\b[A-Z][a-z]+\s+(?:the\s+)?(?:Great|Bold|Wise|Fair|Good|Bad|Mad|Young|Old|First|Second|Third)\b',
            ])
            patterns["LOCATION"].extend([
                r'\b(?:Kingdom|Empire|Duchy|County|Shire)\s+of\s+[A-Z][a-z]+\b',
                r'\b[A-Z][a-z]+\s+(?:Castle|Abbey|Cathedral|Monastery)\b',
            ])
            patterns["ORGANIZATION"].extend([
                r'\b(?:Church|Abbey|Monastery|Cathedral|Order)\s+of\s+[A-Z][a-z]+\b',
            ])
        
        return patterns
    
    @staticmethod
    def recommend_model_for_content(text: str, domain: str = "general") -> str:
        """Recommend the best model for given content."""
        language = DomainUtils.detect_language(text)
        models = DomainUtils.get_multilingual_model_recommendations()
        
        # Filter models by language and domain
        suitable_models = []
        for model_name, info in models.items():
            if (language in info["languages"] and 
                (info["domain"] == domain or info["domain"] == "general")):
                suitable_models.append((model_name, info))
        
        if suitable_models:
            # Prefer domain-specific models, then larger models
            domain_models = [m for m in suitable_models if m[1]["domain"] == domain]
            if domain_models:
                return domain_models[0][0]
            else:
                # Prefer larger models for better accuracy
                return max(suitable_models, key=lambda x: "large" in x[0])[0]
        
        # Fallback to general multilingual model
        return "xlm-roberta-base-finetuned-conll03-english"


class HistoricalTextProcessor:
    """Specialized processor for historical documents."""
    
    @staticmethod
    def normalize_historical_spelling(text: str) -> str:
        """Normalize historical spelling variations."""
        return DomainUtils.preprocess_historical_text(text)
    
    @staticmethod
    def enhance_historical_entities(entities: List, text: str, language: str) -> List:
        """Add historical-specific entity detection."""
        return DomainUtils.enhance_entities_with_patterns(entities, text, language, "historical")


class MultilingualProcessor:
    """Processor for multilingual documents."""
    
    @staticmethod
    def detect_and_process(text: str) -> Tuple[str, str]:
        """Detect language and return processed text with language code."""
        language = DomainUtils.detect_language(text)
        
        # Language-specific preprocessing
        if language in ['zh', 'ja', 'ko']:
            # CJK languages might need different tokenization
            processed_text = re.sub(r'\s+', '', text)  # Remove spaces in CJK
            processed_text = re.sub(r'([。！？])', r'\1 ', processed_text)  # Add space after punctuation
        else:
            processed_text = text
        
        return processed_text, language
    
    @staticmethod
    def enhance_multilingual_entities(entities: List, text: str, language: str) -> List:
        """Enhance entities with language-specific patterns."""
        return DomainUtils.enhance_entities_with_patterns(entities, text, language, "general")