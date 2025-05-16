# HistText Project Documentation

Welcome to the HistText project documentation. This repository contains comprehensive documentation for all components of the system, organized into several sections.

## Documentation Structure

The documentation is organized into the following main sections:

### 1. Backend API Documentation

OpenAPI/Swagger specification files are available in the `docs/api/` directory:
- `histtext-openapi.json` - Core HistText API specification
- `solr-openapi.json` - Solr interface API specification
- `users-openapi.json` - User management API specification

These JSON files can be imported into any OpenAPI-compatible tool (like Swagger UI, Postman, etc.) to explore and test the APIs.

### 2. Administrator Setup Guide

The `docs/admin_setup/` directory contains detailed instructions for system administrators:
- `README.md` - Step-by-step setup and configuration guide

### 3. Backend Rust Documentation

The Rust backend documentation is available in `docs/backend/HistTextWeb/`:
- **Access**: Open `docs/backend/HistTextWeb/index.html` in your browser
- **Contents**: Complete API documentation for the Rust backend, including:
  - Configuration system
  - GraphQL interfaces (queries, mutations, subscriptions)
  - Core text processing modules:
    - Document management
    - Embeddings
    - Metadata handling
    - Named Entity Recognition (NER)
    - Statistics
    - Tokenization
  - Database models and services
  - Server implementation
  - Error handling

### 4. Database Schema Documentation

The database schema documentation is available in `docs/database/README.md`:
- **Contents**: Comprehensive documentation of the project's database schema:
  - User management tables
  - Authorization system (roles and permissions)
  - Solr search integration
  - Table relationships and schema visualization
  - Complete column descriptions and data types

This documentation provides insights into the data model that powers the application, including authentication, authorization, and search functionality.

### 5. Python Toolkit Documentation

The Python toolkit documentation is available in `docs/toolkit/`:
- **Access**: Open `docs/toolkit/index.html` in your browser
- **Contents**: Documentation for the Python toolkit, including:
  - Core modules
  - Model implementations:
    - Chinese segmentation
    - FastText
    - GlINER
    - Spacy integration
    - Transformer models
    - Word embeddings
  - Operations:
    - Embeddings generation
    - Named Entity Recognition
    - Tokenization
    - Upload functionality
  - Utility functions

## Getting Started

1. For system administrators:
   - Start with `docs/admin_setup/README.md`
2. For API users:
   - Review the OpenAPI specs in `docs/api/`
3. For backend developers:
   - Access the Rust documentation by opening `docs/backend/HistTextWeb/index.html`
   - Review the database schema documentation in `docs/database/README.md`
4. For toolkit users:
   - Access the Python toolkit documentation by opening `docs/toolkit/index.html`

## Building Documentation

If you need to rebuild the documentation:
- For Rust backend:
```
cargo doc --no-deps --bin HistTextWeb
```
- For Python toolkit:
```
cd toolkit
sphinx-build -b html source docs
```
- For database schema:
```
# The database schema documentation is maintained manually in docs/database/README.md
```

## Additional Resources

For more information about the project, please refer to the main project repository and the linked resources in each documentation section.