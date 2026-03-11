#!/bin/bash
set -e

echo "Running Database Migrations..."
cd backend
alembic upgrade head
cd ..

echo "Starting Uvicorn Server..."
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
