"""Upload operations module.

This module provides functionality for uploading documents to Solr.
"""

import asyncio
import os
from collections.abc import Iterator
from typing import Any, Optional

import jsonlines

from ..core.logging import get_logger
from ..solr.client import SolrClient

logger = get_logger(__name__)


def split_in_batches(items: list[Any], batch_size: int) -> Iterator[list[Any]]:
    """Split a list of items into batches.

    Args:
        items: List of items to split
        batch_size: Maximum size of each batch

    Yields:
        List[Any]: Batch of items

    """
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) >= batch_size:
            yield batch
            batch = []

    if batch:
        yield batch


async def upload_jsonl_files(
    solr_client: SolrClient,
    collection: str,
    jsonl_files: list[str],
    schema_file: Optional[str] = None,
    batch_size: int = 1000,
) -> int:
    """Upload JSONL files to Solr.

    Reads JSONL files and uploads the documents to a Solr collection.
    Can optionally set up a schema before uploading.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection
        jsonl_files: List of JSONL file paths
        schema_file: Optional schema file path
        batch_size: Number of documents per batch

    Returns:
        int: Number of documents uploaded

    """
    # Set up schema if provided
    if schema_file:
        logger.info(f"Setting up schema from {schema_file}")
        from ..solr.schema import setup_schema_from_file

        success = await setup_schema_from_file(solr_client, collection, schema_file)
        if not success:
            logger.error(f"Failed to set up schema from {schema_file}")
            return 0

    # Upload documents
    total_docs = 0
    doc_ids = set()

    for jsonl_file in jsonl_files:
        logger.info(f"Loading '{jsonl_file}'...")

        try:
            with jsonlines.open(jsonl_file, "r") as reader:
                documents = list(reader)

                # Process in batches
                for i in range(0, len(documents), batch_size):
                    batch = documents[i : i + batch_size]

                    # Filter out duplicate documents
                    unique_batch = []
                    for doc in batch:
                        doc_id = doc.get("id")
                        if doc_id and doc_id not in doc_ids:
                            unique_batch.append(doc)
                            doc_ids.add(doc_id)

                    if not unique_batch:
                        continue

                    # Upload batch
                    success = await solr_client.upload_documents(collection, unique_batch)

                    if success:
                        total_docs += len(unique_batch)
                        logger.info(f"Uploaded {len(unique_batch)} documents " f"('{unique_batch[0]['id']}' to '{unique_batch[-1]['id']}')")
                    else:
                        logger.error("Failed to upload batch")

        except Exception as e:
            logger.error(f"Error uploading documents from {jsonl_file}: {e}")

    logger.info(f"Total documents uploaded: {total_docs}")
    return total_docs


async def create_ner_collection(solr_client: SolrClient, collection: str) -> bool:
    """Create a new collection specifically for NER annotations.

    Sets up the collection with all required field types and fields
    for storing named entity recognition results.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection to create

    Returns:
        bool: True if successful, False otherwise

    """
    # Create the collection
    logger.info(f"Creating collection '{collection}'")
    try:
        # We only need to know if the request was successful, not the response content
        await solr_client.admin_request(
            "collections",
            {
                "action": "CREATE",
                "name": collection,
                "numShards": 1,
                "replicationFactor": 1,
            },
            True,
        )

        # Wait for the collection to be available
        await asyncio.sleep(2)

        # Add required fields using schema API
        logger.info(f"Adding fields to collection '{collection}'")

        # Define the schema all at once
        schema_command = {
            "add-field-type": [
                {
                    "name": "text_general",
                    "class": "solr.TextField",
                    "positionIncrementGap": "100",
                    "indexAnalyzer": {
                        "tokenizer": {"class": "solr.StandardTokenizerFactory"},
                        "filters": [{"class": "solr.LowerCaseFilterFactory"}],
                    },
                    "queryAnalyzer": {
                        "tokenizer": {"class": "solr.StandardTokenizerFactory"},
                        "filters": [{"class": "solr.LowerCaseFilterFactory"}],
                    },
                }
            ],
            "add-field": [
                {
                    "name": "id",
                    "type": "string",
                    "indexed": True,
                    "stored": True,
                    "multiValued": False,
                },
                {
                    "name": "doc_id",
                    "type": "string",
                    "indexed": True,
                    "stored": True,
                    "multiValued": True,
                },
                {
                    "name": "t",
                    "type": "text_general",
                    "indexed": True,
                    "stored": True,
                    "multiValued": True,
                },
                {
                    "name": "l",
                    "type": "string",
                    "indexed": True,
                    "stored": True,
                    "multiValued": True,
                },
                {
                    "name": "s",
                    "type": "plong",
                    "indexed": True,
                    "stored": True,
                    "multiValued": True,
                },
                {
                    "name": "e",
                    "type": "plong",
                    "indexed": True,
                    "stored": True,
                    "multiValued": True,
                },
                {
                    "name": "c",
                    "type": "pdouble",
                    "indexed": True,
                    "stored": True,
                    "multiValued": True,
                },
                {"name": "_root_", "type": "string", "indexed": True, "stored": True},
            ],
        }

        # Use the lower-level API to send the complete schema command
        url = f"{solr_client.url}/{collection}/schema"
        async with solr_client._session.post(url, json=schema_command) as response:
            if response.status >= 400:
                error_text = await response.text()
                logger.error(f"Error setting up schema: {response.status} - {error_text}")
                return False
            await response.text()

        logger.info(f"Successfully created collection '{collection}' with required fields")
        return True

    except Exception as e:
        logger.error(f"Error creating collection '{collection}': {e}")
        return False


async def upload_precomputed_ner(
    solr_client: SolrClient,
    collection: str,
    cache_root: str,
    model_name: str,
    solr_collection: str,
    field: str,
    batch_size: int = 1000,
) -> int:
    """Upload precomputed NER annotations to Solr.

    Looks for cached NER annotations and uploads them to a Solr collection.
    Uses a schema file if available.

    Args:
        solr_client: Solr client instance
        collection: Name of the target collection
        cache_root: Root directory for caches
        model_name: Name of the model that produced the annotations
        solr_collection: Name of the source collection
        field: Field name that was used for extraction
        batch_size: Number of documents per batch

    Returns:
        int: Number of documents uploaded

    """
    # Check for schema file
    schema_file = os.path.join(cache_root, f"{solr_collection}.yaml")
    if not os.path.exists(schema_file):
        logger.error(f"Schema file not found: {schema_file}")
        return 0

    # Get cache directory
    cache_dir = os.path.join(cache_root, model_name, solr_collection, field)
    if not os.path.exists(cache_dir):
        logger.error(f"Cache directory not found: {cache_dir}")
        return 0

    # Find all JSONL files
    jsonl_files = [os.path.join(cache_dir, filename) for filename in os.listdir(cache_dir) if filename.endswith(".jsonl")]

    if not jsonl_files:
        logger.error(f"No JSONL files found in {cache_dir}")
        return 0

    # Upload the files
    return await upload_jsonl_files(solr_client, collection, jsonl_files, schema_file, batch_size)
