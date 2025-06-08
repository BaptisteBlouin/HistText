# HistText Deployment Guide

## Overview

This guide covers comprehensive deployment strategies for HistText, from local development to production environments. HistText can be deployed using Docker (recommended) or manual installation across different platforms.

## Deployment Methods

### 1. Docker Deployment (Recommended)

Docker deployment provides the most reliable and consistent environment across different systems.

#### Prerequisites
```bash
# System requirements
- Docker 23.0+ with Docker Compose 2.0+
- 4GB+ RAM (8GB+ recommended for production)
- 20GB+ free disk space
- Linux/macOS/Windows with WSL2

# Network requirements
- Ports 3000, 8982, 15432 available
- Internet access for image downloads
```

#### Quick Start Deployment
```bash
# 1. Clone repository
git clone https://github.com/BaptisteBlouin/HistText.git
cd HistText

# 2. Create required directories
mkdir -p data/{postgres,solr,histtext-tmp,ssh,embeddings}

# 3. Set correct permissions for Solr
sudo chown -R 1000:1000 data/solr

# 4. Configure environment
cp .env.example .env
nano .env  # Edit configuration (see Configuration section)

# 5. Start services
docker-compose up -d

# 6. Verify deployment
curl http://localhost:3000/api/health
```

#### Production Docker Configuration

**docker-compose.prod.yml**
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      - ./ssl:/ssl:ro  # SSL certificates
    environment:
      - RUST_ENV=production
      - RUST_LOG=info
      - DATABASE_URL=postgres://histtext:${DB_PASSWORD}@postgres:5432/historicaltext
    env_file:
      - .env.prod
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      solr:
        condition: service_healthy
    networks:
      - histtext-network
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
        reservations:
          memory: 2G
          cpus: '1.0'

  postgres:
    image: postgres:15-alpine
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    environment:
      - POSTGRES_USER=histtext
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=historicaltext
    restart: unless-stopped
    healthcheck:
      test: pg_isready -U histtext -d historicaltext
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - histtext-network
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'

  solr:
    image: solr:9.4-slim
    user: "1000:1000"
    ports:
      - "127.0.0.1:8982:8982"
    volumes:
      - solr_data:/var/solr
      - ./solr/config:/opt/solr/server/solr/configsets/histtext:ro
    environment:
      - SOLR_PORT=8982
      - SOLR_HEAP=2g
      - SOLR_JAVA_MEM=-Xms1g -Xmx2g
    command:
      - solr-precreate
      - ner
      - /opt/solr/server/solr/configsets/histtext
    restart: unless-stopped
    healthcheck:
      test: curl -f http://localhost:8982/solr/admin/ping
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - histtext-network
    deploy:
      resources:
        limits:
          memory: 3G
          cpus: '2.0'

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
      - ./logs/nginx:/var/log/nginx
    restart: unless-stopped
    depends_on:
      - app
    networks:
      - histtext-network

networks:
  histtext-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  postgres_data:
    driver: local
  solr_data:
    driver: local
```

### 2. Manual Deployment

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

# Build backend
cd ..
cargo build --release

# Run database migrations
diesel migration run

# Initialize admin user
cargo run --release --bin script

# Create systemd service
sudo cp deployment/histtext.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable histtext
sudo systemctl start histtext
```

### 3. Kubernetes Deployment

#### Kubernetes Manifests

**namespace.yaml**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: histtext
```

**configmap.yaml**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: histtext-config
  namespace: histtext
data:
  DATABASE_URL: "postgres://histtext:password@postgres:5432/historicaltext"
  SOLR_NER_PORT: "8982"
  RUST_LOG: "info"
  PATH_STORE_FILES: "/data/histtext-tmp"
```

**postgres-deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: histtext
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_USER
          value: "histtext"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: histtext-secrets
              key: db-password
        - name: POSTGRES_DB
          value: "historicaltext"
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1"
      volumes:
      - name: postgres-data
        persistentVolumeClaim:
          claimName: postgres-pvc
```

**histtext-deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: histtext-app
  namespace: histtext
spec:
  replicas: 2
  selector:
    matchLabels:
      app: histtext-app
  template:
    metadata:
      labels:
        app: histtext-app
    spec:
      containers:
      - name: histtext
        image: histtext:latest
        envFrom:
        - configMapRef:
            name: histtext-config
        - secretRef:
            name: histtext-secrets
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: histtext-data
          mountPath: /data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: histtext-data
        persistentVolumeClaim:
          claimName: histtext-pvc
```

## Environment-Specific Configurations

### Development Environment
```bash
# .env.development
RUST_ENV=development
RUST_LOG=debug
RUST_BACKTRACE=1
DATABASE_URL=postgres://histtext:dev_password@localhost:5432/historicaltext_dev
SOLR_NER_PORT=8983
DEBUG_MODE=true
ENABLE_DEV_TOOLS=true
```

### Staging Environment
```bash
# .env.staging
RUST_ENV=staging
RUST_LOG=info
DATABASE_URL=postgres://histtext:${DB_PASSWORD}@staging-db:5432/historicaltext_staging
SOLR_NER_PORT=8982
SEND_MAIL=false
ENABLE_METRICS=true
```

