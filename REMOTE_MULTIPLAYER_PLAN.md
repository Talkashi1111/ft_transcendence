# Remote Multiplayer Implementation Plan

## Overview

Implement remote multiplayer for Pong with server-authoritative game logic, WebSocket communication, and support for both 1v1 and tournament modes.

## Game Modes Summary

| Mode              | Login Required | Implementation |
| ----------------- | -------------- | -------------- |
| Local 1v1         | ❌ No          | ✅ Existing    |
| Local Tournament  | ❌ No          | ✅ Existing    |
| Remote 1v1        | ✅ Yes         | ✅ Implemented |
| Remote Tournament | ✅ Yes         | 🔲 Planned     |

---

## Architecture

```
┌─────────────────┐         WebSocket          ┌─────────────────────────────┐
│   Client A      │◄─────────────────────────►│         Backend             │
│  (Browser)      │                            │                             │
│                 │   - Player inputs          │  ┌─────────────────────┐   │
│  - Render game  │   - Game state updates     │  │   Game Engine       │   │
│  - Send inputs  │   - Match events           │  │   (Authoritative)   │   │
│  - Interpolate  │                            │  │                     │   │
└─────────────────┘                            │  │  - Physics          │   │
                                               │  │  - Scoring          │   │
┌─────────────────┐         WebSocket          │  │  - State broadcast  │   │
│   Client B      │◄─────────────────────────►│  └─────────────────────┘   │
│  (Browser)      │                            │                             │
└─────────────────┘                            │  ┌─────────────────────┐   │
                                               │  │   Match Manager     │   │
                                               │  │                     │   │
                                               │  │  - Matchmaking      │   │
                                               │  │  - Room management  │   │
                                               │  │  - Reconnection     │   │
                                               │  └─────────────────────┘   │
                                               └─────────────────────────────┘
```

---

## Phase 1: Backend WebSocket Infrastructure

### 1.1 WebSocket Setup

**Files to create:**

- `backend/src/modules/game/game.gateway.ts` - WebSocket connection handler
- `backend/src/modules/game/game.route.ts` - REST API endpoints
- `backend/src/modules/game/game.service.ts` - Business logic
- `backend/src/modules/game/game.schema.ts` - Validation schemas

**Dependencies to add:**

```bash
pnpm add @fastify/websocket --filter backend
```

**WebSocket Events (Client → Server):**

```typescript
interface ClientEvents {
  'player:input': { direction: 'up' | 'down' | 'none' };
  'player:ready': {};
  'match:join': { matchId: string };
  'match:create': { mode: '1v1' | 'tournament' };
  'match:leave': {};
  'match:reconnect': {}; // Explicitly request reconnection to active match
}
```

**WebSocket Events (Server → Client):**

```typescript
interface ServerEvents {
  'game:state': GameState; // 60 FPS game state updates
  'game:countdown': { count: number };
  'game:start': {};
  'game:end': { winner: string; score1: number; score2: number };
  'game:paused': { reason: 'opponent_disconnected' }; // Only server-initiated (no manual pause)
  'game:resumed': {};
  'match:created': { matchId: string };
  'match:joined': { matchId: string; opponent: string };
  'match:waiting': { matchId: string };
  'match:opponent_left': {};
  'match:cancelled': { matchId: string };
  'matches:updated': { matches: AvailableMatch[] }; // Real-time match list updates
  error: { code: string; message: string };
}
```

### 1.1.1 Shared WebSocket Architecture

The frontend uses a **singleton WebSocket manager** that maintains a single connection per user session:

```typescript
// frontend/src/utils/websocket.ts
export function getWebSocketManager(): WebSocketManager {
  // Returns singleton instance, creates if needed
}

export function resetWebSocketManager(): void {
  // Disconnects and clears singleton (called on logout)
}
```

**Connection Lifecycle:**

- Connect on successful login or authenticated page navigation
- Single connection used by: game play, match list updates, (future) friends/online status
- Disconnect on logout via `resetWebSocketManager()`
- Only ONE connection per user allowed (Tab Takeover - see below)

**Match Association (Explicit Reconnect):**

