#!/bin/sh
set -eu

log() { printf "[startup] %s\n" "$*"; }

: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_PASSWORD:=dev_password}"
: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=taskito}"
: "${API_PORT:=8000}"

log "Waiting for database at ${POSTGRES_HOST}:${POSTGRES_PORT} (db=${POSTGRES_DB})..."
i=0
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q; do
  i=$((i+1))
  if [ "$i" -ge 60 ]; then
    log "Database not ready after 120s. Exiting." >&2
    exit 1
  fi
  sleep 2
done
log "Database is ready."

log "Applying database migrations..."
export PYTHONPATH="/app:${PYTHONPATH:-}"
alembic upgrade head
log "Migrations applied."

log "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port "$API_PORT" --proxy-headers