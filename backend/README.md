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
│   │   ├── game/           # Remote multiplayer game module
│   │   │   ├── engine/     # Server-side game physics engine
│   │   │   ├── game.gateway.ts   # WebSocket connection handler
│   │   │   ├── game.route.ts     # REST API endpoints
│   │   │   ├── game.schema.ts    # Validation schemas
│   │   │   ├── game.types.ts     # TypeScript types
│   │   │   └── match-manager.ts  # Match state management
│   │   ├── oauth/          # Google OAuth module
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

### Game (Remote Multiplayer)

| Method | Endpoint                    | Description                          | Auth     |
| ------ | --------------------------- | ------------------------------------ | -------- |
| POST   | `/api/game/match`           | Create a new match                   | Required |
| GET    | `/api/game/matches`         | List available matches (waiting)     | Required |
| GET    | `/api/game/match/:id`       | Get match details                    | Required |
| GET    | `/api/game/match/:id/state` | Get current game state               | Required |
| POST   | `/api/game/match/:id/join`  | Join an existing match               | Required |
| POST   | `/api/game/match/:id/input` | Send player input (polling fallback) | Required |
| POST   | `/api/game/quickmatch`      | Auto-matchmaking (join or create)    | Required |
| GET    | `/api/game/current`         | Get player's current match           | Required |
| DELETE | `/api/game/match/current`   | Leave/cancel current match           | Required |

### WebSocket (Real-time Game)

| Endpoint       | Description                 | Auth     |
| -------------- | --------------------------- | -------- |
| `/api/game/ws` | WebSocket endpoint for game | Required |

#### WebSocket Authentication

WebSocket connections are authenticated via JWT in the `preValidation` hook, **before** the WebSocket upgrade completes. This allows proper HTTP 401 responses for unauthenticated requests.

```
Browser                         Backend
   |                               |
   |-- GET /api/game/ws ---------->|
   |   Cookie: token=<jwt>         |
   |   Upgrade: websocket          |
   |                               |
   |   [preValidation hook]        |
   |   - Extract JWT from cookie   |
   |   - Verify token              |
   |   - Attach user to request    |
   |                               |
   |<-- 101 Switching Protocols ---|  (if authenticated)
   |<-- 401 Unauthorized ----------|  (if not)
```

