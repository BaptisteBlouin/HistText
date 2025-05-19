HistText Toolkit Documentation
==============================

Welcome to the HistText Toolkit documentation. This toolkit provides a set of utilities for processing and analyzing historical text data, with a focus on named entity recognition, tokenization, and embeddings.

Features
--------

* Named Entity Recognition (NER) for historical texts
* Advanced tokenization with support for multiple languages
* Text embeddings with various models (FastText, Word2Vec, Transformers)
* Integration with Solr for document storage and retrieval
* GPU memory management utilities

Getting Started
--------------

To install the HistText Toolkit:

.. code-block:: bash

   pip install .


Quick example:

.. code-block:: python

   from histtext_toolkit.models.registry import get_available_model_types
   
   # Get available models
   models = get_available_model_types()
   print(f"Available models: {models}")


Table of Contents
----------------

.. toctree::
   :maxdepth: 2
   :caption: Contents:

   modules/core
   modules/models
   modules/operations
   modules/utils


Indices and tables
=================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
