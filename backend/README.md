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
- **2FA**: TOTP (`otpauth`, `qrcode`)
- **Encryption**: AES-256-GCM (Node.js `crypto`)
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
│   │   ├── 2fa/            # Two-Factor Authentication module
│   │   └── blockchain/     # Blockchain module (tournament scores)
│   └── utils/
│       ├── prisma.ts       # Prisma client singleton
│       ├── hash.ts         # Argon2 password hashing
│       └── crypto.ts       # AES-256-GCM encryption for 2FA secrets
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
| alice@example.com | alice | password123 |
| bob@example.com | bob | password123 |
| charlie@example.com | charlie | password123 |

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

| Variable                    | Description               | Default                                           |
| --------------------------- | ------------------------- | ------------------------------------------------- |
| `DATABASE_URL`              | SQLite file path          | `file:/app/data/database.db`                      |
| `JWT_SECRET`                | JWT signing secret        | Change in production!                             |
| `TWO_FACTOR_ENCRYPTION_KEY` | 2FA secret encryption key | Generate with: `openssl rand -hex 32`             |
| `PORT`                      | Server port               | `3000`                                            |
| `GOOGLE_CLIENT_ID`          | Google OAuth client ID    | (required for OAuth)                              |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth secret       | (required for OAuth)                              |
| `OAUTH_CALLBACK_URI`        | OAuth callback URL        | `http://localhost:5173/api/oauth/google/callback` |

> **Security Note:** The `TWO_FACTOR_ENCRYPTION_KEY` must be exactly 64 hexadecimal characters (32 bytes). This key encrypts TOTP secrets stored in the database using AES-256-GCM.

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

| Method | Endpoint            | Description              | Auth     |
| ------ | ------------------- | ------------------------ | -------- |
| POST   | `/api/users`        | Register new user        | No       |
| POST   | `/api/users/login`  | Login (returns JWT)      | No       |
| GET    | `/api/users`        | List all users           | Required |
| GET    | `/api/users/me`     | Get current user profile | Required |
| POST   | `/api/users/logout` | Logout (clear cookie)    | No       |

### Two-Factor Authentication (2FA)

| Method | Endpoint           | Description                      | Auth     |
| ------ | ------------------ | -------------------------------- | -------- |
| POST   | `/api/2fa/setup`   | Generate new 2FA secret (QR)     | Required |
| POST   | `/api/2fa/enable`  | Verify code and enable 2FA       | Required |
| POST   | `/api/2fa/disable` | Disable 2FA                      | Required |
| POST   | `/api/2fa/verify`  | Verify code during login process | No       |

#### 2FA Overview

The application implements TOTP-based Two-Factor Authentication compatible with Google Authenticator.

**Key Features:**

- TOTP secrets encrypted at rest using AES-256-GCM
- 6-digit codes, 30-second validity window
- ±30 second clock drift tolerance
- Works with both password-based and OAuth login
- Optional - OFF by default, enabled per-user in settings

#### 2FA Setup Flow

```
User                    Frontend                   Backend
  |                        |                          |
  |-- Go to Settings ----->|                          |
  |-- Click "Enable 2FA" ->|                          |
  |                        |-- POST /2fa/setup ------>|
  |                        |<-- { secret, qrCodeUrl }-|
  |<-- Show QR code -------|                          |
  |-- Scan with app ------>|                          |
  |-- Enter code --------->|                          |
  |                        |-- POST /2fa/enable ----->|
  |                        |   { code: "123456" }     |
  |                        |<-- { success: true } ----|
  |<-- "2FA Enabled!" -----|                          |
```

#### Login Flow (Without 2FA)

```
User                    Frontend                   Backend
  |                        |                          |
  |-- Enter credentials -->|                          |
  |                        |-- POST /login ---------->|
  |                        |<-- JWT cookie -----------|
  |<-- Redirect home ------|                          |
```

#### Login Flow (With 2FA Enabled)

```
User                    Frontend                   Backend
  |                        |                          |
  |-- Enter credentials -->|                          |
  |                        |-- POST /login ---------->|
  |                        |<-- { requires2FA: true,  |
  |                        |      tempToken: "..." } -|
  |<-- Show 2FA input -----|                          |
  |-- Enter 6-digit code ->|                          |
  |                        |-- POST /2fa/verify ----->|
  |                        |   { tempToken, code }    |
  |                        |<-- JWT cookie -----------|
  |<-- Redirect home ------|                          |
```

**Temporary Token:** When 2FA is required, the backend issues a short-lived temporary token (5 minutes) that can only be used for 2FA verification. This token cannot access protected routes and is single-purpose only.

### OAuth (Google Authentication)

| Method | Endpoint                     | Description                  | Auth |
| ------ | ---------------------------- | ---------------------------- | ---- |
| GET    | `/api/oauth/google`          | Start Google OAuth flow      | No   |
| GET    | `/api/oauth/google/callback` | OAuth callback (sets cookie) | No   |

#### OAuth Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Google OAuth 2.0 Flow                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User clicks "Continue with Google"                                      │
│          │                                                                  │
│          ▼                                                                  │
│  2. GET /api/oauth/google                                                   │
│          │ (sets state cookie, redirects to Google)                         │
│          ▼                                                                  │
│  3. Google Authorization Page                                               │
│          │ (user grants permission)                                         │
│          ▼                                                                  │
│  4. GET /api/oauth/google/callback?code=xxx&state=xxx                       │
│          │ (validates state, exchanges code for token)                      │
│          ▼                                                                  │
│  5. Fetch Google profile, upsert user in DB                                 │
│          │ (links to existing account ONLY if email is verified by Google)  │
│          ▼                                                                  │
│  6. Set JWT cookie, redirect to home                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Select **Web application**
6. Configure:
   - **Name**: ft_transcendence (or your app name)
   - **Authorized JavaScript origins**: `http://localhost:5173`
   - **Authorized redirect URIs**: `http://localhost:5173/api/oauth/google/callback`
7. Copy **Client ID** and **Client Secret** to your `.env`:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
OAUTH_CALLBACK_URI=http://localhost:5173/api/oauth/google/callback
```

> **Production:** Update redirect URIs to your production domain

> **Note:** TOTP-based 2FA works completely offline with no Google API calls. Any TOTP-compatible app (Google Authenticator, Authy, Microsoft Authenticator) will work.

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
