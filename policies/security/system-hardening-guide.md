# System Hardening Guide
## Law Firm Pro - Security Hardening Standards

**Document ID:** SEC-HRD-001  
**Version:** 1.0  
**Effective Date:** 2025-08-31  
**Review Date:** 2026-02-28  
**Owner:** Chief Information Security Officer (CISO)  
**Classification:** CONFIDENTIAL

---

## 1. Overview

This guide provides comprehensive hardening procedures for all systems within Law Firm Pro's infrastructure. Following these standards ensures compliance with Chinese legal requirements and industry best practices.

### 1.1 Objectives
- Minimize attack surface
- Implement defense-in-depth security
- Ensure system integrity and availability
- Meet regulatory compliance requirements
- Protect sensitive client and case information

### 1.2 Scope
- All production servers and workstations
- Network infrastructure devices
- Cloud resources and services
- Database systems
- Application servers

---

## 2. Operating System Hardening

### 2.1 Linux Server Hardening (RHEL/CentOS/Ubuntu)

#### 2.1.1 Initial Setup
```bash
# Update system packages
sudo yum update -y  # RHEL/CentOS
sudo apt update && sudo apt upgrade -y  # Ubuntu

# Remove unnecessary packages
sudo yum remove telnet rsh-server rlogin-server ypserv  # RHEL/CentOS
sudo apt remove telnetd rsh-server ypserv  # Ubuntu

# Install security tools
sudo yum install -y firewalld fail2ban aide  # RHEL/CentOS
sudo apt install -y ufw fail2ban aide  # Ubuntu
```

#### 2.1.2 User and Group Management
```bash
# Create dedicated service accounts
sudo groupadd -r service_accounts
sudo useradd -r -g service_accounts -s /sbin/nologin app_user

# Remove unused user accounts
sudo userdel -r unused_user

# Lock system accounts
sudo passwd -l bin daemon adm lp sync shutdown halt mail news uucp operator games gopher ftp

# Set password policies
sudo authconfig --passminlen=12 --passminclass=3 --passmaxrepeat=3 --update  # RHEL/CentOS
```

#### 2.1.3 File System Security
```bash
# Set secure permissions on critical directories
sudo chmod 700 /root
sudo chmod 755 /home
sudo chmod 750 /etc/sudoers.d

# Set secure umask
echo "umask 027" | sudo tee -a /etc/profile
echo "umask 027" | sudo tee -a /etc/bashrc

# Mount /tmp with noexec and nosuid
sudo mount -o remount,noexec,nosuid /tmp
echo "tmpfs /tmp tmpfs defaults,noexec,nosuid 0 0" | sudo tee -a /etc/fstab
```

#### 2.1.4 Service Hardening
```bash
# Disable unnecessary services
sudo systemctl disable avahi-daemon cups bluetooth
sudo systemctl stop avahi-daemon cups bluetooth

# Enable and start security services
sudo systemctl enable --now firewalld
sudo systemctl enable --now fail2ban
sudo systemctl enable --now aide

# Configure SSH
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
sudo tee /etc/ssh/sshd_config > /dev/null <<EOL
Port 22
Protocol 2
PermitRootLogin no
PermitEmptyPasswords no
PasswordAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd yes
AcceptEnv LANG LC_*
Subsystem sftp /usr/libexec/openssh/sftp-server
AllowUsers app_user
MaxAuthTries 3
LoginGraceTime 60
ClientAliveInterval 300
ClientAliveCountMax 0
EOL

sudo systemctl restart sshd
```

#### 2.1.5 Firewall Configuration
```bash
# Configure firewall (RHEL/CentOS)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload

# Configure firewall (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow https
sudo ufw allow http
sudo ufw enable
```

#### 2.1.6 System Logging
```bash
# Configure centralized logging
sudo tee /etc/rsyslog.d/security.conf > /dev/null <<EOL
authpriv.* /var/log/secure
mail.* /var/log/maillog
kern.* /var/log/kern.log
daemon.* /var/log/daemon.log
syslog.* /var/log/syslog
user.* /var/log/user.log
*.info;mail.none;authpriv.none;cron.none /var/log/messages
*.emerg *
EOL

sudo systemctl restart rsyslog

# Configure log rotation
sudo tee /etc/logrotate.d/security > /dev/null <<EOL
/var/log/secure /var/log/maillog /var/log/kern.log {
    daily
    rotate 90
    compress
    delaycompress
    missingok
    notifempty
    create 640 root adm
    postrotate
        systemctl reload rsyslog
    endscript
}
EOL
```

