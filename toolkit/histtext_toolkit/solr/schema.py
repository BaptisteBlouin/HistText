"""Schema management for Solr.

This module provides functionality for creating and managing Solr schemas.
"""

import json
from typing import Any, Optional

import yaml

from ..core.logging import get_logger
from .client import SolrClient

logger = get_logger(__name__)


async def setup_schema_from_dict(solr_client: SolrClient, collection: str, schema_dict: dict[str, Any]) -> bool:
    """Set up a schema from a dictionary.

    Creates a collection and configures it with the specified field types and fields.

    Args:
        solr_client: Solr client instance to use for API calls
        collection: Name of the collection to create
        schema_dict: Schema dictionary containing types and fields definitions

    Returns:
        bool: True if successful, False otherwise

    """
    # Extract types and fields
    types = schema_dict.get("schema", {}).get("types", [])
    fields = schema_dict.get("schema", {}).get("fields", {})

    # Create collection
    logger.info(f"Creating collection '{collection}'...")
    created = await solr_client.create_collection(collection)
    if not created:
        logger.error(f"Failed to create collection '{collection}'")
        return False

    # Add field types
    for type_name in types:
        logger.info(f"Adding field type '{type_name}' to '{collection}'...")
        if type_name == "rdate":
            await add_daterange_field_type(solr_client, collection)
        elif type_name == "integer":
            await add_integer_field_type(solr_client, collection)
        elif type_name == "text_normalized_cjk":
            await add_cjk_field_type(solr_client, collection)
        else:
            logger.warning(f"Unknown field type: {type_name}")

    # Add fields
    for field_name, field_config in fields.items():
        logger.info(f"Adding field '{field_name}' to '{collection}'...")
        field_type = field_config.get("type", "string")
        indexed = field_config.get("indexed", True)
        stored = field_config.get("stored", True)
        multivalued = field_config.get("multivalued", False)

        success = await solr_client.add_field(collection, field_name, field_type, indexed, stored, multivalued)

        if not success:
            logger.warning(f"Failed to add field '{field_name}'")

    logger.info(f"Schema setup complete for collection '{collection}'")
    return True


async def setup_schema_from_file(solr_client: SolrClient, collection: str, schema_file: str) -> bool:
    """Set up a schema from a YAML file.

    Loads a schema from a YAML file and creates a collection with that schema.

    Args:
        solr_client: Solr client instance to use for API calls
        collection: Name of the collection to create
        schema_file: Path to the YAML schema file

    Returns:
        bool: True if successful, False otherwise

    """
    try:
        with open(schema_file) as f:
            schema_dict = yaml.safe_load(f)

        return await setup_schema_from_dict(solr_client, collection, schema_dict)
    except Exception as e:
        logger.error(f"Error setting up schema from file: {e}")
        return False


async def add_daterange_field_type(solr_client: SolrClient, collection: str) -> bool:
    """Add the 'rdate' field type to a collection.

    Creates a DateRangeField type for date range queries.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection

    Returns:
        bool: True if successful, False otherwise

    """
    command = {"add-field-type": {"name": "rdate", "class": "solr.DateRangeField"}}

    return await solr_client.alter_schema(collection, command)


async def add_integer_field_type(solr_client: SolrClient, collection: str) -> bool:
    """Add the 'integer' field type to a collection.

    Creates an IntPointField type for integer values.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection

    Returns:
        bool: True if successful, False otherwise

    """
    command = {"add-field-type": {"name": "integer", "class": "solr.IntPointField"}}

    return await solr_client.alter_schema(collection, command)


