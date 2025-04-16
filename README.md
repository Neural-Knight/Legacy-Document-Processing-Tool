# Production Deployment Guide

This guide outlines the steps to deploy your Legacy Document Manager to a production environment with secure authentication.

## Prerequisites

- Domain name with valid SSL certificate
- Production server (AWS EC2, DigitalOcean Droplet, etc.)
- PostgreSQL database server
- AWS S3 bucket for file storage
- Docker and Docker Compose (recommended)

## Security Checklist

Before deploying to production, ensure the following security measures are in place:

- [x] JWT-based authentication with refresh tokens
- [x] Secure password hashing with bcrypt
- [x] HTTPS enforcement
- [x] CORS configuration
- [x] Rate limiting
- [x] Security headers
- [x] Proper error handling
- [x] Secure environment variable management
- [x] Database connection pooling
- [x] Token revocation on logout

## Frontend Deployment

### 1. Build the React Application

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Output will be in the 'dist' folder
```

### 2. Configure Environment Variables

Create a `.env.production` file in your frontend project:

```
VITE_API_URL=https://api.yourdomain.com/api
```

### 3. Deploy to Web Server

You can deploy the static files to:

- AWS S3 + CloudFront
- Netlify
- Vercel
- Nginx/Apache web server

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.yourdomain.com; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline';" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Static file serving
    root /var/www/html/document-manager;
    index index.html;
    
    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

## Backend Deployment

### 1. Prepare for Deployment

Create a `Dockerfile` in your backend directory:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Run application with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  api:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    depends_on:
      - db
    networks:
      - app-network

  db:
    image: postgres:14
    volumes:
      - postgres_data:/var/lib/postgresql/data
    env_file:
      - .env
    ports:
      - "5432:5432"
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
```

### 2. Database Setup

Create a secure PostgreSQL database for production:

```sql
CREATE DATABASE docmanager;
CREATE USER docmanager_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE docmanager TO docmanager_user;
```

### 3. Environment Variables

Ensure all environment variables in the `.env` file are properly set for production.

Important security considerations:
- Generate a strong random `SECRET_KEY`
- Use secure passwords for database
- Use private S3 buckets with proper access policies
- Set `SESSION_COOKIE_SECURE=true` for HTTPS

### 4. Deploy with Docker

```bash
# Build and start the services
docker-compose up -d

# Run database migrations
docker-compose exec api alembic upgrade head

# Create initial superuser (if needed)
docker-compose exec api python -m app.create_superuser
```

### 5. Set Up Reverse Proxy

Example Nginx configuration for the API:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy settings
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Configure timeouts for file uploads
    client_max_body_size 50M;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
}
```

## Monitoring and Maintenance

### 1. Set Up Logging

Configure logging to a central location (e.g., CloudWatch, Loki, ELK stack).

### 2. Set Up Monitoring

Monitor your application with:
- Prometheus + Grafana
- AWS CloudWatch
- Datadog
- New Relic

### 3. Regular Backups

Set up regular database backups:

```bash
# Example PostgreSQL backup script
pg_dump -U docmanager_user -d docmanager -F c -b -v -f /backup/docmanager_$(date +%Y%m%d).backup
```

### 4. Security Updates

Regularly update dependencies and security patches:

```bash
# Update dependencies
pip install --upgrade -r requirements.txt

# Update security patches on the server
sudo apt update && sudo apt upgrade -y
```

## Troubleshooting Common Issues

### Authentication Issues

If users experience authentication problems:

1. Check token expiration settings
2. Verify CORS configuration
3. Check if HTTPS is properly configured
4. Verify that localStorage is working in the client's browser

### File Upload Issues

If file uploads are failing:

1. Check S3 bucket permissions
2. Verify AWS credentials
3. Check upload size limits
4. Check Nginx/proxy timeouts

### Database Connection Issues

If database connections are failing:

1. Check connection string
2. Verify database credentials
3. Check network connectivity
4. Verify PostgreSQL is running

## Scaling Considerations

For high-traffic applications:

1. Implement database connection pooling
2. Consider using a load balancer
3. Implement caching (Redis)
4. Use a CDN for static assets
5. Implement horizontal scaling of the API

## Conclusion

Following this guide will help ensure your Document Management System is deployed securely with a robust authentication system. Regular maintenance and monitoring are essential to keep the system secure and performant.