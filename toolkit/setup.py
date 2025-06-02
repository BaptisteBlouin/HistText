"""Package setup file for HistText Toolkit."""
from setuptools import find_packages, setup

setup(
    name="histtext_toolkit",
    version="1.1.0",  
    description="A toolkit for working with Apache Solr, including enhanced NER, tokenization, and embeddings operations with state-of-the-art models",
    long_description="""
    HistText Toolkit provides comprehensive functionality for historical text processing with Apache Solr.
    
    Features:
    - Enhanced NER with state-of-the-art models (GLiNER, NuNER, Flair)
    - Traditional NER with spaCy and Transformers
    - Text tokenization and embeddings
    - Solr integration and batch processing
    - Caching and performance optimization
    """,
    long_description_content_type="text/plain",
    author="Baptiste Blouin",
    author_email="histtext@gmail.com",
    url="https://github.com/BaptisteBlouin/HistText",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        # Core dependencies
        "aiohttp>=3.8.0",
        "jsonlines>=2.0.0",
        "pyyaml>=6.0",
        "tqdm>=4.62.0",
        "numpy>=1.20.0",
        # Enhanced NER core dependencies
        "torch>=2.0.0",
        "transformers>=4.35.0",
        "datasets>=2.14.0",
        "accelerate>=0.24.0",
    ],
    extras_require={
        # Traditional NLP models
        "spacy": ["spacy>=3.7.0"],
        "transformers": ["transformers>=4.35.0", "torch>=2.0.0"],
        
        # Enhanced NER models
        "enhanced_ner": [
            "gliner>=0.2.0",
            "flair>=0.12.0",
            "optimum>=1.14.0",
        ],
        "gliner": ["gliner>=0.2.0"],
        "flair": ["flair>=0.12.0"],
        "nuner": [
            "gliner>=0.2.0",  # NuNER is based on GLiNER architecture
        ],
        
        # Chinese text processing
        "chinese": ["hanziconv>=0.3.2"],
        
        # Embeddings
        "fasttext": ["fasttext>=0.9.2"],
        "word2vec": ["gensim>=4.0.0"],
        "sentence_transformers": ["sentence-transformers>=2.0.0"],
        "word_embeddings": ["gensim>=4.0.0", "nltk>=3.6.0", "psutil>=5.8.0"],
        "embeddings": [
            "fasttext>=0.9.2",
            "gensim>=4.0.0",
            "sentence-transformers>=2.0.0",
            "nltk>=3.6.0",
            "psutil>=5.8.0",
        ],
        
        # Performance optimizations
        "performance": [
            "optimum>=1.14.0",
            "psutil>=5.8.0",
        ],
        
        # Documentation
        "docs": [
            "sphinx>=5.0.0",
            "sphinx_rtd_theme",
            "myst-parser>=0.18.0",
        ],
        
        # Development
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.20.0",
            "black>=22.0.0",
            "flake8>=5.0.0",
            "mypy>=0.991",
        ],
        
        # Complete installation with all features
        "all": [
            # Traditional NLP
            "spacy>=3.7.0",
            "transformers>=4.35.0",
            "torch>=2.0.0",
            
            # Enhanced NER
            "gliner>=0.2.0",
            "flair>=0.12.0",
            "optimum>=1.14.0",
            
            # Chinese processing
            "hanziconv>=0.3.2",
            
            # Embeddings
            "fasttext>=0.9.2",
            "gensim>=4.0.0",
            "sentence-transformers>=2.0.0",
            "nltk>=3.6.0",
            
            # Performance
            "psutil>=5.8.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "histtext-toolkit=histtext_toolkit.main:main_cli",
            "histtext=histtext_toolkit.main:main_cli",  # Shorter alias
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Researchers",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Text Processing :: Linguistic",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    keywords=[
        "nlp", "ner", "solr", "text-processing", "historical-text", 
        "gliner", "transformers", "embeddings", "tokenization"
    ],
    project_urls={
        "Bug Reports": "https://github.com/BaptisteBlouin/HistText/issues",
        "Source": "https://github.com/BaptisteBlouin/HistText",
    },
)