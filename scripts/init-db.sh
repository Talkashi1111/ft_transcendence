#!/bin/bash
set -e

# Extract database file path from DATABASE_URL environment variable
# DATABASE_URL format: "file:/app/data/database.db"
DB_PATH="${DATABASE_URL#file:}"

if [ -z "$DB_PATH" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "🔍 Checking database status..."
echo "   Database URL: $DATABASE_URL"
echo "   Database path: $DB_PATH"

if [ -f "$DB_PATH" ]; then
  echo "✅ Database already exists at $DB_PATH"
  echo "   Skipping migration and seed (use 'make migrate' or 'make seed' manually if needed)"
else
  echo "📦 Database not found. Initializing..."

  # Ensure data directory exists
  DB_DIR=$(dirname "$DB_PATH")
  mkdir -p "$DB_DIR"  # Run migrations
  echo "🔄 Running migrations..."
  cd /app/backend && npx prisma migrate deploy

  # Run seed
  echo "🌱 Seeding database..."
  cd /app/backend && npx prisma db seed

  echo "✅ Database initialized successfully!"
fi
