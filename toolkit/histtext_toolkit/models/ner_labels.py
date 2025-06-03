# toolkit/histtext_toolkit/models/ner_labels.py
"""NER label mapping utilities for compact storage."""

from typing import Dict, Optional

# Mapping from full labels to compact codes
FULL2COMPACT: Dict[str, str] = {
    "PERSON": "P",
    "NORP": "N", 
    "FAC": "F",
    "ORG": "O",
    "ORGANIZATION": "O",  # Alternative spelling
    "GPE": "G",
    "LOC": "L",
    "LOCATION": "L",  # Alternative spelling
    "PRODUCT": "PR",
    "EVENT": "E",
    "WORK_OF_ART": "W",
    "LAW": "LA",
    "DATE": "D",
    "TIME": "T",
    "PERCENT": "PE",
    "MONEY": "M",
    "QUANTITY": "Q",
    "ORDINAL": "OR",
    "CARDINAL": "C",
    "LANGUAGE": "LG",
    "MISC": "MI",
    "MISCELLANEOUS": "MI",  # Alternative spelling
    
    # Additional common mappings
    "PER": "P",  # spaCy/Flair format
    "FACILITY": "F",
    "WORK_OF_ART": "W",
    "LAW": "LA",
    "UNK": "MI",  # Unknown -> Misc
    "OTHER": "MI",
}

# Mapping from compact codes to full labels
COMPACT2FULL: Dict[str, str] = {
    "P": "PERSON",
    "N": "NORP",
    "F": "FAC", 
    "O": "ORG",
    "G": "GPE",
    "L": "LOC",
    "PR": "PRODUCT",
    "E": "EVENT",
    "W": "WORK_OF_ART",
    "LA": "LAW",
    "D": "DATE",
    "T": "TIME",
    "PE": "PERCENT",
    "M": "MONEY",
    "Q": "QUANTITY",
    "OR": "ORDINAL",
    "C": "CARDINAL",
    "LG": "LANGUAGE",
    "MI": "MISC",
}


def get_compact_label(full_label: str) -> str:
    """Convert full label to compact code, keeping original if no mapping found."""
    # Handle BIO tags
    if full_label.startswith(('B-', 'I-')):
        entity_type = full_label[2:]
        mapped = FULL2COMPACT.get(entity_type.upper())
        if mapped:
            return mapped
        else:
            return entity_type  # Keep original entity type if no mapping
    
    # Direct mapping
    mapped = FULL2COMPACT.get(full_label.upper())
    if mapped:
        return mapped
    else:
        return full_label
    

def get_full_label(compact_label: str) -> str:
    """Convert compact code to full label."""
    return COMPACT2FULL.get(compact_label.upper(), "MISC")


def validate_compact_label(label: str) -> bool:
    """Check if a compact label is valid."""
    return label.upper() in COMPACT2FULL


def get_all_compact_labels() -> Dict[str, str]:
    """Get all compact label mappings."""
    return COMPACT2FULL.copy()


def get_label_stats(labels: list) -> Dict[str, int]:
    """Get statistics for label usage."""
    stats = {}
    for label in labels:
        compact = get_compact_label(label)
        stats[compact] = stats.get(compact, 0) + 1
    return stats