### Production Environment

Based on actual `app/backend/config.rs` implementation:

```bash
# .env.production - Verified Environment Variables
DATABASE_URL=postgres://histtext:${DB_PASSWORD}@prod-db:5432/historicaltext
SECRET_KEY=your-256-bit-secret-key-here

# Solr Configuration  
SOLR_NER_PORT=8982

# Storage Paths
PATH_STORE_FILES=/data/histtext-tmp
EMBED_PATH=/data/embeddings/glove.6B.50d.txt

# Performance Tuning
MAX_SIZE_QUERY=20000
MAX_EMBEDDINGS_FILES=3

# Optional: Mail configuration
MAIL_FROM=noreply@your-domain.com
MAIL_REPLY_TO=support@your-domain.com
```

### SSH Key Management for Production

```bash
# SSH keys location for tunnels
mkdir -p /data/ssh/
chmod 700 /data/ssh/
chown app:app /data/ssh/

# Place SSH private keys in /data/ssh/ directory
# Keys should be referenced in solr_databases table configuration
```

## SSL/TLS Configuration

### Nginx SSL Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for long-running queries
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### Let's Encrypt SSL
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Database Management

### Backup Strategy
```bash
#!/bin/bash
# backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="historicaltext"
DB_USER="histtext"

# Create backup
pg_dump -U $DB_USER -h localhost $DB_NAME > $BACKUP_DIR/histtext_backup_$TIMESTAMP.sql

# Compress backup
gzip $BACKUP_DIR/histtext_backup_$TIMESTAMP.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "histtext_backup_*.sql.gz" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/histtext_backup_$TIMESTAMP.sql.gz s3://your-backup-bucket/database/
```

### Database Restore
```bash
# Restore from backup
gunzip histtext_backup_20250108_120000.sql.gz
psql -U histtext -h localhost historicaltext < histtext_backup_20250108_120000.sql
```

### Database Migrations
```bash
# Check current migration status
diesel migration list

# Run pending migrations
diesel migration run

# Rollback last migration
diesel migration revert

# Generate new migration
diesel migration generate add_new_feature
```

## Monitoring and Logging

### System Monitoring
```bash
# Install monitoring tools
sudo apt-get install prometheus node-exporter grafana

# Configure Prometheus
sudo nano /etc/prometheus/prometheus.yml
```

**prometheus.yml**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'histtext'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
      
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
```

### Log Management
```bash
# Configure log rotation
sudo nano /etc/logrotate.d/histtext
```

**logrotate configuration**
```
/var/log/histtext/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 histtext histtext
    postrotate
        systemctl reload histtext
    endscript
}
```

### Application Metrics
```bash
# View application logs
journalctl -u histtext -f

# Monitor resource usage
htop
iotop
iftop

# Database performance
sudo -u postgres psql historicaltext -c "SELECT * FROM pg_stat_activity;"
```

## Performance Optimization

### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX CONCURRENTLY idx_security_events_time ON security_events(created_at);

-- Analyze and vacuum regularly
ANALYZE;
VACUUM;

-- Configure PostgreSQL
-- postgresql.conf optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
```

### Solr Optimization
```bash
# Increase JVM heap size
export SOLR_HEAP=4g

# Configure Solr cache sizes
curl -X POST "http://localhost:8982/solr/ner/config" -H 'Content-type:application/json' -d '{
  "set-property": {
    "queryResultCache.size": 1024,
    "documentCache.size": 1024,
    "filterCache.size": 1024
  }
}'
```

### Application Optimization
```bash
# Rust compiler optimizations
export RUSTFLAGS="-C target-cpu=native"
cargo build --release

# Enable memory optimization
export RUST_MIN_STACK=8388608

# Configure thread pools
export RAYON_NUM_THREADS=4
```

## Security Hardening

### System Security
```bash
# Firewall configuration
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 5432/tcp   # PostgreSQL (internal only)
sudo ufw deny 8982/tcp   # Solr (internal only)

# Fail2ban for brute force protection
sudo apt-get install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

### Application Security
```bash
# Set secure file permissions
chmod 600 .env*
chmod 700 data/ssh/
chmod 600 data/ssh/id_rsa

# Secure database
sudo -u postgres psql -c "ALTER USER histtext PASSWORD 'new_secure_password';"

# Rotate JWT secrets
openssl rand -hex 32  # Generate new SECRET_KEY
```

## Troubleshooting Deployment

### Common Issues

**Port conflicts:**
```bash
# Check port usage
sudo netstat -tlnp | grep :3000
sudo lsof -i :3000

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:3000)
```

**Permission issues:**
```bash
# Fix Solr permissions
sudo chown -R 1000:1000 data/solr

# Fix application permissions
sudo chown -R histtext:histtext /opt/histtext
```

**Database connection issues:**
```bash
# Test database connection
psql postgres://histtext:password@localhost:5432/historicaltext

# Check database status
sudo systemctl status postgresql
```

**Memory issues:**
```bash
# Monitor memory usage
free -h
cat /proc/meminfo

# Increase swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

This deployment guide provides comprehensive coverage for deploying HistText in various environments with proper security, monitoring, and optimization considerations.