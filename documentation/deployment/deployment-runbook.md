# LA Chat — Deployment Runbook

Step-by-step guide to deploy LA Chat to the school server.

## Prerequisites

- A server running Ubuntu 22.04+ with:
  - 4+ vCPU, 8+ GB RAM, 250+ GB SSD
  - Docker + Docker Compose installed
  - Ports 80 + 443 open to the internet
  - A domain name pointing to the server (e.g. `chat.lightacademy.sc.ug`)
- A GitHub PAT (for pulling the repo)
- (Optional) FCM server key for Android push
- (Optional) APNs key for iOS push

## Step 1: Clone the repo

```bash
sudo mkdir -p /opt/la-chat
sudo chown $USER:$USER /opt/la-chat
cd /opt/la-chat
git clone https://github.com/likus-69/LA-Chat.git .
```

## Step 2: Configure environment

```bash
cp .env.example .env
# Edit .env with strong secrets:
# - Generate JWT secrets: openssl rand -base64 48
# - Set a strong Postgres password
# - Set MinIO credentials
# - Set the domain name
nano .env
```

## Step 3: Start the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

This starts:
- PostgreSQL 16 (with persistent volume)
- Redis 7 (for presence + rate limiting)
- MinIO (for file storage)
- The API (NestJS)
- The web app (Next.js)
- Caddy (reverse proxy with auto-HTTPS)

## Step 4: Run migrations + seed

```bash
docker compose exec api pnpm prisma migrate deploy
docker compose exec api pnpm prisma db seed
```

## Step 5: Verify

```bash
# Health check
curl https://api.lightacademy.sc.ug/health
# Should return {"status":"ok"}

# Swagger
# Open https://api.lightacademy.sc.ug/docs in a browser

# Web app
# Open https://chat.lightacademy.sc.ug in a browser
# Login with ict.admin@la-chat.local / Password1
```

## Step 6: Configure Caddy

The Caddyfile at `infrastructure/school-server/Caddyfile` handles:
- TLS certificate issuance via Let's Encrypt
- Reverse proxy: `chat.lightacademy.sc.ug` → web:3000
- Reverse proxy: `api.lightacademy.sc.ug` → api:4000
- Rate limiting on auth endpoints
- HSTS + security headers

Edit it to match your domain, then reload:
```bash
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## Step 7: Configure backups

```bash
# Generate an encryption key for backups
openssl rand -base64 32 > /etc/la-chat/backup.key
chmod 600 /etc/la-chat/backup.key

# Set up the nightly cron job
sudo crontab -e
# Add:
# 0 2 * * * /opt/la-chat/infrastructure/school-server/scripts/backup.sh >> /var/log/la-chat-backup.log 2>&1
```

## Step 8: Test the backup

```bash
# Run the backup script manually
/opt/la-chat/infrastructure/school-server/scripts/backup.sh

# Verify the backup file exists
ls -la /var/backups/la-chat/db/

# Test restore (on a separate machine):
# 1. Copy the encrypted backup to the test machine
# 2. Decrypt: openssl enc -aes-256-cbc -d -pbkdf2 -in la-chat-YYYY-MM-DD.sql.gz.enc -out la-chat.sql.gz -pass file:/etc/la-chat/backup.key
# 3. gunzip la-chat.sql.gz
# 4. Restore: psql -U la_chat -d la_chat < la-chat.sql
```

## Step 9: Configure monitoring (optional)

```bash
# Start Prometheus + Grafana
docker compose -f infrastructure/monitoring/docker-compose.monitoring.yml up -d

# Access Grafana at http://localhost:3001 (admin/admin)
# Import the dashboard from infrastructure/monitoring/grafana-dashboard.json
```

## Rollback procedure

If a deployment goes wrong:

1. **Stop the new containers:**
   ```bash
   docker compose down
   ```

2. **Restore the database from the last backup:**
   ```bash
   # Decrypt + restore (see Step 8)
   ```

3. **Checkout the previous version:**
   ```bash
   git checkout <previous-commit-sha>
   docker compose up -d
   ```

4. **Verify** with the health check + a test login.

## Health check endpoints

| Endpoint | Expected | Action if failing |
|---|---|---|
| `GET /health` | `{"status":"ok"}` | Check API container logs |
| `GET /docs` | Swagger UI HTML | Check API container |
| `https://chat.lightacademy.sc.ug` | Login page | Check web container + Caddy |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 502 Bad Gateway | API or web container down | `docker compose restart api web` |
| Login fails (401) | JWT secret changed | Re-login; old tokens are invalid |
| WebSocket won't connect | Caddy not proxying /ws | Check Caddyfile has WebSocket upgrade |
| File upload fails | MinIO down or bucket missing | `docker compose restart minio` |
| DB migration fails | Schema mismatch | Check `prisma migrate status` |