The WebSocket connection alone does not associate the socket with an active match. Clients must explicitly send a `match:reconnect` event after connecting:

```
Frontend                          Backend
    |                                |
    |-- WS connect ----------------->|
    |<-- connection established -----|
    |                                |
    |-- match:reconnect ------------>|  (explicit)
    |<-- match:joined/waiting -------|  (socket now associated with match)
```

This explicit flow prevents false reconnections when users navigate between pages. The server no longer auto-reconnects on WebSocket connection.

**Tab Takeover (Duplicate Tab Handling):**

Only one WebSocket connection per user is supported. When a user opens a duplicate tab:

1. **New tab connects** → Server closes old tab's socket with code `4001` ("session_replaced")
2. **Old tab** → Shows "Reclaim Session" modal, navigates to home if was in game
3. **New tab** → Sends `match:reconnect`, auto-navigates to play page if match exists
4. **Reclaim** → User can click "Reclaim Session" to take back control (kicks new tab)

```
Tab 1 (playing)                   Backend                    Tab 2 (new)
    |                                |                            |
    |                                |<-- WS connect -------------|
    |<-- close(4001) ----------------|-- store Tab 2 socket       |
    |                                |<-- match:reconnect --------|
    | [Reclaim modal]                |-- match:joined ----------->|
    | [→ home page]                  |<-- game continues ---------|
```

This ensures the game seamlessly transfers to the new tab without interruption.

**Match List Real-Time Updates:**

- Backend broadcasts `matches:updated` event when matches are created, joined, or cancelled
- Frontend subscribes via shared WebSocket manager
- No polling required - instant updates across all connected clients

### 1.1.2 WebSocket Security & Match Isolation

The implementation ensures secure game isolation when multiple matches run in parallel:

**Authentication Flow:**

```
Client ──► WS Connect ──► preValidation Hook
                              │
                              ▼
                    ┌──────────────────┐
                    │  JWT from Cookie │
                    │  verify(token)   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Database Lookup  │
                    │ fetch user.alias │
                    └────────┬─────────┘
                             │
                             ▼
         socket.userId = decoded.id  (IMMUTABLE)
         socket.username = user.alias
```

**Key Security Principles:**

1. **Identity from Socket, NOT Payload**: Player ID comes from JWT-authenticated socket connection, never from message data
2. **Immutable User Identity**: `socket.userId` is set once at connection and cannot be changed
3. **Match Isolation via `playerMatches` Map**: Each player is mapped to exactly one match

**Match Isolation:**

```
playerMatches: Map<string, string>  // playerId → matchId

┌─────────────────┐    ┌─────────────────┐
│  Match "abc"    │    │  Match "xyz"    │
│  ┌───────────┐  │    │  ┌───────────┐  │
│  │ Player A  │  │    │  │ Player C  │  │
│  │ Player B  │  │    │  │ Player D  │  │
│  └───────────┘  │    │  └───────────┘  │
└─────────────────┘    └─────────────────┘

handlePlayerInput(playerId, direction):
  matchId = playerMatches.get(playerId)  // Only THEIR match
  match = matches.get(matchId)
  match.engine.setPlayerInput(playerId, direction)
```

**Security Guarantees:**

| Attack Vector                 | Protection                                                |
| ----------------------------- | --------------------------------------------------------- |
| Spoofing another player's ID  | Identity from JWT-authenticated socket, not payload       |
| Controlling opponent's paddle | `playerMatches` map ensures input only affects own match  |
| Cross-match interference      | Each match has isolated game engine instance              |
| Manipulating game state       | Server-authoritative physics; client only sends direction |

````

### 1.2 Server-Side Game Engine

**File:** `backend/src/modules/game/engine/`

