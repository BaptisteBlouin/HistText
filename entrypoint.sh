#!/bin/bash
set -e

# Create directories for cache files if they don't exist
mkdir -p /data/histtext-tmp

# Setup SSH properly
echo "Setting up SSH..."
if [ -d "/root/.ssh" ]; then
  # Set proper permissions on SSH directory and files
  chmod 700 /root/.ssh
  
  # Set permissions on any private keys
  find /root/.ssh -name "id_*" ! -name "*.pub" -exec chmod 600 {} \;
  
  # Set permissions on public keys and known_hosts
  find /root/.ssh -name "*.pub" -o -name "known_hosts" -exec chmod 644 {} \;
  
  # If known_hosts doesn't exist, create empty one
  if [ ! -f "/root/.ssh/known_hosts" ]; then
    touch /root/.ssh/known_hosts
    chmod 644 /root/.ssh/known_hosts
  fi
  
  # Start SSH agent if not already running
  eval "$(ssh-agent)" 
  
  # Add all private keys to SSH agent
  find /root/.ssh -name "id_*" ! -name "*.pub" -exec ssh-add {} \; || echo "No SSH keys found to add"
  
  # List added SSH keys
  echo "SSH keys loaded:"
  ssh-add -l || echo "No SSH keys loaded"
  
  # Test SSH connectivity if a test host is defined
  if [ -n "$SSH_TEST_HOST" ]; then
    echo "Testing SSH connection to $SSH_TEST_HOST..."
    ssh -o StrictHostKeyChecking=no -T $SSH_TEST_HOST || echo "SSH test connection failed, but continuing..."
  fi
else
  echo "No SSH directory found. SSH tunnels may not work."
fi

# Debug environment
echo "=== Environment Variables ==="
echo "PWD: $(pwd)"
echo "Contents of current directory:"
ls -la
echo "Contents of /app directory:"
ls -la /app
echo "Checking .env file:"
if [ -f /app/.env ]; then
  echo ".env file exists"
  grep -v "PASSWORD\|SECRET\|KEY" /app/.env || echo "No safe environment variables found"
else
  echo ".env file not found!"
fi



# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 -U ${DB_USER:-user}; do
  sleep 2
done
echo "PostgreSQL is ready!"

# Wait for Solr to be ready
echo "Waiting for Solr to be ready..."
until curl --silent --fail http://solr:${SOLR_NER_PORT:-8982}/solr/ || curl --silent --fail http://localhost:${SOLR_NER_PORT:-8982}/solr/ ; do
  echo "Solr not yet ready, retrying..."
  sleep 2
done
echo "Solr is ready!"

# Check if the Rust application is already built
if [ ! -f /app/target/release/backend ] || [ ! -f /app/target/release/frontend ] || [ ! -f /app/target/release/script ]; then
  echo "Building Rust application..."
  cd /app
  cargo build --release
else
  echo "Rust application already built."
fi

# Run database migrations
echo "Running database migrations..."
cd /app
diesel migration run

# Run initialization script to create admin user if not exists
echo "Running initialization script..."
cd /app
./target/release/script


# Setup and start frontend with npm start
echo "Setting up and starting frontend..."
cd /app/frontend
if [ ! -d "node_modules" ]; then
  npm install
fi
npm start &
FRONTEND_PID=$!

# Start backend with cargo watch
echo "Starting backend with cargo watch..."
cd /app
cargo run --release --bin HistTextWeb &
BACKEND_PID=$!

# Handle termination signals
trap "kill $FRONTEND_PID $BACKEND_PID" SIGINT SIGTERM

# Print process status
echo "Frontend process (npm start) running with PID: $FRONTEND_PID"
echo "Backend process (cargo watch) running with PID: $BACKEND_PID"

# Wait for processes to finish
wait $FRONTEND_PID $BACKEND_PID
