# HistText API Reference

## Overview

HistText provides a comprehensive REST API built with Rust and Actix Web. The API is organized into three main sections with full OpenAPI/Swagger documentation available at `/swagger-ui`.

## API Structure

### Base URLs
- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

### API Sections
1. **User Management API** (`/api/users`, `/api/auth`)
2. **Solr Administration API** (`/api/solr_databases`)
3. **HistText Core API** (`/api/solr`, `/api/embeddings`, `/api/tokenize`)

## Authentication

### JWT Bearer Token
All API endpoints require JWT authentication except public endpoints.

```bash
# Authentication header
Authorization: Bearer <jwt_token>
```

### Login Process
```bash
# Login request
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

# Response
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}

# Note: Refresh token is set as HTTP-only cookie, not returned in JSON
```

### Token Refresh
```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

## Core API Endpoints

### 1. Document Search and Query

#### Advanced Document Search
```bash
GET /api/solr/query?database_id={id}&collection={name}&...
```

**Query Parameters:**
- `database_id` (required): Solr database ID
- `collection` (required): Collection name
- `q`: Search query (Solr syntax)
- `fq[]`: Filter queries (array)
- `sort`: Sort specification
- `start`: Starting row (pagination)
- `rows`: Number of rows to return
- `ner`: Enable NER processing (`true`/`false`)
- `stats_level`: Statistics level (`all`, `medium`, `none`)
- `download_only`: Return only metadata for CSV export

**Example Request:**
```bash
GET /api/solr/query?database_id=1&collection=historical_texts&q=revolution&fq[]=date_range:[1789 TO 1799]&ner=true&stats_level=medium&start=0&rows=100
```

**Response Structure:**
```json
{
  "docs": [
    {
      "id": "doc_123",
      "title": "French Revolution Documents",
      "content": "Text content with <mark>revolution</mark> highlighted...",
      "date_rdt": "1789-07-14T00:00:00Z",
      "author": "Anonymous",
      "ner_entities": [
        {
          "text": "France",
          "label": "LOC",
          "start": 45,
          "end": 51,
          "confidence": 0.95
        }
      ]
    }
  ],
  "numFound": 1543,
  "start": 0,
  "maxScore": 8.7,
  "facet_counts": {
    "facet_fields": {
      "author": ["Anonymous", 145, "Voltaire", 23],
      "year": ["1789", 234, "1790", 189]
    }
  },
  "highlighting": {
    "doc_123": {
      "content": ["Text content with <em>revolution</em> highlighted..."]
    }
  },
  "stats": {
    "document_count": 1543,
    "word_count": 234567,
    "language_distribution": {
      "french": 0.85,
      "latin": 0.15
    }
  }
}
```

#### Collection Metadata
```bash
GET /api/solr/collection_metadata?database_id={id}&collection={name}
```

**Response:**
```json
{
  "fields": [
    {
      "name": "title",
      "type": "text_general",
      "indexed": true,
      "stored": true,
      "required": false
    },
    {
      "name": "date_rdt",
      "type": "pdate",
      "indexed": true,
      "stored": true,
      "required": false
    }
  ],
  "aliases": ["historical_docs", "hist_texts"],
  "document_count": 15234,
  "last_modified": "2025-01-08T12:00:00Z"
}
```

#### Get Available Collections
```bash
GET /api/solr/aliases?database_id={id}
```

**Response:**
```json
{
  "aliases": [
    {
      "name": "historical_texts",
      "collections": ["hist_core_v1", "hist_core_v2"],
      "document_count": 15234
    },
    {
      "name": "medieval_docs",
      "collections": ["medieval_v1"],
      "document_count": 8976
    }
  ]
}
```

### 2. Text Tokenization

#### Multi-Language Tokenization
```bash
POST /api/tokenize
Content-Type: application/json

{
  "texts": [
    "This is English text to tokenize.",
    "这是中文文本需要分词处理。"
  ],
  "options": {
    "remove_stopwords": true,
    "lowercase": true,
    "min_length": 2,
    "language": "auto"
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "original": "This is English text to tokenize.",
      "tokens": ["english", "text", "tokenize"],
      "language": "en",
      "processing_time_ms": 12
    },
    {
      "original": "这是中文文本需要分词处理。",
      "tokens": ["中文", "文本", "分词", "处理"],
      "language": "zh",
      "processing_time_ms": 45
    }
  ],
  "total_processing_time_ms": 57,
  "word_frequencies": {
    "english": 1,
    "text": 1,
    "tokenize": 1,
    "中文": 1,
    "文本": 1,
    "分词": 1,
    "处理": 1
  }
}
```

### 3. Word Embeddings

#### Semantic Similarity Search
```bash
POST /api/embeddings/neighbors
Content-Type: application/json

