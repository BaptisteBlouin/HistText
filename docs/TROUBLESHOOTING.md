# HistText Troubleshooting and Maintenance Guide

## Overview

This guide provides comprehensive troubleshooting steps, maintenance procedures, and solutions for common issues encountered with HistText deployment and operation.

## Quick Diagnostics

### Health Check Commands
```bash
# Application health
curl http://localhost:3000/api/health

# Database connectivity
psql postgres://histtext:password@localhost:5432/historicaltext -c "SELECT 1;"

# Solr connectivity
curl "http://localhost:8982/solr/admin/ping"

# Container status (Docker)
docker-compose ps
docker-compose logs app

# Service status (systemd)
systemctl status histtext
journalctl -u histtext -f
```

### System Information
```bash
# System resources
free -h && df -h && lscpu

# Network ports
netstat -tlnp | grep -E "(3000|8982|5432)"

# Process status
ps aux | grep -E "(histtext|postgres|solr)"
```

## Common Issues and Solutions

### 1. Application Startup Issues

#### Issue: Application fails to start with database connection error
```
Error: Failed to connect to database
Database connection timeout
```

**Diagnosis:**
```bash
# Check database status
systemctl status postgresql
docker-compose logs postgres

# Test database connection
psql postgres://histtext:password@localhost:5432/historicaltext
```

**Solutions:**
```bash
# 1. Restart PostgreSQL
sudo systemctl restart postgresql
# or for Docker
docker-compose restart postgres

# 2. Check database credentials in .env
grep DATABASE_URL .env

# 3. Verify database exists
sudo -u postgres psql -l | grep historicaltext

# 4. Recreate database if needed
sudo -u postgres dropdb historicaltext --if-exists
sudo -u postgres createdb historicaltext -O histtext
diesel migration run
```

#### Issue: Solr connection failed
```
Error: Failed to connect to Solr server
Connection refused to localhost:8982
```

**Diagnosis:**
```bash
# Check Solr status
curl "http://localhost:8982/solr/admin/ping"
docker-compose logs solr

# Check core existence
curl "http://localhost:8982/solr/admin/cores?action=STATUS"
```

**Solutions:**
```bash
# 1. Restart Solr
docker-compose restart solr
# or manually
sudo systemctl restart solr

# 2. Create missing core
curl "http://localhost:8982/solr/admin/cores?action=CREATE&name=ner&instanceDir=ner"

# 3. Check Solr configuration
docker exec -it histtext_solr_1 ls /var/solr/data/

# 4. Reset Solr data (WARNING: destroys data)
docker-compose down
sudo rm -rf data/solr/*
docker-compose up -d
```

#### Issue: Permission denied errors
```
Error: Permission denied (os error 13)
Failed to create directory /data/histtext-tmp
```

**Solutions:**
```bash
# Fix data directory permissions
sudo chown -R $(whoami):$(whoami) data/
chmod -R 755 data/

# Fix Solr permissions (Docker)
sudo chown -R 1000:1000 data/solr

# Fix SSH key permissions
chmod 600 data/ssh/id_rsa
chmod 644 data/ssh/id_rsa.pub
chmod 644 data/ssh/known_hosts
```

### 2. Performance Issues

#### Issue: Slow query responses
```
Queries taking >30 seconds to complete
High CPU/memory usage during searches
```

**Diagnosis:**
```bash
# Monitor system resources
htop
iotop -o

# Check Solr performance
curl "http://localhost:8982/solr/ner/admin/luke?numTerms=0"

# Database performance
sudo -u postgres psql historicaltext -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

**Solutions:**
```bash
# 1. Increase Solr memory
# Edit docker-compose.yml:
# SOLR_HEAP=4g

# 2. Optimize Solr caches
curl -X POST "http://localhost:8982/solr/ner/config" \
  -H 'Content-type:application/json' -d '{
    "set-property": {
      "queryResultCache.size": 2048,
      "documentCache.size": 2048,
      "filterCache.size": 2048
    }
  }'

# 3. Database optimization
sudo -u postgres psql historicaltext -c "ANALYZE; VACUUM;"

# 4. Clear application caches
curl -X POST "http://localhost:3000/api/cache/clear"
```

#### Issue: Out of memory errors
```
thread 'main' panicked at 'out of memory'
Docker container killed (OOMKilled)
```

**Solutions:**
```bash
# 1. Increase Docker memory limits
# Edit docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 8G

