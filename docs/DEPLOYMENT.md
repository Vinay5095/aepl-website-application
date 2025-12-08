# Deployment Guide - AEPL Enterprise ERP

This guide provides step-by-step instructions for deploying the AEPL Enterprise ERP system to production.

## Prerequisites

- Docker and Docker Compose installed
- Supabase account (or self-hosted Supabase)
- Domain name (optional)
- SSL certificate (for production)

## Quick Start with Docker

### 1. Clone Repository

```bash
git clone https://github.com/Vinay5095/aepl-website-application.git
cd aepl-website-application
```

### 2. Configure Environment

Create `.env.production` file:

```env
# Next.js
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://user:password@db:5432/aepl_erp

# Redis (optional, for caching)
REDIS_URL=redis://redis:6379

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret

# E-invoice API (optional)
EINVOICE_USERNAME=your-username
EINVOICE_PASSWORD=your-password
EINVOICE_API_URL=https://einvoice-api.com

# GST API (optional)
GST_USERNAME=your-username
GST_PASSWORD=your-password
```

### 3. Build and Deploy

```bash
# Build Docker images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f nextjs_app
```

### 4. Run Database Migrations

```bash
# Access the database container
docker-compose exec db psql -U postgres -d aepl_erp

# Or run migrations via Supabase CLI
supabase db push
```

### 5. Access Application

- Application: http://localhost:3000
- Health Check: http://localhost:3000/api/health

## Production Deployment

### Option 1: Vercel (Recommended for Frontend)

1. **Push to GitHub**
```bash
git push origin main
```

2. **Import to Vercel**
- Go to https://vercel.com
- Click "Import Project"
- Select your GitHub repository
- Configure environment variables
- Deploy

3. **Configure Custom Domain**
- Add your domain in Vercel dashboard
- Update DNS records
- Enable automatic SSL

### Option 2: AWS EC2

1. **Launch EC2 Instance**
- Ubuntu 22.04 LTS
- t3.medium or larger
- 30GB+ storage
- Security group: Allow 80, 443, 22

2. **Install Dependencies**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Install Node.js (optional, for direct deployment)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

3. **Deploy Application**
```bash
# Clone repository
git clone https://github.com/Vinay5095/aepl-website-application.git
cd aepl-website-application

# Copy environment file
cp .env.example .env.production
# Edit .env.production with your values

# Build and start
docker-compose -f docker-compose.prod.yml up -d
```

4. **Configure Nginx Reverse Proxy**
```nginx
# /etc/nginx/sites-available/aepl-erp
server {
    listen 80;
    server_name your-domain.com;

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

5. **Enable SSL with Let's Encrypt**
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### Option 3: DigitalOcean App Platform

1. **Create App**
- Go to DigitalOcean dashboard
- Click "Create" → "Apps"
- Connect GitHub repository

2. **Configure Build**
- Build Command: `npm run build`
- Run Command: `npm start`
- Environment: Node.js 20.x

3. **Add Environment Variables**
- Add all variables from `.env.example`

4. **Deploy**
- Click "Create Resources"
- Wait for deployment to complete

### Option 4: Self-Hosted with Docker Swarm

1. **Initialize Swarm**
```bash
docker swarm init
```

2. **Create Stack File** (`docker-stack.yml`)
```yaml
version: '3.8'

services:
  app:
    image: aepl-erp:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
```

3. **Deploy Stack**
```bash
docker stack deploy -c docker-stack.yml aepl-erp
```

## Database Setup

### Supabase Cloud

1. **Create Project**
- Go to https://supabase.com
- Create new project
- Note down project URL and keys

2. **Run Migrations**
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

3. **Enable Auth**
- Go to Authentication settings
- Enable email provider
- Configure email templates
- Add custom SMTP (optional)

4. **Configure Storage**
- Go to Storage
- Create buckets:
  - `products` (for product documents)
  - `qc-reports` (for QC reports)
  - `invoices` (for invoices)
  - `hr-documents` (for HR docs)
- Set appropriate RLS policies

### Self-Hosted PostgreSQL

1. **Install PostgreSQL**
```bash
sudo apt install postgresql postgresql-contrib -y
```

2. **Create Database**
```sql
CREATE DATABASE aepl_erp;
CREATE USER aepl_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE aepl_erp TO aepl_user;
```

3. **Run Migrations**
```bash
psql -U aepl_user -d aepl_erp -f supabase/migrations/20251208_initial_schema.sql
psql -U aepl_user -d aepl_erp -f supabase/migrations/20251208_rls_policies.sql
psql -U aepl_user -d aepl_erp -f supabase/migrations/20251208_enhanced_rfq_workflow.sql
psql -U aepl_user -d aepl_erp -f supabase/migrations/20251208_enhanced_rfq_rls.sql
psql -U aepl_user -d aepl_erp -f supabase/migrations/20251208_product_code_traceability.sql
psql -U aepl_user -d aepl_erp -f supabase/migrations/20251208_product_code_traceability_rls.sql
```

## Initial Data Setup

### 1. Create Admin User

```sql
-- Insert admin user
INSERT INTO users (id, email, role, full_name)
VALUES ('uuid-here', 'admin@aepl.com', 'super_admin', 'System Administrator');
```

### 2. Load Master Data

```sql
-- Load tax rates
INSERT INTO tax_rates (name, rate, type) VALUES
('CGST 9%', 9, 'CGST'),
('SGST 9%', 9, 'SGST'),
('IGST 18%', 18, 'IGST');