{
  "word": "revolution",
  "k": 5,
  "solr_database_id": 1,
  "metric": "cosine"
}
```

**Parameters:**
- `word`: Target word for similarity search
- `k`: Number of similar words to return (default: 10)
- `solr_database_id`: Database context for embeddings
- `metric`: Similarity metric (`cosine`, `euclidean`, `dot_product`, `manhattan`)

**Response:**
```json
{
  "word": "revolution",
  "neighbors": [
    {
      "word": "revolt",
      "similarity": 0.8234,
      "rank": 1
    },
    {
      "word": "uprising",
      "similarity": 0.7891,
      "rank": 2
    },
    {
      "word": "rebellion",
      "similarity": 0.7654,
      "rank": 3
    },
    {
      "word": "insurrection",
      "similarity": 0.7432,
      "rank": 4
    },
    {
      "word": "transformation",
      "similarity": 0.6987,
      "rank": 5
    }
  ],
  "embedding_model": "glove_6b_50d",
  "processing_time_ms": 23
}
```

#### Batch Similarity Query
```bash
POST /api/embeddings/batch-neighbors
Content-Type: application/json

{
  "words": ["revolution", "democracy", "freedom"],
  "k": 3,
  "solr_database_id": 1,
  "metric": "cosine"
}
```

#### Word Analogies
```bash
POST /api/embeddings/analogy
Content-Type: application/json

{
  "a": "king",
  "b": "queen", 
  "c": "man",
  "solr_database_id": 1
}
```

**Response:**
```json
{
  "analogy": "king : queen :: man : ?",
  "result": "woman",
  "confidence": 0.87,
  "candidates": [
    {"word": "woman", "score": 0.87},
    {"word": "lady", "score": 0.72},
    {"word": "female", "score": 0.68}
  ]
}
```

### 4. Named Entity Recognition

#### Extract Entities from Documents
```bash
GET /api/solr/ner?database_id={id}&collection={name}&doc_ids[]={id1}&doc_ids[]={id2}
```

**Parameters:**
- `database_id`: Solr database ID
- `collection`: Collection name
- `doc_ids[]`: Array of document IDs
- `entity_types[]`: Filter by entity types (optional)
- `confidence_threshold`: Minimum confidence (0.0-1.0)

**Response:**
```json
{
  "documents": [
    {
      "doc_id": "doc_123",
      "entities": [
        {
          "text": "Napoleon Bonaparte",
          "label": "PER",
          "start_char": 145,
          "end_char": 163,
          "confidence": 0.95,
          "context": "...Emperor Napoleon Bonaparte ruled France..."
        },
        {
          "text": "France",
          "label": "LOC",
          "start_char": 171,
          "end_char": 177,
          "confidence": 0.89,
          "context": "...Napoleon Bonaparte ruled France from..."
        }
      ]
    }
  ],
  "entity_counts": {
    "PER": 45,
    "LOC": 23,
    "ORG": 12,
    "MISC": 8
  },
  "processing_time_ms": 1234
}
```

### 5. Statistical Analysis

#### Corpus Statistics
```bash
GET /api/solr/stats?database_id={id}&collection={name}&query={q}&level={stats_level}
```

**Parameters:**
- `level`: Statistics detail level (`all`, `medium`, `basic`)
- `sample_size`: Limit analysis to sample (for large corpora)
- `include_ngrams`: Include n-gram analysis
- `language_filter`: Filter by detected language

**Response:**
```json
{
  "corpus_stats": {
    "document_count": 15234,
    "total_words": 2345678,
    "unique_words": 123456,
    "average_document_length": 154.2,
    "language_distribution": {
      "french": 0.75,
      "latin": 0.20,
      "english": 0.05
    }
  },
  "word_frequencies": {
    "le": 12345,
    "de": 10987,
    "la": 9876,
    "et": 8765,
    "à": 7654
  },
  "ngram_analysis": {
    "bigrams": [
      {"text": "louis xiv", "frequency": 234},
      {"text": "ancien régime", "frequency": 189}
    ],
    "trigrams": [
      {"text": "révolution française", "frequency": 156}
    ]
  },
  "temporal_distribution": {
    "1700-1710": 234,
    "1710-1720": 456,
    "1720-1730": 678
  }
}
```

## Administration API Endpoints

### 1. User Management

#### List Users
```bash
GET /api/users?page={page}&per_page={limit}&role={role}
```

#### Create User
```bash
POST /api/users
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "secure_password",
  "roles": ["User"],
  "active": true
}
```

#### Update User
```bash
PUT /api/users/{id}
Content-Type: application/json