### 2.2 Windows Server Hardening

#### 2.2.1 Initial Configuration
```powershell
# Install Windows Server updates
Install-WindowsFeature -Name Windows-Server-Backup
Install-WindowsFeature -Name Windows-Defender-Features

# Disable unnecessary services
Set-Service -Name "Telnet" -StartupType Disabled
Set-Service -Name "RemoteRegistry" -StartupType Disabled
Set-Service -Name "SNMP" -StartupType Disabled

# Configure Windows Firewall
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
New-NetFirewallRule -DisplayName "Allow SSH" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow
New-NetFirewallRule -DisplayName "Allow HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

#### 2.2.2 User Account Control
```powershell
# Enable UAC
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "EnableLUA" -Value 1
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "ConsentPromptBehaviorAdmin" -Value 2

# Configure password policy
secedit /export /cfg C:\secpol.cfg
(Get-Content C:\secpol.cfg).replace("MinimumPasswordLength = 0", "MinimumPasswordLength = 12") | Set-Content C:\secpol.cfg
(Get-Content C:\secpol.cfg).replace("PasswordComplexity = 0", "PasswordComplexity = 1") | Set-Content C:\secpol.cfg
secedit /configure /db C:\Windows\security\local.sdb /cfg C:\secpol.cfg /areas SECURITYPOLICY
```

---

## 3. Database Hardening

### 3.1 PostgreSQL Hardening

#### 3.1.1 Configuration File (postgresql.conf)
```ini
# Security settings
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
password_encryption = scram-sha-256

# Connection settings
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 256MB

# Logging settings
log_connections = on
log_disconnections = on
log_statement = 'ddl'
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Memory settings
work_mem = 4MB
maintenance_work_mem = 64MB
effective_cache_size = 4GB
```

#### 3.1.2 Client Authentication (pg_hba.conf)
```ini
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     scram-sha-256
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    lawfirmpro      app_user        10.0.0.0/8             scram-sha-256
host    all             all             0.0.0.0/0               reject
```

#### 3.1.3 Role Management
```sql
-- Create application role
CREATE ROLE app_user WITH LOGIN PASSWORD 'secure_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Create read-only role
CREATE ROLE read_only;
GRANT CONNECT ON DATABASE lawfirmpro TO read_only;
GRANT USAGE ON SCHEMA public TO read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_only;

-- Create read-write role
CREATE ROLE read_write;
GRANT CONNECT ON DATABASE lawfirmpro TO read_write;
GRANT USAGE ON SCHEMA public TO read_write;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO read_write;
```

### 3.2 Redis Hardening

#### 3.2.1 Configuration File (redis.conf)
```ini
# Security settings
bind 127.0.0.1
port 6379
protected-mode yes
requirepass very_strong_password_here
maxmemory 2gb
maxmemory-policy allkeys-lru

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
```

---

## 4. Web Server Hardening

### 4.1 Nginx Hardening

#### 4.1.1 Security Configuration (nginx.conf)
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-src 'self';" always;

    # SSL/TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Server configuration
    server {
        listen 80;
        server_name lawfirmpro.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name lawfirmpro.com;

        ssl_certificate /etc/letsencrypt/live/lawfirmpro.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/lawfirmpro.com/privkey.pem;

        # Security measures
        client_max_body_size 10M;
        client_body_timeout 30s;
        client_header_timeout 30s;
        send_timeout 30s;

        # Location blocks
        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /auth/login {
            limit_req zone=login burst=10 nodelay;
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Security locations
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }

        location ~* \.(log|txt)$ {
            deny all;
            access_log off;
            log_not_found off;
        }
    }
}
```

### 4.2 Node.js Application Security

#### 4.2.1 Security Middleware (security.js)
```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const session = require('express-session');

// Security middleware configuration
const securityMiddleware = (app) => {
    // Helmet for security headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https:"],
                fontSrc: ["'self'", "data:"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'self'"]
            }
        }
    }));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.'
    });

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // limit each IP to 5 login attempts per windowMs
        message: 'Too many login attempts, please try again later.'
    });

    app.use('/api/', limiter);
    app.use('/auth/login', authLimiter);

    // Session configuration
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }));

    // CSRF protection
    const csrfProtection = csrf({ cookie: true });
    app.use(csrfProtection);

    // Error handling
    app.use((err, req, res, next) => {
        if (err.code === 'EBADCSRFTOKEN') {
            res.status(403).json({ error: 'Invalid CSRF token' });
        } else {
            next(err);
        }
    });
};

module.exports = securityMiddleware;
```

