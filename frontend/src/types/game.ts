// Game type definitions

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

// Remote game types
export interface RemotePlayer extends Player {
  id: string;
}

export interface RemoteGameState extends Omit<GameState, 'player1' | 'player2'> {
  player1: RemotePlayer;
  player2: RemotePlayer;
}

// Match types for remote play
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
  createdAt: string;
  startedAt: string | null;
}

export const BotLevel = {
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
  LEVEL_4: 4,
} as const;

export type BotLevel = typeof BotLevel[keyof typeof BotLevel];
