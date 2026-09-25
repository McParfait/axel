#!/usr/bin/env bash
# Cloud Agent install phase: durable, idempotent repository setup.
# Installs the local PostgreSQL server, JS dependencies (which runs
# `prisma generate` via postinstall), and initializes a local database
# cluster. The cluster is started and migrated per boot by start.sh.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGDATA="${PGDATA:-$HOME/.profuel/pgdata}"

echo "==> Ensuring PostgreSQL server is installed"
if ! ls /usr/lib/postgresql/*/bin/postgres >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

PGBIN="$(dirname "$(ls -d /usr/lib/postgresql/*/bin/postgres | sort -V | tail -1)")"
echo "==> Using PostgreSQL binaries at $PGBIN"

echo "==> Installing JS dependencies (npm ci)"
cd "$REPO_DIR"
npm ci

echo "==> Initializing local PostgreSQL cluster (if needed)"
mkdir -p "$PGDATA"
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  "$PGBIN/initdb" -D "$PGDATA" -A trust -U ubuntu
else
  echo "    cluster already initialized"
fi

echo "==> Install phase complete"