---

## 5. Container Security

### 5.1 Docker Security

#### 5.1.1 Dockerfile Security
```dockerfile
# Use official base images
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY --chown=nextjs:nodejs . .

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

#### 5.1.2 Docker Security Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/lawfirmpro
    depends_on:
      - db
      - redis
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - NET_BIND_SERVICE
    user: "1001:1001"

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=lawfirmpro
      - POSTGRES_USER=lawfirm
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./security/db-init.sql:/docker-entrypoint-initdb.d/init.sql
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /var/run/postgresql
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - DAC_OVERRIDE
    user: "999:999"

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
    user: "999:999"

volumes:
  postgres_data:
  redis_data:
```

#### 5.1.3 Docker Daemon Security
```json
// /etc/docker/daemon.json
{
  "icc": false,
  "userland-proxy": false,
  "live-restore": true,
  "no-new-privileges": true,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

---

## 6. Network Security

### 6.1 Kubernetes Security

#### 6.1.1 Pod Security Context
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lawfirmpro-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: lawfirmpro
  template:
    metadata:
      labels:
        app: lawfirmpro
    spec:
      securityContext:
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      containers:
      - name: app
        image: lawfirmpro/app:latest
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          capabilities:
            drop:
            - ALL
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: NODE_ENV
          value: "production"
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: config
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: tmp
        emptyDir: {}
      - name: config
        configMap:
          name: app-config
```

#### 6.1.2 Network Policy
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: lawfirmpro-network-policy
spec:
  podSelector:
    matchLabels:
      app: lawfirmpro
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to: []
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

### 6.2 AWS Security Configuration

#### 6.2.1 Security Groups
```hcl
# Terraform configuration
resource "aws_security_group" "lawfirmpro_app" {
  name        = "${var.environment}-lawfirmpro-app"
  description = "Security group for Law Firm Pro application"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.lb.id]
    description     = "Allow traffic from load balancer"
  }

  ingress {
    from_port       = 9229
    to_port         = 9229
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
    description     = "Allow debugging from bastion"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-lawfirmpro-app"
  })
}
```

---

## 7. Monitoring and Logging

### 7.1 Security Monitoring Configuration

#### 7.1.1 Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "security_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'lawfirmpro-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
    scrape_interval: 15s

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['localhost:9187']
    scrape_interval: 15s
```

#### 7.1.2 Security Alert Rules
```yaml
# security_rules.yml
groups:
  - name: security
    rules:
      - alert: HighRateOfFailedLogins
        expr: rate(login_failed_total[5m]) > 5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High rate of failed login attempts"
          description: "High rate of failed login attempts detected ({{ $value }} attempts/5m)"

      - alert: SuspiciousNetworkActivity
        expr: rate(network_connections_total[5m]) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Suspicious network activity detected"
          description: "High rate of network connections detected ({{ $value }} connections/5m)"

      - alert: DatabaseConnectionErrors
        expr: rate(db_connection_errors_total[5m]) > 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connection errors detected"
          description: "High rate of database connection errors ({{ $value }} errors/5m)"
```

---

## 8. Compliance and Validation

### 8.1 Security Validation Scripts

#### 8.1.1 System Hardening Check
```bash
#!/bin/bash
# security-check.sh - System hardening validation

echo "Starting security hardening validation..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

# Check for unnecessary services
echo "Checking for unnecessary services..."
UNNECESSARY_SERVICES=("telnet" "rsh" "rlogin" "ypserv")
for service in "${UNNECESSARY_SERVICES[@]}"; do
    if systemctl is-active --quiet "$service"; then
        echo "FAIL: $service is running"
    else
        echo "PASS: $service is not running"
    fi
done

# Check password policy
echo "Checking password policy..."
if grep -q "PASS_MIN_LEN 12" /etc/login.defs; then
    echo "PASS: Minimum password length is 12"
else
    echo "FAIL: Minimum password length is not 12"
fi

# Check SSH configuration
echo "Checking SSH configuration..."
if grep -q "PermitRootLogin no" /etc/ssh/sshd_config; then
    echo "PASS: Root login is disabled"
else
    echo "FAIL: Root login is enabled"
fi

if grep -q "PasswordAuthentication no" /etc/ssh/sshd_config; then
    echo "PASS: Password authentication is disabled"
else
    echo "FAIL: Password authentication is enabled"
fi

# Check firewall status
echo "Checking firewall status..."
if systemctl is-active --quiet firewalld; then
    echo "PASS: Firewall is running"
else
    echo "FAIL: Firewall is not running"
fi

