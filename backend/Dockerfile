FROM python:3.11-slim

WORKDIR /app

# Install PostgreSQL client
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run startup logic directly: wait for DB, run migrations, start API
CMD ["sh", "-lc", "set -eu\nPOSTGRES_USER=\"${POSTGRES_USER:-postgres}\"\nPOSTGRES_PASSWORD=\"${POSTGRES_PASSWORD:-dev_password}\"\nPOSTGRES_HOST=\"${POSTGRES_HOST:-postgres}\"\nPOSTGRES_PORT=\"${POSTGRES_PORT:-5432}\"\nPOSTGRES_DB=\"${POSTGRES_DB:-taskito}\"\nAPI_PORT=\"${API_PORT:-8000}\"\necho \"[startup] Waiting for database at ${POSTGRES_HOST}:${POSTGRES_PORT} (db=${POSTGRES_DB})...\"\ni=0\nuntil pg_isready -h \"$POSTGRES_HOST\" -p \"$POSTGRES_PORT\" -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -q; do\n  i=$((i+1)); if [ \"$i\" -ge 60 ]; then echo \"[startup] Database not ready after 120s. Exiting.\" >&2; exit 1; fi; sleep 2; done\necho \"[startup] Database is ready.\"\nexport PYTHONPATH=\"/app:${PYTHONPATH:-}\"\necho \"[startup] Applying database migrations...\"\nalembic upgrade head\necho \"[startup] Migrations applied.\"\necho \"[startup] Starting application...\"\nexec uvicorn main:app --host 0.0.0.0 --port \"$API_PORT\" --proxy-headers"]