async def add_cjk_field_type(solr_client: SolrClient, collection: str) -> bool:
    """Add the 'text_normalized_cjk' field type to a collection.

    Creates a specialized TextField type for CJK (Chinese, Japanese, Korean) text with
    appropriate tokenization and filters.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection

    Returns:
        bool: True if successful, False otherwise

    """
    command = {
        "add-field-type": {
            "name": "text_normalized_cjk",
            "class": "solr.TextField",
            "analyzer": {
                "tokenizer": {"class": "solr.StandardTokenizerFactory"},
                "filters": [
                    {"class": "solr.LowerCaseFilterFactory"},
                    {"class": "solr.CJKWidthFilterFactory"},
                    {"class": "solr.CJKBigramFilterFactory"},
                ],
            },
        }
    }

    return await solr_client.alter_schema(collection, command)


def create_schema_dict(fields: dict[str, dict[str, Any]], types: Optional[list[str]] = None) -> dict[str, Any]:
    """Create a schema dictionary.

    Constructs a schema dictionary with the specified fields and types.

    Args:
        fields: Dictionary mapping field names to field configurations
        types: List of field types to include

    Returns:
        Dict[str, Any]: Schema dictionary suitable for creating a Solr schema

    """
    return {"schema": {"types": types or [], "fields": fields}}


def write_schema_to_file(schema_dict: dict[str, Any], output_file: str) -> bool:
    """Write a schema dictionary to a YAML file.

    Args:
        schema_dict: Schema dictionary to write
        output_file: Path to the output file

    Returns:
        bool: True if successful, False otherwise

    """
    try:
        with open(output_file, "w") as f:
            yaml.dump(schema_dict, f, default_flow_style=False, allow_unicode=True)
        return True
    except Exception as e:
        logger.error(f"Error writing schema to file: {e}")
        return False


async def get_collection_schema(solr_client: SolrClient, collection: str) -> dict[str, dict[str, Any]]:
    """Get the schema fields for a collection.

    Attempts to infer the schema by examining a sample document from the collection.
    Falls back to a basic schema if inference fails.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection

    Returns:
        Dict[str, Dict[str, Any]]: Dictionary mapping field names to field configurations

    """
    # Create a basic schema as fallback
    basic_fields = {
        "id": {
            "type": "string",
            "indexed": True,
            "stored": True,
            "multivalued": False,
        },
        "text": {
            "type": "text_general",
            "indexed": True,
            "stored": True,
            "multivalued": False,
        },
    }

    try:
        # Try to get sample document to improve the schema
        try:
            # Use a raw HTTP request to ensure we get the proper response
            url = f"{solr_client.url}/{collection}/select?q=*:*&rows=1&wt=json"
            async with solr_client._session.get(url) as response:
                # Read raw text
                text = await response.text()

                # Try to parse as JSON
                try:
                    data = json.loads(text)

                    # Check if we have documents
                    if data.get("response", {}).get("docs"):
                        doc = data["response"]["docs"][0]

                        # Create a schema from the document
                        fields = {}
                        for field_name, value in doc.items():
                            # Skip internal fields
                            if field_name.startswith("_"):
                                continue

                            # Determine field type and multivalue status
                            if isinstance(value, list):
                                if value and isinstance(value[0], (int, float)):
                                    field_type = "plongs" if isinstance(value[0], int) else "pdoubles"
                                else:
                                    field_type = "strings"
                                multivalued = True
                            elif isinstance(value, (int, float)):
                                field_type = "plong" if isinstance(value, int) else "pdouble"
                                multivalued = False
                            else:
                                field_type = "string" if len(str(value)) < 32 else "text_general"
                                multivalued = False

                            fields[field_name] = {
                                "type": field_type,
                                "indexed": True,
                                "stored": True,
                                "multivalued": multivalued,
                            }

                        # Merge with basic fields
                        fields.update(basic_fields)
                        return fields
                except json.JSONDecodeError:
                    logger.warning("Could not parse JSON response from Solr")
        except Exception as e:
            logger.warning(f"Error querying collection for schema inference: {e}")

        # Return basic schema as a last resort
        return basic_fields
    except Exception as e:
        logger.error(f"Error getting schema for collection '{collection}': {e}")
        return basic_fields