# 2. Add swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. Reduce processing batch sizes
# Edit .env:
MAX_SIZE_QUERY=5000
NER_BATCH_SIZE=50
MAX_EMBEDDINGS_FILES=1

# 4. Monitor memory usage
docker stats
free -h
```

### 3. Authentication and Authorization Issues

#### Issue: JWT token authentication failures
```
Error: Invalid or expired token
401 Unauthorized responses
```

**Diagnosis:**
```bash
# Check token in browser developer tools
# Look for 'Authorization' header

# Verify SECRET_KEY configuration
grep SECRET_KEY .env

# Check system time
date
```

**Solutions:**
```bash
# 1. Regenerate SECRET_KEY
openssl rand -hex 32 > secret.txt
# Update .env with new key

# 2. Clear browser storage
# In browser: Application > Storage > Clear All

# 3. Restart application
docker-compose restart app
# or
systemctl restart histtext

# 4. Check token expiration settings
# In .env:
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=604800
```

#### Issue: Permission denied for operations
```
Error: Insufficient permissions
403 Forbidden responses
```

**Solutions:**
```bash
# 1. Check user roles
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/users/me"

# 2. Assign correct roles
# Via admin interface or API:
curl -X POST "http://localhost:3000/api/user_roles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"user_id": 5, "role_id": 1}'

# 3. Reset admin user
cargo run --release --bin script

# 4. Check database permissions
sudo -u postgres psql historicaltext -c "SELECT * FROM user_roles ur JOIN users u ON ur.user_id = u.id;"
```

### 4. Text Processing Issues

#### Issue: NER processing failures
```
Error: NER timeout
Failed to process entities
Empty NER results
```

**Diagnosis:**
```bash
# Check NER cache
ls -la data/histtext-tmp/ner_cache.json

# Monitor processing
docker-compose logs app | grep -i ner

# Check Solr documents
curl "http://localhost:8982/solr/ner/select?q=*:*&rows=1"
```

**Solutions:**
```bash
# 1. Clear NER cache
rm data/histtext-tmp/ner_cache.json
curl -X POST "http://localhost:3000/api/cache/clear/ner"

# 2. Increase timeout settings
# In .env:
NER_TIMEOUT=1200
MAX_ID_NER=500

# 3. Process smaller batches
# In frontend: reduce document selection

# 4. Check document format
# Ensure documents have proper text fields
```

#### Issue: Tokenization errors for Chinese text
```
Error: Chinese tokenization failed
Unexpected token results
```

**Solutions:**
```bash
# 1. Verify Jieba installation
# Check in Docker container:
docker exec -it histtext_app_1 bash
python3 -c "import jieba; print('Jieba working')"

# 2. Reset tokenization cache
rm data/histtext-tmp/tokenization_cache.json

# 3. Update configuration
# In .env:
CHINESE_TOKENIZER=jieba
TOKENIZER_CACHE_SIZE=100000
```

#### Issue: Word embeddings not loading
```
Error: Failed to load embeddings
Embeddings file not found
```

**Solutions:**
```bash
# 1. Check embeddings file
ls -la data/embeddings/
file data/embeddings/glove.6B.50d.txt

# 2. Download embeddings
cd data/embeddings/
wget http://nlp.stanford.edu/data/glove.6B.zip
unzip glove.6B.zip

# 3. Update configuration
# In .env:
EMBED_PATH=/data/embeddings/glove.6B.50d.txt

# 4. Clear embeddings cache
curl -X POST "http://localhost:3000/api/cache/clear/embeddings"
```

### 5. SSH Tunnel Issues

#### Issue: SSH tunnel connection failures
```
Error: Failed to establish SSH tunnel
Connection refused
Authentication failed
```

**Diagnosis:**
```bash
# Test SSH connection manually
ssh -v user@remote-server.com

# Check SSH keys
ls -la data/ssh/
ssh-keygen -l -f data/ssh/id_rsa.pub

# Check known_hosts
cat data/ssh/known_hosts
```

**Solutions:**
```bash
# 1. Generate new SSH keys
ssh-keygen -t rsa -b 4096 -f data/ssh/id_rsa -N ""

# 2. Add public key to remote server
ssh-copy-id -i data/ssh/id_rsa.pub user@remote-server.com

# 3. Update known_hosts
ssh-keyscan remote-server.com >> data/ssh/known_hosts

# 4. Check database configuration
sudo -u postgres psql historicaltext -c "SELECT * FROM solr_databases;"