```typescript
// game-engine.ts
export class ServerGameEngine {
  private gameState: GameState;
  private player1Input: 'up' | 'down' | 'none' = 'none';
  private player2Input: 'up' | 'down' | 'none' = 'none';
  private tickRate: number = 60; // Server tick rate
  private tickInterval: NodeJS.Timeout | null = null;

  constructor(player1Id: string, player2Id: string) {}

  start(): void {}
  pause(): void {}
  resume(): void {}
  stop(): void {}

  setPlayerInput(playerId: string, direction: 'up' | 'down' | 'none'): void {}
  getState(): GameState {}

  private tick(): void {
    // Run physics at fixed timestep
    // Broadcast state to connected clients
  }
}
````

**Shared code between frontend/backend:**

- Move `physics.ts` logic to shared location or duplicate with same logic
- Use same `GAME_CONFIG` constants

### 1.3 Match Manager

**File:** `backend/src/modules/game/match-manager.ts`

```typescript
interface Match {
  id: string;
  mode: '1v1' | 'tournament';
  status: 'waiting' | 'countdown' | 'playing' | 'paused' | 'finished';
  player1: { id: string; username: string; socket: WebSocket; connected: boolean };
  player2: { id: string; username: string; socket: WebSocket; connected: boolean } | null;
  engine: ServerGameEngine | null;
  createdAt: Date;
  reconnectTimeout?: NodeJS.Timeout;
}

export class MatchManager {
  private matches: Map<string, Match> = new Map();
  private playerMatches: Map<string, string> = new Map(); // playerId -> matchId

  createMatch(playerId: string, mode: '1v1'): Match {}
  joinMatch(matchId: string, playerId: string): Match {}
  findAvailableMatch(mode: '1v1'): Match | null {} // Quick match
  leaveMatch(playerId: string): void {}
  handleDisconnect(playerId: string): void {}
  handleReconnect(playerId: string, socket: WebSocket): void {}
}
```

---

## Phase 2: REST API Endpoints

### 2.1 Game API Routes

**File:** `backend/src/modules/game/game.route.ts`

```typescript
// All routes require authentication

// Match Management
POST   /api/game/match              // Create a new match
GET    /api/game/match/:id          // Get match details
DELETE /api/game/match/current      // Leave/cancel current match
GET    /api/game/matches            // List available matches to join
POST   /api/game/match/:id/join     // Join existing match
POST   /api/game/quickmatch         // Auto-matchmaking
GET    /api/game/current            // Get player's current match

// Game State (for CLI support)
GET    /api/game/match/:id/state    // Get current game state
POST   /api/game/match/:id/input    // Send player input (polling alternative)

// Player Stats
GET    /api/game/stats              // Get player's game statistics
GET    /api/game/leaderboard        // Global leaderboard

// Tournament (future)
POST   /api/game/tournament         // Create tournament
GET    /api/game/tournament/:id     // Get tournament state
POST   /api/game/tournament/:id/join // Join tournament
```

### 2.2 Response Schemas

```typescript
// Match response
interface MatchResponse {
  id: string;
  mode: '1v1' | 'tournament';
  status: 'waiting' | 'countdown' | 'playing' | 'paused' | 'finished';
  player1: { id: string; username: string };
  player2: { id: string; username: string } | null;
  score1: number;
  score2: number;
  createdAt: string;
  // Note: No websocketUrl - client uses singleton WebSocket connection
  // and sends match:reconnect event to associate with match
}
```

---

## Phase 3: Frontend Remote Game Client

### 3.1 New Files Structure

```
frontend/src/
├── game/
│   ├── pong.ts              # Existing local game
│   ├── remote-pong.ts       # NEW: Remote game client
│   ├── physics.ts           # Existing (shared logic)
│   ├── renderer.ts          # Existing (reused)
│   └── config.ts            # Existing (shared)
├── utils/
│   ├── websocket.ts         # NEW: WebSocket manager
│   └── input.ts             # Existing
└── pages/
    └── play.ts              # Update with remote options
```

### 3.2 WebSocket Manager

**File:** `frontend/src/utils/websocket.ts`

```typescript
export class GameWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(): Promise<void> {} // Single connection, no matchId needed
  disconnect(): void {}

  send(event: string, data: any): void {}
  on(event: string, callback: Function): void {}
  off(event: string, callback: Function): void {}

  reconnectToMatch(matchId?: string): void {} // Associate with match via event
  private handleReconnect(): void {}
  private handleMessage(event: MessageEvent): void {}
}

