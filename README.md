![Latest Release](https://img.shields.io/github/v/release/BaptisteBlouin/HistText?label=version) ![License: Dual](https://img.shields.io/badge/License-Dual-blue)

# HistText  

HistText is a Rust/TypeScript web application for large-scale historical text analysis. It provides a fullstack platform to store, combine, search, and analyze digitized historical texts with features like full-text search, named entity recognition (NER), and statistical text analysis. The backend is built in Rust (Actix Web) with a PostgreSQL database and uses Apache Solr for indexing and search. The frontend is a React application for an intuitive web interface. This README includes instructions for setting up and running HistText with or without Docker, along with configuration and troubleshooting guidelines.

## License

This project is available under a dual license:
- Free for individuals and European public institutions – Non-commercial use is permitted at no cost.
- Commercial license required for private organizations and non-European public institutions.

See the LICENSE.md file for details on usage terms. (Note: Contact the authors to obtain a commercial license if applicable.)

## Documentation

The HistText project includes comprehensive documentation for all components. See the docs/ directory for detailed guides and references:
- API Documentation – OpenAPI specifications for the RESTful API (docs/api/) – (OpenAPI docs are generated at runtime; see usage below).
- Administrator Guide – Setup and configuration instructions for deployment (docs/admin_setup/).
- Backend Documentation – Rust backend developer guide and API reference (docs/backend/).
- Database Schema – Details about the PostgreSQL schema, tables, and relationships (docs/database/).
- Python Toolkit – Documentation for planned Python tools to interact with HistText (docs/toolkit/). To be developed.

Each documentation section provides guidance for different user roles (administrators, developers, researchers). For a complete index of all documentation resources, see docs/README.md.

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Requirements](#requirements)
  - [For Docker Setup](#for-docker-setup)
  - [For Manual Setup](#for-manual-setup)
- [Installation](#installation)
  - [Using Docker (Recommended)](#using-docker-recommended)
  - [Manual Installation](#manual-installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [SSH Tunneling](#ssh-tunneling)
- [Usage](#usage)
  - [Admin Interface](#admin-interface)
  - [API Access](#api-access)
- [Running as a Service](#running-as-a-service)
  - [Manual Installation Service Setup (systemd)](#manual-installation-service-setup)
  - [Docker Service Setup](#docker-service-setup)
- [Development](#development)
  - [Docker Development Mode](#docker-development-mode)
  - [Local Development Mode](#local-development-mode)
  - [Database Migrations](#database-migrations)
- [Troubleshooting](#troubleshooting)
  - [Docker Issues](#docker-issues)
  - [Manual Setup Issues](#manual-setup-issues)
- [About](#about)

## Overview

HistText is a comprehensive platform for analyzing and managing historical texts. It provides:

- Text Storage & Management: Upload and organize large collections of historical documents through a web interface.
- Full-Text Search: Powerful search powered by Apache Solr, with advanced filtering and faceted search capabilities.
- Named Entity Recognition (NER): Automatically identify and categorize names of people, places, organizations, and other entities within texts.
- User Authentication & Roles: Secure login system with role-based access control (admin, researcher, etc.).
- Statistical Analysis & Visualization: Compute corpus statistics (word frequencies, co-occurrences, etc.) and visualize results with charts for insight.
- RESTful API Access: Programmatic access to all functionalities via a documented API (OpenAPI/Swagger UI available).
- Document Versioning & Tracking: Planned: Keep a history of document edits and revisions for provenance and change tracking.
- Metadata Management: Manage metadata (e.g. publication date, author, source) for each document, with support for custom fields and facets.
- Scalability: Support for large text corpora with efficient indexing and caching.
- Custom Search Fields: Ability to customize which fields are indexed and searchable (configurable include/exclude of fields and types).

The application consists of multiple components working together:

- Backend: A Rust web service (built with Actix Web) that provides the API.
- Frontend: A React TypeScript single-page application (SPA) for the user interface.
- Database: PostgreSQL for storing user accounts, metadata, and other relational data.
- Search Index: Apache Solr for full-text indexing, search queries, and storing NER data.
- File Storage: Uses the local filesystem (by default) or an S3-compatible object storage for storing document files and large data.
- Email Service: (Optional) SMTP integration for sending notifications or user account emails (e.g. password reset).
- NLP Toolkit: (Planned) A Python toolkit to perform advanced NLP tasks or batch processing, to be used alongside the web application.

## Architecture

```mermaid
flowchart LR
 user(User Browser)
 subgraph Client
 frontend[Frontend SPA]
 end
 subgraph Server
 backend[Backend API]
 end
 db[(PostgreSQL<br/>Database)]
 solr[(Apache Solr<br/>Index & NER Core)]
 storage[(File Storage<br/>Local or S3)]
 smtp[(SMTP Email<br/>Server)]
 user --> frontend --> backend
 backend --> db
 backend --> solr
 backend --> storage
 backend -. optional .-> smtp
```

Figure: HistText architecture – The React frontend runs in the user's browser and communicates with the Rust backend via REST API calls. The backend interacts with a PostgreSQL database for persistent data and uses an Apache Solr server for full-text search indexing and NER storage. Document files and large assets are stored on the local filesystem or an S3-compatible storage. An SMTP server can be configured for sending out emails (optional). The backend also establishes SSH tunnels as needed to reach remote services (e.g., a Solr instance on another server) based on configuration.

## Requirements

### For Docker Setup
- Docker (version 23.0.x or newer)
- Docker Compose (version 2.x or newer)
- Git for cloning the repository
- System Resources:
  - RAM: Minimum 1 GB (4 GB+ recommended for large corpora)
  - PostgreSQL database: ~50 MB memory usage (depending on data size)
  - Solr: ~750 MB or more (depending on index size)
  - Rust backend: ~100 MB (varies with usage)
- Disk Space:
  - Base application (containers + images): ~7 GB
  - PostgreSQL data: starts at ~50 MB (grows with database content)
  - Solr indexes: starts at ~1 MB (grows with indexed content)
  - Application data (file storage, caches): ~1 MB (grows with usage)
- CPU: Minimum 2 cores (4+ cores recommended for better performance)
- Network: Internet connectivity to download Docker images and for application use (if remote data or users will connect).

### For Manual Setup
- Rust (Rust toolchain 1.85.0 or newer, with cargo and rustup).
- Node.js (18.x or newer) and npm (for building/running the frontend).
- PostgreSQL (16.x or newer) installed and running.
- Apache Solr (9.8.1 or newer) installed for full-text search.
- Diesel CLI: For database migrations. Install via:
  ```
  cargo install diesel_cli --no-default-features --features postgres
  ```
- PostgreSQL Dev Libraries: (For Diesel) e.g., libpq-dev on Debian/Ubuntu.
- OpenSSH Client: (ssh command-line tool) for enabling SSH tunneling functionality.
- C Compiler: e.g., GCC or Clang, for building certain Rust dependencies (if any native extensions are used).

## Installation

### Using Docker (Recommended)

Using Docker is the easiest way to set up HistText, as it encapsulates all dependencies (PostgreSQL, Solr, and the HistText app) in containers.

1. **Clone the Repository**
   ```bash
   git clone https://github.com/BaptisteBlouin/HistText.git
   cd HistText
   ```

2. **Prepare the Directory Structure**
   
   Create the necessary directories for persistent data and configuration:
   ```bash
   # Create directories for database, search index, temp files, SSH keys, etc.
   mkdir -p data/postgres data/solr data/histtext-tmp data/ssh data/embeddings
   ```
   - data/postgres: Volume for PostgreSQL data
   - data/solr: Volume for Solr indexes
      - You may need to do : `chown 1000:1000 data/solr` according to the `user: "1000:1000"` set in `docker-compose.yml`
   - data/histtext-tmp: Temporary files, caches, and uploads
   - data/ssh: (Docker-only) place to mount SSH keys for tunnels
   - data/embeddings: (Optional) word embeddings files (if used for NLP)

3. **Set Up Environment Variables**
   
   Copy the example environment file and adjust it for your setup:
   ```bash
   cp .env.example .env
   ```
   
   Open the .env file in an editor and update at least the following variables:
   - DATABASE_URL – PostgreSQL connection string.
     - For Docker usage, use the service name postgres as host:
       ```
       DATABASE_URL=postgres://<user>:<password>@postgres:5432/<dbname>
       ```
     - For non-Docker (local), use localhost:
       ```
       DATABASE_URL=postgres://<user>:<password>@localhost:5432/<dbname>
       ```
   - SECRET_KEY – A secure random string for session encryption and password hashing (replace the default).
   - SMTP_* – (Optional) SMTP server, username, password, and from-address for email features.
   - Other credentials and paths as needed (see Configuration below for full list of variables).

   > Note: In Docker deployment, ensure any file paths (e.g. for embeddings) refer to locations inside the container or mounted volumes (the default paths under /data/... are recommended as they map to the data/ host folder).

4. **Start the Docker Containers**
   
   Use Docker Compose to launch the application:
   ```bash
   docker-compose up
   ```
   
   This will start the PostgreSQL database, Solr server, and HistText application (backend and frontend). To run in the background (detached mode), add the -d flag:
   ```bash
   docker-compose up -d
   ```
   
   Once the containers initialize, the application will be available at:
   - Frontend SPA: http://localhost:3000
   - Backend API: http://localhost:8000
   
   (Ports can be adjusted in the Compose file if needed.)

### Manual Installation

If you prefer to run the application natively on your host (or for development outside Docker), follow these steps:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/BaptisteBlouin/HistText.git
   cd HistText
   ```

2. **Set Up PostgreSQL**
   
   Install PostgreSQL if not already installed. Create a user and database for HistText:
   ```bash
   sudo -u postgres psql
   # In the psql shell, run:
   CREATE USER histtext WITH PASSWORD 'yourpassword';
   CREATE DATABASE historicaltext OWNER histtext;
   \q
   ```
   
   Ensure you replace 'yourpassword' with a secure password of your choice. The database name historicaltext and user histtext should match what you plan to use in the .env file.

3. **Set Up Solr**
   
   Install Apache Solr and create a core for HistText's search index:
   ```bash
   # Download and extract Solr (if not already installed)
   wget https://downloads.apache.org/lucene/solr/9.8.1/solr-9.8.1.tgz
   tar xzf solr-9.8.1.tgz
   cd solr-9.8.1
   # Start Solr server (in background)
   bin/solr start
   # Create a new core named "ner" (for storing NER and index data)
   bin/solr create -c ner
   ```
   
   This will start Solr on the default port 8983 and set up an empty core called ner for HistText to use.
   (You can choose a different core name, but make sure to adjust the application config accordingly.)

4. **Set Up Environment Variables**
   
   Copy the example environment file and customize it for your local setup:
   ```bash
   cp .env.example app/.env
   ```
   
   Edit app/.env and update the key settings:
   - DATABASE_URL=postgres://histtext:yourpassword@localhost:5432/historicaltext
     (ensure the user, password, and DB name match what you created in step 2).
   - SOLR_NER_PORT=8983 (Solr port, default 8983 for a local Solr server).
   - (Optional) Update any other settings as needed (see Configuration below for a full list).

5. **Set Up the Database Schema**
   
   Run database migrations to create the required tables:
   ```bash
   # Install Diesel CLI if you haven't (see Requirements)
   diesel migration run
   ```
   
   This will apply all migrations in the migrations/ directory to set up the schema (user accounts, documents, etc.).

6. **Install Frontend Dependencies**
   
   In a separate terminal, install JavaScript dependencies for the frontend:
   ```bash
   cd app/frontend
   npm install
   ```
   
   This will download all required Node packages for the React app.


7. **Run the Initialization Script**
   
   Before starting the server for the first time, run the setup script to initialize default data (admin user, roles, etc.):
   ```bash
   # Build and run the initialization script
   cargo run --release --bin script
   ```
   
   This will execute the script binary (located at src/bin/script.rs) which performs one-time setup tasks. Specifically, the script will:
   - Initialize the Argon2 password hashing configuration (using the SECRET_KEY from the environment for salt generation).
   - Generate cryptographically secure random salts for hashing.
   - Create a default admin user with credentials admin / admin (if no admin user exists yet).
   - Hash the default admin password using Argon2id.
   - Create an "Admin" role and assign it to the admin user.
   - Set up base permissions associated with the admin role.
   - Insert any necessary bootstrap data into the database for the application to run.

   > Security Tip: The default admin credentials are for initial setup only. Log in and change the admin password immediately upon first use, especially in a production environment.

8. **Build the Application**
   
   Back in the root project directory (ensure you've built the frontend at least once for production):
   ```bash
   # Build the Rust backend in release mode
   cargo build --release
   ```
   
   This will compile the backend server and supporting binaries. The output will be in target/release/.
   
   (If you plan to actively develop, you can use cargo run without --release for faster compile cycles, but the release build is recommended for production use.)

9. **Start the Application**
   
   Launch both the backend and frontend services:
   
   - Frontend: In the app/frontend directory, start the React development server:
     ```bash
     cd app/frontend
     npm start
     ```
     This will run the frontend on http://localhost:3000. (The React dev server may proxy API requests to the backend to avoid CORS issues.)
   
   - Backend: In the project root (or app/backend directory), start the Rust server:
     ```bash
     cargo run --release --bin HistTextWeb
     ```
     This will start the API server on http://localhost:8000 (as configured in .env).
   
   Now you can open http://localhost:3000 in your browser. You should see the HistText web interface. Proceed to log in with the admin account (credentials admin / admin) and you can begin using the system.

## Configuration

### Environment Variables

HistText is configured via a .env file. Below is a list of important environment variables and their default values:

| Variable | Description | Default value |
|----------|-------------|---------------|
| RUST_LOG | Logging level for the Rust backend (debug, info, etc.) | debug |
| SECRET_KEY | Secret key for session encryption and Argon2 hashing | secretkey |
| POSTGRES_USER | PostgreSQL username (if using separate env vars) | user |
| POSTGRES_PASSWORD | PostgreSQL password | password |
| POSTGRES_DB | PostgreSQL database name | databasename |
| POSTGRES_PORT | PostgreSQL port | 5432 |
| DATABASE_URL | Complete database connection URL | postgres://user:password@localhost/databasename |
| RUST_BACKTRACE | Enable backtraces for error debugging (1 to enable) | 1 |
| APP_URL | Application URL (used for OAuth redirects, etc.) | http://localhost:3000 |
| DEV_PORT | Development port (for internal use, if any) | 60012 |
| GOOGLE_OAUTH2_CLIENT_ID | (Optional) Google OAuth2 Client ID for Google login | abc |
| GOOGLE_OAUTH2_CLIENT_SECRET | (Optional) Google OAuth2 Client Secret | 123 |
| SMTP_FROM_ADDRESS | (Optional) Email "from" address for outgoing emails | histtext@testmail.com |
| SMTP_SERVER | (Optional) SMTP server address | smtp.testmail.com |
| SMTP_USERNAME | (Optional) SMTP username | histtext@testmail.com |
| SMTP_PASSWORD | (Optional) SMTP password | password |
| SEND_MAIL | (Optional) Enable sending emails (true/false) | true |
| S3_HOST | (Optional) S3-compatible storage endpoint URL | http://localhost:9000 |
| S3_REGION | (Optional) S3 region (if applicable) | minio |
| S3_BUCKET | (Optional) S3 bucket name for file storage | bucket |
| S3_ACCESS_KEY_ID | (Optional) S3 access key ID | access_key |
| S3_SECRET_ACCESS_KEY | (Optional) S3 secret access key | secret_key |
| MAX_SIZE_QUERY | Maximum number of results for text queries | 20000 |
| MAX_SIZE_DOCUMENT | Maximum characters for document concordance previews | 50  |
| MAX_ID_NER | Maximum number of NER IDs to process at once | 1000 |
| MAX_METADATA_SELECT | Maximum number of metadata fields selectable in UI | 50 |
| PATH_STORE_FILES | Path to store uploaded files and temp data | /data/histtext-tmp |
| STATS_CACHE_PATH | Path for caching computed statistics | /data/histtext-tmp/stats_cache.json |
| NER_CACHE_PATH | Path for caching NER results | /data/histtext-tmp/ner_cache.json |
| EMBED_PATH | Path to a default word embeddings file (if used) | /data/embeddings/glove.6B.50d.txt |
| MAX_EMBEDDINGS_FILES | Max number of embedding files to cache simultaneously | 3 |
| SOLR_NER_PORT | Port for connecting to Solr (NER core) | 8982 (Docker default; use 8983 for local) |
| EXCLUDE_FIELD_TYPES | Comma-separated Solr field types to exclude from facets/search | text_general,text_normalized_cjk,integer |
| EXCLUDE_FIELD_NAMES | Comma-separated field names to exclude | date_rdt |
| EXCLUDE_FIELD_NAME_PATTERNS | Comma-separated prefixes of field names to exclude | wke_,wk_ |
| EXCLUDE_REQUEST_NAME_STARTS_WITH | Exclude Solr request handler names starting with | _ |
| EXCLUDE_REQUEST_NAME_ENDS_WITH | Exclude Solr request handler names ending with | _ |
| ID_STARTS_WITH | Prefix for document ID fields (for parsing/filters) | id |
| ID_ENDS_WITH | Suffix for document ID fields | id |
| MAIN_DATE_VALUE | Primary date field name (for timeline/analysis) | date_rdt |
| DO_OPENAPI | Enable serving OpenAPI docs via Swagger UI | true |
| OPENAPI_LOGIN | Username for accessing Swagger UI docs | openapi |
| OPENAPI_PWD | Password for accessing Swagger UI docs | openapi |

Notes: Most of these settings apply to the backend. The POSTGRES_* and DATABASE_URL are alternative ways to configure database access (you can use just DATABASE_URL). The CRA_* variables (e.g. CRA_MANIFEST_PATH) are used internally by the create-rust-app framework to locate frontend build assets; these are usually set automatically in Docker and may need to be set in development (see Development below). The default values above are for a development setup. Be sure to change sensitive values (like SECRET_KEY, database credentials, OAuth secrets) in production.

### SSH Tunneling

HistText supports SSH tunneling to securely connect to remote services (such as a Solr server on another host) as if they were local. This is useful if your Solr index or database is hosted remotely and not directly accessible.

To configure SSH tunnels:

1. **Prepare SSH Keys**:
   - Docker: Place your SSH key files (id_rsa, id_rsa.pub, known_hosts, etc.) in the data/ssh/ directory before starting the container. The Docker setup will mount this folder so the backend can use the keys.
   - Manual: Ensure the host machine's SSH agent/keys are available. The backend will invoke the system ssh for tunnels, which will use your user's SSH config.

2. **Configure tunnel entries in the database**: The backend reads from a solr_databases table to establish tunnels on startup. Insert a row for each remote service you want to tunnel to. Key fields:
   - name: A descriptive name (not used in connection, just for your reference).
   - url: The SSH connection string (e.g. user@remote-server.com) for the remote host.
   - server_port: The port on the remote host that you want to tunnel (e.g. the Solr port on that server, typically 8983).
   - local_port: The local port on which the tunnel will be available (choose a free port, e.g. 8982).
   - created_at: Timestamp (can use NOW() in SQL).
   
   Example: To tunnel a remote Solr at remote-server.com:8983 to your local port 8982, add an entry:
   ```sql
   INSERT INTO solr_databases (name, url, server_port, local_port, created_at)
   VALUES ('RemoteSolr', 'user@remote-server.com', 8983, 8982, NOW());
   ```

3. **Start HistText**: On startup, the backend will attempt to open an SSH tunnel for each entry in solr_databases. If configured correctly, it will ssh into user@remote-server.com and forward remote port 8983 to local 8982. The application will then use localhost:8982 as if Solr were local.

If a tunnel fails to connect, the application will log a warning but continue running. You can always test SSH connectivity manually:
```bash
# From the host or within the Docker container:
ssh -v user@remote-server.com
```
This helps debug key or connectivity issues. (Also ensure the Docker image has an SSH client installed, e.g. openssh-client, if using Docker.)

## Usage

### Admin Interface

After installation, open your browser to http://localhost:3000/admin to access the HistText admin interface. Log in with the default administrator credentials:

- Username: admin
- Password: admin

Upon first login, you will see the administration dashboard. Here you can upload texts, manage users, configure metadata fields, and run analyses. Please change the admin password immediately via the user management section for security.

The admin interface allows you to:
- Create and manage user accounts and roles.
- Upload documents or import text corpora.
- Configure metadata schemas (fields associated with documents).
- View how to extract named entities and other NLP tools.

(The exact features available may evolve; see the ROADMAP for upcoming enhancements.)

### API Access

HistText provides a RESTful API that enables programmatic access to all its functions (document management, search queries, etc.). This is useful for integration with other tools or automation.

- Base URL: The API is served at http://localhost:8000 (or the host/port where the backend is running).
- Authentication: The API uses token-based or session authentication. When you log in via the frontend, an auth token (or session cookie) is issued which can be used for subsequent API calls. You can also obtain tokens via an API call (if implemented) or use basic auth for certain endpoints (if enabled).
- OpenAPI Documentation: For developers, an interactive API documentation is available. If DO_OPENAPI=true in your environment, navigate to http://localhost:3000/swagger-ui in a browser. You will be prompted for credentials to view the Swagger UI:
  - Username: value of OPENAPI_LOGIN (default "openapi")
  - Password: value of OPENAPI_PWD (default "openapi")
  
  This interface lists all API endpoints, their request/response schemas, and allows testing endpoints. It's a convenient way to explore the API. (The OpenAPI JSON spec is generated by the backend; you can also retrieve it directly from the backend if needed for use in tools.)

- Using the API: You can use any HTTP client (curl, Postman, Python requests, etc.) to call the API. For example, to list documents or upload a new text, use the appropriate endpoints as documented in the OpenAPI docs. Ensure you include the authentication token or cookie in your requests if the API requires login (most endpoints will, except possibly health checks).

(Note: Detailed API endpoint documentation can be found in docs/api/ or via the Swagger UI. If an endpoint described in docs is not functioning, it might be a planned feature – check the project issues or roadmap.)

## Running as a Service

For production or long-running deployments, you may want to run HistText as a system service so that it starts on boot and can be managed by the OS (using systemd on Linux, for example).

### Manual Installation Service Setup

If you installed HistText manually on a Linux server, you can create systemd service units for the backend and optionally the frontend:

1. **Create a Service User (recommended)**:
   
   It's good practice to run services under a dedicated user with limited permissions. Create a user histtext without login shell:
   ```bash
   sudo useradd -r -s /bin/false histtext
   ```

2. **Create a systemd Service File for the Backend**:
   
   Create a file at /etc/systemd/system/histtext.service with the following content (use sudo and your editor of choice):
   ```ini
   [Unit]
   Description=HistText Backend Service
   After=network.target postgresql.service solr.service
   
   [Service]
   Type=simple
   User=histtext
   WorkingDirectory=/path/to/HistText # <-- change to your HistText project directory
   EnvironmentFile=/path/to/HistText/app/.env # <-- path to your env file
   ExecStart=/path/to/HistText/target/release/HistTextWeb
   Restart=on-failure
   RestartSec=5
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=histtext-backend
   
   [Install]
   WantedBy=multi-user.target
   ```
   
   Adjust the paths: make sure the WorkingDirectory points to the project directory (where you ran cargo build and where the migrations/ folder is), the EnvironmentFile points to your environment config (you can also inline environment variables with Environment= lines), and the ExecStart points to the compiled binary (if you built in release mode as shown, the path in the example is correct). We use histtext user to run it (created in step 1). The After line ensures this service starts after network, PostgreSQL, and Solr are up (modify names if your Solr service unit has a different name).

3. **Create a Frontend Service (optional)**:
   
   If you want the React frontend to also run as a service (for example, if you are serving it via the development server or an SSR setup), create /etc/systemd/system/histtext-frontend.service:
   ```ini
   [Unit]
   Description=HistText Frontend Service
   After=network.target
   
   [Service]
   Type=simple
   User=histtext
   WorkingDirectory=/path/to/HistText/app/frontend
   ExecStart=/usr/bin/npm start
   Restart=on-failure
   RestartSec=5
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=histtext-frontend
   
   [Install]
   WantedBy=multi-user.target
   ```
   
   This will run npm start in the frontend directory on system boot. Note that using the dev server (npm start) in production is not typical; you might instead serve the built frontend with a static file server or via the backend. In many cases, you do not need a separate frontend service if you build the frontend and let the backend serve the static files. In such a scenario, you can skip this service and just ensure the backend is serving the UI. (The create-rust-app integration can serve the dist files if configured.)

4. **Enable and Start the Services**:
   
   Reload systemd to pick up the new unit files and then enable/start the services:
   ```bash
   sudo systemctl daemon-reload
   # Enable services to start on boot
   sudo systemctl enable histtext.service
   sudo systemctl enable histtext-frontend.service # only if using a separate frontend service
   # Start the services now
   sudo systemctl start histtext.service
   sudo systemctl start histtext-frontend.service
   # (Optional) Check status to confirm they started
   sudo systemctl status histtext.service
   sudo systemctl status histtext-frontend.service
   ```
   
   If everything is configured correctly, the backend should now be running continuously in the background. The frontend service (if used) will run the dev server. In a production scenario, you would likely not use npm start but serve the files via Nginx or the Rust backend.

5. **View Logs**:
   
   You can follow the logs via journalctl:
   ```bash
   # Backend logs
   sudo journalctl -u histtext.service -f
   # Frontend logs (if running as service)
   sudo journalctl -u histtext-frontend.service -f
   ```
   
   Press Ctrl+C to exit the log tail.

### Docker Service Setup

If you deployed using Docker Compose, you can also set it up to run at boot using systemd, or consider Docker's own restart policies.

1. **Systemd Service for Docker Compose**:
   
   Create a file /etc/systemd/system/histtext-docker.service with contents:
   ```ini
   [Unit]
   Description=HistText (Docker Compose)
   Requires=docker.service
   After=docker.service
   
   [Service]
   Type=simple
   WorkingDirectory=/path/to/HistText
   ExecStart=/usr/bin/docker-compose up
   ExecStop=/usr/bin/docker-compose down
   Restart=on-failure
   RestartSec=10
   
   [Install]
   WantedBy=multi-user.target
   ```
   
   Adjust WorkingDirectory to your project path. This will call docker-compose up to start and docker-compose down to stop. It relies on Docker being installed and running.

2. **Enable and Start the Docker Compose Service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable histtext-docker.service
   sudo systemctl start histtext-docker.service
   # Check status
   sudo systemctl status histtext-docker.service
   ```
   
   Now Docker Compose will start HistText on boot.

3. **(Alternative) Docker Swarm or Other Orchestration**:
   
   For a more production-ready setup, you might use Docker Swarm or Kubernetes. For example, with Swarm:
   ```bash
   # Initialize Docker Swarm (if not already)
   docker swarm init
   # Deploy the stack using the compose file
   docker stack deploy -c docker-compose.yml histtext
   # Verify services
   docker service ls
   # (Optional) scale the app service if needed
   docker service scale histtext_app=2
   ```
   
   (Above assumes the compose file is compatible with Swarm and names the app service histtext_app.)

4. **Automatic Container Restarts**:
   
   If not using systemd, you can rely on Docker's restart policies. Ensure your docker-compose.yml services have restart: always (or unless-stopped) so that containers restart on failure or reboot. For example:
   ```yaml
   services:
     app:
       image: ...
       # ... other settings ...
       restart: always
     postgres:
       image: ...
       # ... other settings ...
       restart: always
     solr:
       image: ...
       # ... other settings ...
       restart: always
   ```
   
   This way, if the machine reboots or the container crashes, Docker will attempt to bring it back up automatically.

## Development

Interested in developing or contributing to HistText? The project is set up to facilitate iterative development with hot-reloading for both frontend and backend.

### Docker Development Mode

When using Docker for development, the provided docker-compose.yml and entrypoint.sh are configured to watch for changes:

- The backend container mounts the source code and uses cargo watch to rebuild and run the server when code changes.
- The frontend container (if included in Docker Compose) can run the dev server or build on changes.

By default, the Docker entrypoint runs both the backend and frontend in "watch" mode (dev mode). This means you can edit code on your host, and the changes will propagate into the container:

- Debugging in Docker: If you need to access the running container for debugging or running commands:
  ```bash
  # Open a shell in the running app container
  docker-compose exec app bash
  # Once inside the container, you can run manual commands, for example:
  cd /app # (or the appropriate working directory in container)
  cargo build --release # build manually
  tail -f /tmp/app.log # view application log (if it's written to a file)
  ```

- Modifying the Docker Setup: You can customize the Docker-based dev environment by editing:
  - docker-compose.yml – to adjust service definitions, ports, volumes, etc.
  - Dockerfile – to add system packages or change the build process.
  - entrypoint.sh – the startup script that launches the processes (for example, it might run cargo watch; you could modify it to run a debug server or other commands).

- Accessing Services (in Docker dev):
  - Frontend UI – http://localhost:3000
  - Backend API – http://localhost:8000
  - PostgreSQL – available on host at port 15432 (if mapped, check compose file)
  - Solr UI – http://localhost:8982/solr (or the mapped port, default 8982 in env)

### Local Development Mode

You can also run the frontend and backend directly on your machine for development:

- Frontend (React): Open a terminal:
  ```bash
  cd app/frontend
  npm start
  ```
  This will start the React dev server (usually on http://localhost:3000) with hot module reload for the UI. The dev server is likely configured to proxy API requests to localhost:8000 (check vite.config.js or similar), so that you can use the UI without CORS issues. If not, you may need to configure a proxy or set environment variables for the API base URL.

- Backend (Rust API): In another terminal, start the backend in watch mode for auto-reload:
  ```bash
  cd app/backend # (if using a workspace, or simply project root if cargo is configured there)
  cargo install cargo-watch --version 8.0.0 # if not installed, do once
  cargo watch -x 'run --bin HistTextWeb' -i frontend/
  ```
  This uses cargo-watch to recompile and run the server whenever you change Rust source files. We ignore changes in the frontend/ directory to avoid triggering backend rebuilds on frontend edits.

Now, as you edit Rust files in app/backend/src, the server will restart with the new code. As you edit React files in app/frontend/src, the browser will live-reload the changes. This setup allows fast iteration.

Environment Setup in Dev: In local development (without Docker), ensure the special environment variables for the create-rust-app integration are set so the backend knows where to find the frontend files (especially if doing SSR or serving static files):

```bash
# In your shell (or add to .env for convenience):
export CRA_MANIFEST_PATH="/path/to/HistText/app/frontend/dist/.vite/manifest.json"
export CRA_FRONTEND_DIR="/path/to/HistText/app/frontend/"
export CRA_VIEWS_GLOB="/path/to/HistText/app/backend/views/**/*.html"
```

These are mainly needed if the backend serves the built frontend assets or server-rendered views. During pure development with separate servers, they may not be critical, but it's good to have them in the environment to mimic production behavior when needed.

Using Remote Databases in Dev: If you want to connect your local dev backend to a remote Solr or Postgres (instead of local ones), you can:
1. Populate solr_databases table with the remote Solr SSH info (as described in SSH Tunneling above).
2. Set up the .env to point to remote DB or allow SSH tunnel usage.
3. Run the backend; it will tunnel to remote Solr and use that, while you develop locally.

### Database Migrations

The project uses Diesel for managing database schema migrations.

Creating a Migration: If you need to change the database schema (add a table, alter columns, etc.), create a new migration file:

```bash
diesel migration generate <migration_name>
```

This will create a timestamped pair of files under migrations/<timestamp>_<migration_name>/:
- up.sql – apply changes (write SQL here to implement the new schema changes)
- down.sql – rollback changes (write SQL to revert the changes made in up)

Edit those files to define the exact SQL commands for the migration.

Running Migrations: To apply pending migrations to your database:

```bash
diesel migration run
```

This will execute all up.sql scripts that haven't been run on the current database.

Managing Migrations:
- Run migrations up to a specific one by specifying the ID (timestamp) before it:
  ```bash
  diesel migration run --migration-id <TIMESTAMP>
  ```
- Revert the last migration:
  ```bash
  diesel migration revert
  ```
- Redo (revert and re-run) the last migration:
  ```bash
  diesel migration redo
  ```
- Check the status of migrations (which have run, which are pending):
  ```bash
  diesel migration list
  ```

Ensure your DATABASE_URL is set correctly in the environment so Diesel knows which database to apply migrations to. In development, this is usually your local database.


## Troubleshooting

Here are common issues and their solutions. If you encounter an issue not listed here, please check the GitHub Issues or open a new issue for assistance.

### Docker Issues

- PostgreSQL Connection Refused (Docker): If the backend cannot connect to the database when running in Docker, verify that in your .env you are using postgres (the Docker service name) as the host, not localhost. Inside the Docker network, the hostname should match the container name:
  ```
  - DATABASE_URL=postgres://user:password@localhost:5432/databasename # WRONG (inside container)
  + DATABASE_URL=postgres://user:password@postgres:5432/databasename # RIGHT (inside container)
  ```

- Solr Permission Issues (Docker): If Solr fails to start or index due to permission errors on /var/solr:
  - Ensure the data/solr directory on the host is owned by the user ID that the Solr container runs as (often UID 1000). You can fix permissions by:
    ```bash
    sudo chown -R 1000:1000 data/solr
    ```
    This gives ownership to UID/GID 1000 (which is the default Solr user in the official image).
  - Alternatively, you can modify docker-compose.yml to run Solr as your host user:
    ```yaml
    solr:
      user: "${UID}:${GID}"
    ```
    and start compose with UID=$(id -u) GID=$(id -g) docker-compose up.

- Continuous Recompilation (Docker Dev Mode): If using cargo watch in the Docker container, sometimes it might restart continuously (e.g., if file timestamps confuse it):
  - Connect to the container (docker-compose exec app bash) and edit the entrypoint script (perhaps at /usr/local/bin/entrypoint.sh). You can temporarily disable watch mode and run the server directly to troubleshoot:
    ```bash
    # In entrypoint.sh, find the line running cargo watch and replace it:
    cargo watch -x 'run --bin HistTextWeb' -i frontend/
    # Change to:
    cargo run --bin HistTextWeb
    ```
    Then rebuild the container or override the command to run without watch.

- SSH Tunneling Errors: If you see an error on startup like "Failed to establish any SSH tunnels":
  - Ensure your keys are in place (data/ssh for Docker, or your ~/.ssh for local).
  - Confirm the openssh-client is installed in the Docker container (the Dockerfile should include it if tunneling is a feature).
  - Verify you have entries in solr_databases table for the tunnels you need (and they are correct).
  - Manually test inside the container:
    ```bash
    docker-compose exec app bash
    ssh -v user@remote-server.com
    ```
    to see if the container can reach the host and authenticate.
  
  Remember, the application will still run even if tunnels fail; the affected remote Solr connections just won't be available.

- Volume Mount Errors (Docker on Windows): If using Docker Desktop on Windows or macOS and you get volume mount issues:
  - Make sure the data/ directories exist (Docker may not create them automatically). Run:
    ```bash
    mkdir -p app data/postgres data/solr data/histtext-tmp data/ssh
    ```
    in the host project directory to ensure all needed folders are there.
  - Check Docker Desktop file sharing settings (on Windows/Mac) to ensure the drive or path is allowed.
  - If permissions issues arise, you can use a more permissive setting (for dev only):
    ```bash
    chmod -R 777 data/
    ```
    on the host to grant full access to mounted volumes. This is not secure for production, but can help get things running in a development environment.

### Manual Setup Issues

- Diesel CLI Installation Fails: If cargo install diesel_cli fails, you likely are missing the Postgres dev libraries.
  - On Ubuntu/Debian: sudo apt-get install libpq-dev
  - On macOS: brew install postgresql (this provides the headers).
  - After installing, try installing Diesel CLI again.

- Solr Core Creation Fails: If bin/solr create -c ner didn't work:
  - Check if Solr was actually running: bin/solr status. If not, start it (bin/solr start).
  - If it complains about memory or other issues, you can allocate more memory: bin/solr stop then bin/solr start -m 4g (for 4 GB heap).
  - Ensure the core name isn't already taken. List cores with: curl http://localhost:8983/solr/admin/cores?action=STATUS.

- Initialization Script Database Connection Error: If running the script binary fails to connect to the database:
  - Double-check DATABASE_URL in your .env (and that the .env is in the correct location relative to where you run the binary). For manual runs, the .env should be in app/.env as we set up.
  - Ensure PostgreSQL is running and accessible. For example, on Linux:
    ```bash
    sudo systemctl status postgresql
    ```
    to see if it's active.
  - Try connecting manually with the connection string to verify credentials:
    ```bash
    psql postgres://histtext:yourpassword@localhost:5432/historicaltext
    ```
    If this fails, there's an issue with the DB setup or credentials.

- SECRET_KEY Error: If the backend logs "No SECRET_KEY environment variable set!" or similar:
  - Make sure your .env file contains a line for SECRET_KEY. This is required for password hashing and session encryption.
  - If running via systemd, ensure the EnvironmentFile path is correct and the file is being read. If running manually, ensure you ran source .env or the application is picking it up (the dotenv crate should auto-load it if present in current directory).
  - You can quickly add/set it:
    ```bash
    echo "SECRET_KEY=$(openssl rand -hex 32)" >> app/.env
    ```
    (using a secure random key generator like openssl to create a 64-hex-character string).

- Frontend Cannot Reach Backend: If the web interface seems to not fetch data (e.g., you see no results or errors in browser console about network requests):
  - Make sure the frontend is pointing to the correct backend URL. In development, the React app might proxy to localhost:8000. In production (when served by backend), it should automatically call the same host. If you changed ports or are accessing via a different IP, you may need to adjust config.
  - If running the frontend dev server, ensure the backend is running and accessible. Check CORS settings on the backend (the Actix Web backend might allow requests from localhost:3000 by default or via configuration).
  - The create-rust-app setup often injects the correct URLs, but if needed, set environment vars or config in the frontend for API endpoint.

- Missing CRA environment variables: If you see errors about CRA_MANIFEST_PATH or similar when running the backend in development:
  - Ensure you set those env vars (as shown in Local Development Mode above) or build the frontend and place the files where the backend expects them. These variables help the backend serve the correct JS/CSS in production or SSR modes. During dev, they might not be critical if you aren't using SSR.

If you run into other issues, please refer to the project's GitHub Issues page – someone may have reported a similar problem, or you can open a new issue with details.

## About

HistText is an open-source project developed by ENP-China with support from the European Research Council (ERC) Proof of Concept program. The goal is to provide researchers and historians with a powerful yet accessible tool to analyze large collections of historical texts, bridging the gap between traditional scholarship and modern text-mining techniques.

- Authors: Collaborators from the ENP-China project.
- Status: Initial release v1.0.0 (May 2025). This is the first version of the integrated Rust/React application, migrating from an earlier prototype. Expect rapid development and new features in upcoming versions.
- Roadmap: See ROADMAP.md for planned features and future improvements.

We welcome contributions! If you have ideas, bug fixes, or enhancements, feel free to open an issue or submit a pull request. For major changes, it's a good idea to start a discussion first to ensure alignment with project goals.

Contact: For questions or support, you can reach out via the GitHub issues or contact the maintainers directly.

Thank you for using HistText! We hope this tool accelerates your research and unlocks new insights in historical texts. Happy exploring!

Note: If a feature described in this documentation is not functioning or appears missing, it might be under active development or planned for a future release. Check the Roadmap and Issues for updates, and consider it a known TODO. This documentation will be updated as new features are implemented.