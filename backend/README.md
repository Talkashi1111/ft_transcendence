# Backend

Fastify REST API with Prisma ORM and SQLite database.

## Tech Stack

- **Runtime**: Node.js 22
- **Framework**: [Fastify](https://fastify.dev/) v5
- **ORM**: [Prisma](https://www.prisma.io/) v7
- **Database**: SQLite
- **Validation**: [Zod](https://zod.dev/) v4
- **Password Hashing**: [Argon2](https://github.com/ranisalt/node-argon2) (Argon2id)
- **Authentication**: JWT (`@fastify/jwt`)
- **API Docs**: Swagger (`@fastify/swagger`)

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Migration history
├── src/
│   ├── app.ts              # Fastify app setup & plugins
│   ├── index.ts            # Entry point (starts server)
│   ├── generated/prisma/   # Generated Prisma Client (gitignored)
│   ├── modules/
│   │   ├── user/           # User module (auth, registration)
│   │   └── blockchain/     # Blockchain module (tournament scores)
│   └── utils/
│       ├── prisma.ts       # Prisma client singleton
│       └── hash.ts         # Argon2 password hashing
├── test/                   # Vitest tests
├── prisma.config.ts        # Prisma configuration
├── .env                    # Environment variables (gitignored)
└── .env.example            # Environment template
```

## Database Setup

<details>
<summary>Initial Prisma Setup (click to expand - already done!)</summary>

These steps were used to initialize Prisma in the project:

```bash
# 1. Install Prisma dependencies
cd /app/backend
pnpm add prisma @prisma/client zod zod-to-json-schema @fastify/swagger @fastify/swagger-ui @fastify/jwt

# 2. Initialize Prisma with SQLite
pnpm exec prisma init --datasource-provider sqlite --output ../src/generated/prisma

# This creates:
#   prisma/schema.prisma    - Database schema
#   prisma.config.ts        - Prisma configuration
#   .gitignore              - Updated with prisma entries

# 3. Configure DATABASE_URL in prisma.config.ts and .env
# Format: file:/app/data/database.db

# 4. Define models in prisma/schema.prisma

# 5. Create and apply migration
pnpm exec prisma migrate dev --name init

# 6. Generate Prisma Client
pnpm exec prisma generate
```

</details>

### Prerequisites

The database file is stored at `/app/data/database.db` (persistent volume in Docker).

### Configuration

Database URL is configured in multiple places (all should match):

| Location                  | Purpose           |
| ------------------------- | ----------------- |
| `.env`                    | Local development |
| `docker-compose.dev.yml`  | Devcontainer      |
| `docker-compose.prod.yml` | Production        |
| `prisma.config.ts`        | Fallback default  |

Format: `file:/app/data/database.db` (Prisma SQLite format)

### Prisma Commands

```bash
# Open Prisma Studio (can run from project root!)
make studio                    # Opens at http://localhost:5555

# Other commands - run from /app/backend directory
cd /app/backend

# Create/apply migrations (development)
npx prisma migrate dev --name <migration_name>

# Apply migrations (production)
npx prisma migrate deploy

# Generate Prisma Client after schema changes
npx prisma generate

# Open Prisma Studio (alternative to make studio)
npx prisma studio --port 5555

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

> **Note:** Most Prisma commands must run from `/app/backend` because that's where Prisma is installed. The exception is `make studio` which works from root dir.

### Database Seeding

Seed the database with demo data for development:

```bash
# From project root
make seed                # Add demo data to dev database
make seed-reset          # Clear all data, then add demo data

# From backend directory
npx prisma db seed           # Add demo data
npx prisma db seed -- --clean  # Clear all data, then seed
```

**Demo Users Created:**
| Email | Alias | Password |
| ------------------ | ------- | ---------- |
| demo@example.com | demo | demo1234 |
| alice@example.com | alice | alice1234 |
| bob@example.com | bob | bob12345 |

### Test Database Isolation

Tests use a separate database (`/app/data/database.test.db`) to avoid polluting development data. This is automatically configured via `test/setup.ts` which:

1. Sets `DATABASE_URL` to the test database
2. Runs migrations on the test database
3. Cleans all data before tests run

The dev database (`/app/data/database.db`) remains untouched during test runs.

## Swagger API Documentation

The API documentation is available via Swagger UI when the server is running:

**URL:** http://localhost:3000/docs

Features:

- Interactive API explorer
- Try out endpoints directly from the browser
- View request/response schemas
- Test authenticated endpoints (add Bearer token)

```bash
# Start the server first
cd /app && make dev
# or
cd /app/backend && pnpm run dev

# Then open http://localhost:3000/docs in your browser
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:

| Variable       | Description        | Default                      |
| -------------- | ------------------ | ---------------------------- |
| `DATABASE_URL` | SQLite file path   | `file:/app/data/database.db` |
| `JWT_SECRET`   | JWT signing secret | Change in production!        |
| `PORT`         | Server port        | `3000`                       |

## Development

```bash
# Start development server (from /app)
make dev

# Or manually
cd backend
pnpm run dev
```

## API Endpoints

### Health Check

- `GET /healthcheck` - Server health status

### Users

| Method | Endpoint           | Description              | Auth     |
| ------ | ------------------ | ------------------------ | -------- |
| POST   | `/api/users`       | Register new user        | No       |
| POST   | `/api/users/login` | Login (returns JWT)      | No       |
| GET    | `/api/users`       | List all users           | Required |
| GET    | `/api/users/me`    | Get current user profile | Required |

### Blockchain (Tournament Scores)

| Method | Endpoint                       | Description            | Auth |
| ------ | ------------------------------ | ---------------------- | ---- |
| GET    | `/api/tournaments/:id/matches` | Get tournament matches | No   |
| POST   | `/api/matches`                 | Record a match         | No   |
| GET    | `/api/matches/total`           | Total match count      | No   |

## Testing

```bash
# Run tests
cd /app/backend && pnpm test

# Run tests with coverage
cd /app/backend && pnpm test -- --coverage

# Run from root (uses make)
cd /app && make test
```
