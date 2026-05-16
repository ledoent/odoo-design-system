#!/usr/bin/env bash
# Copyright 2026 Ledo / Subteno.
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
#
# Bootstrap a service-account user on the self-hosted Penpot instance
# at design.hz.ledoweb.com, activate it via direct DB UPDATE (Penpot's
# SMTP is unconfigured so verification emails go nowhere), log it in,
# mint a long-lived access token, and write everything to .env at the
# repo root.
#
# Re-run is idempotent: if the account already exists, the script skips
# registration and just refreshes the access token.
#
# Prereqs:
#   - kubectl with $KUBECONFIG pointing at the Hetzner cluster
#   - jq and python3 on PATH
#
# Run from the repo root:
#   bash docs/case-studies/dms/scripts/penpot-bootstrap-account.sh

set -euo pipefail

HOST="${PENPOT_HOST:-https://design.hz.ledoweb.com}"
EMAIL="${PENPOT_EMAIL:-hello@ledoweb.com}"
FULLNAME="${PENPOT_FULLNAME:-Hello (Service Account)}"
ENV_FILE="${ENV_FILE:-$(git rev-parse --show-toplevel)/.env}"

# Always use the password from .env if it's already there — re-using lets
# us refresh the token without locking ourselves out of an existing account.
if [[ -f "$ENV_FILE" ]] && grep -q '^PENPOT_PASSWORD=' "$ENV_FILE"; then
    PW=$(grep '^PENPOT_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
    echo "→ re-using PENPOT_PASSWORD from $ENV_FILE"
else
    PW=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
    echo "→ generated fresh PENPOT_PASSWORD"
fi

transit_get() {
    # Pull a value by its transit-shaped key (~:key) from a Penpot response.
    python3 -c '
import json, sys
arr = json.load(sys.stdin)
key = sys.argv[1]
try:
    idx = arr.index(key)
    print(arr[idx + 1])
except ValueError:
    print("")
' "$1"
}

# --- 1. Register (or skip if exists) ----------------------------------

PREPARE=$(curl -sS -X POST "$HOST/api/rpc/command/prepare-register-profile" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"fullname\":\"$FULLNAME\"}")
TOK=$(echo "$PREPARE" | transit_get '~:token' || echo "")

if [[ -n "$TOK" ]]; then
    REG=$(curl -sS -X POST "$HOST/api/rpc/command/register-profile" \
        -H 'Content-Type: application/json' \
        -d "{\"token\":\"$TOK\",\"accept-terms-and-privacy\":true}")
    ID=$(echo "$REG" | transit_get '~:id' || echo "")
    if [[ -n "$ID" ]]; then
        echo "✓ registered profile id=$ID"
    else
        echo "× register-profile unexpected response: $REG" >&2
        exit 1
    fi
else
    echo "→ profile already exists or registration disabled — continuing"
fi

# --- 2. Activate via direct DB UPDATE ---------------------------------
# Penpot ships with SMTP unconfigured on this cluster; the verification
# email is logged to backend stdout and would block login. Flip is_active
# server-side instead. Idempotent.

kubectl -n penpot exec -i sts/penpot-postgresql -- bash <<EOF >/dev/null
export PGPASSWORD="\$POSTGRES_POSTGRES_PASSWORD"
psql -U postgres -d penpot -c "UPDATE profile SET is_active=true WHERE email='$EMAIL';"
EOF
echo "✓ profile is_active=true"

# --- 3. Login ---------------------------------------------------------

COOKJAR=$(mktemp)
trap 'rm -f "$COOKJAR"' EXIT

LOGIN=$(curl -sS -c "$COOKJAR" -X POST "$HOST/api/rpc/command/login-with-password" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
PROFILE_ID=$(echo "$LOGIN" | transit_get '~:id' || echo "")
if [[ -z "$PROFILE_ID" ]]; then
    echo "× login failed: $LOGIN" >&2
    exit 1
fi
echo "✓ login profile-id=$PROFILE_ID"

# --- 4. Mint access token ---------------------------------------------

NAME="claude-${USER}-$(date -u +%Y%m%dT%H%M%SZ)"
TOKEN_RESP=$(curl -sS -b "$COOKJAR" -X POST "$HOST/api/rpc/command/create-access-token" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"$NAME\",\"perms\":[]}")
TOKEN=$(echo "$TOKEN_RESP" | transit_get '~:token' || echo "")
if [[ -z "$TOKEN" ]]; then
    echo "× create-access-token failed: $TOKEN_RESP" >&2
    exit 1
fi
echo "✓ minted access token $NAME"

# --- 5. Persist to .env -----------------------------------------------

cat > "$ENV_FILE" <<EOF
# Penpot service-account credentials for design.hz.ledoweb.com.
# Regenerate with: bash docs/case-studies/dms/scripts/penpot-bootstrap-account.sh
# DO NOT COMMIT (covered by repo .gitignore).
PENPOT_HOST=$HOST
PENPOT_EMAIL=$EMAIL
PENPOT_PASSWORD=$PW
PENPOT_TOKEN=$TOKEN
PENPOT_PROFILE_ID=$PROFILE_ID
EOF
chmod 600 "$ENV_FILE"
echo "✓ wrote $ENV_FILE ($(wc -l < "$ENV_FILE" | tr -d ' ') lines)"
echo ""
echo "Next: source the env in any shell that needs Penpot API access:"
echo "  set -a && source $ENV_FILE && set +a"