// Singleton pattern - single connection per user session
export function getWebSocketManager(): GameWebSocket {}
export function resetWebSocketManager(): void {} // Called on logout
```

### 3.3 Remote Pong Client

**File:** `frontend/src/game/remote-pong.ts`

```typescript
export class RemotePongGame {
  private ctx: CanvasRenderingContext2D;
  private ws: WebSocketManager;
  private gameState: GameState | null = null;
  private inputHandler: InputHandler;
  private playerId: 'player1' | 'player2';
  private lastInput: 'up' | 'down' | 'none' = 'none';

  // Client-side interpolation for smooth rendering
  private previousBallX: number = 0;
  private previousBallY: number = 0;
  private interpolationDelay: number = 100; // ms

  constructor(canvas: HTMLCanvasElement) {}

  connect(matchId: string): Promise<void> {
    // Uses singleton WebSocket manager
    // Sends match:reconnect event to associate with match
  }
  disconnect(): void {}

  private sendInput(): void {
    // Send input at fixed rate (not every frame)
    // Only send if input changed
  }

  private interpolateState(): void {
    // Smooth interpolation between server states
    // Detects ball reset (position jump > 100px) to skip interpolation
  }

  private render(): void {
    // Use interpolated state for smooth visuals
  }
}
```

### 3.4 Client-Side Prediction (Optional Enhancement)

For better responsiveness, implement client-side prediction:

- Predict local paddle movement immediately
- Reconcile with server state when received
- Only for the local player's paddle

---

## Phase 4: UI/UX Updates

### 4.1 Play Page Updates

**File:** `frontend/src/pages/play.ts`

```
┌─────────────────────────────────────────┐
│              Play Pong                  │
├─────────────────────────────────────────┤
│                                         │
│   ┌───────────────┐ ┌───────────────┐  │
│   │  LOCAL PLAY   │ │ ONLINE PLAY   │  │
│   │               │ │  (Login Req)  │  │
│   └───────────────┘ └───────────────┘  │
│                                         │
│   LOCAL:                                │
│   [1v1 Game]  [Tournament]              │
│                                         │
│   ONLINE:                               │
│   [Quick Match]  [Create Private]       │
│   [Join Match]   [Tournament]           │
│                                         │
└─────────────────────────────────────────┘
```

### 4.2 Match Lobby UI

```
┌─────────────────────────────────────────┐
│           Waiting for Opponent          │
├─────────────────────────────────────────┤
│                                         │
│        Match ID: ABC123                 │
│        Share this code with a friend    │
│                                         │
│        [Copy Link]                      │
│                                         │
│        ⏳ Waiting...                    │
│                                         │
│        [Cancel]                         │
└─────────────────────────────────────────┘
```

### 4.3 Connection Status Indicator

Show connection quality during game:

- 🟢 Good (< 50ms ping)
- 🟡 Fair (50-150ms)
- 🔴 Poor (> 150ms)

### 4.4 Disconnection Handling UI

```
┌─────────────────────────────────────────┐
│           Opponent Disconnected         │
├─────────────────────────────────────────┤
│                                         │
│   Waiting for opponent to reconnect...  │
│                                         │
│        ⏳ 25 seconds remaining          │
│                                         │
│   [Claim Victory]  [Wait]               │
└─────────────────────────────────────────┘
```

---

## Phase 5: Network Handling

### 5.1 Latency Compensation

1. **Server-side:** Run authoritative game at 60 tick/s
2. **Client-side:**
   - Buffer incoming states (100ms delay)
   - Interpolate between buffered states
   - Local paddle uses client-side prediction

### 5.2 Disconnection Handling

```typescript
// Server-side logic
const RECONNECT_GRACE_PERIOD = 30_000; // 30 seconds

function handlePlayerDisconnect(match: Match, playerId: string) {
  // 1. Pause the game
  match.engine?.pause();
  match.status = 'paused';

  // 2. Notify other player
  notifyPlayer(match, getOtherPlayer(playerId), 'game:paused', {
    reason: 'opponent_disconnected',
  });

  // 3. Start reconnection timer
  match.reconnectTimeout = setTimeout(() => {
    // Award victory to connected player
    endMatch(match, getOtherPlayer(playerId));
  }, RECONNECT_GRACE_PERIOD);
}

