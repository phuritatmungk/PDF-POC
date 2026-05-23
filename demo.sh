#!/usr/bin/env bash
# Start the full demo stack: Docker (backend + frontend) + Cloudflare quick tunnel.
# Usage: bash demo.sh
# Ctrl+C stops the tunnel; Docker containers keep running (use `docker compose down` to stop those).

set -euo pipefail

DOCKER_BIN="/c/Users/chait/AppData/Local/Programs/DockerDesktop/resources/bin"
CLOUDFLARED="/c/Program Files (x86)/cloudflared/cloudflared.exe"
VERCEL_ORIGIN="${VERCEL_ORIGIN:-https://pdf-poc-opal.vercel.app}"
LLM_BASE_URL="${LLM_BASE_URL:-http://host.docker.internal:8080}"

export PATH="$DOCKER_BIN:$PATH"
cd "$(dirname "$0")"

echo ">>> Starting Docker stack with ALLOWED_ORIGINS=$VERCEL_ORIGIN, LLM_BASE_URL=$LLM_BASE_URL"
ALLOWED_ORIGINS="$VERCEL_ORIGIN,http://localhost:3000" \
  LLM_BASE_URL="$LLM_BASE_URL" \
  docker compose up -d

echo ">>> Waiting for backend /health ..."
until curl -sf http://localhost:8000/health >/dev/null 2>&1; do sleep 2; done
echo "    backend ready."

TUNNEL_LOG=$(mktemp)
trap 'kill $TUNNEL_PID 2>/dev/null || true; rm -f "$TUNNEL_LOG"' EXIT INT TERM

echo ">>> Starting Cloudflare tunnel ..."
"$CLOUDFLARED" tunnel --url http://localhost:8000 > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

TUNNEL_URL=""
for _ in $(seq 1 30); do
  TUNNEL_URL=$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)
  [ -n "$TUNNEL_URL" ] && break
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "ERROR: tunnel URL not found within 30s. Log:" >&2
  cat "$TUNNEL_LOG" >&2
  exit 1
fi

cat <<EOF

================================================================
  Tunnel URL:  $TUNNEL_URL
  Vercel:      $VERCEL_ORIGIN

  >> Update Vercel env (only if tunnel URL changed since last time):
     1. https://vercel.com → PDF-POC → Settings → Environment Variables
     2. Edit NEXT_PUBLIC_API_BASE = $TUNNEL_URL
     3. Deployments tab → latest → "..." → Redeploy

  Tunnel running. Ctrl+C to stop tunnel. Docker keeps running.
================================================================

EOF

wait $TUNNEL_PID
