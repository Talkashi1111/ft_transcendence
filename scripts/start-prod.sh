#!/bin/bash
# Production startup script
# Runs database migrations and starts the backend server

set -e

echo "🚀 Starting ft_transcendence production server..."

# Run database migrations
echo "📦 Running database migrations..."
cd /app/backend
npx prisma migrate deploy

echo "✅ Migrations complete"

# Start the server
echo "🎮 Starting server..."
exec node /app/backend/dist/index.js