function handlePlayerReconnect(match: Match, playerId: string, socket: WebSocket) {
  // 1. Clear timeout
  clearTimeout(match.reconnectTimeout);

  // 2. Update socket reference
  updatePlayerSocket(match, playerId, socket);

  // 3. Resume game after brief countdown
  startCountdown(match, 3);
}
```

### 5.3 Input Buffering

- Server buffers last N inputs per player
- Apply inputs with timestamps
- Handle out-of-order packets

---

## Phase 6: Database Updates

### 6.1 New Prisma Models

**File:** `backend/prisma/schema.prisma`

```prisma
model GameMatch {
  id          String   @id @default(uuid())
  mode        String   // '1v1' | 'tournament'
  status      String   // 'waiting' | 'playing' | 'finished' | 'cancelled'

  player1Id   String
  player1     User     @relation("Player1Matches", fields: [player1Id], references: [id])
  player2Id   String?
  player2     User?    @relation("Player2Matches", fields: [player2Id], references: [id])

  score1      Int      @default(0)
  score2      Int      @default(0)
  winnerId    String?

  createdAt   DateTime @default(now())
  startedAt   DateTime?
  finishedAt  DateTime?

  tournamentId String?
  tournament   Tournament? @relation(fields: [tournamentId], references: [id])
}

model Tournament {
  id          String   @id @default(uuid())
  name        String
  status      String   // 'registration' | 'in_progress' | 'finished'
  maxPlayers  Int      @default(8)

  createdBy   String
  creator     User     @relation(fields: [createdBy], references: [id])

  matches     GameMatch[]
  players     TournamentPlayer[]

  createdAt   DateTime @default(now())
  startedAt   DateTime?
  finishedAt  DateTime?
}

model TournamentPlayer {
  id           String     @id @default(uuid())
  tournamentId String
  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  userId       String
  user         User       @relation(fields: [userId], references: [id])
  eliminated   Boolean    @default(false)
  placement    Int?

  @@unique([tournamentId, userId])
}

// Add to User model
model User {
  // ... existing fields
  player1Matches   GameMatch[] @relation("Player1Matches")
  player2Matches   GameMatch[] @relation("Player2Matches")
  tournaments      TournamentPlayer[]
  createdTournaments Tournament[]

  // Stats
  gamesPlayed      Int @default(0)
  gamesWon         Int @default(0)
}
```

---

## Phase 7: CLI Support

### 7.1 CLI Game Client

For "partial usage via CLI", support basic game interaction using cookie-based auth:

```bash
# Login first and save cookie
curl -c /tmp/cookies.txt -X POST 'http://localhost:3000/api/users/login' \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "password": "Password123!"}'

# Create a match
curl -b /tmp/cookies.txt -X POST 'http://localhost:3000/api/game/match' \
  -H 'Content-Type: application/json' \
  -d '{}'

# Get match state
curl -b /tmp/cookies.txt 'http://localhost:3000/api/game/match/<match-id>/state'

# Send input (polling mode for CLI)
curl -b /tmp/cookies.txt -X POST 'http://localhost:3000/api/game/match/<match-id>/input' \
  -H 'Content-Type: application/json' \
  -d '{"input": "up"}'
```

### 7.2 WebSocket CLI Testing

```bash
# Connect via WebSocket using npx wscat (single connection, no matchId in URL)
npx wscat -c 'ws://localhost:3000/api/game/ws' \
  -H "Cookie: $(grep token /tmp/cookies.txt | awk '{print $6\"=\"$7}')"