# Check for automatic updates
echo "Checking automatic updates..."
if systemctl is-enabled --quiet dnf-automatic || systemctl is-enabled --quiet unattended-upgrades; then
    echo "PASS: Automatic updates are enabled"
else
    echo "FAIL: Automatic updates are not enabled"
fi

echo "Security hardening validation completed."
```

### 8.2 Compliance Scanning

#### 8.2.1 Lynis Security Scan
```bash
#!/bin/bash
# compliance-scan.sh - Run Lynis security audit

echo "Starting compliance scan..."

# Install Lynis if not present
if ! command -v lynis &> /dev/null; then
    echo "Installing Lynis..."
    # Add Lynis repository and install
    echo "deb https://packages.cisofy.com/community/lynis/deb/ stable main" | sudo tee /etc/apt/sources.list.d/cisofy-lynis.list
    wget -O - https://packages.cisofy.com/keys/cisofy-software-public.key | sudo apt-key add -
    sudo apt update
    sudo apt install -y lynis
fi

# Run Lynis scan
sudo lynis audit system

# Generate report
echo "Generating compliance report..."
sudo lynis show details > /tmp/lynis-report.txt

echo "Compliance scan completed. Report saved to /tmp/lynis-report.txt"
```

---

## 9. Maintenance and Updates

### 9.1 Regular Maintenance Tasks

#### 9.1.1 Daily Tasks
- Review security logs
- Monitor system performance
- Check for security alerts
- Verify backup completion

#### 9.1.2 Weekly Tasks
- Apply security patches
- Review user access
- Update virus definitions
- Test disaster recovery procedures

#### 9.1.3 Monthly Tasks
- Perform vulnerability scans
- Review firewall rules
- Audit user accounts
- Update security policies

#### 9.1.4 Quarterly Tasks
- Conduct penetration testing
- Review incident response procedures
- Update disaster recovery plan
- Perform security awareness training

### 9.2 Patch Management

#### 9.2.1 Patch Management Process
1. **Assessment**: Identify required patches and prioritize
2. **Testing**: Test patches in development environment
3. **Scheduling**: Schedule maintenance windows
4. **Deployment**: Deploy patches to production
5. **Verification**: Verify patch success and system stability
6. **Documentation**: Document patch deployment

#### 9.2.2 Patch Management Script
```bash
#!/bin/bash
# patch-management.sh - Automated patch management

LOG_FILE="/var/log/patch-management.log"
EMAIL="security-team@lawfirmpro.com"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check for updates
log "Checking for system updates..."
if command -v dnf &> /dev/null; then
    dnf check-update >> "$LOG_FILE" 2>&1
elif command -v apt &> /dev/null; then
    apt update >> "$LOG_FILE" 2>&1
    apt list --upgradable >> "$LOG_FILE" 2>&1
fi

# Apply security updates
log "Applying security updates..."
if command -v dnf &> /dev/null; then
    dnf update -y --security >> "$LOG_FILE" 2>&1
elif command -v apt &> /dev/null; then
    apt upgrade -y --security >> "$LOG_FILE" 2>&1
fi

# Reboot if required
if [ -f /var/run/reboot-required ]; then
    log "System reboot required. Scheduling reboot..."
    echo "System will reboot in 5 minutes for security updates" | mail -s "Scheduled Reboot for Security Updates" "$EMAIL"
    shutdown -r +5 "Security update reboot"
fi

log "Patch management completed."
```

---

## 10. References and Resources

### 10.1 Security Standards
- **ISO 27001:2022** - Information Security Management
- **NIST Cybersecurity Framework** - Security best practices
- **CIS Controls** - Critical Security Controls
- **OWASP Top 10** - Web application security

### 10.2 Chinese Legal Requirements
- **Personal Information Protection Law (PIPL)**
- **Cybersecurity Law (CSL)**
- **Data Security Law (DSL)**
- **Multi-Level Protection Scheme (MLPS)**

### 10.3 Tools and Utilities
- **Lynis** - Security auditing tool
- **OpenSCAP** - Security compliance scanning
- **ClamAV** - Antivirus software
- **Fail2ban** - Intrusion prevention software
- **AIDE** - File integrity checking

### 10.4 Documentation
- [Information Security Policy](./information-security-policy.md)
- [Incident Response Plan](../operating/incident-response-plan.md)
- [Business Continuity Plan](../operating/business-continuity-plan.md)
- [Data Classification Policy](./data-classification-policy.md)

---

*This document is classified as CONFIDENTIAL and should be handled according to the company's information classification policy.*