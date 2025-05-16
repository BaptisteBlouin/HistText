"""
Cache management for NER annotations.

This module provides functionality for efficiently caching and retrieving
named entity recognition (NER) annotations to reduce processing time and
conserve computational resources.
"""

import json
import os
from typing import Any, Dict, List, Optional

import jsonlines

from ..core.logging import get_logger

logger = get_logger(__name__)


class CacheManager:
    """Manager for NER annotation caches.

    Handles the storage and retrieval of named entity recognition results
    in a structured directory hierarchy, with index files for fast lookups.

    Attributes:
        cache_root (str): Absolute path to the root directory for caches
    """

    def __init__(self, cache_root: str):
        """Initialize the cache manager.

        Args:
            cache_root: Root directory for caches. Will be expanded to
                an absolute path with environment variables resolved.
        """
        self.cache_root = os.path.abspath(os.path.expanduser(os.path.expandvars(cache_root)))
        os.makedirs(self.cache_root, exist_ok=True)

    def get_cache_path(self, model_name: str, collection: str, field: str) -> str:
        """Get the path to a cache directory.

        Constructs and creates (if needed) a directory path for a specific
        model, collection, and field combination.

        Args:
            model_name: Name of the model
            collection: Name of the collection
            field: Field name

        Returns:
            str: Absolute path to the cache directory
        """
        cache_path = os.path.join(self.cache_root, model_name, collection, field)
        os.makedirs(cache_path, exist_ok=True)
        return cache_path

    def get_jsonl_path(
        self,
        model_name: str,
        collection: str,
        field: str,
        jsonl_prefix: Optional[str],
        start: int,
    ) -> str:
        """Get the path to a JSONL file.

        Constructs the path to a specific JSONL file within the cache directory.

        Args:
            model_name: Name of the model
            collection: Name of the collection
            field: Field name
            jsonl_prefix: Optional prefix for the JSONL file name
            start: Start index for the batch of annotations

        Returns:
            str: Absolute path to the JSONL file
        """
        cache_path = self.get_cache_path(model_name, collection, field)

        if jsonl_prefix:
            jsonl_name = f"{jsonl_prefix}-{start}.jsonl"
        else:
            jsonl_name = f"{start}.jsonl"

        return os.path.join(cache_path, jsonl_name)

    def load_index(self, model_name: str, collection: str, field: str) -> Dict[str, Any]:
        """Load the index for a cache.

        Loads the index file that maps document IDs to their location
        within the JSONL cache files.

        Args:
            model_name: Name of the model
            collection: Name of the collection
            field: Field name

        Returns:
            Dict[str, Any]: Index dictionary mapping document IDs to (file_base, record_idx) tuples,
                or an empty dictionary if the index doesn't exist or can't be loaded
        """
        cache_path = self.get_cache_path(model_name, collection, field)
        index_path = os.path.join(cache_path, "index.json")

        if not os.path.exists(index_path):
            return {}

        try:
            with open(index_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading index: {e}")
            return {}

    def save_index(self, model_name: str, collection: str, field: str, index: Dict[str, Any]) -> bool:
        """Save the index for a cache.

        Updates the index file with the provided mapping of document IDs
        to their location in JSONL files.

        Args:
            model_name: Name of the model
            collection: Name of the collection
            field: Field name
            index: Index dictionary mapping document IDs to (file_base, record_idx) tuples

        Returns:
            bool: True if successful, False if an error occurred
        """
        cache_path = self.get_cache_path(model_name, collection, field)
        index_path = os.path.join(cache_path, "index.json")

        try:
            with open(index_path, "w", encoding="utf-8") as f:
                json.dump(index, f, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Error saving index: {e}")
            return False

    def get_annotation(self, model_name: str, collection: str, field: str, doc_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get an annotation from the cache.

        Retrieves the cached NER annotation for a specific document ID,
        supporting multiple storage formats.

        Args:
            model_name: Name of the model
            collection: Name of the collection
            field: Field name
            doc_id: Document ID to retrieve annotations for

        Returns:
            Optional[List[Dict[str, Any]]]: List of entity annotations if found,
                None if the document is not in the cache or an error occurs
        """
        index = self.load_index(model_name, collection, field)

        if doc_id not in index:
            return None

        jsonl_base, record_idx = index[doc_id]
        cache_path = self.get_cache_path(model_name, collection, field)
        jsonl_path = os.path.join(cache_path, f"{jsonl_base}.jsonl")

        if not os.path.exists(jsonl_path):
            return None

        try:
            with jsonlines.open(jsonl_path, "r") as reader:
                for i, record in enumerate(reader):
                    if i == record_idx:
                        if "annotation" in record:
                            return record["annotation"]
                        elif "a" in record:
                            return record["a"]
                        elif "t" in record and "l" in record and "s" in record and "e" in record:
                            # Flat format with aggregated entities
                            entities = []
                            for i in range(len(record["t"])):
                                entity = {
                                    "t": record["t"][i],
                                    "l": (record["l"][i] if isinstance(record["l"][i], list) else [record["l"][i]]),
                                    "s": record["s"][i],
                                    "e": record["e"][i],
                                }
                                if "c" in record and i < len(record["c"]):
                                    entity["c"] = record["c"][i]
                                entities.append(entity)
                            return entities
                        else:
                            return None
        except Exception as e:
            logger.error(f"Error reading annotation: {e}")

        return None

    def save_annotations(
        self,
        model_name: str,
        collection: str,
        field: str,
        entities: Dict[str, List[Dict[str, Any]]],
        jsonl_prefix: Optional[str],
        start: int,
        format_type: str = "default",
        shorten: bool = False,
    ) -> bool:
        """Save annotations to the cache.

        Stores entity annotations for multiple documents in a JSONL file
        and updates the index accordingly.

        Args:
            model_name: Name of the model
            collection: Name of the collection
            field: Field name
            entities: Dictionary mapping document IDs to lists of entity annotations
            jsonl_prefix: Optional prefix for the JSONL file name
            start: Start index for the batch
            format_type: Format type for storage ('default' or 'flat')
            shorten: Whether to use shortened field names to reduce storage size

        Returns:
            bool: True if successful, False if an error occurred or entities was empty
        """
        if not entities:
            return False

        jsonl_path = self.get_jsonl_path(model_name, collection, field, jsonl_prefix, start)

        # Determine JSONL base for the index
        if jsonl_prefix:
            jsonl_base = f"{jsonl_prefix}-{start}"
        else:
            jsonl_base = f"{start}"

        # Load existing index
        index = self.load_index(model_name, collection, field)

        try:
            with jsonlines.open(jsonl_path, "w") as writer:
                records = []

                for idx, (doc_id, ents) in enumerate(entities.items()):
                    if format_type == "flat":
                        # Flat format with aggregated entities
                        texts, labels, starts, ends, confidences = [], [], [], [], []
                        for ent in ents:
                            texts.append(ent.get("t", ent.get("text", "")))

                            # Handle labels
                            labels = ent.get("l", ent.get("labels", []))
                            if isinstance(labels, list):
                                labels.append(labels[0] if labels else "")
                            else:
                                labels.append(labels)

                            starts.append(ent.get("s", ent.get("start_pos", 0)))
                            ends.append(ent.get("e", ent.get("end_pos", 0)))

                            # Handle confidence
                            confidence = ent.get("c", ent.get("confidence", -1.0))
                            confidences.append(confidence)

                        ner_id = f"ner-{doc_id}"
                        record = {
                            "id": ner_id,
                            "doc_id": [doc_id],
                            "t": texts,
                            "l": labels,
                            "s": starts,
                            "e": ends,
                            "c": confidences,
                            "_root_": ner_id,
                        }
                    else:
                        # Default format
                        annot_key = "a" if shorten else "annotation"
                        record = {"id": doc_id, annot_key: ents}

                    records.append(record)

                    # Update index
                    index[doc_id] = (jsonl_base, idx)

                writer.write_all(records)
        except Exception as e:
            logger.error(f"Error saving annotations: {e}")
            return False

        # Save updated index
        return self.save_index(model_name, collection, field, index)


# Singleton instance
_cache_manager: Optional[CacheManager] = None


def get_cache_manager(cache_root: str) -> CacheManager:
    """Get or create a cache manager singleton.

    Returns the existing cache manager instance or creates a new one
    if none exists yet.

    Args:
        cache_root: Root directory for caches

    Returns:
        CacheManager: The singleton cache manager instance

    Example:
        >>> manager = get_cache_manager("/path/to/cache")
        >>> annotation = manager.get_annotation("ner-model", "documents", "text", "doc123")
    """
    global _cache_manager

    if _cache_manager is None:
        _cache_manager = CacheManager(cache_root)

    return _cache_manager


def get_annotation(model_name: str, collection: str, field: str, doc_id: str, cache_root: str) -> Optional[List[Dict[str, Any]]]:
    """Get an annotation from the cache using a simplified interface.

    Convenience function that wraps the CacheManager's get_annotation method.

    Args:
        model_name: Name of the model
        collection: Name of the collection
        field: Field name
        doc_id: Document ID
        cache_root: Root directory for caches

    Returns:
        Optional[List[Dict[str, Any]]]: List of entity annotations if found,
            None if the document is not in the cache or an error occurs

    Example:
        >>> entities = get_annotation("bert-ner", "news", "content", "article123", "./cache")
        >>> if entities:
        >>>     for entity in entities:
        >>>         print(f"Found entity: {entity['text']} ({entity['labels'][0]})")
    """
    cache_manager = get_cache_manager(cache_root)
    return cache_manager.get_annotation(model_name, collection, field, doc_id)
