// Server-side authoritative game engine

import type { GameState, Ball, Paddle, Player, PlayerInput } from '../game.types.js';
import { GAME_CONFIG, TICK_INTERVAL, COUNTDOWN_SECONDS } from './config.js';
import {
  updateBallPosition,
  checkWallCollision,
  checkPaddleCollision,
  checkScore,
  resetBall,
  movePaddle,
} from './physics.js';

export type GameEventCallback = (event: string, data: unknown) => void;

export class GameEngine {
  private gameState: GameState;
  private player1Input: PlayerInput = 'none';
  private player2Input: PlayerInput = 'none';
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private onStateUpdate: GameEventCallback | null = null;
  private onGameEnd: ((winnerId: string, score1: number, score2: number) => void) | null = null;

  constructor(player1Id: string, player1Alias: string, player2Id: string, player2Alias: string) {
    this.gameState = this.createInitialState(player1Id, player1Alias, player2Id, player2Alias);
  }

  private createInitialState(
    player1Id: string,
    player1Alias: string,
    player2Id: string,
    player2Alias: string
  ): GameState {
    const ball: Ball = {
      x: GAME_CONFIG.canvasWidth / 2,
      y: GAME_CONFIG.canvasHeight / 2,
      velocityX: -GAME_CONFIG.ballInitialSpeed,
      velocityY: 0,
      radius: GAME_CONFIG.ballRadius,
      speed: GAME_CONFIG.ballInitialSpeed,
    };

    const paddle1: Paddle = {
      x: 20,
      y: GAME_CONFIG.canvasHeight / 2 - GAME_CONFIG.paddleHeight / 2,
      width: GAME_CONFIG.paddleWidth,
      height: GAME_CONFIG.paddleHeight,
      speed: GAME_CONFIG.paddleSpeed,
      score: 0,
    };

    const paddle2: Paddle = {
      x: GAME_CONFIG.canvasWidth - 20 - GAME_CONFIG.paddleWidth,
      y: GAME_CONFIG.canvasHeight / 2 - GAME_CONFIG.paddleHeight / 2,
      width: GAME_CONFIG.paddleWidth,
      height: GAME_CONFIG.paddleHeight,
      speed: GAME_CONFIG.paddleSpeed,
      score: 0,
    };

    const player1: Player = {
      id: player1Id,
      alias: player1Alias,
      paddle: paddle1,
    };

    const player2: Player = {
      id: player2Id,
      alias: player2Alias,
      paddle: paddle2,
    };

    return {
      ball,
      player1,
      player2,
      status: 'waiting',
      winner: null,
      countdown: COUNTDOWN_SECONDS,
    };
  }

  setOnStateUpdate(callback: GameEventCallback): void {
    this.onStateUpdate = callback;
  }

  setOnGameEnd(callback: (winnerId: string, score1: number, score2: number) => void): void {
    this.onGameEnd = callback;
  }

  start(): void {
    this.startCountdown();
  }

  private startCountdown(): void {
    this.gameState.status = 'countdown';
    this.gameState.countdown = COUNTDOWN_SECONDS;

    this.broadcastState();
    this.emitEvent('game:countdown', { count: this.gameState.countdown });

    this.countdownInterval = setInterval(() => {
      this.gameState.countdown--;
      this.emitEvent('game:countdown', { count: this.gameState.countdown });

      if (this.gameState.countdown <= 0) {
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
        this.gameState.status = 'playing';
        this.emitEvent('game:start', {});
        this.startGameLoop();
      }
    }, 1000);
  }

  private startGameLoop(): void {
    this.tickInterval = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL);
  }

  private tick(): void {
    if (this.gameState.status !== 'playing') {
      return;
    }

    // Apply player inputs
    this.handleInputs();

    // Update ball position
    updateBallPosition(this.gameState.ball);

    // Check wall collisions
    checkWallCollision(this.gameState.ball);

    // Check paddle collisions
    checkPaddleCollision(this.gameState.ball, this.gameState.player1.paddle);
    checkPaddleCollision(this.gameState.ball, this.gameState.player2.paddle);

    // Check scoring
    const scorer = checkScore(this.gameState.ball);
    if (scorer) {
      if (scorer === 'player1') {
        this.gameState.player1.paddle.score++;
        resetBall(this.gameState.ball, 'right');
      } else {
        this.gameState.player2.paddle.score++;
        resetBall(this.gameState.ball, 'left');
      }

      // Check win condition
      if (this.gameState.player1.paddle.score >= GAME_CONFIG.maxScore) {
        this.endGame(this.gameState.player1.id, this.gameState.player1.alias);
      } else if (this.gameState.player2.paddle.score >= GAME_CONFIG.maxScore) {
        this.endGame(this.gameState.player2.id, this.gameState.player2.alias);
      }
    }

    // Broadcast state to clients
    this.broadcastState();
  }

  private handleInputs(): void {
    // Player 1 input
    if (this.player1Input === 'up') {
      movePaddle(this.gameState.player1.paddle, 'up');
    } else if (this.player1Input === 'down') {
      movePaddle(this.gameState.player1.paddle, 'down');
    }

    // Player 2 input
    if (this.player2Input === 'up') {
      movePaddle(this.gameState.player2.paddle, 'up');
    } else if (this.player2Input === 'down') {
      movePaddle(this.gameState.player2.paddle, 'down');
    }
  }

  setPlayerInput(playerId: string, direction: PlayerInput): void {
    if (playerId === this.gameState.player1.id) {
      this.player1Input = direction;
    } else if (playerId === this.gameState.player2.id) {
      this.player2Input = direction;
    }
  }

  pause(reason: 'opponent_disconnected'): void {
    if (this.gameState.status === 'playing') {
      this.gameState.status = 'paused';
      this.emitEvent('game:paused', { reason });
    }
  }

  resume(): void {
    if (this.gameState.status === 'paused') {
      // Resume with a short countdown - ball continues from where it was
      this.gameState.countdown = COUNTDOWN_SECONDS;
      this.startCountdown();
    }
  }

  private endGame(winnerId: string, winnerAlias: string): void {
    this.gameState.status = 'finished';
    this.gameState.winner = winnerAlias;

    this.stop();

    this.emitEvent('game:end', {
      winner: winnerAlias,
      winnerId,
      score1: this.gameState.player1.paddle.score,
      score2: this.gameState.player2.paddle.score,
    });

    if (this.onGameEnd) {
      this.onGameEnd(
        winnerId,
        this.gameState.player1.paddle.score,
        this.gameState.player2.paddle.score
      );
    }
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private broadcastState(): void {
    this.emitEvent('game:state', this.getState());
  }

  private emitEvent(event: string, data: unknown): void {
    if (this.onStateUpdate) {
      this.onStateUpdate(event, data);
    }
  }

  getState(): GameState {
    return { ...this.gameState };
  }

  getStatus(): GameState['status'] {
    return this.gameState.status;
  }

  getScores(): { score1: number; score2: number } {
    return {
      score1: this.gameState.player1.paddle.score,
      score2: this.gameState.player2.paddle.score,
    };
  }

  // Force end the game with a specific winner (e.g., opponent disconnected)
  forceEnd(winnerId: string): void {
    const winner =
      winnerId === this.gameState.player1.id ? this.gameState.player1 : this.gameState.player2;
    this.endGame(winner.id, winner.alias);
  }
}
