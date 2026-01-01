// Game type definitions (shared between frontend and backend)

export interface Ball {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  speed: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  score: number;
}

export interface Player {
  id: string;
  alias: string;
  paddle: Paddle;
}

export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'paused' | 'finished';

export interface GameState {
  ball: Ball;
  player1: Player;
  player2: Player;
  status: GameStatus;
  winner: string | null;
  countdown: number;
}

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  paddleWidth: number;
  paddleHeight: number;
  paddleSpeed: number;
  ballRadius: number;
  ballInitialSpeed: number;
  ballMaxSpeed: number;
  maxScore: number;
  fps: number;
}

// Match types
export type MatchMode = '1v1' | 'tournament';
export type MatchStatus = 'waiting' | 'countdown' | 'playing' | 'paused' | 'finished' | 'cancelled';

export interface MatchPlayer {
  id: string;
  username: string;
  connected: boolean;
}

export interface Match {
  id: string;
  mode: MatchMode;
  status: MatchStatus;
  player1: MatchPlayer;
  player2: MatchPlayer | null;
  score1: number;
  score2: number;
  winnerId: string | null;
  createdAt: Date;
  startedAt: Date | null;
}

// WebSocket event types
export type PlayerInput = 'up' | 'down' | 'none';

// Client -> Server events
export interface ClientEvents {
  'player:input': { direction: PlayerInput };
  'player:ready': Record<string, never>;
  'match:join': { matchId: string };
  'match:leave': Record<string, never>;
}

// Server -> Client events
export interface ServerEvents {
  'game:state': GameState;
  'game:countdown': { count: number };
  'game:start': Record<string, never>;
  'game:end': { winner: string; winnerId: string; score1: number; score2: number };
  'game:paused': { reason: 'opponent_disconnected' };
  'game:resumed': Record<string, never>;
  'match:created': { matchId: string };
  'match:joined': { matchId: string; opponent: string; playerNumber: 1 | 2 };
  'match:waiting': { matchId: string };
  'match:opponent_joined': { opponent: string };
  'match:opponent_left': Record<string, never>;
  'match:opponent_disconnected': { reconnectTimeout: number };
  'match:opponent_reconnected': Record<string, never>;
  error: { code: string; message: string };
}

// WebSocket message wrapper
export interface WSMessage<T = unknown> {
  event: string;
  data: T;
}
