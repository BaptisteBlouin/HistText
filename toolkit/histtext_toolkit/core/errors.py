"""Error handling module for HistText Toolkit.

This module provides custom exceptions and error handling utilities
to improve robustness of toolkit operations with structured logging
and specialized error recovery strategies.
"""

import asyncio
import functools
import logging
import random
import traceback
from typing import Any, Callable, Optional, TypeVar

# Define a type variable for function return types
T = TypeVar("T")


class HistTextError(Exception):
    """Base exception class for all HistText Toolkit errors.

    All custom exceptions in the toolkit inherit from this class,
    providing consistent error handling patterns.

    Attributes:
        message (str): Human-readable error description
        details (Dict[str, Any]): Additional structured error information

    """

    def __init__(self, message: str, details: Optional[dict[str, Any]] = None):
        """Initialize the exception.

        Args:
            message: Error message describing what went wrong
            details: Optional dictionary with additional error details

        """
        self.message = message
        self.details = details or {}
        super().__init__(message)


class ModelError(HistTextError):
    """Exception raised for errors in model operations.

    Used when errors occur during model loading, inference,
    or other model-related operations.

    Attributes:
        model_name (str): Name of the model that encountered the error
        model_type (str): Type of the model (e.g., "fasttext", "spacy")

    """

    def __init__(
        self,
        message: str,
        model_name: Optional[str] = None,
        model_type: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """Initialize the exception.

        Args:
            message: Error message describing what went wrong
            model_name: Name of the model that encountered the error
            model_type: Type of the model (e.g., "fasttext", "spacy")
            details: Optional dictionary with additional error details

        """
        self.model_name = model_name
        self.model_type = model_type
        details = details or {}
        details.update({"model_name": model_name, "model_type": model_type})
        super().__init__(message, details)


class EmbeddingError(ModelError):
    """Exception raised for errors in embedding operations.

    Used specifically for errors that occur during text embedding.

    Attributes:
        text_sample (str): Sample of problematic text that caused the error

    """

    def __init__(
        self,
        message: str,
        model_name: Optional[str] = None,
        model_type: Optional[str] = None,
        text_sample: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """Initialize the exception.

        Args:
            message: Error message describing what went wrong
            model_name: Name of the model that encountered the error
            model_type: Type of the model (e.g., "fasttext", "spacy")
            text_sample: Sample of problematic text that caused the error
            details: Optional dictionary with additional error details

        """
        self.text_sample = text_sample
        details = details or {}
        if text_sample:
            # Include only a truncated version of the text to avoid huge error messages
            max_sample_length = 100
            truncated_sample = text_sample[:max_sample_length]
            if len(text_sample) > max_sample_length:
                truncated_sample += "..."
            details["text_sample"] = truncated_sample
        super().__init__(message, model_name, model_type, details)


class SolrError(HistTextError):
    """Exception raised for errors in Solr operations.

    Used when errors occur during Solr queries, updates, or other operations.

    Attributes:
        status_code (int): HTTP status code from Solr response
        collection (str): Name of the Solr collection

    """

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        collection: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """Initialize the exception.

        Args:
            message: Error message describing what went wrong
            status_code: HTTP status code from Solr response
            collection: Name of the Solr collection
            details: Optional dictionary with additional error details

        """
        self.status_code = status_code
        self.collection = collection
        details = details or {}
        details.update({"status_code": status_code, "collection": collection})
        super().__init__(message, details)


class InputError(HistTextError):
    """Exception raised for errors in user input.

    Used when user-provided input is invalid or cannot be processed.
    """

    pass


class ResourceError(HistTextError):
    """Exception raised for errors related to resources.

    Used when files, directories, or other resources are unavailable.

    Attributes:
        resource_type (str): Type of resource (e.g., "file", "directory")
        resource_path (str): Path to the resource

    """

    def __init__(
        self,
        message: str,
        resource_type: Optional[str] = None,
        resource_path: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """Initialize the exception.

        Args:
            message: Error message describing what went wrong
            resource_type: Type of resource (e.g., "file", "directory")
            resource_path: Path to the resource
            details: Optional dictionary with additional error details

        """
        self.resource_type = resource_type
        self.resource_path = resource_path
        details = details or {}
        details.update({"resource_type": resource_type, "resource_path": resource_path})
        super().__init__(message, details)


class MemoryError(ResourceError):
    """Exception raised for out-of-memory errors.

    Used when operations fail due to insufficient memory.

    Attributes:
        estimated_required (str): Estimated required memory
        available (str): Available memory

    """

    def __init__(
        self,
        message: str,
        estimated_required: Optional[str] = None,
        available: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """Initialize the exception.

        Args:
            message: Error message describing what went wrong
            estimated_required: Estimated required memory (e.g., "4.2 GB")
            available: Available memory (e.g., "2.1 GB")
            details: Optional dictionary with additional error details

        """
        self.estimated_required = estimated_required
        self.available = available
        details = details or {}
        details.update({"estimated_required": estimated_required, "available": available})
        super().__init__(message, "memory", None, details)


def safe_embed(logger: logging.Logger, default_return: Optional[T] = None) -> Callable:
    """Decorate embedding functions to handle errors gracefully.

    Catches exceptions during embedding operations and returns a default value
    instead of propagating the error, allowing batch processing to continue.

    Args:
        logger: Logger to use for recording error messages
        default_return: Default return value when an error occurs

    Returns:
        Callable: Decorated function that handles errors gracefully

    Example:
        >>> @safe_embed(logger, default_return=np.zeros(300))
        >>> def embed_text(text: str) -> np.ndarray:
        >>>     # Implementation that might raise exceptions
        >>>     return model.get_embedding(text)

    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            try:
                return func(*args, **kwargs)
            except HistTextError as e:
                # Log HistText errors with their structured details
                logger.error(f"{type(e).__name__}: {e.message}")
                for key, value in e.details.items():
                    if value is not None:
                        logger.error(f"  {key}: {value}")
                return default_return
            except Exception as e:
                if "memory" in str(e).lower() or "cuda" in str(e).lower():
                    # Special handling for memory errors
                    logger.error(f"Memory error in {func.__name__}: {str(e)}")
                    # Log detailed memory information if available
                    try:
                        import torch

                        if torch.cuda.is_available():
                            device = torch.cuda.current_device()
                            allocated = torch.cuda.memory_allocated(device) / (1024**3)
                            reserved = torch.cuda.memory_reserved(device) / (1024**3)
                            logger.error(f"  GPU memory allocated: {allocated:.2f} GB")
                            logger.error(f"  GPU memory reserved: {reserved:.2f} GB")
                            # Try to free memory
                            torch.cuda.empty_cache()
                            logger.info("Attempted to free GPU memory")
                    except ImportError:
                        pass
                else:
                    # For other exceptions, log the traceback
                    logger.error(f"Unexpected error in {func.__name__}: {str(e)}")
                    logger.debug(f"Traceback: {traceback.format_exc()}")
                return default_return

        return wrapper

    return decorator


def handle_embedding_errors(model_name: Optional[str] = None, model_type: Optional[str] = None) -> Callable:
    """Handle embedding errors with model context using a decorator.

    Converts generic exceptions into specialized HistText exceptions
    with additional context about the model and operation.

    Args:
        model_name: Name of the model for context
        model_type: Type of the model for context

    Returns:
        Callable: Decorated function that converts exceptions to HistText exceptions

    Example:
        >>> @handle_embedding_errors(model_name="fasttext-en", model_type="fasttext")
        >>> def load_model() -> bool:
        >>>     # Implementation that might raise exceptions
        >>>     return model.load()

    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except HistTextError:
                # Re-raise HistText errors unchanged
                raise
            except ValueError as e:
                # Convert ValueError to InputError
                raise InputError(str(e)) from e
            except Exception as e:
                if "memory" in str(e).lower() or "cuda" in str(e).lower():
                    # Convert memory errors to MemoryError
                    raise MemoryError(
                        f"Out of memory error in {func.__name__}: {str(e)}",
                        None,
                        None,
                        {"original_error": str(e)},
                    ) from e
                else:
                    # Convert other exceptions to EmbeddingError
                    raise EmbeddingError(
                        f"Error in {func.__name__}: {str(e)}",
                        model_name,
                        model_type,
                        None,
                        {"original_error": str(e)},
                    ) from e

        return wrapper

    return decorator


async def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    logger: Optional[logging.Logger] = None,
):
    """Retry an async function with exponential backoff.

    Useful for operations that might fail temporarily, such as network requests.

    Args:
        func: Async function to retry
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds between retries
        logger: Logger to use for recording retry attempts

    Returns:
        Any: Result of the function if successful

    Raises:
        Exception: The last exception that occurred if all retries fail

    Example:
        >>> async def fetch_data():
        >>>     # Implementation that might fail temporarily
        >>>     return await api.get_data()
        >>>
        >>> result = await retry_with_backoff(fetch_data, max_retries=5)

    """
    last_exception = None
    for retry in range(max_retries):
        try:
            return await func()
        except Exception as e:
            last_exception = e
            if logger:
                logger.warning(f"Retry {retry+1}/{max_retries} failed: {str(e)}")

            if retry < max_retries - 1:
                # Calculate backoff delay with jitter
                delay = base_delay * (2**retry) + random.uniform(0, 0.5)
                if logger:
                    logger.info(f"Retrying in {delay:.2f} seconds...")
                await asyncio.sleep(delay)

    # If we get here, all retries failed
    if logger:
        logger.error(f"All {max_retries} retries failed")
    raise last_exception


def log_error_and_continue(error: Exception, item_id: str, logger: logging.Logger) -> None:
    """Log an error and continue processing.

    Provides structured logging for errors during batch processing.

    Args:
        error: The exception that occurred
        item_id: Identifier for the item being processed
        logger: Logger to use for recording error messages

    Example:
        >>> try:
        >>>     process_document(doc)
        >>> except Exception as e:
        >>>     log_error_and_continue(e, doc.id, logger)
        >>>     # Continue with next document

    """
    if isinstance(error, HistTextError):
        logger.error(f"Error processing {item_id}: {error.message}")
        for key, value in error.details.items():
            if value is not None:
                logger.debug(f"  {key}: {value}")
    else:
        logger.error(f"Error processing {item_id}: {str(error)}")
        logger.debug(f"Traceback: {traceback.format_exc()}")


def get_memory_info() -> dict[str, Any]:
    """Get system memory information for RAM and GPU.

    Returns information about total and available memory for system diagnosis
    and resource planning.

    Returns:
        Dict[str, Any]: Dictionary with memory information including:
            - ram_available_gb: Available RAM in GB
            - ram_total_gb: Total RAM in GB
            - gpu_available_gb: Available GPU memory in GB
            - gpu_total_gb: Total GPU memory in GB

    Example:
        >>> memory = get_memory_info()
        >>> print(f"Available RAM: {memory['ram_available_gb']:.2f} GB")
        >>> print(f"Available GPU: {memory['gpu_available_gb']:.2f} GB")

    """
    memory_info = {
        "ram_available_gb": None,
        "ram_total_gb": None,
        "gpu_available_gb": None,
        "gpu_total_gb": None,
    }

    # Get RAM information
    try:
        import psutil

        memory = psutil.virtual_memory()
        memory_info["ram_available_gb"] = memory.available / (1024**3)
        memory_info["ram_total_gb"] = memory.total / (1024**3)
    except ImportError:
        pass

    # Get GPU information
    try:
        import torch

        if torch.cuda.is_available():
            device = torch.cuda.current_device()
            props = torch.cuda.get_device_properties(device)
            memory_info["gpu_total_gb"] = props.total_memory / (1024**3)

            # Get available memory
            reserved = torch.cuda.memory_reserved(device)
            total = props.total_memory
            available = total - reserved
            memory_info["gpu_available_gb"] = available / (1024**3)
    except ImportError:
        pass

    return memory_info
