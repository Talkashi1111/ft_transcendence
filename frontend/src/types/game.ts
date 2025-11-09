// Game type definitions

export interface Ball {
  x: number
  y: number
  velocityX: number
  velocityY: number
  radius: number
  speed: number
}

export interface Paddle {
  x: number
  y: number
  width: number
  height: number
  speed: number
  score: number
}

export interface Player {
  alias: string
  paddle: Paddle
}

export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'paused' | 'finished'

export interface GameState {
  ball: Ball
  player1: Player
  player2: Player
  status: GameStatus
  winner: string | null
  countdown: number
}

export interface GameConfig {
  canvasWidth: number
  canvasHeight: number
  paddleWidth: number
  paddleHeight: number
  paddleSpeed: number
  ballRadius: number
  ballInitialSpeed: number
  ballMaxSpeed: number
  maxScore: number
  fps: number
}