# 5. Test tunnel manually
ssh -L 8983:localhost:8983 user@remote-server.com -N
```

### 6. SSH Tunnel Issues

#### Issue: SSH tunnel connection failed
```
Error: SSH connection timeout
Failed to establish tunnel
Permission denied (publickey)
```

**Solutions:**
```bash
# 1. Check SSH key permissions
chmod 600 data/ssh/private_key
chmod 700 data/ssh/

# 2. Test SSH connection manually
ssh -i data/ssh/private_key user@remote-host
ssh -L 8983:localhost:8983 -N user@remote-host

# 3. Verify solr_databases table configuration
# Connect to PostgreSQL and check:
SELECT * FROM solr_databases WHERE url LIKE '%@%';

# 4. Check SSH key format
file data/ssh/private_key
# Should show: OpenSSH private key

# 5. Debug SSH connection
ssh -vvv -i data/ssh/private_key user@remote-host

# 6. Check if SSH service is running on remote host
nmap -p 22 remote-host.com
```

#### Issue: SSH tunnel drops frequently
```
Error: SSH tunnel disconnected
Connection reset by peer
```

**Solutions:**
```bash
# 1. Add keep-alive settings
# In .ssh/config:
Host remote-host.com
    ServerAliveInterval 60
    ServerAliveCountMax 3

# 2. Check network stability
ping remote-host.com

# 3. Monitor SSH process
ps aux | grep ssh
tail -f /var/log/auth.log

# 4. Restart application to recreate tunnels
docker-compose restart app
```

### 7. Cache Performance Issues

#### Issue: Cache memory usage too high
```
Error: Out of memory
Cache size exceeded
L1 cache eviction too frequent
```

**Solutions:**
```bash
# 1. Monitor cache statistics
curl "http://localhost:3000/api/embeddings/cache/stats"

# 2. Adjust cache settings
# In .env:
MAX_EMBEDDINGS_FILES=2
CACHE_SIZE_LIMIT=512MB

# 3. Clear specific caches
curl -X POST "http://localhost:3000/api/cache/clear/embeddings"
curl -X POST "http://localhost:3000/api/cache/clear/ner"

# 4. Monitor memory usage
docker stats histtext_app_1
htop
```

#### Issue: Cache hit rate too low
```
Warning: Low cache hit rate
Performance degradation
Frequent L2/L3 cache misses
```

**Solutions:**
```bash
# 1. Check cache configuration
# Verify cache hierarchy is working:
# L1: Memory (DashMap) -> L2: File -> L3: Database

# 2. Warm up caches
# Access frequently used collections first
curl "http://localhost:3000/api/solr/query?collection=main&q=*:*"

# 3. Optimize cache TTL
# Increase cache lifetime for stable data

# 4. Monitor cache patterns
tail -f logs/cache.log | grep "hit_rate"
```

### 8. Frontend Issues

#### Issue: Frontend build failures
```
Error: npm install failed
Module not found
Build process crashed
```

**Solutions:**
```bash
# 1. Clear npm cache
cd app/frontend
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# 2. Update Node.js version
nvm install 18
nvm use 18

# 3. Fix permission issues
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) app/frontend/node_modules

# 4. Build with verbose output
npm run build --verbose
```

#### Issue: Frontend runtime errors
```
Error: Cannot read property of undefined
Failed to fetch API data
CORS errors
```

**Solutions:**
```bash
# 1. Check API connectivity
curl "http://localhost:3000/api/health"

# 2. Verify proxy configuration
# In vite.config.ts:
server: {
  proxy: {
    '/api': 'http://localhost:3000'
  }
}

# 3. Clear browser cache
# Hard refresh: Ctrl+Shift+R

# 4. Check CORS configuration
# In .env:
CORS_ALLOWED_ORIGINS=http://localhost:21012,http://localhost:3000
```

## Maintenance Procedures

### 1. Regular Maintenance Tasks

#### Daily Tasks
```bash
#!/bin/bash
# daily_maintenance.sh

# Check system health
curl -s http://localhost:3000/api/health > /dev/null || echo "Application unhealthy"

# Monitor disk space
df -h | awk '$5 > 80 {print "Warning: " $0}'

# Check log sizes
find /var/log -name "*.log" -size +100M

# Monitor active connections
netstat -an | grep :3000 | wc -l
```

#### Weekly Tasks
```bash
#!/bin/bash
# weekly_maintenance.sh

# Database maintenance
sudo -u postgres psql historicaltext -c "ANALYZE; VACUUM;"

# Clear old logs
journalctl --vacuum-time=7d

