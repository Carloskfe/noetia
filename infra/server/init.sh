#!/bin/bash
# One-time server setup — run as root on fresh Ubuntu 24.04
# Usage: bash infra/server/init.sh

set -euo pipefail

echo "=== Noetia Server Init ==="

# ── System update ────────────────────────────────────────────────────────────
apt-get update -qq && apt-get upgrade -y -qq

# ── Docker ───────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  echo "Docker installed."
else
  echo "Docker already installed — skipping."
fi

# ── Git ──────────────────────────────────────────────────────────────────────
apt-get install -y git

# ── SSH on the canonical administration port (PO-019) ────────────────────────
# Noetia production deliberately uses TCP 222, not the default 22. This block
# makes a rebuilt host match that posture; previously init.sh opened 22 while
# production sshd listened on 222, so a disaster rebuild locked the operator out
# of the very host they were recovering (NEM-009 / IG-DR-09).
#
# Order matters: configure sshd and OPEN THE FIREWALL FIRST, restart sshd last,
# and never drop the current session until a second one is proven on 222.
SSH_PORT=222

if ! grep -qE "^[[:space:]]*Port[[:space:]]+${SSH_PORT}\b" /etc/ssh/sshd_config; then
  cp /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak.$(date +%Y%m%d_%H%M%S)"
  # Replace an existing Port directive if present, else append one.
  if grep -qE "^[[:space:]]*#?[[:space:]]*Port[[:space:]]+" /etc/ssh/sshd_config; then
    sed -i -E "s/^[[:space:]]*#?[[:space:]]*Port[[:space:]]+.*/Port ${SSH_PORT}/" /etc/ssh/sshd_config
  else
    printf '\nPort %s\n' "${SSH_PORT}" >> /etc/ssh/sshd_config
  fi
  echo "sshd_config set to Port ${SSH_PORT} (backup kept)."
else
  echo "sshd already configured for port ${SSH_PORT} — skipping."
fi

sshd -t || { echo "FATAL: sshd config invalid — not restarting. Fix before continuing."; exit 1; }

# ── Firewall ─────────────────────────────────────────────────────────────────
apt-get install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ${SSH_PORT}/tcp  # SSH — canonical Noetia admin port (PO-019). NOT 22.
ufw allow 80/tcp   # HTTP  (Traefik → Let's Encrypt challenge + redirect)
ufw allow 443/tcp  # HTTPS (Traefik)
ufw --force enable
echo "UFW configured — SSH permitted on ${SSH_PORT}/tcp only."

# Apply the new sshd port only after the firewall already permits it.
systemctl restart ssh 2>/dev/null || systemctl restart sshd
echo ""
echo "!! VERIFY NOW, from a SECOND terminal, BEFORE closing this session:"
echo "!!     ssh -p ${SSH_PORT} root@<this-host>"
echo "!! If that fails you still hold this session — re-check sshd_config and UFW."
echo ""

# NOTE: some providers deliver a fresh host reachable only on 22. If so, that is a
# TEMPORARY RECOVERY BOOTSTRAP: keep the existing session open, complete the steps
# above, prove port 222 from a second terminal, and close 22 immediately with
#     ufw delete allow 22/tcp
# Do NOT leave port 22 permanently open (PO-019).

# ── fail2ban ─────────────────────────────────────────────────────────────────
apt-get install -y fail2ban
systemctl enable fail2ban --now

# ── Project directories ───────────────────────────────────────────────────────
mkdir -p /opt/traefik /opt/noetia /opt/autoguildx
echo "Directories created: /opt/traefik  /opt/noetia  /opt/autoguildx"

# ── Shared Docker network for Traefik ────────────────────────────────────────
docker network create proxy 2>/dev/null && echo "Docker network 'proxy' created." \
  || echo "Docker network 'proxy' already exists — skipping."

echo ""
echo "=== Init complete. Next steps (run manually): ==="
echo ""
echo "1. Upload Traefik config to /opt/traefik/ and start it:"
echo "     cd /opt/traefik && touch acme.json && chmod 600 acme.json"
echo "     docker compose up -d"
echo ""
echo "2. Clone Noetia into /opt/noetia/:"
echo "     git clone git@github.com:YOUR_ORG/noetia.git /opt/noetia"
echo "     # (or use HTTPS: git clone https://github.com/YOUR_ORG/noetia.git /opt/noetia)"
echo ""
echo "3. Copy .env.production into /opt/noetia/ and fill in all values."
echo ""
echo "4. Start Noetia:"
echo "     cd /opt/noetia"
echo "     docker compose -f docker-compose.server.yml up -d --build"
echo "     docker compose -f docker-compose.server.yml exec -T api npm run migration:run"
echo ""
echo "5. Repeat steps 2-4 for AutoGuildX in /opt/autoguildx/"
echo "   using its own docker-compose.server.yml and .env.production."
