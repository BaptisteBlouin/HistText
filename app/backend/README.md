# HistText Backend

This directory contains the backend server for HistText – a Rust application that provides the API and core logic for historical text analysis. The backend is responsible for handling HTTP requests, managing database operations, running text processing tasks (like search and NER), and coordinating with external services (Solr, email, etc.).

## Technology Stack

- Language: Rust 
- Web Framework: Actix Web (for building RESTful API endpoints and serving web content)
- Database ORM: Diesel (for interacting with PostgreSQL using Rust structs and queries)
- Search Engine: Apache Solr (the backend connects to Solr for full-text indexing & search)
- Authentication: JSON Web Tokens (JWT) or session-based (via cookies) – the backend manages user authentication and roles.
- Security: Passwords are hashed with Argon2id (using a secret salt). The backend uses the SECRET_KEY for cryptographic operations.
- Background Tasks: HistText may perform some tasks like caching statistics or establishing SSH tunnels at startup.

## Backend Structure

The backend is organized as a Rust crate (likely part of a Cargo workspace in the app/ directory). Key components include:

- `main.rs` : Entry point for the main web server binary (HistTextWeb). This sets up Actix Web, configures routes, initializes database connections, Solr client, etc.
- `bin/script.rs`: Entry point for the initialization script binary (script). This is a one-time setup utility to seed the database (creating admin user, roles, etc.).
- Controllers / Handlers: The code is divided into modules corresponding to different parts of the API (for example, `services` or `server/routes.rs` might contain handlers for documents, search, auth, etc.).
- Models: There will be Diesel models representing database tables (in `models`) and schema definitions (Diesel's `schema.rs`).
- Views (Optional): If server-side rendering or templating is used for any part of the app, templates might reside in `views` . (HistText primarily uses a React frontend, so this might only be used for serving static files or not at all.)
- Utilities: Common helpers (for example, for Solr queries, SSH tunneling setup, etc.) are in `server/` .

(For detailed developer documentation, see docs/backend/ which may contain generated docs or additional notes about the code structure.)

## Setup and Configuration

Before running the backend, ensure you have completed the necessary installation steps (database migration, .env configuration, etc.). Refer to the root README for initial setup instructions. Key points:

- The backend uses a configuration file `.env` (in the app/ directory) for all settings (database URL, ports, credentials, etc.). Make sure this file is present and correctly configured.
- Database migrations should be applied (using Diesel CLI) before launching the server in a development environment.
- If Solr is not running locally on the default port, update the environment variables (SOLR_NER_PORT or tunnel settings) accordingly.

## Running the Backend (Development)

For day-to-day development, you have a few options to run the backend:

### 1. Direct via Cargo:

You can run the backend directly using Cargo. From the app/backend directory (or project root if configured as a workspace):

```bash
# Debug mode (faster compile, slower runtime)
cargo run --bin HistTextWeb

# Or Release mode (slower compile, faster runtime)
cargo run --release --bin HistTextWeb
```

This will start the server on the port defined by your configuration (typically 8000). The server will serve API endpoints and, in production mode, also serve the compiled frontend assets (if CRA_MANIFEST_PATH is set and the assets are built).

### 2. Using cargo-watch (auto-reload):

During active development, it's convenient to have the server reload on code changes. Install cargo-watch if you haven't, then run:

```bash
cargo watch -x 'run --bin HistTextWeb'
```

This will monitor the source code. On each save, the server will recompile and restart, picking up your changes quickly.

### 3. Docker (Dev mode):

Alternatively, run `docker-compose up` in dev mode, which uses the Docker environment. The backend in the container will rebuild on changes thanks to mounted volumes and the entrypoint script.

Note: When running locally (not in Docker), the backend expects to find Solr and PostgreSQL at the addresses given in .env (e.g., localhost:5432 for Postgres and localhost:8983 for Solr by default). Make sure those services are running and accessible. If using Docker for those and running backend locally, you might need to adjust hostnames (for example, point DATABASE_URL to the Docker container IP or use port mappings).

## Common Tasks

### Database Migrations (Diesel)

If you modify the database schema, create a Diesel migration:

```bash
diesel migration generate add_new_table_or_change
# edit the up.sql and down.sql in migrations/<timestamp>_add_new_table_or_change/
diesel migration run
```

Make sure to run migrations before launching the server to avoid runtime errors due to missing tables or columns.

In development, the server might panic on startup if the schema is outdated. Running `diesel migration run` will fix that by updating the DB. Migrations are version-controlled in the migrations/ directory, so remember to commit new migration files to version control.

### Environment Variables

The backend relies on environment variables for configuration (see the comprehensive list in the main README's Configuration section). Some important ones for the backend:

- DATABASE_URL – connection string for Postgres.
- SECRET_KEY – secret for encryption/hashing (must be set).
- RUST_LOG – adjust to see more verbose logging during dev (e.g., debug).
- APP_URL – base URL of the app (for constructing links, OAuth redirects).
- DO_OPENAPI – if true, the backend will serve Swagger UI at /swagger-ui (protected by basic auth using OPENAPI_LOGIN/PWD).
- GOOGLE_OAUTH2_CLIENT_ID/SECRET – if set, the backend may offer Google OAuth login integration (this feature might be experimental; check code for usage).
- SMTP_* – if you want the backend to send emails (for account confirmation, password reset, etc.), configure these. If not set, email functionality will be disabled or mocked.
- SOLR_NER_PORT – port where Solr is reachable. In Docker it might be mapped to 8982 internally; in dev it's typically 8983.
- EXCLUDE_* (fields and patterns) – these define which Solr fields or request handlers to hide from search results or facet generation. Modify only if you know your Solr schema details.

When changing any env variable, you'll need to restart the backend to pick up the new configuration. In dev, simply stop and re-run `cargo run` (or if using cargo-watch, stop and start it again).


## OpenAPI (Swagger) Documentation

The backend can produce an OpenAPI specification for its endpoints. If DO_OPENAPI=true, the backend serves a Swagger UI interface. This is implemented by mounting static Swagger UI files and providing an OpenAPI JSON.

- The OpenAPI JSON is generated at runtime (the exact mechanism depends on the implementation; it could be via macros like utoipa or a manually maintained spec).
- If you change or add endpoints, ensure the OpenAPI documentation is updated accordingly. This might involve editing annotations or data structures in the code that produce the spec, or updating a YAML/JSON file if we maintain one. Check docs/api/ or the codebase for where the OpenAPI schema is defined.

To view the docs, run the backend and navigate to http://localhost:3000/swagger-ui (through the frontend) or potentially http://localhost:8000/swagger-ui (direct to backend, depending on how routing is set). Use the credentials from OPENAPI_LOGIN / OPENAPI_PWD. This will show the interactive docs where you can try out API calls.

For developers: you can also retrieve the raw OpenAPI JSON (commonly at an endpoint like /api-docs.json or similar) and use it in tools or tests.

## Code Style and Contribution

We follow standard Rust conventions and formatting (please run rustfmt on contributions). The project aims for clear, commented code, especially around complex logic like text processing or authentication.

If you plan to contribute:
- For any significant change, please open an issue or discussion first.
- Ensure new code passes `cargo fmt` (formatting) and `cargo clippy` (lint checks) without introducing warnings.
- Document any new environment variables or configuration changes in the appropriate README and docs.

## Known TODOs (Backend)

- Improved Error Handling: Currently, error messages might be simplistic. A more robust error management (with proper HTTP status codes and messages) is on the roadmap.
- Entity Recognition Enhancements: The NER functionality may currently rely on precomputed data or simple dictionary lookups. Integration with advanced NLP (perhaps via the Python toolkit or an ML model) is planned.
- Versioning: Document versioning (history of changes) is not yet implemented in the initial release. Database schema has placeholders for tracking changes, but the logic needs to be built.
- Testing: Increase test coverage, especially for critical functionalities like authentication, data import, and search logic.

Keep an eye on ROADMAP.md and GitHub issues for more details on planned backend work.

## Running in Production

When deploying the backend in a production environment, a few considerations:
- Always build with --release for optimizations.
- Use a process supervisor (systemd as shown, or Docker in swarm/K8s) to manage the service.
- Use a robust PostgreSQL setup (enable backups, tuning for large data, etc.).
- Secure the .env file (it contains secrets). In production, you might supply env vars through a secure mechanism (like systemd Environment, Docker secrets, etc.) instead of a plaintext file.
- Monitor resource usage. The backend should be fairly lightweight, but Solr and Postgres will use more memory as data grows. Use monitoring tools to watch these.
- Adjust logging (RUST_LOG=info or warn in production to reduce verbosity).

## Backend API Reference

For a detailed API reference of backend endpoints and data models, see the OpenAPI documentation and Swagger UI as described above. Additionally, if the code has inline documentation, you can generate Rust docs with `cargo doc --open` (or find compiled docs in docs/backend/HistTextWeb/ ). This may include documentation of internal modules and functions which is helpful for developers extending the backend.