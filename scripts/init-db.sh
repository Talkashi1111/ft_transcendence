#!/bin/bash
set -e

# Check if DATABASE_URL is set and not empty
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# Extract database file path from DATABASE_URL environment variable
# DATABASE_URL format: "file:/app/data/database.db"
DB_PATH="${DATABASE_URL#file:}"

# Check if DB_PATH is valid after extraction
if [ -z "$DB_PATH" ] || [ "$DB_PATH" = "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL must be in format 'file:/path/to/database.db'"
  echo "   Current value: $DATABASE_URL"
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
  mkdir -p "$DB_DIR"

  # Run migrations (using migrate dev for development environment)
  echo "🔄 Running migrations..."
  cd /app/backend && npx prisma migrate dev

  # Run seed
  echo "🌱 Seeding database..."
  cd /app/backend && npx prisma db seed

  echo "✅ Database initialized successfully!"
fi