-- Load UOMs
INSERT INTO uom (code, name) VALUES
('PCS', 'Pieces'),
('KG', 'Kilograms'),
('LTR', 'Liters'),
('MTR', 'Meters');

-- Load payment terms
INSERT INTO payment_terms (code, name, days) VALUES
('NET30', 'Net 30 Days', 30),
('NET45', 'Net 45 Days', 45),
('ADVANCE', '100% Advance', 0);
```

### 3. Configure Company Settings

```sql
INSERT INTO companies (
    name, 
    gstin, 
    pan,
    address,
    city,
    state,
    pincode,
    phone,
    email
) VALUES (
    'AEPL Industries',
    '27XXXXX1234X1Z5',
    'XXXXX1234X',
    '123 Industrial Area',
    'Mumbai',
    'Maharashtra',
    '400001',
    '+91-22-12345678',
    'info@aepl.com'
);
```

## Monitoring & Logging

### 1. Application Logs

```bash
# View real-time logs
docker-compose logs -f nextjs_app

# Export logs
docker-compose logs nextjs_app > app.log
```

### 2. Database Monitoring

```bash
# Connect to database
docker-compose exec db psql -U postgres

# Check connections
SELECT count(*) FROM pg_stat_activity;

# Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### 3. Performance Monitoring

Use tools like:
- **Sentry** for error tracking
- **DataDog** for APM
- **Grafana** for metrics visualization
- **Prometheus** for metrics collection

## Backup & Recovery

### Database Backup

```bash
# Create backup
docker-compose exec db pg_dump -U postgres aepl_erp > backup_$(date +%Y%m%d).sql

# Automated daily backup (crontab)
0 2 * * * cd /path/to/app && docker-compose exec db pg_dump -U postgres aepl_erp > backups/backup_$(date +\%Y\%m\%d).sql
```

### Restore from Backup

```bash
# Stop application
docker-compose down

# Restore database
docker-compose up -d db
docker-compose exec -T db psql -U postgres aepl_erp < backup_20241208.sql

# Start application
docker-compose up -d
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up security headers
- [ ] Configure CORS properly
- [ ] Enable audit logging
- [ ] Implement backup strategy
- [ ] Set up monitoring alerts
- [ ] Review and test RLS policies
- [ ] Enable 2FA for admin users
- [ ] Regular security updates
- [ ] Penetration testing

## Performance Optimization

### 1. Database

- Create indexes on frequently queried columns
- Enable query caching
- Use connection pooling
- Regular VACUUM and ANALYZE

### 2. Application

- Enable Next.js caching
- Use CDN for static assets
- Implement Redis caching
- Optimize images

### 3. Server

- Use load balancer for multiple instances
- Enable gzip compression
- Configure appropriate resources
- Monitor and scale as needed

## Scaling

### Horizontal Scaling

```bash
# Scale app instances
docker-compose up -d --scale nextjs_app=3

# Use load balancer (Nginx)
upstream app_servers {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}
```

### Vertical Scaling

- Increase CPU/RAM for containers
- Upgrade database instance
- Use larger cache size

## Troubleshooting

### Application Won't Start

1. Check logs: `docker-compose logs nextjs_app`
2. Verify environment variables
3. Ensure database is accessible
4. Check port availability

### Database Connection Issues

1. Verify DATABASE_URL
2. Check network connectivity
3. Confirm database is running
4. Review PostgreSQL logs

### Performance Issues

1. Check database query performance
2. Review application logs for errors
3. Monitor resource usage
4. Check for slow API endpoints

## Support

For issues or questions:
- GitHub Issues: https://github.com/Vinay5095/aepl-website-application/issues
- Documentation: `/docs` folder
- Email: support@aepl.com

## Updates

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Database Migrations

```bash
# Run new migrations
supabase db push

# Or manually
psql -U postgres -d aepl_erp -f supabase/migrations/new_migration.sql
```

## Conclusion

Your AEPL Enterprise ERP is now deployed and ready for production use. Monitor the application regularly and keep it updated with the latest security patches.

For production use, ensure you:
1. Set up proper backups
2. Configure monitoring
3. Enable security features
4. Test disaster recovery procedures
5. Train your team on the system
