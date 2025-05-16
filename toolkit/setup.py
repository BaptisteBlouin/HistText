"""Package setup file for HistText Toolkit."""

from setuptools import find_packages, setup

setup(
    name="histtext_toolkit",
    version="1.0.0",
    description="A toolkit for working with Apache Solr, including NER, tokenization, and embeddings operations",
    author="Baptiste Blouin",
    author_email="histtext@gmail.com",
    packages=find_packages(),
    install_requires=[
        "aiohttp>=3.8.0",
        "jsonlines>=2.0.0",
        "pyyaml>=6.0",
        "tqdm>=4.62.0",
        "numpy>=1.20.0",
    ],
    extras_require={
        "spacy": ["spacy>=3.0.0"],
        "transformers": ["transformers>=4.10.0", "torch>=1.9.0"],
        "gliner": ["gliner>=0.1.0"],
        "chinese": [
            "hanziconv>=0.3.2",
            "ChineseWordSegmenter @ git+https://github.com/hhhuang/ChineseWordSegmenter.git",
        ],
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
        "docs": [
            "sphinx>=5.0.0",
            "sphinx_rtd_theme",
        ],
        "all": [
            "spacy>=3.0.0",
            "transformers>=4.10.0",
            "torch>=1.9.0",
            "gliner>=0.1.0",
            "hanziconv>=0.3.2",
            "ChineseWordSegmenter @ git+https://github.com/hhhuang/ChineseWordSegmenter.git",
            "fasttext>=0.9.2",
            "gensim>=4.0.0",
            "sentence-transformers>=2.0.0",
            "nltk>=3.6.0",
            "psutil>=5.8.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "histtext-toolkit=histtext_toolkit.main:main_cli",
        ],
    },
)
