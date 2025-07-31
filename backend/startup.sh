#!/bin/bash

# Apply database migrations
echo "Applying database migrations..."
alembic upgrade head

# Start the application
echo "Starting application..."
uvicorn main:app --host 0.0.0.0 --port 8000