![Latest Release](https://img.shields.io/github/v/release/BaptisteBlouin/HistText?label=version) ![License: Dual](https://img.shields.io/badge/License-Dual-blue)

# HistText - Advanced Historical Text Analysis Platform

HistText is a comprehensive web application for large-scale historical text analysis and digital humanities research. Built with Rust and React, it provides powerful tools for searching, analyzing, and visualizing patterns in historical document collections.

## Features

### **Advanced Text Search & Analysis**
- **Multi-database text search** with Apache Solr integration
- **Dynamic query building** based on collection metadata
- **Boolean search operators** (AND, OR, NOT) with field-specific targeting
- **Date range filtering** with automatic date field detection
- **Real-time search results** with pagination and sorting
- **Cross-database search** capabilities

### **Natural Language Processing**
- **Named Entity Recognition (NER)** with 19+ entity types (Person, Location, Organization, etc.)
- **Multi-language tokenization** with specialized Chinese text processing
- **Word embeddings integration** for semantic similarity search
- **Statistical text analysis** with frequency distributions and pattern detection
- **Language detection** and processing optimization

### **Data Visualization & Analytics**
- **Interactive word clouds** with customizable styling
- **Advanced NER analytics** including entity relationships and co-occurrence analysis
- **Statistical dashboards** with corpus-wide metrics
- **Timeline analysis** for temporal entities
- **Network visualization** for entity relationships
- **Performance monitoring** and system analytics

### **User Management & Security**
- **Role-based access control** (Admin, User roles)
- **JWT authentication** with automatic token refresh
- **Permission-based collection access**
- **User registration, activation, and password recovery**
- **Security event logging** and audit trails

### **Administration Tools**
- **Database management** for multiple Solr instances
- **SSH tunnel support** for secure remote connections
- **Real-time system monitoring** and performance metrics
- **API documentation** with interactive Swagger UI
- **Cache management** and optimization tools

## Technology Stack

- **Backend**: Rust (Actix Web) with PostgreSQL and Apache Solr
- **Frontend**: React TypeScript with Material-UI and Vite
- **NLP**: Jieba (Chinese text processing), Word2Vec/FastText embeddings, Python toolkit with spaCy/Transformers support
- **Deployment**: Docker Compose with multi-service orchestration

## Quick Start with Docker (Recommended)

### Prerequisites
- Docker (23.0+) and Docker Compose (2.0+)
- 4GB+ RAM recommended
- 10GB+ free disk space

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BaptisteBlouin/HistText.git
   cd HistText
   ```

2. **Create data directories**
   ```bash
   mkdir -p data/{postgres,solr,histtext-tmp,ssh,embeddings}
   chmod 1000:1000 data/solr  # Solr permissions
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings (database credentials, secrets, etc.)
   ```

4. **Start the application**
   ```bash
   docker-compose up -d
   ```

5. **Access the application**
   - **Web Interface**: http://localhost:3000
   - **API Documentation**: http://localhost:3000/swagger-ui
   - **Solr Admin**: http://localhost:8982/solr

### Default Login
- **Username**: `admin`
- **Password**: `admin`

⚠️ **Change the default password immediately after first login**

## Manual Development Setup

### Prerequisites
- Rust 1.85+ with Cargo
- Node.js 18+ and npm
- PostgreSQL 16+
- Apache Solr 9.8+
- Diesel CLI: `cargo install diesel_cli --no-default-features --features postgres`

### Setup Steps

#### System Requirements

**Operating System Support:**
- Ubuntu 20.04+ / Debian 11+
- CentOS 8+ / RHEL 8+
- macOS 12+
- Windows 11 with WSL2

**Dependencies:**
```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update stable

# Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install postgresql postgresql-contrib libpq-dev

# Apache Solr
wget https://downloads.apache.org/lucene/solr/9.4.1/solr-9.4.1.tgz
tar xzf solr-9.4.1.tgz
sudo mv solr-9.4.1 /opt/solr
sudo chown -R solr:solr /opt/solr

# System tools
sudo apt-get install build-essential pkg-config openssl libssl-dev
cargo install diesel_cli --no-default-features --features postgres
```

#### Manual Installation Steps

**1. Database Setup**
```bash
# Create PostgreSQL user and database
sudo -u postgres createuser histtext
sudo -u postgres createdb historicaltext -O histtext
sudo -u postgres psql -c "ALTER USER histtext PASSWORD 'secure_password';"

# Configure PostgreSQL
sudo nano /etc/postgresql/15/main/postgresql.conf
# Listen on all addresses: listen_addresses = '*'

sudo nano /etc/postgresql/15/main/pg_hba.conf
# Add: host historicaltext histtext 0.0.0.0/0 md5

sudo systemctl restart postgresql
```

**2. Solr Setup**
```bash
# Create Solr user
sudo useradd -r -s /bin/false solr

# Start Solr
sudo -u solr /opt/solr/bin/solr start -p 8983

# Create NER core
sudo -u solr /opt/solr/bin/solr create -c ner -p 8983

# Configure Solr for HistText
sudo -u solr /opt/solr/bin/solr config -c ner -p 8983 -action set-property -property requestHandler.max-content-length:100000000
```

**3. Application Setup**
```bash
# Clone and build
git clone https://github.com/BaptisteBlouin/HistText.git
cd HistText

# Configure environment
cp .env.example app/.env
nano app/.env  # Edit configuration

# Build frontend
cd app/frontend
npm install
npm run build

# Run database migrations
diesel migration run

# Initialize admin user
cargo run --release --bin script

# Build backend
cd ..
cargo build --release
```

## Core Workflows

### 1. Text Analysis Workflow
1. **Select Database**: Choose from configured Solr collections
2. **Build Query**: Use dynamic form to construct search parameters
3. **Execute Search**: Run query with optional NER and statistics
4. **Analyze Results**: Use 6-tab interface for comprehensive analysis:
   - **Query**: Search form and parameters
   - **Partial Results**: First batch preview
   - **All Results**: Complete dataset
   - **Statistics**: Corpus analytics
   - **Word Cloud**: Visual frequency analysis
   - **NER**: Named entity analysis with advanced features

### 2. Administrative Tasks
1. **User Management**: Create users, assign roles, manage permissions
2. **Database Configuration**: Add Solr instances, configure SSH tunnels
3. **System Monitoring**: View performance metrics and system health
4. **API Management**: Access interactive documentation and testing

### 3. NER Analysis Deep Dive
- **Entity Extraction**: Identify 19+ entity types in documents
- **Relationship Analysis**: Discover co-occurrence patterns
- **Timeline Analysis**: Track entities across time periods
- **Network Visualization**: Explore entity connections
- **Advanced Analytics**: Centrality scores and influence analysis

## API Overview

### Core Endpoints
- `GET /api/solr/query` - Advanced document search
- `POST /api/tokenize` - Multi-language text tokenization
- `POST /api/embeddings/neighbors` - Semantic similarity search
- `GET /api/solr/ner` - Named entity recognition
- `GET /api/solr/stats` - Statistical analysis

### Authentication
All API endpoints use JWT Bearer token authentication:
```bash
curl -H "Authorization: Bearer <token>" \
     -X GET "http://localhost:3000/api/solr/query?..."
```

### Interactive Documentation
Visit http://localhost:3000/swagger-ui for complete API documentation with testing interface.

## Configuration

### Environment Variables
Key configuration options in `.env`:

```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/historicaltext

# Solr
SOLR_NER_PORT=8982

# Security
SECRET_KEY=your-secure-random-key-here

# Storage
PATH_STORE_FILES=/data/histtext-tmp
EMBED_PATH=/data/embeddings/glove.6B.50d.txt

# Features
MAX_SIZE_QUERY=20000
MAX_EMBEDDINGS_FILES=3
```

### SSH Tunneling
Configure remote Solr access via SSH tunnels:
1. Add entries to `solr_databases` table
2. Place SSH keys in `data/ssh/` (Docker) or `~/.ssh/` (manual)
3. Application automatically establishes tunnels on startup

## Performance & Scaling

### Optimization Features
- **Multi-level caching** for embeddings, NER results, and metadata
- **Parallel processing** for CPU-intensive text analysis
- **Chunked processing** for large datasets (15,000+ entities)
- **Connection pooling** for database operations
- **Memory management** for GPU-intensive NLP operations

### System Requirements
- **Minimum**: 4GB RAM, 2 CPU cores, 10GB storage
- **Recommended**: 8GB+ RAM, 4+ CPU cores, 50GB+ storage
- **Large corpora**: 16GB+ RAM, 8+ CPU cores, 100GB+ storage

## Development

### Running in Development Mode
```bash
# Backend with auto-reload
cargo watch -x 'run --bin HistTextWeb' -i frontend/

# Frontend with hot reload
cd app/frontend && npm start

# Both services via Docker
docker-compose up
```

### Key Commands
```bash
# Database migrations
diesel migration generate <name>
diesel migration run

# Code formatting
cd app/frontend && npm run format

# Linting
cd app/frontend && npm run lint

# Testing
cd app/frontend && npx playwright test
```

## Documentation

- **API Reference**: Interactive Swagger UI at `/swagger-ui`
- **Admin Guide**: `docs/admin_setup/`
- **Backend Docs**: `docs/backend/`
- **Database Schema**: `docs/database/`

## License

This project is available under a dual license:
- **Free** for individuals and European public institutions (non-commercial use)
- **Commercial license** required for private organizations and non-European public institutions

See `LICENSE.md` for complete terms.

## Support & Contributing

- **Issues**: Report bugs and request features via GitHub Issues
- **Documentation**: See `docs/` directory for comprehensive guides
- **Contributing**: Follow standard GitHub workflow with pull requests

## About

HistText is developed by the ENP-China project with support from the European Research Council (ERC) Proof of Concept program. The platform bridges traditional historical scholarship with modern computational text analysis techniques.

**Current Version**: 2.0.0 (June 2025)

---

For detailed setup instructions, troubleshooting, and advanced configuration, see the documentation in the `docs/` directory.