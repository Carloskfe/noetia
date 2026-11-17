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

# ── Firewall ─────────────────────────────────────────────────────────────────
apt-get install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP  (Traefik → Let's Encrypt challenge + redirect)
ufw allow 443/tcp  # HTTPS (Traefik)
ufw --force enable
echo "UFW configured."

# ── fail2ban ─────────────────────────────────────────────────────────────────
apt-get install -y fail2ban
systemctl enable fail2ban --now

# ── Project directories ───────────────────────────────────────────────────────
mkdir -p /opt/traefik /opt/noetia /opt/autoguildx
echo "Directories created: /opt/traefik  /opt/noetia  /opt/autoguildx"

# ── Shared Docker network for Traefik ────────────────────────────────────────
docker network create proxy 2>/dev/null && echo "Docker network 'proxy' created." \
  || echo "Docker network 'proxy' already exists — skipping."

# ── G1-I1: dedicated internal Traefik ↔ Noetia API network ───────────────────
# Created with an exact IPAM; an existing network with the right name but wrong subnet/gateway/range/internal
# flag is REJECTED (the helper stops), never silently accepted. Traefik must also list it in
# /opt/traefik/docker-compose.yml (see infra/server/traefik/docker-compose.yml).
EDGE_HELPER="$(dirname "$0")/noetia-api-edge-network.sh"
if [ -f "$EDGE_HELPER" ]; then
  bash "$EDGE_HELPER" ensure
else
  echo "WARNING: $EDGE_HELPER not found — create 'noetia_api_edge' with it before deploying Noetia."
fi

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