# Update system packages
sudo apt update && sudo apt upgrade -y

# Restart services to clear memory
docker-compose restart
```

#### Monthly Tasks
```bash
#!/bin/bash
# monthly_maintenance.sh

# Full database backup
pg_dump -U histtext historicaltext | gzip > /backups/histtext_$(date +%Y%m%d).sql.gz

# Clean old backups (keep 6 months)
find /backups -name "histtext_*.sql.gz" -mtime +180 -delete

# Update Docker images
docker-compose pull
docker-compose up -d

# Security updates
sudo apt update && sudo apt upgrade -y
```

### 2. Cache Management

#### Clear All Caches
```bash
# API endpoint
curl -X POST "http://localhost:3000/api/cache/clear"

# Manual cache clearing
rm -f data/histtext-tmp/ner_cache.json
rm -f data/histtext-tmp/stats_cache.json
rm -rf data/histtext-tmp/embeddings_cache/

# Restart application
docker-compose restart app
```

#### Monitor Cache Performance
```bash
# Cache statistics
curl "http://localhost:3000/api/cache/stats"

# Cache hit rates
tail -f logs/app.log | grep -i cache

# Memory usage
docker stats histtext_app_1
```

### 3. Database Maintenance

#### Performance Optimization
```sql
-- Run in PostgreSQL
ANALYZE;
VACUUM FULL;

-- Reindex tables
REINDEX DATABASE historicaltext;

-- Update statistics
ANALYZE VERBOSE;
```

#### Connection Management
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Kill long-running queries
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE query_start < now() - interval '1 hour';
```

### 4. Log Management

#### Configure Log Rotation
```bash
# /etc/logrotate.d/histtext
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

#### Monitor Logs
```bash
# Real-time monitoring
tail -f /var/log/histtext/app.log

# Error analysis
grep -i error /var/log/histtext/app.log | tail -20

# Performance monitoring
grep -i "slow query" /var/log/histtext/app.log
```

### 5. Security Maintenance

#### Update Secrets
```bash
# Generate new JWT secret
openssl rand -hex 32

# Rotate database password
sudo -u postgres psql -c "ALTER USER histtext PASSWORD 'new_password';"

# Update .env file
sed -i 's/SECRET_KEY=.*/SECRET_KEY=new_secret/' .env
```

#### Security Audit
```bash
# Check for security updates
sudo apt list --upgradable | grep -i security

# Audit file permissions
find . -type f -perm /o+w

# Check network exposure
nmap localhost -p 1-65535
```

## Monitoring and Alerting

### System Monitoring
```bash
# CPU and Memory monitoring script
#!/bin/bash
# monitor.sh

CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
MEM_USAGE=$(free | grep Mem | awk '{printf("%.1f"), $3/$2 * 100.0}')

if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "High CPU usage: $CPU_USAGE%"
fi

if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo "High memory usage: $MEM_USAGE%"
fi
```

### Application Monitoring
```bash
# Health check script
#!/bin/bash
# health_check.sh

HEALTH=$(curl -s http://localhost:3000/api/health | jq -r '.status')

if [ "$HEALTH" != "healthy" ]; then
    echo "Application unhealthy"
    # Send alert email or notification
    systemctl restart histtext
fi
```

### Log Analysis
```bash
# Error rate monitoring
grep -c "ERROR" /var/log/histtext/app.log

# Response time analysis
awk '/response_time/ {sum+=$NF; count++} END {print "Average response time:", sum/count "ms"}' /var/log/histtext/app.log

# Top errors
grep "ERROR" /var/log/histtext/app.log | cut -d' ' -f5- | sort | uniq -c | sort -nr
```

## Recovery Procedures

### Application Recovery
```bash
# Quick recovery
docker-compose restart

# Full recovery
docker-compose down
docker-compose up -d

# Manual service recovery
systemctl stop histtext
systemctl start histtext
```

### Database Recovery
```bash
# From backup
gunzip histtext_backup.sql.gz
sudo -u postgres psql historicaltext < histtext_backup.sql

# Reset and reimport
sudo -u postgres dropdb historicaltext
sudo -u postgres createdb historicaltext -O histtext
diesel migration run
cargo run --release --bin script
```

### Disaster Recovery
```bash
# Complete system rebuild
git pull origin master
docker-compose down -v
rm -rf data/*
docker-compose build --no-cache
docker-compose up -d
```

This troubleshooting guide provides comprehensive coverage for maintaining and troubleshooting HistText in production environments.