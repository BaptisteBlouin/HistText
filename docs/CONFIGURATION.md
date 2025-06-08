# HistText Configuration Reference

## Overview

HistText uses environment variables for configuration following the [12-Factor App](https://12factor.net/) methodology. This document provides complete documentation for all configuration options based on the actual implementation.

## Configuration Files

### Primary Configuration
- **`.env`**: Main environment configuration file
- **`docker-compose.yml`**: Docker-specific environment overrides
- **`app/.env`**: Application-specific environment (manual setup)

### Configuration Precedence (highest to lowest)
1. Docker Compose environment variables
2. System environment variables
3. `.env` file variables
4. Application defaults

## Core Environment Variables

### Required Variables

These variables MUST be set for the application to start:

```bash
# Database connection string
DATABASE_URL=postgres://user:password@host:port/database

# Security key for token signing and password hashing
SECRET_KEY=your-256-bit-secret-key-here

# Word embeddings file path
EMBED_PATH=/data/embeddings/glove.6B.50d.txt

# Solr port for NER and document indexing
SOLR_NER_PORT=8982

# Query limits
MAX_SIZE_QUERY=20000
MAX_SIZE_DOCUMENT=50
MAX_ID_NER=1000

# Cache file paths
STATS_CACHE_PATH=/data/histtext-tmp/stats_cache.json
NER_CACHE_PATH=/data/histtext-tmp/ner_cache.json
PATH_STORE_FILES=/data/histtext-tmp

# Metadata configuration
MAX_METADATA_SELECT=50
EXCLUDE_FIELD_TYPES=text_general,text_normalized_cjk,integer
EXCLUDE_FIELD_NAMES=date_rdt
EXCLUDE_FIELD_NAME_PATTERNS=wke_,wk_
MAIN_DATE_VALUE=date_rdt

# Application URL
APP_URL=http://localhost:3000

# OpenAPI documentation settings
DO_OPENAPI=true
OPENAPI_LOGIN=openapi
OPENAPI_PWD=openapi
```

### Optional Variables with Defaults

These variables have default values and can be omitted:

```bash
# Field exclusion patterns (defaults to empty)
EXCLUDE_REQUEST_NAME_STARTS_WITH=
EXCLUDE_REQUEST_NAME_ENDS_WITH=
ID_STARTS_WITH=
ID_ENDS_WITH=

# Size limits (defaults in parentheses)
MAX_QUERY_SIZE_MB=10          # Maximum query JSON payload in MB
MAX_DOCUMENT_SIZE_MB=128      # Maximum document upload in MB
MAX_EMBEDDINGS_FILES=3        # Maximum embedding files in cache

# Email/SMTP settings (defaults for disabled email)
SMTP_SERVER=localhost
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_ADDRESS=no-reply@example.com
SEND_MAIL=false

# Cache configuration
CACHE_TTL_SECONDS=3600        # Cache time-to-live in seconds
MAX_CACHE_SIZE=1000           # Maximum cache entries
ENABLE_QUERY_CACHE=true       # Enable query result caching
ENABLE_RESPONSE_STREAMING=false # Enable response streaming
```

## Configuration Sections

### Database Configuration

#### PostgreSQL Connection
```bash
# Complete connection string (recommended)
DATABASE_URL=postgres://user:password@host:port/database

# Examples:
# Docker: DATABASE_URL=postgres://histtext:password@postgres:5432/historicaltext
# Local:  DATABASE_URL=postgres://histtext:password@localhost:5432/historicaltext
```

**Security Notes:**
- Generate SECRET_KEY with: `openssl rand -hex 32`
- Use strong, unique passwords
- Store secrets securely in production

### Solr Configuration

```bash
# Solr port for NER and document indexing
SOLR_NER_PORT=8982  # Docker default
# SOLR_NER_PORT=8983  # Manual setup default

# Field filtering configuration
EXCLUDE_FIELD_TYPES=text_general,text_normalized_cjk,integer
EXCLUDE_FIELD_NAMES=date_rdt,_version_,timestamp
EXCLUDE_FIELD_NAME_PATTERNS=wke_,wk_,_dyn_,temp_

# Document ID field identification
ID_STARTS_WITH=id,doc_id,document
ID_ENDS_WITH=id,_id

# Primary date field for timeline analysis
MAIN_DATE_VALUE=date_rdt
```

### File Storage Configuration

```bash
# Primary storage directory
PATH_STORE_FILES=/data/histtext-tmp

# Cache file locations
STATS_CACHE_PATH=/data/histtext-tmp/stats_cache.json
NER_CACHE_PATH=/data/histtext-tmp/ner_cache.json

# Word embeddings file path
EMBED_PATH=/data/embeddings/glove.6B.50d.txt
```

### Processing Limits

```bash
# Query and processing limits
MAX_SIZE_QUERY=20000           # Maximum documents per query
MAX_SIZE_DOCUMENT=50           # Maximum characters for preview
MAX_ID_NER=1000               # Maximum NER IDs per batch
MAX_METADATA_SELECT=50         # Maximum metadata fields in UI

# Request size limits (in MB)
MAX_QUERY_SIZE_MB=10          # Maximum JSON payload size
MAX_DOCUMENT_SIZE_MB=128      # Maximum document upload size

# Embeddings cache
MAX_EMBEDDINGS_FILES=3        # Maximum embedding files to cache
```

### Email Configuration (Optional)

```bash
# Enable/disable email features
SEND_MAIL=true

# SMTP server configuration
SMTP_SERVER=smtp.gmail.com
SMTP_USERNAME=your-email@domain.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_ADDRESS=histtext@yourdomain.com
```

**Email Behavior:**
- If `SEND_MAIL=false` or SMTP not configured, user accounts are auto-activated
- If `SEND_MAIL=true` and SMTP configured, activation emails are sent

### API Documentation Configuration

```bash
# Enable API documentation
DO_OPENAPI=true

# Swagger UI authentication
OPENAPI_LOGIN=openapi
OPENAPI_PWD=secure_password_here
```

### Performance Configuration

```bash
# Caching settings
CACHE_TTL_SECONDS=3600        # Cache time-to-live
MAX_CACHE_SIZE=1000           # Maximum cache entries
ENABLE_QUERY_CACHE=true       # Enable query result caching
ENABLE_RESPONSE_STREAMING=false # Enable response streaming
```

## Environment Templates

### Development `.env` Template
```bash
# Database
DATABASE_URL=postgres://histtext:password@localhost:5432/historicaltext

# Security
SECRET_KEY=dev-secret-key-change-in-production

# Solr
SOLR_NER_PORT=8983

# Storage
PATH_STORE_FILES=/tmp/histtext-dev
STATS_CACHE_PATH=/tmp/histtext-dev/stats_cache.json
NER_CACHE_PATH=/tmp/histtext-dev/ner_cache.json
EMBED_PATH=/data/embeddings/glove.6B.50d.txt

# Limits
MAX_SIZE_QUERY=20000
MAX_SIZE_DOCUMENT=50
MAX_ID_NER=1000
MAX_METADATA_SELECT=50

# Field configuration
EXCLUDE_FIELD_TYPES=text_general,text_normalized_cjk,integer
EXCLUDE_FIELD_NAMES=date_rdt
EXCLUDE_FIELD_NAME_PATTERNS=wke_,wk_
MAIN_DATE_VALUE=date_rdt

# Application
APP_URL=http://localhost:3000

# API Documentation
DO_OPENAPI=true
OPENAPI_LOGIN=openapi
OPENAPI_PWD=openapi

# Email (disabled for development)
SEND_MAIL=false
```

### Production `.env` Template
```bash
# Database
DATABASE_URL=postgres://histtext:${DB_PASSWORD}@postgres:5432/historicaltext

# Security
SECRET_KEY=${SECRET_KEY}

# Solr
SOLR_NER_PORT=8982

# Storage
PATH_STORE_FILES=/data/histtext-tmp
STATS_CACHE_PATH=/data/histtext-tmp/stats_cache.json
NER_CACHE_PATH=/data/histtext-tmp/ner_cache.json
EMBED_PATH=/data/embeddings/glove.6B.50d.txt

# Limits (production values)
MAX_SIZE_QUERY=20000
MAX_SIZE_DOCUMENT=50
MAX_ID_NER=1000
MAX_METADATA_SELECT=50

# Field configuration
EXCLUDE_FIELD_TYPES=text_general,text_normalized_cjk,integer
EXCLUDE_FIELD_NAMES=date_rdt
EXCLUDE_FIELD_NAME_PATTERNS=wke_,wk_
MAIN_DATE_VALUE=date_rdt

# Application
APP_URL=https://your-domain.com

# API Documentation
DO_OPENAPI=true
OPENAPI_LOGIN=openapi
OPENAPI_PWD=secure_production_password

# Email (enabled for production)
SEND_MAIL=true
SMTP_SERVER=${SMTP_SERVER}
SMTP_USERNAME=${SMTP_USERNAME}
SMTP_PASSWORD=${SMTP_PASSWORD}
SMTP_FROM_ADDRESS=histtext@your-domain.com

# Performance
CACHE_TTL_SECONDS=3600
MAX_CACHE_SIZE=1000
ENABLE_QUERY_CACHE=true
```

### Docker Compose Environment
```bash
# Override for Docker Compose
DATABASE_URL=postgres://histtext:password@postgres:5432/historicaltext
SOLR_NER_PORT=8982
PATH_STORE_FILES=/data/histtext-tmp
STATS_CACHE_PATH=/data/histtext-tmp/stats_cache.json
NER_CACHE_PATH=/data/histtext-tmp/ner_cache.json
```

## Configuration Validation

### Required Variables
The application will fail to start without these variables:
- `DATABASE_URL`
- `SECRET_KEY`
- `EMBED_PATH`
- `SOLR_NER_PORT`
- `MAX_SIZE_QUERY`
- `MAX_SIZE_DOCUMENT`
- `MAX_ID_NER`
- `STATS_CACHE_PATH`
- `NER_CACHE_PATH`
- `PATH_STORE_FILES`
- `MAX_METADATA_SELECT`
- `EXCLUDE_FIELD_TYPES`
- `EXCLUDE_FIELD_NAMES`
- `EXCLUDE_FIELD_NAME_PATTERNS`
- `MAIN_DATE_VALUE`
- `APP_URL`
- `DO_OPENAPI`
- `OPENAPI_LOGIN`
- `OPENAPI_PWD`

### Validation on Startup
The application validates configuration on startup and will:
- Exit with error for missing required variables
- Log warnings for misconfigured optional variables
- Validate database connectivity
- Check file path permissions
- Verify Solr connectivity

## Security Considerations

### Secrets Management
- Use environment-specific secret management
- Rotate secrets regularly
- Use strong, random values for `SECRET_KEY`
- Never commit secrets to version control

### File System Security
- Set appropriate file permissions (600 for secrets)
- Use dedicated service accounts
- Mount secrets as read-only volumes in containers

### Network Security
- Configure firewall rules for services
- Use HTTPS in production
- Restrict database access to application only

This configuration reference reflects the actual implementation and ensures reliable deployment across different environments.