# Then send events interactively:
# {"event": "match:create", "data": {}}
# {"event": "match:reconnect", "data": {}}   # Associate with active match
# {"event": "player:input", "data": {"direction": "up"}}
```

---

## Implementation Order

### Sprint 1: Foundation (Week 1)

1. ✅ Add `@fastify/websocket` dependency
2. ✅ Create `game` module structure
3. ✅ Implement `ServerGameEngine` (port physics to backend)
4. ✅ Implement basic WebSocket connection handler
5. ✅ Create `MatchManager` for room management

### Sprint 2: Core Gameplay (Week 2)

1. ✅ Implement game state broadcasting
2. ✅ Handle player inputs via WebSocket
3. ✅ Create `RemotePongGame` client class
4. ✅ Implement state interpolation on client
5. ✅ Basic matchmaking (create/join)

### Sprint 3: Network Resilience (Week 3)

1. ✅ Implement reconnection handling
2. ✅ Add connection quality monitoring
3. ✅ Handle disconnection gracefully
4. ✅ Input buffering and validation
5. ✅ Add latency display

### Sprint 4: UI/UX (Week 4)

1. ✅ Update Play page with remote options
2. ✅ Create match lobby UI
3. ✅ Add connection status indicators
4. ✅ Implement disconnection UI
5. ✅ Quick match functionality

### Sprint 5: Persistence & Stats (Week 5)

1. ✅ Add database models
2. ✅ Save match results
3. ✅ Implement player stats
4. ✅ Create leaderboard
5. ✅ Match history

### Sprint 6: Remote Tournament (Week 6)

1. ✅ Tournament creation/registration
2. ✅ Tournament bracket management
3. ✅ Automatic match scheduling
4. ✅ Tournament progression
5. ✅ Tournament results

### Sprint 7: Polish & Testing (Week 7)

1. ✅ CLI support
2. ✅ Comprehensive testing
3. ✅ Performance optimization
4. ✅ Documentation
5. ✅ Edge case handling

---

## Technical Considerations

### Performance

- Server tick rate: 60 Hz
- State broadcast rate: 60 Hz (or 30 Hz with interpolation)
- Input send rate: 60 Hz (with deduplication)
- Use binary WebSocket messages for efficiency (optional)

### Security

- Validate all inputs server-side
- Rate limit WebSocket messages
- Authenticate WebSocket connections via JWT
- Prevent match manipulation

### Scalability

- Each match is independent (easy horizontal scaling)
- Consider Redis for match state if scaling across instances
- WebSocket sticky sessions if load balancing

---

## File Checklist

### Backend New Files

- [x] `src/modules/game/game.gateway.ts`
- [x] `src/modules/game/game.route.ts`
- [ ] `src/modules/game/game.service.ts`
- [x] `src/modules/game/game.schema.ts`
- [x] `src/modules/game/engine/game-engine.ts`
- [x] `src/modules/game/engine/physics.ts` (shared with frontend)
- [x] `src/modules/game/match-manager.ts`
- [x] `src/modules/game/game.types.ts`
- [ ] `test/game.test.ts`

### Frontend New Files

- [x] `src/game/remote-pong.ts`
- [x] `src/utils/websocket.ts`
- [ ] `src/pages/match-lobby.ts`
- [ ] `test/remote-pong.test.ts`
- [ ] `test/websocket.test.ts`

### Modifications

- [x] `backend/src/app.ts` (register WebSocket + game routes)
- [ ] `backend/prisma/schema.prisma` (add game models)
- [x] `frontend/src/pages/play.ts` (add remote options)
- [x] `frontend/src/types/game.ts` (add remote types)
- [x] `frontend/src/main.ts` (global WebSocket connection management)

---

## Questions to Resolve

1. **State sync frequency:** 60 Hz or 30 Hz with interpolation?
2. **Binary vs JSON:** Use binary protocol for efficiency?
3. **Spectator mode:** Support watching matches?
4. **Match replay:** Store and replay matches?
5. **Anti-cheat:** How much validation is needed?

---

## Success Criteria

1. ✅ Two players can play from different browsers/computers
2. ✅ Game feels responsive (< 100ms perceived latency)
3. ✅ Handles disconnection gracefully (30s reconnect window)
4. ✅ Smooth visuals (no jitter/teleporting)
5. ✅ Match results are persisted
6. ✅ CLI can interact with game API
7. ✅ Tournament mode works remotely