**Authentication:** JWT is extracted from the `token` cookie. For CLI testing, pass the cookie via header (see [CLI Testing](#cli-testing-with-curl--wscat) section).

#### WebSocket Proxy (Development)

In development, Vite proxies WebSocket traffic to the backend. The `ws: true` option in `vite.config.ts` enables this:

```
Browser                    Vite (:5173)              Backend (:3000)
   |                           |                           |
   |-- WS /api/game/ws ------->|                           |
   |                           |-- WS /api/game/ws ------->|
   |                           |<-- 101 Switching ---------|
   |<-- 101 Switching ---------|                           |
   |                           |                           |
   |===== WebSocket tunnel ====|===== WebSocket tunnel ====|
   |                           |                           |
   |-- {event: "ping"} ------->|-- {event: "ping"} ------->|
   |<-- {event: "pong"} -------|<-- {event: "pong"} -------|
```

Vite creates a transparent bidirectional tunnel, forwarding all WebSocket frames between browser and backend.

#### Shared WebSocket Architecture (Frontend)

The frontend uses a **singleton WebSocket manager** pattern - a single shared connection per user session that serves multiple features:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Frontend WebSocket Architecture                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐           │
│  │    Play Page    │   │   Remote Game   │   │     Friends     │           │
│  │                 │   │                 │   │    (future)     │           │
│  │  Match List     │   │   Game State    │   │  Online Status  │           │
│  │  (matches:      │   │   (game:state,  │   │                 │           │
│  │   updated)      │   │    game:end)    │   │                 │           │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘           │
│           │                     │                     │                    │
│           └──────────────┬──────┴─────────────────────┘                    │
│                          │                                                 │
│                          ▼                                                 │
│              ┌───────────────────────────────┐                             │
│              │   WebSocketManager (Singleton) │                            │
│              │   getWebSocketManager()        │                            │
│              │                               │                             │
│              │   - Auto-reconnect            │                             │
│              │   - Event subscription        │                             │
│              │   - Keep-alive ping           │                             │
│              └───────────────┬───────────────┘                             │
│                              │                                             │
│                              │ Single WebSocket Connection                 │
│                              ▼                                             │
│                    ┌─────────────────┐                                     │
│                    │ /api/game/ws    │                                     │
│                    │ (via Vite proxy)│                                     │
│                    └─────────────────┘                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Connection Lifecycle:**

```
User Action                  Frontend                        Backend
    |                            |                               |
    |-- Login successful ------->|                               |
    |                            |-- connectGlobalWebSocket() -->|
    |                            |<-- WS connection established --|
    |                            |                               |
    |-- Navigate to Play ------->|                               |
    |                            | [reuse existing connection]   |
    |                            |<-- matches:updated -----------|
    |                            |                               |
    |-- Start Remote Game ------>|                               |
    |                            |-- POST /quickmatch ---------->|
    |                            |<-- { matchId } ---------------|
    |                            |-- match:reconnect ----------->| (associate socket)
    |                            |<-- match:waiting -------------|
    |                            |<-- game:state (60Hz) ---------|
    |                            |-- player:input -------------->|
    |                            |                               |
    |-- Navigate away ---------->|                               |
    |                            |-- match:leave --------------->| (forfeit match)
    |                            |                               |
    |-- Logout ----------------->|                               |
    |                            |-- resetWebSocketManager() --->|
    |                            | [connection closed]           |
```

> **Note:** The `match:reconnect` event must be sent explicitly after connecting to associate the WebSocket with an active match. The server no longer auto-reconnects on WebSocket connection to prevent false reconnections when navigating between pages.

**Reconnection Handling:**

```
                         Frontend                        Backend
                             |                               |
    [Connection drops]       X                               |
                             |                               |
                             |-- State: 'reconnecting' ----->|
                             |                               |
                             |   [Exponential backoff]       |
                             |   Attempt 1: wait 1s + jitter |
                             |-- WS connect attempt -------->|
                             |<-- Connection failed ---------|
                             |                               |
                             |   Attempt 2: wait 2s + jitter |
                             |-- WS connect attempt -------->|
                             |<-- 101 Switching Protocols ---|
                             |                               |
                             |-- State: 'connected' -------->|
                             |   [Resume normal operation]   |
```

**Configuration:**
| Setting | Default | Description |
|---------|---------|-------------|
| `maxReconnectAttempts` | 10 | Stop trying after this many failures |
| `baseReconnectDelay` | 1000ms | Initial delay before first retry |
| `maxReconnectDelay` | 30000ms | Cap on exponential backoff |
| `pingInterval` | 25000ms | Keep-alive ping frequency |

**Key functions:**

- `getWebSocketManager()` - Returns singleton, creates if needed
- `resetWebSocketManager()` - Disconnects and clears (on logout)
- `wsManager.on(event, handler)` - Subscribe to events
- `wsManager.off(event, handler)` - Unsubscribe from events

**Tab Takeover (Duplicate Tab Handling):**

Only one WebSocket connection per user is allowed. When a user opens a new tab:

```
Tab 1 (playing game)              Backend                    Tab 2 (new tab)
    |                                |                            |
    |<-- game:state (60Hz) ----------|                            |
    |                                |                            |
    |                                |<-- WS connect -------------|
    |                                |                            |
    |<-- close(4001, session_replaced)                            |
    |                                |-- store Tab 2 socket ----->|
    |                                |                            |
    | [Shows "Reclaim Session" modal]|<-- match:reconnect --------|
    |                                |-- match:joined ----------->|
    | [Navigates to home]            |<-- game:state (60Hz) ------|
    |                                |                            |
    | [User clicks "Reclaim"]        |                            |
    |-- WS connect ----------------->|                            |
    |                                |-- close(4001) ------------>|
    | [Navigates to /play]           |                            |
    |<-- match:joined ---------------|  [Shows "Reclaim" modal]   |
```

**Key implementation details:**

1. **Backend**: When new socket connects, close existing socket with code `4001` ("session_replaced")
2. **Backend**: `handleDisconnect` ignores sockets that were replaced (prevents game pause)
3. **Frontend**: Listen for close code `4001`, show "Reclaim Session" modal
4. **Frontend**: `sessionWasReplaced` flag prevents auto-reconnect loops during `render()`
5. **Frontend**: New tab sends `match:reconnect` to auto-join active match

#### WebSocket Events

**Client → Server:**

| Event             | Data                            | Description                          |
| ----------------- | ------------------------------- | ------------------------------------ |
| `ping`            | `{}`                            | Keep-alive ping                      |
| `player:input`    | `{ direction: up\|down\|none }` | Paddle movement                      |
| `match:join`      | `{ matchId: string }`           | Join specific match                  |
| `match:leave`     | `{}`                            | Leave current match                  |
| `match:reconnect` | `{}`                            | Explicitly reconnect to active match |

**Server → Client:**

| Event                         | Data                                   | Description                       |
| ----------------------------- | -------------------------------------- | --------------------------------- |
| `pong`                        | `{}`                                   | Response to ping                  |
| `game:state`                  | `GameState`                            | Game state update (60Hz)          |
| `game:countdown`              | `{ count: number }`                    | Countdown before start            |
| `game:start`                  | `{}`                                   | Game started                      |
| `game:end`                    | `{ winner, winnerId, score1, score2 }` | Game finished                     |
| `game:paused`                 | `{ reason: opponent_disconnected }`    | Game paused (opponent DC)         |
| `game:resumed`                | `{}`                                   | Game resumed                      |
| `match:created`               | `{ matchId }`                          | Match created                     |
| `match:joined`                | `{ matchId, opponent, playerNumber }`  | Joined a match                    |
| `match:waiting`               | `{ matchId }`                          | Waiting for opponent              |
| `match:opponent_joined`       | `{ opponent }`                         | Opponent joined                   |
| `match:opponent_left`         | `{}`                                   | Opponent left                     |
| `match:opponent_disconnected` | `{ reconnectTimeout }`                 | Opponent disconnected             |
| `match:opponent_reconnected`  | `{}`                                   | Opponent reconnected              |
| `match:cancelled`             | `{ matchId }`                          | Match was cancelled               |
| `matches:updated`             | `{ matches: AvailableMatch[] }`        | Match list changed (global)       |
| `session:replaced`            | `{}`                                   | Another tab took over (code 4001) |
| `error`                       | `{ code, message }`                    | Error occurred                    |

> **Note:** The `matches:updated` event is broadcast to ALL connected clients when any match is created, joined, or cancelled. This enables real-time match list updates without polling.

#### Backend Broadcast Architecture

The backend maintains a map of all connected sockets and broadcasts events when match state changes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Backend WebSocket Architecture                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       game.gateway.ts                                │   │
│  │                                                                      │   │
│  │   connectedSockets: Map<userId, AuthenticatedSocket>                 │   │
│  │                                                                      │   │
│  │   broadcastToAll(event, data)  ─────► All connected clients         │   │
│  │   sendToMatch(matchId, event, data) ► Match participants only       │   │
│  └────────────────────────────────────────────────────────────────┬────┘   │
│                                                                    │        │
│                          Callback registration                     │        │
│                                                                    ▼        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       match-manager.ts                               │   │
│  │                                                                      │   │
│  │   setMatchListUpdateCallback(callback)                               │   │
│  │                                                                      │   │
│  │   On match create/join/cancel:                                       │   │
│  │     notifyMatchListUpdate() ──► callback() ──► broadcastMatchList()  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Broadcast triggers:**

- `createMatch()` - New match available for joining
- `joinMatch()` - Match filled, no longer available
- `cancelMatch()` - Match removed from available list
- `leaveMatch()` - Match may become available again (if waiting status)

#### Quick Match Flow

```
Player A                    Server                    Player B
   |                           |                           |
   |-- POST /quickmatch ------>|                           |
   |<-- { matchId, isNew } ----|                           |
   |-- WS connect ------------>|                           |
   |-- match:reconnect ------->|  (associate socket)       |
   |<-- match:waiting ---------|                           |
   |                           |                           |
   |   (Player B joins)        |<-- POST /quickmatch ------|
   |                           |--- { matchId } ---------->|
   |                           |<-- WS connect ------------|
   |                           |<-- match:reconnect -------|
   |                           |                           |
   |<-- match:opponent_joined -|                           |
   |<-- match:joined ----------|--- match:joined --------->|
   |                           |                           |
   |<-- game:countdown {3} ----|--- game:countdown {3} --->|
   |<-- game:countdown {2} ----|--- game:countdown {2} --->|
   |<-- game:countdown {1} ----|--- game:countdown {1} --->|
   |<-- game:start ------------|--- game:start ----------->|
   |                           |                           |
   |<===== game:state (60Hz) ==|=== game:state (60Hz) ====>|
   |-- player:input {up} ----->|                           |
   |                           |<-- player:input {down} ---|
   |                           |                           |
   |<-- game:end --------------|--- game:end ------------->|
```

> **Note:** After establishing a WebSocket connection, the client must explicitly send `match:reconnect` to associate the socket with their active match. The server no longer auto-reconnects on connection.

#### Reconnection Flow (30s grace period)

```
Player A                    Server                    Player B
   |                           |                           |
   |===== game in progress ====|=== game in progress =====>|
   |                           |                           |
   X (connection lost)         |                           |
   |                           |                           |
   |                           |--- game:paused ---------->|
   |                           |    {reason: opponent_     |
   |                           |     disconnected}         |
   |                           |--- match:opponent_ ------>|
   |                           |    disconnected           |
   |                           |    {reconnectTimeout: 30} |
   |                           |                           |
   |   [30 second timer]       |                           |
   |                           |                           |
   |-- WS connect ------------>|                           |
   |-- match:reconnect ------->|  (explicit reconnect)     |
   |<-- match:joined ----------|                           |
   |<-- game:state ------------|                           |
   |                           |--- match:opponent_ ------>|
   |                           |    reconnected            |
   |                           |--- game:resumed --------->|
   |                           |                           |
   |<===== game resumes =======|=== game resumes =========>|
```

> **Important:** When reconnecting after a disconnect, the client must:
>
> 1. Establish a new WebSocket connection
> 2. Explicitly send `match:reconnect` event
>
> The server will NOT auto-reconnect on WebSocket connection. This explicit flow prevents false reconnections when users navigate to other pages.

#### Reconnection Timeout (opponent wins)

```
Player A                    Server                    Player B
   |                           |                           |
   X (disconnected)            |                           |
   |                           |--- game:paused ---------->|
   |                           |--- match:opponent_ ------>|
   |                           |    disconnected {30s}     |
   |                           |                           |
   |   [30 seconds pass...]    |                           |
   |                           |                           |
   |                           |--- game:end ------------->|
   |                           |    {winner: "Player B",   |
   |                           |     winnerId: "...",      |
   |                           |     score1: X, score2: Y} |
   |                           |                           |
   |                           | [match cleanup after 5s]  |
```

#### Voluntary Leave (opponent wins)

```
Player A                    Server                    Player B
   |                           |                           |
   |===== game in progress ====|=== game in progress =====>|
   |                           |                           |
   |-- match:leave ----------->|                           |
   |                           |                           |
   |                           |--- game:end ------------->|
   |                           |    {winner: "Player B"}   |
   |                           |                           |
   | [connection closed]       | [match cleanup after 5s]  |
```

#### Error Handling

| Error Code         | Description                    | Fatal? |
| ------------------ | ------------------------------ | ------ |
| `AUTH_FAILED`      | JWT invalid or missing         | Yes    |
| `MATCH_NOT_FOUND`  | Match ID doesn't exist         | Yes    |
| `MATCH_FULL`       | Match already has 2 players    | Yes    |
| `ALREADY_IN_MATCH` | Player in another active match | Yes    |
| `UNKNOWN_EVENT`    | Unrecognized event type        | No     |
| `PARSE_ERROR`      | Invalid JSON message           | No     |

```
Client                      Server
   |                           |
   |-- {invalid JSON} -------->|
   |<-- error ----------------|
   |    {code: PARSE_ERROR}    |
   |   [connection stays open] |
   |                           |
   |-- match:join {bad id} --->|
   |<-- error -----------------|
   |    {code: MATCH_NOT_FOUND}|
   |   [may close connection]  |
```

#### WebSocket Security & Match Isolation

The WebSocket implementation ensures secure game isolation when multiple matches run in parallel:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     WebSocket Security Model                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CONNECTION AUTHENTICATION                                               │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Client ──► WS Connect ──► preValidation Hook                      │    │
│  │                                │                                   │    │
│  │                                ▼                                   │    │
│  │                     ┌──────────────────┐                           │    │
│  │                     │  JWT from Cookie │                           │    │
│  │                     │  server.jwt.     │                           │    │
│  │                     │   verify(token)  │                           │    │
│  │                     └────────┬─────────┘                           │    │
│  │                              │                                     │    │
│  │                              ▼                                     │    │
│  │                     ┌──────────────────┐                           │    │
│  │                     │ Database Lookup  │                           │    │
│  │                     │ prisma.user.     │                           │    │
│  │                     │  findUnique()    │                           │    │
│  │                     └────────┬─────────┘                           │    │
│  │                              │                                     │    │
│  │                              ▼                                     │    │
│  │              socket.userId = decoded.id  (IMMUTABLE)               │    │
│  │              socket.username = user.alias                          │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  2. MESSAGE HANDLING - Identity from Socket, NOT Payload                    │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                    │    │
│  │  Client sends: { event: "player:input", data: { direction: "up" }} │    │
│  │                                                                    │    │
│  │  Server handler:                                                   │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │ handlePlayerInput(socket, data) {                            │ │    │
│  │  │   // Uses socket.userId - NOT data.userId (never sent)       │ │    │
│  │  │   matchManager.handlePlayerInput(socket.userId, data.dir);   │ │    │
│  │  │ }                                                            │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  │                                                                    │    │
│  │  ✓ Client CANNOT send fake userId in payload                      │    │
│  │  ✓ Identity always comes from authenticated socket                │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  3. MATCH ISOLATION - playerMatches Map                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                    │    │
│  │   playerMatches: Map<string, string>  // playerId → matchId       │    │
│  │                                                                    │    │
│  │   ┌─────────────────┐    ┌─────────────────┐                      │    │
│  │   │  Match "abc"    │    │  Match "xyz"    │                      │    │
│  │   │  ┌───────────┐  │    │  ┌───────────┐  │                      │    │
│  │   │  │ Player A  │  │    │  │ Player C  │  │                      │    │
│  │   │  │ Player B  │  │    │  │ Player D  │  │                      │    │
│  │   │  └───────────┘  │    │  └───────────┘  │                      │    │
│  │   └─────────────────┘    └─────────────────┘                      │    │
│  │                                                                    │    │
│  │   handlePlayerInput(playerId, direction):                         │    │
│  │     matchId = playerMatches.get(playerId)  // Only THEIR match    │    │
│  │     match = matches.get(matchId)                                  │    │
│  │     match.engine.setPlayerInput(playerId, direction)              │    │
│  │                                                                    │    │
│  │   ✓ Player A input → Only affects Match "abc"                     │    │
│  │   ✓ Player C input → Only affects Match "xyz"                     │    │
│  │   ✓ No cross-match interference possible                          │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Security guarantees:**

| Attack Vector                   | Protection                                                  |
| ------------------------------- | ----------------------------------------------------------- |
| Spoofing another player's ID    | Identity from JWT-authenticated socket, not message payload |
| Controlling opponent's paddle   | `playerMatches` map ensures input only affects own match    |
| Joining match as different user | Socket userId set at connection, immutable during session   |
| Manipulating game state         | Server-authoritative physics; client only sends direction   |

**Code flow for player input:**

```
1. Client sends:     { event: "player:input", data: { direction: "up" } }
2. game.gateway.ts:  handlePlayerInput(socket, data)
                     → matchManager.handlePlayerInput(socket.userId, direction)
                                                      ^^^^^^^^^^^
                                                      From socket, not payload!
3. match-manager.ts: matchId = playerMatches.get(playerId)
                     match = matches.get(matchId)
                     match.engine.setPlayerInput(playerId, direction)
```

### Blockchain (Tournament Scores)

| Method | Endpoint                       | Description            | Auth |
| ------ | ------------------------------ | ---------------------- | ---- |
| GET    | `/api/tournaments/:id/matches` | Get tournament matches | No   |
| POST   | `/api/matches`                 | Record a match         | No   |
| GET    | `/api/matches/total`           | Total match count      | No   |

## CLI Testing with curl & wscat

This section shows how to test API endpoints using command-line tools.

### Authentication (Login)

**Option 1: Save cookies to a file (recommended for multiple requests)**

```bash
# Login and save cookie to file
curl -c /tmp/cookies.txt -X POST 'http://localhost:3000/api/users/login' \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "password": "password123"}'

# Use saved cookie for authenticated requests
curl -b /tmp/cookies.txt 'http://localhost:3000/api/users/me'
```

**Option 2: Without cookies file (inline cookie)**

```bash
# Login and capture Set-Cookie header
curl -i -X POST 'http://localhost:3000/api/users/login' \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "password": "password123"}'

# Manually copy the token from Set-Cookie header and use it:
curl -H 'Cookie: token=YOUR_JWT_TOKEN_HERE' 'http://localhost:3000/api/users/me'
```

**Option 3: One-liner with command substitution**

```bash
TOKEN=$(curl -s -c - -X POST 'http://localhost:3000/api/users/login' \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "password": "password123"}' | grep token | awk '{print $7}')

curl -H "Cookie: token=$TOKEN" 'http://localhost:3000/api/users/me'
```

### User Endpoints

```bash
# Register a new user
curl -X POST 'http://localhost:3000/api/users' \
  -H 'Content-Type: application/json' \
  -d '{"email": "test@example.com", "password": "test1234", "alias": "testuser"}'

# Login
curl -c /tmp/cookies.txt -X POST 'http://localhost:3000/api/users/login' \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "password": "password123"}'

# Get current user profile
curl -b /tmp/cookies.txt 'http://localhost:3000/api/users/me'

# List all users
curl -b /tmp/cookies.txt 'http://localhost:3000/api/users'

# Logout
curl -b /tmp/cookies.txt -X POST 'http://localhost:3000/api/users/logout'
```

### Game Endpoints

```bash
# Create a new match
curl -b /tmp/cookies.txt -X POST 'http://localhost:3000/api/game/match' \
  -H 'Content-Type: application/json' \
  -d '{}'

# Create match with mode
curl -b /tmp/cookies.txt -X POST 'http://localhost:3000/api/game/match' \
  -H 'Content-Type: application/json' \
  -d '{"mode": "1v1"}'

# List available matches (waiting for players)
curl -b /tmp/cookies.txt 'http://localhost:3000/api/game/matches'

# Get specific match details
curl -b /tmp/cookies.txt 'http://localhost:3000/api/game/match/<match-id>'

# Get match game state
curl -b /tmp/cookies.txt 'http://localhost:3000/api/game/match/<match-id>/state'

# Join an existing match
curl -b /tmp/cookies.txt -X POST 'http://localhost:3000/api/game/match/<match-id>/join'

# Quick match (auto-join or create)
curl -b /tmp/cookies.txt -X POST 'http://localhost:3000/api/game/quickmatch'

# Send input during game
curl -b /tmp/cookies.txt -X POST 'http://localhost:3000/api/game/match/<match-id>/input' \
  -H 'Content-Type: application/json' \
  -d '{"input": "up"}'   # Options: "up", "down", "stop"

# Get current match for logged-in user
curl -b /tmp/cookies.txt 'http://localhost:3000/api/game/current'

# Leave/cancel current match
curl -b /tmp/cookies.txt -X DELETE 'http://localhost:3000/api/game/match/current'
```

### Testing with Two Players

```bash
# Terminal 1: Login as alice, create match
curl -c /tmp/alice.txt -X POST 'http://localhost:3000/api/users/login' \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "password": "password123"}'

curl -b /tmp/alice.txt -X POST 'http://localhost:3000/api/game/match' \
  -H 'Content-Type: application/json' \
  -d '{}'
# Note the match ID from response

# Terminal 2: Login as bob, join the match
curl -c /tmp/bob.txt -X POST 'http://localhost:3000/api/users/login' \
  -H 'Content-Type: application/json' \
  -d '{"email": "bob@example.com", "password": "password123"}'

curl -b /tmp/bob.txt -X POST 'http://localhost:3000/api/game/match/<match-id>/join'
```

### WebSocket Testing with wscat

Real-time gameplay requires WebSocket connection. Use `npx wscat` (no install needed):

```bash
# Connect to WebSocket (using cookie from file)
npx wscat -c 'ws://localhost:3000/api/game/ws' \
  -H "Cookie: $(grep token /tmp/cookies.txt | awk '{print $6"="$7}')"

# Once connected, you can send events:
# Create a match
{"event": "match:create", "data": {}}

# Quick match (join existing or create new)
{"event": "match:quickmatch", "data": {}}

# Join specific match
{"event": "match:join", "data": {"matchId": "<match-id>"}}

# Send paddle input
{"event": "player:input", "data": {"direction": "up"}}
{"event": "player:input", "data": {"direction": "down"}}
{"event": "player:input", "data": {"direction": "none"}}

# Ping (keep-alive)
{"event": "ping", "data": {}}

# Leave match
{"event": "match:leave", "data": {}}
```

**Two-player WebSocket test:**

```bash
# Terminal 1: Alice creates match
npx wscat -c 'ws://localhost:3000/api/game/ws' \
  -H "Cookie: $(grep token /tmp/alice.txt | awk '{print $6"="$7}')"
# Send: {"event": "match:create", "data": {}}
# Note the matchId from match:created event

# Terminal 2: Bob joins
npx wscat -c 'ws://localhost:3000/api/game/ws' \
  -H "Cookie: $(grep token /tmp/bob.txt | awk '{print $6"="$7}')"
# Send: {"event": "match:join", "data": {"matchId": "<match-id>"}}
```

## Testing

```bash
# Run tests
cd /app/backend && pnpm test

# Run tests with coverage
cd /app/backend && pnpm test -- --coverage

# Run from root (uses make)
cd /app && make test
```
