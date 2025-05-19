"""Add main CLI entrypoint for setup.py.

This function is called when using the console script defined in setup.py.
"""

import asyncio
import sys

from .main import main


def main_cli():
    """Entry point for the command-line interface.

    This function is called when using the console script defined in setup.py.
    """
    if sys.platform == "win32":
        # Set up asyncio policy for Windows
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    asyncio.run(main())
