"""Logging setup and configuration.

This module provides utility functions for configuring the Python logging system
with consistent formats and flexible handler configuration.
"""

import logging
import sys
from typing import Any, Optional, Union


def setup_logging(
    level: Union[str, int] = "INFO",
    format_str: str = "[%(asctime)s] %(levelname)s: %(message)s",
    handlers: Optional[dict[str, Any]] = None,
) -> logging.Logger:
    """Set up logging configuration for the entire application.

    Configures the root logger with the specified log level, format string,
    and handlers. By default, logs to stdout with a timestamp and level name.

    Args:
        level: Logging level, either as string (e.g., "INFO", "DEBUG") or
            integer constant (e.g., logging.INFO)
        format_str: Format string for log messages
        handlers: Optional custom handlers configuration, a dictionary mapping
            handler types to their configurations

    Returns:
        logging.Logger: The configured root logger

    Raises:
        ValueError: If the string log level is invalid

    Example:
        >>> # Basic setup with default settings
        >>> logger = setup_logging()
        >>>
        >>> # Setup with custom level and file handler
        >>> logger = setup_logging(
        ...     level="DEBUG",
        ...     handlers={"file": {"filename": "app.log"}}
        ... )

    """
    # Convert string level to numeric if needed
    if isinstance(level, str):
        numeric_level = getattr(logging, level.upper(), None)
        if not isinstance(numeric_level, int):
            raise ValueError(f"Invalid log level: {level}")
        level = numeric_level

    # Basic configuration
    logging.basicConfig(level=level, format=format_str, handlers=[logging.StreamHandler(sys.stdout)])

    # Add custom handlers if specified
    if handlers:
        logger = logging.getLogger()
        for handler_type, handler_config in handlers.items():
            if handler_type == "file":
                handler = logging.FileHandler(
                    filename=handler_config.get("filename", "solr_toolkit.log"),
                    mode=handler_config.get("mode", "a"),
                    encoding=handler_config.get("encoding", "utf-8"),
                )
                handler.setFormatter(logging.Formatter(format_str))
                logger.addHandler(handler)

    return logging.getLogger()


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name.

    Returns a logger instance with the given name, which will inherit settings
    from the root logger if setup_logging() has been called. Module loggers
    should typically use __name__ as the logger name for proper hierarchical logging.

    Args:
        name: Name of the logger, typically the module name using __name__

    Returns:
        logging.Logger: The logger instance configured with the specified name

    Example:
        >>> # In a module file
        >>> logger = get_logger(__name__)
        >>> logger.info("This is a log message")

    """
    return logging.getLogger(name)
