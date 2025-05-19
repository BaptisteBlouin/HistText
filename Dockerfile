FROM rust:1.85

WORKDIR /app

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libpq-dev \
    postgresql-client \
    nodejs \
    npm \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Install Rust tools
RUN cargo install cargo-watch
RUN cargo install diesel_cli --no-default-features --features postgres

# Set environment variables
ENV SQLX_OFFLINE=1
ENV CRA_MANIFEST_PATH=/app/frontend/dist/.vite/manifest.json
ENV CRA_FRONTEND_DIR=/app/frontend/
ENV CRA_VIEWS_GLOB=/app/backend/views/**/*.html

# Copy the entrypoint script
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose ports
EXPOSE 3000 8000 60012

ENTRYPOINT ["entrypoint.sh"]