// Game configuration constants (must match frontend config)

import type { GameConfig } from '../game.types.js';

export const GAME_CONFIG: GameConfig = {
  canvasWidth: 800,
  canvasHeight: 600,
  paddleWidth: 15,
  paddleHeight: 100,
  paddleSpeed: 6,
  ballRadius: 8,
  ballInitialSpeed: 5,
  ballMaxSpeed: 12,
  maxScore: 11,
  fps: 60,
};

// Timing constants
export const TICK_RATE = 60; // Server tick rate in Hz
export const TICK_INTERVAL = 1000 / TICK_RATE; // ~16.67ms
export const COUNTDOWN_SECONDS = 3;
export const RECONNECT_TIMEOUT = 30_000; // 30 seconds grace period for reconnection
