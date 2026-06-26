# Secrets Rotation Policy

All production secrets live in `.env.production` at `/opt/noetia/.env.production` on the server. This file is never committed. Keep a copy in a password manager.

**Rotate before:** public launch, any team member departure, any suspected credential compromise.  
**Rotate on schedule:** annually for all secrets.

---

## Secrets inventory

| Secret | Risk if leaked | User impact on rotation | Where to rotate |
|--------|---------------|------------------------|----------------|
| `JWT_SECRET` | All user sessions can be forged | All users re-login on next request | `.env.production` → restart api |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Full bucket access (read/write/delete) | Brief service interruption during restart | MinIO console + `.env.production` |
| `SOCIAL_TOKEN_SECRET` | AES-256 key — decrypts stored OAuth tokens | All users must re-link social accounts | `.env.production` → restart api |
| `STRIPE_SECRET_KEY` | Full Stripe account access | None (transparent) | Stripe Dashboard + `.env.production` |
| `STRIPE_WEBHOOK_SECRET` | Webhook requests can be forged | None (transparent) | Stripe Dashboard + `.env.production` |
| `DEPLOY_SSH_KEY` | Server access | CI/CD stops until new key is in GitHub | Server + GitHub secrets |
| `SMTP_PASS` / Resend API key | Email sending access | None (transparent) | Resend Dashboard + `.env.production` |
| `GRAFANA_ADMIN_PASSWORD` | Monitoring access | None | Grafana CLI (see grafana-monitoring.md) |
| `SENTRY_AUTH_TOKEN` | Source map upload access | None | Sentry + GitHub CI secrets |

---

## How to rotate each secret

### JWT_SECRET

```bash
# Generate a new secret (32+ random bytes)
openssl rand -base64 32

# On server — update and restart
nano /opt/noetia/.env.production
# Update: JWT_SECRET=<new value>

docker compose --env-file .env.production -f docker-compose.server.yml restart api
```

**Effect:** All existing JWTs are immediately invalid. Users are logged out on their next API call and must log in again. This is expected and safe — do not warn users in advance, just do it.

---

### MINIO_ACCESS_KEY / MINIO_SECRET_KEY

```bash
# 1. SSH tunnel to MinIO console on your local machine:
ssh -p 222 -L 9001:localhost:9001 root@84.247.140.175
# Open http://localhost:9001

# 2. In MinIO console: Access Keys → Create Access Key → note new key + secret
# 3. Do NOT delete the old key yet

# 4. Update .env.production
nano /opt/noetia/.env.production
# Update: MINIO_ACCESS_KEY=<new> MINIO_SECRET_KEY=<new>

# 5. Restart all services that talk to MinIO
docker compose --env-file .env.production -f docker-compose.server.yml restart api image-gen worker

# 6. Verify images and audio still load, then delete the old key in MinIO console
```

---

### SOCIAL_TOKEN_SECRET

This key encrypts stored OAuth tokens (LinkedIn, Facebook, Instagram, Pinterest) in Redis.

```bash
# Generate new key (must be 32 hex bytes = 64 hex chars for AES-256)
openssl rand -hex 32

nano /opt/noetia/.env.production
# Update: SOCIAL_TOKEN_SECRET=<new value>

docker compose --env-file .env.production -f docker-compose.server.yml restart api
```

**Effect:** All stored social tokens become unreadable. Users who had social accounts linked will see an error on next share attempt and must re-link. Post a brief in-app notice if you have many linked users.

---

### STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET

```bash
# Stripe Dashboard (live mode):
# Developers → API keys → Roll key / Create restricted key
# Developers → Webhooks → Roll signing secret

nano /opt/noetia/.env.production
# Update: STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...

docker compose --env-file .env.production -f docker-compose.server.yml restart api

# Verify webhook is still receiving events in Stripe Dashboard → Webhooks → recent deliveries
```

---

### DEPLOY_SSH_KEY (GitHub Actions deploy key)

```bash
# Generate a new ED25519 keypair locally
ssh-keygen -t ed25519 -f /tmp/deploy_key_new -N ""

# 1. Add the new public key to the server
ssh -p 222 root@84.247.140.175 "cat >> /root/.ssh/authorized_keys" < /tmp/deploy_key_new.pub

# 2. Update GitHub secret
# Repo → Settings → Secrets → DEPLOY_SSH_KEY → update with contents of /tmp/deploy_key_new

# 3. Test CI by pushing a trivial commit
# 4. Only after CI succeeds, remove the old public key from /root/.ssh/authorized_keys
ssh -p 222 root@84.247.140.175 "nano /root/.ssh/authorized_keys"

# Clean up local temp files
rm /tmp/deploy_key_new /tmp/deploy_key_new.pub
```

---

### SMTP credentials (Resend)

```bash
# Resend Dashboard → API Keys → Create new key → delete old

nano /opt/noetia/.env.production
# Update: SMTP_PASS=re_<new key>

docker compose --env-file .env.production -f docker-compose.server.yml restart api

# Send a test password-reset email to verify
```

---

## After any rotation

1. Update the password manager entry with the new value
2. Verify the affected service is healthy: `docker ps`
3. Smoke-test the affected feature (login, share, payment, email)
4. Note the rotation date in a comment in the password manager entry
