"""Sphinx configuration file for the HistText Toolkit documentation.

This file sets up project metadata, extensions, and theme options for generating
documentation using Sphinx. See the Sphinx documentation for detailed options:
https://www.sphinx-doc.org/en/master/usage/configuration.html
"""

import os
import sys

sys.path.insert(0, os.path.abspath("../.."))  # Add project root directory

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "HistText Toolkit"
copyright = "2025, Baptiste Blouin"
author = "Baptiste Blouin"
release = "0.1.0"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
    "sphinx.ext.autodoc",  # Generate documentation from docstrings
    "sphinx.ext.viewcode",  # Link to source code
    "sphinx.ext.napoleon",  # Support for NumPy and Google style docstrings
    "sphinx.ext.intersphinx",  # Link to other project's documentation
]

templates_path = ["_templates"]
exclude_patterns = []
master_doc = "index"

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "sphinx_rtd_theme"  # ReadTheDocs theme (pip install sphinx_rtd_theme)
html_static_path = ["_static"]

# -- Autodoc configuration --------------------------------------------------
autodoc_member_order = "bysource"
autoclass_content = "both"
autodoc_typehints = "description"

# -- Napoleon configuration -------------------------------------------------
napoleon_google_docstring = True
napoleon_numpy_docstring = True
napoleon_include_init_with_doc = True
napoleon_include_private_with_doc = False
napoleon_include_special_with_doc = True

# -- intersphinx configuration ----------------------------------------------
intersphinx_mapping = {
    "python": ("https://docs.python.org/3", None),
    "numpy": ("https://numpy.org/doc/stable", None),
    "torch": ("https://pytorch.org/docs/stable", None),
}