{
  "email": "updated@example.com",
  "roles": ["User", "Researcher"],
  "active": true
}
```

### 2. Solr Database Management

#### List Databases
```bash
GET /api/solr_databases
```

**Response:**
```json
{
  "databases": [
    {
      "id": 1,
      "name": "Historical Archive",
      "url": "user@remote-server.com",
      "server_port": 8983,
      "local_port": 8982,
      "status": "connected",
      "last_health_check": "2025-01-08T12:00:00Z",
      "collections": ["historical_texts", "medieval_docs"]
    }
  ]
}
```

#### Create Database Connection
```bash
POST /api/solr_databases
Content-Type: application/json

{
  "name": "New Archive",
  "url": "user@archive-server.com",
  "server_port": 8983,
  "local_port": 8984,
  "ssh_key_path": "/data/ssh/archive_key"
}
```

#### Test Database Connection
```bash
POST /api/solr_databases/{id}/test_connection
```

### 3. Permissions Management

#### Assign User Permissions
```bash
POST /api/user_permissions
Content-Type: application/json

{
  "user_id": 5,
  "database_id": 1,
  "permission_level": "read_write"
}
```

#### List User Roles
```bash
GET /api/user_roles?user_id={id}
```

## System Monitoring Endpoints

### Health Check
```bash
GET /api/health
```

**Response:**
```
OK
```

Simple text response indicating the service is running.

### System Statistics
```bash
GET /api/stats
```

**Response:**
```json
{
  "system": {
    "memory_usage": "2.4GB / 8.0GB",
    "cpu_usage": "15%",
    "disk_usage": "45GB / 100GB"
  },
  "application": {
    "active_users": 23,
    "total_requests_today": 5678,
    "cache_hit_rate": 0.87,
    "average_response_time_ms": 234
  },
  "database": {
    "total_documents": 234567,
    "total_users": 145,
    "total_databases": 8
  }
}
```

### Cache Management
```bash
# Clear embeddings cache (admin only)
POST /api/embeddings/clear
```

**Note:** Only embeddings cache clearing is currently implemented. Other cache operations are not available via API.

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "The search query contains invalid syntax",
    "details": {
      "field": "q",
      "value": "invalid[query",
      "expected": "valid Solr query syntax"
    },
    "timestamp": "2025-01-08T12:00:00Z",
    "request_id": "req_123456789"
  }
}
```

### Common Error Codes
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `AUTHORIZATION_DENIED`: Insufficient permissions
- `INVALID_QUERY`: Malformed search query
- `DATABASE_CONNECTION_ERROR`: Cannot connect to Solr
- `PROCESSING_TIMEOUT`: Operation exceeded time limit
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_SERVER_ERROR`: Unexpected server error

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Unprocessable Entity
- `429`: Too Many Requests
- `500`: Internal Server Error
- `503`: Service Unavailable

## Performance Considerations

### Request Limits
- Request timeouts apply to long-running queries
- Large dataset queries may take significant time
- Consider using smaller batch sizes for better responsiveness

### Response Caching
- Query results are cached when `ENABLE_QUERY_CACHE=true`
- Cache TTL configured via `CACHE_TTL_SECONDS`
- Embeddings are cached for performance

## Interactive Documentation

### Swagger UI
Access comprehensive, interactive API documentation at:
- **URL**: `http://localhost:3000/swagger-ui`
- **Authentication**: Basic auth (configured in environment)
- **Features**: Interactive testing, schema documentation, example requests/responses

### API Specifications
- **User API**: `/api/openapi/users.json`
- **Solr API**: `/api/openapi/solr.json`
- **HistText API**: `/api/openapi/histtext.json`

This API reference provides the foundation for building applications on top of HistText's powerful text analysis capabilities.