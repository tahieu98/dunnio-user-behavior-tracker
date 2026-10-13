# 🚀 Dunnio Behavior Tracker - Hướng dẫn Triển khai

> **Ngày tạo**: 07/10/2026  
> **Phiên bản**: 1.0.0  
> **Loại tài liệu**: Deployment Guide

---

## Mục lục

1. [Yêu cầu Hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt Môi trường](#2-cài-đặt-môi-trường)
3. [Cấu hình Database](#3-cấu-hình-database)
4. [Cài đặt Backend](#4-cài-đặt-backend)
5. [Cài đặt Frontend](#5-cài-đặt-frontend)
6. [Cài đặt Tracker](#6-cài-đặt-tracker)
7. [Kiểm thử](#7-kiểm-thử)
8. [Triển khai Production](#8-triển-khai-production)
9. [Bảo trì & Monitoring](#9-bảo-trì--monitoring)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Yêu cầu Hệ thống

### 1.1 Development Environment

| Component | Phiên bản tối thiểu | Khuyến nghị |
|-----------|---------------------|-------------|
| Node.js | 18.x | 20.x LTS |
| MySQL | 8.0 | 8.0.35+ |
| npm | 9.x | 10.x |
| RAM | 2GB | 4GB+ |
| Disk | 10GB | 20GB+ |

### 1.2 Production Environment

| Component | Specification |
|-----------|--------------|
| CPU | 2 cores minimum |
| RAM | 4GB minimum |
| Storage | 50GB SSD |
| OS | Ubuntu 22.04 LTS / Windows Server 2019 |
| Network | HTTPS required |

---

## 2. Cài đặt Môi trường

### 2.1 Node.js

**Windows (sử dụng Laragon):**
```bash
# Laragon đã có Node.js tích hợp
# Kiểm tra version
node --version
npm --version
```

**Ubuntu:**
```bash
# Cài đặt Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should show v20.x.x
npm --version
```

### 2.2 MySQL

**Windows (Laragon):**
```bash
# Laragon có MySQL tích hợp
# Truy cập phpMyAdmin: http://localhost/phpmyadmin
```

**Ubuntu:**
```bash
# Cài đặt MySQL
sudo apt update
sudo apt install mysql-server

# Start service
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure installation
sudo mysql_secure_installation
```

---

## 3. Cấu hình Database

### 3.1 Tạo Database

```sql
-- Login to MySQL
mysql -u root -p

-- Create database
CREATE DATABASE dunnio_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (optional - root is fine for dev)
CREATE USER 'dunnio_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON dunnio_tracker.* TO 'dunnio_user'@'localhost';
FLUSH PRIVILEGES;

-- Verify
SHOW DATABASES;
USE dunnio_tracker;
SHOW TABLES;
```

### 3.2 Import Schema

```bash
# Method 1: Direct SQL
mysql -u root -p dunnio_tracker < backend/migrations/001_init.sql

# Method 2: Via MySQL CLI
mysql -u root -p
USE dunnio_tracker;
SOURCE backend/migrations/001_init.sql;
```

### 3.3 Tạo Admin User

```javascript
// Generate password hash
// Chạy trong terminal:
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('admin123', 10).then(hash => console.log(hash));
"
```

```sql
-- Insert admin user với hash đã generate
INSERT INTO users (username, email, password_hash, role) 
VALUES ('admin', 'admin@dunnio-tracker.local', '$2b$10$YOUR_GENERATED_HASH_HERE', 'admin');
```

---

## 4. Cài đặt Backend

### 4.1 Clone/Copy Project

```bash
cd C:\laragon\www\dunnio-behavior-tracker\backend
# hoặc
git clone <repository-url> dunnio-behavior-tracker
cd dunnio-behavior-tracker/backend
```

### 4.2 Cài đặt Dependencies

```bash
npm install
```

### 4.3 Cấu hình Environment

```bash
# Copy .env.example to .env
copy .env.example .env
# Windows: copy thay vì cp
```

```env
# .env file
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=dunnio_tracker
DB_USER=root
DB_PASSWORD=your_password

# JWT Secret (THAY ĐỔI TRONG PRODUCTION!)
JWT_SECRET=change-this-to-a-very-long-random-secret-key-in-production

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 4.4 Chạy Backend

```bash
# Development (với auto-reload)
npm run dev

# Production
npm start

# Verify
# Mở browser: http://localhost:3000/api/health
```

**Expected output:**
```json
{
    "success": true,
    "message": "Dunnio Behavior Tracker API is running",
    "version": "1.0.0",
    "timestamp": "2026-10-07T10:30:00Z"
}
```

---

## 5. Cài đặt Frontend

### 5.1 Frontend là Static Files

Frontend đã được cấu hình để phục vụ static files từ folder `frontend/`. Không cần build step.

### 5.2 Serve Frontend

**Option A: Sử dụng Backend (Recommended)**

Backend đã được cấu hình để serve frontend. Chỉ cần truy cập:
- http://localhost:3000/ → redirect to login
- http://localhost:3000/login.html
- http://localhost:3000/dashboard.html

**Option B: Sử dụng Laragon**

```bash
# Thêm domain trong Laragon
# Menu → Apache → sites enabled
# Tạo virtual host cho dunnio-tracker.test
```

**Option C: Sử dụng http-server**

```bash
npm install -g http-server
cd frontend
http-server -p 8080
# Mở http://localhost:8080
```

### 5.3 Cấu hình API Endpoint

Frontend mặc định sử dụng relative path `/api`. Đảm bảo backend chạy trên port 3000.

```javascript
// frontend/js/auth.js và frontend/js/app.js
const API_BASE = '/api';  // Sử dụng relative path
```

---

## 6. Cài đặt Tracker

### 6.1 Cài đặt trên dunniotailor.com

**Bước 1:** Copy tracker file
```bash
# Copy clarity-tracker.js vào website
# Ví dụ: wp-content/themes/your-theme/js/clarity-tracker.js
```

**Bước 2:** Thêm vào theme
```html
<!-- Trong footer.php hoặc functions.php -->
<script>
    // Cấu hình tracker
    var TRACKER_CONFIG = {
        apiEndpoint: 'http://your-local-url:3000/api',
        enabled: true,
        sampleRate: 1,  // 100% users
        debug: false
    };
</script>
<script src="/wp-content/themes/your-theme/js/clarity-tracker.js"></script>
```

**Bước 3:** Verify
```javascript
// Mở DevTools console trên dunniotailor.com
// Gõ:
dunnioTracker

// Should show: BehaviorTracker {...}
```

### 6.2 Cấu hình Backend Endpoint

```bash
# Tạo endpoint mới trong backend/src/index.js
# Thêm route cho tracker events
```

---

## 7. Kiểm thử

### 7.1 Kiểm thử Backend API

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 7.2 Kiểm thử Frontend

1. Mở http://localhost:3000/login.html
2. Đăng nhập với admin/admin123
3. Verify dashboard loads
4. Check console for errors

### 7.3 Test Checklist

| Test | Expected Result |
|------|----------------|
| Login with valid credentials | Success, redirect to dashboard |
| Login with invalid credentials | Error message displayed |
| Access protected route without token | 401 Unauthorized |
| View pages list | All 50 pages displayed |
| View grid for a page | Grid overlay renders |
| Create CTA suggestion | Suggestion created successfully |
| Sync Clarity data | Data imported (if configured) |

### 7.4 Browser Testing

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Tested |
| Firefox | 90+ | ✅ Tested |
| Edge | 90+ | ✅ Tested |
| Safari | 14+ | ⚠️ Partial |

---

## 8. Triển khai Production

### 8.1 Checklist Pre-Production

```
□ Code reviewed
□ All tests passing
□ Security audit completed
□ Performance tested
□ Backup strategy in place
□ Monitoring configured
```

### 8.2 Server Setup

**Ubuntu 22.04 Example:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server

# Install PM2 for process management
npm install -g pm2

# Create app directory
sudo mkdir -p /var/www/dunnio-tracker
sudo chown -R $USER:$USER /var/www/dunnio-tracker
```

### 8.3 Environment Configuration

```bash
# Production .env
PORT=3000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=3306
DB_NAME=dunnio_tracker
DB_USER=dunnio_user
DB_PASSWORD=<secure-password>

JWT_SECRET=<very-long-random-string-min-32-chars>

CORS_ORIGIN=https://tracker.dunnio.com
```

### 8.4 Build & Deploy

```bash
# Clone repository
cd /var/www/dunnio-tracker
git clone <repo-url> .

# Install dependencies
cd backend && npm install --production

# Start with PM2
pm2 start src/index.js --name dunnio-tracker

# Configure startup
pm2 startup
pm2 save

# Setup Nginx reverse proxy
sudo nano /etc/nginx/sites-available/dunnio-tracker
```

```nginx
# Nginx configuration
server {
    listen 80;
    server_name tracker.dunnio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/dunnio-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tracker.dunnio.com
```

### 8.5 Security Checklist

- [ ] Change JWT_SECRET
- [ ] Enable HTTPS (SSL)
- [ ] Configure firewall (ufw)
- [ ] Setup database backups
- [ ] Enable error logging
- [ ] Configure rate limiting
- [ ] Review CORS settings

---

## 9. Bảo trì & Monitoring

### 9.1 PM2 Commands

```bash
# View logs
pm2 logs dunnio-tracker

# Restart
pm2 restart dunnio-tracker

# Monitor
pm2 monit

# List processes
pm2 list
```

### 9.2 Database Backup

```bash
# Create backup script
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/dunnio-tracker
mkdir -p $BACKUP_DIR

mysqldump -u dunnio_user -p dunnio_tracker > $BACKUP_DIR/backup_$DATE.sql
gzip $BACKUP_DIR/backup_$DATE.sql

# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.sql.gz"
```

```bash
# Add to crontab
crontab -e
# Add line:
0 2 * * * /var/www/dunnio-tracker/backup.sh
```

### 9.3 Log Management

```bash
# Setup log rotation
sudo nano /etc/logrotate.d/dunnio-tracker
```

```
/var/www/dunnio-tracker/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
}
```

### 9.4 Monitoring

```bash
# Setup PM2 metrics (optional)
pm2 install pm2-server-monit

# Or use process manager plus
pm2 install pm2-probe
pm2 set pm2-probe.key <your-key>
```

---

## 10. Troubleshooting

### 10.1 Common Issues

#### Issue: "Cannot connect to database"

**Symptoms:** Server fails to start, connection error

**Solution:**
```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection
mysql -u root -p -e "SHOW DATABASES;"

# Verify credentials in .env
cat backend/.env | grep DB_
```

#### Issue: "Module not found"

**Symptoms:** npm install fails

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Issue: "Port already in use"

**Symptoms:** Cannot start server on port 3000

**Solution:**
```bash
# Find process using port
netstat -ano | findstr :3000  # Windows
# or
lsof -i :3000  # Linux

# Kill process or use different port
PORT=3001 npm start
```

#### Issue: "CORS error"

**Symptoms:** API calls blocked by browser

**Solution:**
```env
# Update .env
CORS_ORIGIN=http://localhost:3000
```

#### Issue: "JWT token invalid"

**Symptoms:** Cannot login, token errors

**Solution:**
```bash
# Check JWT_SECRET in .env
# Should be at least 32 characters
# Regenerate if compromised
```

### 10.2 Debug Mode

```env
# Enable debug in .env
NODE_ENV=development

# Frontend debug in tracker
var TRACKER_CONFIG = {
    debug: true  // Enable console logging
};
```

### 10.3 Logs

```bash
# View server logs
pm2 logs dunnio-tracker --lines 100

# View error logs only
pm2 logs dunnio-tracker --err

# View in real-time
pm2 logs dunnio-tracker --raw
```

---

## 11. Quick Reference

### 11.1 Common Commands

```bash
# Start development
cd backend && npm run dev

# Start production
pm2 start src/index.js --name dunnio-tracker

# Restart
pm2 restart dunnio-tracker

# View logs
pm2 logs dunnio-tracker

# Backup database
mysqldump -u root -p dunnio_tracker > backup.sql
```

### 11.2 URLs

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Main application |
| http://localhost:3000/api/health | API health check |
| http://localhost:3000/login.html | Login page |
| http://localhost:3000/dashboard.html | Dashboard |

### 11.3 Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |

### 11.4 Contact

| Role | Contact |
|------|---------|
| Technical Lead | TBD |
| DevOps | TBD |
| Support | TBD |

---

## 12. Checklist Triển khai

### Pre-Deployment
```
□ Development complete
□ All tests passing
□ Code reviewed
□ Security reviewed
□ Documentation complete
```

### Deployment Day
```
□ Backup current system
□ Deploy to staging
□ Run smoke tests
□ Deploy to production
□ Verify all features
□ Monitor logs
```

### Post-Deployment
```
□ User training
□ Documentation published
□ Monitoring active
□ Backup scheduled
□ Support process established
```

---

*Document ends here*
