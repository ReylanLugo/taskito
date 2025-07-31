#!/bin/bash

# Wait for the database to be ready
echo "Waiting for database..."
while ! pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -q; do
  sleep 2
done

echo "Database is ready!"

# Apply database migrations
echo "Applying database migrations..."
alembic upgrade head

# Start the application
echo "Starting application..."
uvicorn main:app --host 0.0.0.0 --port 8000