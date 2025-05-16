"""Solr client implementation.

This module provides a client for interacting with Apache Solr.
"""

from typing import Any, Optional

import aiohttp

from ..core.logging import get_logger

logger = get_logger(__name__)


class SolrClient:
    """Client for interacting with Apache Solr.

    Provides methods for querying documents, managing collections,
    and updating the Solr schema.
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8983,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        """Initialize the Solr client.

        Args:
            host: Solr host.
            port: Solr port.
            username: Optional username for authentication.
            password: Optional password for authentication.

        """
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.url = f"http://{host}:{port}/solr"
        self._session: Optional[aiohttp.ClientSession] = None

    async def start_session(self):
        """Start the client session with Solr.

        Creates a new aiohttp ClientSession with authentication if credentials
        are provided.
        """
        if self._session is None or self._session.closed:
            auth = None
            if self.username and self.password:
                auth = aiohttp.BasicAuth(self.username, self.password)

            self._session = aiohttp.ClientSession(auth=auth)
            logger.debug(f"Started Solr session to {self.url}")

    async def close_session(self):
        """Close the client session.

        Releases any resources held by the session.
        """
        if self._session and not self._session.closed:
            await self._session.close()
            logger.debug("Closed Solr session")

    async def _ensure_session(self):
        """Ensure that a session exists.

        Creates a new session if one doesn't exist or if the existing one
        is closed.
        """
        if self._session is None or self._session.closed:
            await self.start_session()

    async def check_status(self, collection: str) -> str:
        """Check the status of a collection.

        Args:
            collection: Name of the collection.

        Returns:
            str: Status of the collection or error message.

        """
        await self._ensure_session()

        try:
            async with self._session.get(f"{self.url}/{collection}/admin/ping") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("status", "unknown")
                else:
                    return f"Error: {response.status}"
        except aiohttp.ClientError as e:
            logger.error(f"Error checking Solr status: {e}")
            return "Solr Unreachable"

    async def collection_exists(self, collection: str) -> bool:
        """Check if a collection or alias exists.

        Args:
            collection: Name of the collection or alias.

        Returns:
            bool: True if the collection or alias exists, False otherwise.

        """
        await self._ensure_session()

        try:
            # First check if it's a direct collection
            payload = {"action": "LIST", "wt": "json"}
            response = await self.admin_request("collections", payload)

            # Check if the collection is in the list
            if "collections" in response and collection in response["collections"]:
                logger.debug(f"Found direct collection: {collection}")
                return True

            # If not a direct collection, check if it's an alias
            aliases_payload = {"action": "LISTALIASES", "wt": "json"}
            aliases_response = await self.admin_request("collections", aliases_payload)

            # Check aliases structure - it varies depending on Solr version
            if "aliases" in aliases_response:
                # Newer Solr versions
                if collection in aliases_response["aliases"]:
                    logger.debug(f"Found alias: {collection}")
                    return True

            # Also check alternative aliases structure (Solr 8.x)
            if "aliases" in aliases_response and isinstance(aliases_response["aliases"], dict):
                for alias_name, target_collections in aliases_response["aliases"].items():
                    if alias_name == collection:
                        logger.debug(f"Found alias: {collection} pointing to: {target_collections}")
                        return True

            # Not found as either collection or alias
            logger.debug(f"Collection or alias not found: {collection}")
            return False

        except Exception as e:
            logger.debug(f"Error checking if collection/alias exists: {e}")
            return False

    async def resolve_alias(self, alias: str) -> list[str]:
        """Resolve an alias to its target collection(s).

        Args:
            alias: Name of the alias.

        Returns:
            List[str]: List of target collection names, or empty list if alias doesn't exist.

        """
        await self._ensure_session()

        try:
            aliases_payload = {"action": "LISTALIASES", "wt": "json"}
            aliases_response = await self.admin_request("collections", aliases_payload)

            if "aliases" in aliases_response:
                # Handle newer Solr versions
                if alias in aliases_response["aliases"]:
                    target = aliases_response["aliases"][alias]
                    return target.split(",")

                # Handle older Solr versions
                if isinstance(aliases_response["aliases"], dict):
                    for alias_name, target_collections in aliases_response["aliases"].items():
                        if alias_name == alias:
                            return target_collections.split(",")

            return []

        except Exception as e:
            logger.debug(f"Error resolving alias: {e}")
            return []

    async def admin_request(self, request: str, params: dict[str, Any], raise_for_status: bool = False) -> dict[str, Any]:
        """Make an admin request to Solr.

        Args:
            request: Type of admin request.
            params: Parameters for the request.
            raise_for_status: Whether to raise an exception on error.

        Returns:
            Dict[str, Any]: Response from Solr.

        Raises:
            aiohttp.ClientResponseError: If raise_for_status is True and the request fails.

        """
        await self._ensure_session()

        async with self._session.get(f"{self.url}/admin/{request}", params=params) as response:
            if raise_for_status:
                response.raise_for_status()
            return await response.json()

    async def collection_select(self, collection: str, params: dict[str, Any], raise_for_status: bool = False) -> dict[str, Any]:
        """Make a select request to a collection.

        Args:
            collection: Name of the collection.
            params: Parameters for the request.
            raise_for_status: Whether to raise an exception on error.

        Returns:
            Dict[str, Any]: Response from Solr.

        Raises:
            aiohttp.ClientResponseError: If raise_for_status is True and the request fails.

        """
        await self._ensure_session()

        async with self._session.get(f"{self.url}/{collection}/select", params=params) as response:
            if raise_for_status:
                response.raise_for_status()
            return await response.json()

    async def get_document(self, collection: str, doc_id: str) -> Optional[dict[str, Any]]:
        """Get a document by ID.

        Args:
            collection: Name of the collection.
            doc_id: ID of the document.

        Returns:
            Optional[Dict[str, Any]]: Document if found, None otherwise.

        """
        await self._ensure_session()

        payload = {"q": f"id:{doc_id}"}

        try:
            select = await self.collection_select(collection, payload)
            docs = select.get("response", {}).get("docs", [])

            if not docs:
                return None

            return docs[0]
        except Exception as e:
            logger.error(f"Error getting document: {e}")
            return None

    async def get_document_batch(
        self,
        collection: str,
        text_field: str,
        start: int,
        batch_size: int,
        filter_query: Optional[str] = None,
    ) -> dict[str, str]:
        """Get a batch of documents.

        Args:
            collection: Name of the collection.
            text_field: Field containing the text.
            start: Start index.
            batch_size: Number of documents to retrieve.
            filter_query: Optional filter query.

        Returns:
            Dict[str, str]: Dictionary mapping document IDs to text.

        """
        await self._ensure_session()

        payload = {"q": "*:*", "rows": batch_size, "start": start}
        if filter_query:
            payload["fq"] = filter_query

        try:
            select = await self.collection_select(collection, payload)
            docs = select.get("response", {}).get("docs", [])

            if not docs:
                return {}

            return {doc["id"]: doc.get(text_field, "") for doc in docs}
        except Exception as e:
            logger.error(f"Error getting document batch: {e}")
            return {}

    async def upload_documents(self, collection: str, documents: list[dict[str, Any]], commit: bool = True) -> bool:
        """Upload documents to a collection.

        Args:
            collection: Name of the collection.
            documents: List of documents to upload.
            commit: Whether to commit the changes immediately.

        Returns:
            bool: True if successful, False otherwise.

        """
        await self._ensure_session()

        url = f"{self.url}/{collection}/update"
        if commit:
            url += "?commit=true"

        try:
            async with self._session.post(url, json=documents) as response:
                if response.status >= 400:
                    # Get detailed error message
                    error_text = await response.text()
                    logger.error(f"HTTP {response.status} error uploading documents: {error_text}")
                    return False

                await response.read()
                return True
        except Exception as e:
            logger.error(f"Error uploading documents: {e}")
            return False

    async def create_collection(self, collection: str, num_shards: int = 1, num_replicas: int = 1) -> bool:
        """Create a new collection.

        Args:
            collection: Name of the collection.
            num_shards: Number of shards.
            num_replicas: Number of replicas.

        Returns:
            bool: True if successful, False otherwise.

        """
        await self._ensure_session()

        payload = {
            "action": "CREATE",
            "name": collection,
            "numShards": num_shards,
            "replicationFactor": num_replicas,
        }

        try:
            # Not using the result, only checking for success
            await self.admin_request("collections", payload, True)
            return True
        except Exception as e:
            logger.error(f"Error creating collection: {e}")
            return False

    async def alter_schema(self, collection: str, command: dict[str, Any]) -> bool:
        """Alter the schema of a collection.

        Args:
            collection: Name of the collection.
            command: Schema command.

        Returns:
            bool: True if successful, False otherwise.

        """
        await self._ensure_session()

        try:
            async with self._session.post(f"{self.url}/{collection}/schema", json=command) as response:
                response.raise_for_status()
                await response.read()
                return True
        except Exception as e:
            logger.error(f"Error altering schema: {e}")
            return False

    async def add_field(
        self,
        collection: str,
        name: str,
        type_: str,
        indexed: bool = True,
        stored: bool = True,
        multivalued: bool = False,
    ) -> bool:
        """Add a field to a collection.

        Args:
            collection: Name of the collection.
            name: Name of the field.
            type_: Type of the field.
            indexed: Whether the field is indexed.
            stored: Whether the field is stored.
            multivalued: Whether the field can have multiple values.

        Returns:
            bool: True if successful, False otherwise.

        """
        await self._ensure_session()

        command = {
            "add-field": {
                "name": name,
                "type": type_,
                "indexed": indexed,
                "stored": stored,
                "multiValued": multivalued,
            }
        }

        try:
            url = f"{self.url}/{collection}/schema"
            async with self._session.post(url, json=command) as response:
                response.raise_for_status()
                await response.text()  # Read the response to release the connection
                return True
        except Exception as e:
            logger.error(f"Error adding field '{name}' to collection '{collection}': {e}")
            # Add more detailed error information
            try:
                if hasattr(e, "status") and e.status == 400:
                    logger.error(f"Bad request details: {command}")
            except Exception:
                pass
            return False


# Singleton instance
_solr_client: Optional[SolrClient] = None


async def get_solr_client(
    host: str = "localhost",
    port: int = 8983,
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> SolrClient:
    """Get or create a Solr client singleton.

    Creates a new SolrClient instance if one doesn't exist,
    or returns the existing one.

    Args:
        host: Solr host.
        port: Solr port.
        username: Optional username for authentication.
        password: Optional password for authentication.

    Returns:
        SolrClient: Solr client instance.

    """
    global _solr_client

    if _solr_client is None:
        _solr_client = SolrClient(host, port, username, password)
        await _solr_client.start_session()

    return _solr_client


async def close_solr_client():
    """Close the Solr client singleton instance.

    Closes the session and resets the singleton reference.
    """
    global _solr_client

    if _solr_client is not None:
        await _solr_client.close_session()
        _solr_client = None
