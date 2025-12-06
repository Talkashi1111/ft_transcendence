import type { GameConfig } from '../types/game';

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

// Colors
export const COLORS = {
  background: '#1e293b', // slate-800
  paddle: '#3b82f6', // blue-500
  ball: '#ffffff',
  text: '#ffffff',
  centerLine: '#475569', // slate-600
};

// Keyboard controls
export const KEYS = {
  player1Up: 'w',
  player1Down: 's',
  player2Up: 'ArrowUp',
  player2Down: 'ArrowDown',
  pause: ' ',
  escape: 'Escape',
};
