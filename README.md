# HistText

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-Dual%20License-orange.svg)

HistText is a Rust/TypeScript web application for historical text analysis, built with a PostgreSQL database and Solr for search functionality. This README provides detailed instructions for setting up and running the application both with and without Docker.

## License

This project is available under a dual license:
- Free for individuals and European public institutions
- Commercial license required for private organizations and non-European public institutions

See the [LICENSE.md](LICENSE.md) file for details.

## Documentation

The HistText project includes comprehensive documentation for all its components. For detailed information, please refer to the `docs/` directory where you'll find:

- **API Documentation**: OpenAPI specifications for all services (`docs/api/`)
- **Administrator Guide**: Setup and configuration instructions (`docs/admin_setup/`)
- **Backend Documentation**: Complete Rust backend API reference (`docs/backend/HistTextWeb/`)
- **Database Schema**: Details about tables, relationships, and data model (`docs/database/`)
- **Python Toolkit**: Documentation for the Python components (`docs/toolkit/`)

Each documentation section provides specific guidance for different user roles including administrators, developers, and data scientists working with the system.

For a complete overview of all documentation resources, see the documentation index at `docs/README.md`.

## Table of Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Installation](#installation)
  - [Using Docker (Recommended)](#using-docker-recommended)
  - [Manual Installation](#manual-installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [SSH Tunneling](#ssh-tunneling-optional)
- [Usage](#usage)
  - [Admin Interface](#admin-interface)
  - [API Access](#api-access)
- [Running as a Service](#running-as-a-service)
  - [Manual Installation Service Setup](#manual-installation-service-setup)
  - [Docker Service Setup](#docker-service-setup)
- [Development](#development)
  - [Docker Development Mode](#docker-development-mode)
  - [Local Development Mode](#local-development-mode)
  - [Database Migrations](#database-migrations)
  - [Testing](#testing)
- [Troubleshooting](#troubleshooting)
  - [Docker Issues](#docker-issues)
  - [Manual Setup Issues](#manual-setup-issues)

## Overview

HistText is a comprehensive platform for analyzing and managing historical texts. It provides:

- Text storage and management through a web interface
- Full-text search powered by Solr with advanced filtering capabilities
- Named entity recognition (NER) for historical texts
- User authentication and authorization with role-based access control
- Statistical analysis of text corpora with data visualization
- RESTful API access with OpenAPI documentation
- Document versioning and change tracking
- Metadata management for historical documents
- Support for large text collections with efficient indexing
- Customizable search fields and facets

The application consists of:
- Backend: Rust with create-rust-app framework
- Frontend: TypeScript/React
- Database: PostgreSQL for relational data storage
- Search: Apache Solr for text search and NER storage
- Storage: Local file system or S3-compatible object storage
- Email: SMTP integration for notifications and user management
- Toolkit: To interact between text data and NLP

## Requirements

### For Docker Setup
- Docker (23.0.x or newer)
- Docker Compose (2.x or newer) 
- Git
- System resources:
  -RAM: Minimum 1GB allocated to Docker, recommended 4GB+
  - PostgreSQL: > 50MB depending on database size
  - Solr: > 750MB depending on index size
  - Rust application: > 105MB depending on the usage
- Disk space:
  - Base installation: ~7GB
  - PostgreSQL data: > 50MB (grows with database size)
  - Solr indexes: > 1Mo (grows with index size)
  - Application data: > 1Mo (epending on the usage)
- Total recommended: At least 10GB free space for production use


CPU: Minimum 2 cores, recommended 4+ cores for better performance


Network connectivity

### For Manual Setup
- Rust (1.85 or newer)
- Cargo and Rustup
- Node.js (18.x or newer) and npm
- PostgreSQL (16.8 or newer)
- Apache Solr (9.8.1 or newer)
- Diesel CLI (`cargo install diesel_cli --no-default-features --features postgres`)
- libpq-dev (PostgreSQL development libraries)
- OpenSSH client (for SSH tunneling)
- A C compiler (gcc/clang) for building native dependencies

## Installation

### Using Docker (Recommended)

The Docker setup makes it easy to get started without installing all dependencies separately. It handles PostgreSQL, Solr, and the application itself in a containerized environment.

#### 1. Clone the Repository

```bash
git clone https://github.com/BaptisteBlouin/hisstext.git
cd histtext
```

#### 2. Prepare the Directory Structure

```bash
# Create necessary directories
mkdir -p data/postgres data/solr data/histtext-tmp data/ssh data/embeddings 
```

#### 3. Set Up Environment Variables

Copy the example .env file and modify it according to your needs:

```bash
cp .env.example .env
```

Make sure to update the following in your .env file:
- `DATABASE_URL=postgres://user:password@postgres:5432/databasename` (for Docker use) `DATABASE_URL=postgres://user:password@localhost:5432/databasename` (for local use)
- `SECRET_KEY` (set to a secure random string for production use)
- `SMTP_*` settings for email functionality
- Other credentials and paths as needed

For Docker deployment, make sure any paths (like EMBED_PATH) point to directories inside the container or to mounted volumes.

#### 4. Start the Docker Containers

```bash
docker-compose up
```

Or to run in the background:

```bash
docker-compose up -d
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

### Manual Installation

If you prefer to run components individually, follow these steps:

#### 1. Clone the Repository

```bash
git clone https://github.com/BaptisteBlouin/hisstext.git
cd histtext
```

#### 2. Set Up PostgreSQL

Install PostgreSQL, then create the database:

```bash
sudo -u postgres psql
CREATE USER histtext WITH PASSWORD 'yourpassword';
CREATE DATABASE historicaltext OWNER histtext;
\q
```

#### 3. Set Up Solr

Install Apache Solr and create a core for the application:

```bash
# Download and extract Solr
wget https://downloads.apache.org/lucene/solr/9.8.1/solr-9.8.1.tgz
tar xzf solr-9.8.1.tgz
cd solr-9.8.1

# Start Solr and create a core
bin/solr start
bin/solr create -c ner
```

#### 4. Set Up Environment Variables

Copy the example .env file and modify it:

```bash
cp .env.example app/.env
```

Update the following variables:
- `DATABASE_URL=postgres://histtext:yourpassword@localhost:5432/historicaltext` (for local use)
- `SOLR_NER_PORT=8983` (default Solr port)
- Update other settings as needed

#### 5. Set Up the Database Schema

Run the database migrations:

```bash
cargo install diesel_cli --no-default-features --features postgres
diesel migration run
```

#### 6. Install Frontend Dependencies

```bash
cd frontend
npm install
```

#### 7. Build the Application

```bash
# In the root directory
cargo build --release
```

#### 8. Run the Initialization Script

This creates the admin user and necessary permissions:

```bash
./target/release/script
```

#### 8. Run the Initialization Script

This creates the admin user and necessary permissions:

```bash
# Build and run the initialization script
cargo build --release
./target/release/script
```

The script performs the following tasks:
- Initializes the Argon2 password hashing configuration (using the `SECRET_KEY` from `.env`)
- Generates cryptographically secure random salts for password hashing
- Creates an admin user with default credentials (admin/admin) if it doesn't exist
- Securely hashes the admin password using Argon2id
- Configures the "Admin" role for the admin user
- Sets up role permissions for the admin user
- Creates necessary database entries for the application to function properly

This script must be run at least once before starting the application. For security in production environments, you should change the admin password after the first login.

#### 9. Start the Application

Start the frontend and backend separately:

```bash
# Start the frontend (in the frontend directory)
cd frontend
npm start

# In another terminal, start the backend (in the root directory)
cargo run --release --bin HistTextWeb
```

## Configuration

### Environment Variables 

The application is configured through environment variables in the `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_LOG` | Logging level (debug, info, warn, error) | `debug` |
| `SECRET_KEY` | Secret key for session encryption and Argon2 hashing | `secretkey` |
| `POSTGRES_USER` | PostgreSQL username | `user` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `password` |
| `POSTGRES_DB` | PostgreSQL database name | `databasename` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:password@localhost/databasename` |
| `RUST_BACKTRACE` | Enable detailed backtraces | `1` |
| `APP_URL` | Application URL | `http://localhost:3000` |
| `DEV_PORT` | Development port | `60012` |
| `GOOGLE_OAUTH2_CLIENT_ID` (not mandatory) | Google OAuth client ID | `abc` |
| `GOOGLE_OAUTH2_CLIENT_SECRET` (not mandatory) | Google OAuth client secret | `123` |
| `SMTP_FROM_ADDRESS` (not mandatory) | From address for emails | `histtext@testmail.com` |
| `SMTP_SERVER` (not mandatory) | SMTP server address | `smtp.testmail.com` |
| `SMTP_USERNAME` (not mandatory) | SMTP username | `histtext@testmail.com` |
| `SMTP_PASSWORD` (not mandatory) | SMTP password | `password` |
| `SEND_MAIL` (not mandatory) | Enable email sending | `true` |
| `S3_HOST` (not mandatory) | S3 host URL | `http://localhost:9000` |
| `S3_REGION` (not mandatory) | S3 region | `minio` |
| `S3_BUCKET` (not mandatory) | S3 bucket name | `bucket` |
| `S3_ACCESS_KEY_ID` (not mandatory) | S3 access key | `access_key` |
| `S3_SECRET_ACCESS_KEY` (not mandatory) | S3 secret key | `secret_key` |
| `MAX_SIZE_QUERY` | Maximum size for queries | `20000` |
| `MAX_SIZE_DOCUMENT` | Maximum concordance document size | `50` |
| `MAX_ID_NER` | Maximum NER IDs | `1000` |
| `MAX_METADATA_SELECT` | Maximum metadata selections | `50` |
| `PATH_STORE_FILES` | Path to store temporary files | `/data/histtext-tmp` |
| `STATS_CACHE_PATH` | Path to statistics cache | `/data/histtext-tmp/stats_cache.json` |
| `NER_CACHE_PATH` | Path to NER cache | `/data/histtext-tmp/ner_cache.json` |
| `EMBED_PATH` | Path to the `default` word embeddings file | `/data/Embeddings/glove.6B.50d.txt` |
| `MAX_EMBEDDINGS_FILES` | Maximum number of embedding to cache simultaneously | `3` |
| `SOLR_NER_PORT` | Port for Solr NER service | `8982` |
| `EXCLUDE_FIELD_TYPES` | Field types to exclude | `text_general,text_normalized_cjk,integer` |
| `EXCLUDE_FIELD_NAMES` | Field names to exclude | `date_rdt` |
| `EXCLUDE_FIELD_NAME_PATTERNS` | Field name patterns to exclude | `wke_,wk_` |
| `EXCLUDE_REQUEST_NAME_STARTS_WITH` | Request name prefix to exclude | `_` |
| `EXCLUDE_REQUEST_NAME_ENDS_WITH` | Request name suffix to exclude | `_` |
| `ID_STARTS_WITH` | ID prefix | `id` |
| `ID_ENDS_WITH` | ID suffix | `id` |
| `MAIN_DATE_VALUE` | Main date field | `date_rdt` |
| `DO_OPENAPI` | Enable OpenAPI documentation | `true` |
| `OPENAPI_LOGIN` | Username for OpenAPI docs | `openapi` |
| `OPENAPI_PWD` | Password for OpenAPI docs | `openapi` |

### SSH Tunneling 

The application supports SSH tunneling for secure connections to remote solr and services. This is particularly useful for connecting to Solr instances running on remote servers.

To configure SSH tunnels:

1. Ensure SSH keys are set up:
   - For Docker: Place your SSH keys in `data/ssh/` (id_rsa, id_rsa.pub, etc.)
   - For manual installation: Use your system's SSH keys

2. Configure tunnels in the `solr_databases` table with:
   - `name`: A descriptive name for the database/service
   - `url`: SSH host (e.g., `user@remote-server`)
   - `server_port`: Remote port (the port on the remote server)
   - `local_port`: Local port (the port to expose locally)
   - `created_at`: Timestamp (auto-filled)

Example SQL to add a tunnel:

```sql
INSERT INTO solr_databases (name, url, server_port, local_port, created_at)
VALUES ('remote-solr', 'user@remote-server', 8983, 8982, NOW());
```

The application will automatically establish SSH tunnels for each entry in this table when it starts. You can then access the remote service at `localhost:local_port`.

## Usage

### Admin Interface

After installation, you can access the admin interface at `http://localhost:3000/admin` with the following credentials:
- Username: `admin`
- Password: `admin`

It's recommended to change the admin password after the first login.

### API Access

The application provides a RESTful API for programmatic access.

OpenAPI documentation is available at `http://localhost:3000/swagger-ui` when `DO_OPENAPI=true` in your .env file. Access the documentation using:
- Username: Value of `OPENAPI_LOGIN` from your .env file (default: `openapi`)
- Password: Value of `OPENAPI_PWD` from your .env file (default: `openapi`)


## Running as a Service

### Manual Installation Service Setup

To run HistText as a system service on Linux using systemd, follow these steps:

#### 1. Create a Service User (Optional but Recommended)

```bash
sudo useradd -r -s /bin/false histtext
```

#### 2. Create a Systemd Service File

Create a systemd service file at `/etc/systemd/system/histtext.service`:

```bash
sudo nano /etc/systemd/system/histtext.service
```

Add the following content, adjusting paths as needed:

```ini
[Unit]
Description=HistText Service
After=network.target postgresql.service

[Service]
Type=simple
User=histtext
WorkingDirectory=/path/to/histtext
EnvironmentFile=/path/to/histtext/.env
ExecStart=/path/to/histtext/target/release/HistText
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=histtext

# Optional security enhancements
#CapabilityBoundingSet=
#AmbientCapabilities=
#NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

#### 3. Create a Frontend Service (Optional)

If you want to run the frontend as a separate service:

```bash
sudo nano /etc/systemd/system/histtext-frontend.service
```

Add the following content:

```ini
[Unit]
Description=HistText Frontend Service
After=network.target

[Service]
Type=simple
User=histtext
WorkingDirectory=/path/to/histtext/frontend
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=histtext-frontend

[Install]
WantedBy=multi-user.target
```

#### 4. Enable and Start the Services

```bash
# Reload systemd to recognize the new service files
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable histtext.service
sudo systemctl enable histtext-frontend.service

# Start the services
sudo systemctl start histtext.service
sudo systemctl start histtext-frontend.service

# Check status
sudo systemctl status histtext.service
sudo systemctl status histtext-frontend.service
```

#### 5. View Logs

```bash
# View logs for the backend service
sudo journalctl -u histtext.service -f

# View logs for the frontend service
sudo journalctl -u histtext-frontend.service -f
```

### Docker Service Setup

When using Docker, you can set up HistText to run as a service using Docker's built-in mechanisms.

#### 1. Create a Systemd Service for Docker Compose

Create a systemd service file at `/etc/systemd/system/histtext-docker.service`:

```bash
sudo nano /etc/systemd/system/histtext-docker.service
```

Add the following content, adjusting paths as needed:

```ini
[Unit]
Description=HistText Docker Service
Requires=docker.service
After=docker.service

[Service]
Type=simple
WorkingDirectory=/path/to/histtext
ExecStart=/usr/bin/docker-compose up
ExecStop=/usr/bin/docker-compose down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 2. Enable and Start the Docker Service

```bash
# Reload systemd to recognize the new service file
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable histtext-docker.service

# Start the service
sudo systemctl start histtext-docker.service

# Check status
sudo systemctl status histtext-docker.service
```

#### 3. Alternative: Docker Swarm for Production

For a more robust production setup, you can use Docker Swarm:

```bash
# Initialize Docker Swarm
docker swarm init

# Deploy the stack
docker stack deploy -c docker-compose.yml histtext

# Check the services
docker service ls

# Scale services if needed
docker service scale histtext_app=2
```

#### 4. Automatic Container Restart

Ensure your `docker-compose.yml` includes restart policies:

```yaml
services:
  app:
    # ... other settings
    restart: always
    
  postgres:
    # ... other settings
    restart: always
    
  solr:
    # ... other settings
    restart: always
```

This ensures containers will automatically restart after system reboots or if they crash.


## Development

### Docker Development Mode

For development with Docker, the entrypoint script handles both frontend and backend in watch mode, automatically recompiling when files change.

#### Debugging in Docker

If you need to connect to the running container for debugging:

```bash
# Connect to the running container
docker-compose exec app bash

# Inside the container, you can run commands:
cd /app
cargo build --release

# Check logs
tail -f /tmp/app.log
```

#### Modifying Docker Configuration

You can customize the Docker setup by editing:

- `docker-compose.yml`: Service configuration, networking, volumes
- `Dockerfile`: Build instructions and dependencies
- `docker-entrypoint.sh`: Startup procedures and environment setup

#### Accessing Container Services

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- PostgreSQL: localhost:15432 (or configured port)
- Solr: http://localhost:8982/solr (or configured port)

### Local Development Mode

For local development without Docker:

```bash
# Start frontend in watch mode
cd frontend
npm start

# Start backend in watch mode
cd ..
cargo watch -x 'run --release --bin HistTextWeb' -i frontend/
```

This will automatically reload both the frontend and backend when files change.

#### Environment Setup for Local Development

Make sure these environment variables are set for the create-rust-app framework:

```bash
export CRA_MANIFEST_PATH=/path/to/frontend/dist/.vite/manifest.json
export CRA_FRONTEND_DIR=/path/to/frontend/
export CRA_VIEWS_GLOB=/path/to/backend/views/**/*.html
```

#### Using Remote Databases in Development

To connect to remote databases during development:

1. Add entries to the `solr_databases` table
2. Ensure SSH keys are properly configured
3. Set up appropriate tunnels in your .env file

### Database Migrations

#### Creating Migrations

To create a new migration:

```bash
diesel migration generate your_migration_name
```

This creates:
- `migrations/XXXXXX_your_migration_name/up.sql`: Forward migration
- `migrations/XXXXXX_your_migration_name/down.sql`: Rollback migration

Edit these files to define your schema changes.

#### Running and Managing Migrations

To run all pending migrations:

```bash
diesel migration run
```

To run migrations up to a specific version:

```bash
diesel migration run --migration-id XXXXXX
```

To revert the last migration:

```bash
diesel migration revert
```

To redo the last migration (revert and reapply):

```bash
diesel migration redo
```

#### Viewing Migration Status

To see the current migration status:

```bash
diesel migration list
```

### Testing

To run the test suite:

```bash
# Run all tests
cargo test

# Run specific tests
cargo test --package HistText --bin HistText -- tests::your_test

# For frontend tests
cd frontend
npm test
```



## Troubleshooting

### Docker Issues

**PostgreSQL Connection Refused**

If the application can't connect to PostgreSQL, ensure the `DATABASE_URL` in your environment variables uses `postgres` as the host name, not `localhost`:

```
# Wrong (inside Docker)
DATABASE_URL=postgres://user:password@localhost:5432/databasename

# Correct (inside Docker)
DATABASE_URL=postgres://user:password@postgres:5432/databasename
```

**Solr Permission Issues**

If Solr reports permissions issues with `/var/solr`:

```bash
# Fix permissions on the host
chmod -R 1000:1000 data/solr
```

Or adjust the user in docker-compose.yml to match your system's user ID:

```yaml
solr:
  # ... other config
  user: "$(id -u):$(id -g)"  # Use your current user/group IDs
```

**Continuous Recompilation with cargo-watch**

If you notice the application recompiling continuously:

```bash
# Connect to the container
docker-compose exec app bash

# Edit the docker-entrypoint.sh file and replace cargo watch with direct execution
nano /usr/local/bin/entrypoint.sh

# Change from:
cargo watch -x 'run --release --bin HistText' -i frontend/

# To:
./target/release/HistText
```

**SSH Tunneling Errors**

If you see "Failed to establish any SSH tunnels":

1. Ensure SSH keys are properly set up in `data/ssh/`
2. Check that the openssh-client package is installed in the container
3. Check if you need to create entries in the `solr_databases` table
4. Test SSH connectivity manually inside the container:
   ```bash
   docker-compose exec app bash
   ssh -v user@your-server
   ```
5. The application will continue to run even without SSH tunnels

**Mounting Volumes Error**

If you get errors about mounting volumes:

```bash
# Check if directories exist
mkdir -p app data/postgres data/solr data/histtext-tmp data/ssh

# Fix permissions
chmod -R 777 data  # Less secure but fixes most issues
```

### Manual Setup Issues

**diesel_cli Installation Fails**

If installing the Diesel CLI fails, ensure you have PostgreSQL development libraries:

```bash
# On Ubuntu/Debian
sudo apt-get install libpq-dev

# On macOS
brew install postgresql

# Then try again
cargo install diesel_cli --no-default-features --features postgres
```

**Solr Core Creation Fails**

If creating the Solr core fails:

```bash
# Check Solr status
bin/solr status

# Stop Solr if it's running
bin/solr stop

# Start with more memory
bin/solr start -m 4g
```

**Script Fails to Connect to Database**

If the initialization script can't connect to the database:

1. Verify the DATABASE_URL in your .env file
2. Check that PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```
3. Test the connection manually:
   ```bash
   psql postgres://user:password@localhost:5432/databasename
   ```

**Secret Key Error**

If you get "No SECRET_KEY environment variable set!" error:

```bash
# Make sure your .env file has the SECRET_KEY variable
echo "SECRET_KEY=your_secure_random_string" >> .env

# And that you're loading the environment variables
source .env  # or export $(grep -v '^#' .env | xargs)
```

**Missing CRA Environment Variables**

If the frontend doesn't connect to the backend correctly:

```bash
# Set these environment variables
export CRA_MANIFEST_PATH=/app/frontend/dist/.vite/manifest.json
export CRA_FRONTEND_DIR=/app/frontend/
export CRA_VIEWS_GLOB=/app/backend/views/**/*.html
```

---

For further assistance, please open an issue in the repository or contact the development team.
