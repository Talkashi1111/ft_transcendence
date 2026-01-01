import type { GameState, Ball, Paddle, Player } from '../types/game';
import { GAME_CONFIG } from './config';
import { InputHandler } from '../utils/input';
import { render, setupCanvas } from './renderer';
import {
  updateBallPosition,
  checkWallCollision,
  checkPaddleCollision,
  checkScore,
  resetBall,
  movePaddle,
} from './physics';

export class PongGame {
  private ctx: CanvasRenderingContext2D;
  private gameState: GameState;
  private inputHandler: InputHandler;
  private animationId: number | null = null;
  private countdownInterval: number | null = null;
  private onGameEnd?: (winner: string, player1Score: number, player2Score: number) => void;
  private lastFrameTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedTimeStep: number = 1000 / GAME_CONFIG.fps; // ~16.67ms for 60fps

  // Interpolation state for smooth rendering
  private previousBallX: number = 0;
  private previousBallY: number = 0;

  constructor(canvas: HTMLCanvasElement, player1Alias: string, player2Alias: string) {
    this.ctx = setupCanvas(canvas);
    this.inputHandler = new InputHandler();
    this.gameState = this.createInitialState(player1Alias, player2Alias);

    // Initialize interpolation state
    this.previousBallX = this.gameState.ball.x;
    this.previousBallY = this.gameState.ball.y;

    this.setupInputHandlers();
  }

  private createInitialState(player1Alias: string, player2Alias: string): GameState {
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
      alias: player1Alias,
      paddle: paddle1,
    };

    const player2: Player = {
      alias: player2Alias,
      paddle: paddle2,
    };

    return {
      ball,
      player1,
      player2,
      status: 'waiting',
      winner: null,
      countdown: 3,
    };
  }

  private setupInputHandlers(): void {
    this.inputHandler.onPause(() => {
      this.togglePause();
    });
  }

  private startCountdown(): void {
    this.gameState.status = 'countdown';
    this.gameState.countdown = 3;

    this.countdownInterval = window.setInterval(() => {
      this.gameState.countdown--;

      if (this.gameState.countdown <= 0) {
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
        this.gameState.status = 'playing';
      }
    }, 1000);
  }

  start(): void {
    this.lastFrameTime = performance.now();
    this.startCountdown();
    this.gameLoop(this.lastFrameTime);
  }

  private togglePause(): void {
    if (this.gameState.status === 'playing') {
      this.gameState.status = 'paused';
    } else if (this.gameState.status === 'paused') {
      this.gameState.status = 'playing';
    }
  }

  private handleInput(): void {
    // Player 1 controls (W/S)
    if (this.inputHandler.isPlayer1UpPressed()) {
      movePaddle(this.gameState.player1.paddle, 'up');
    }
    if (this.inputHandler.isPlayer1DownPressed()) {
      movePaddle(this.gameState.player1.paddle, 'down');
    }

    // Player 2 controls (Arrow Up/Down)
    if (this.inputHandler.isPlayer2UpPressed()) {
      movePaddle(this.gameState.player2.paddle, 'up');
    }
    if (this.inputHandler.isPlayer2DownPressed()) {
      movePaddle(this.gameState.player2.paddle, 'down');
    }
  }

  private update(): void {
    if (this.gameState.status !== 'playing') {
      return;
    }

    // Handle input
    this.handleInput();

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
        // Player1 scored, so serve to player2 (who got scored on)
        resetBall(this.gameState.ball, 'right');
      } else {
        this.gameState.player2.paddle.score++;
        // Player2 scored, so serve to player1 (who got scored on)
        resetBall(this.gameState.ball, 'left');
      }

      // Reset interpolation state after ball reset to prevent weird interpolation
      this.previousBallX = this.gameState.ball.x;
      this.previousBallY = this.gameState.ball.y;

      // Check win condition
      if (this.gameState.player1.paddle.score >= GAME_CONFIG.maxScore) {
        this.endGame(this.gameState.player1.alias);
      } else if (this.gameState.player2.paddle.score >= GAME_CONFIG.maxScore) {
        this.endGame(this.gameState.player2.alias);
      }
    }
  }

  private endGame(winner: string): void {
    this.gameState.status = 'finished';
    this.gameState.winner = winner;

    if (this.onGameEnd) {
      this.onGameEnd(
        winner,
        this.gameState.player1.paddle.score,
        this.gameState.player2.paddle.score
      );
    }
  }

  private gameLoop = (currentTime: number): void => {
    // Calculate delta time in milliseconds
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Only accumulate time and run physics when actually playing
    // This prevents the ball/paddles from "catching up" after pause or countdown
    if (this.gameState.status === 'playing') {
      // Clamp delta time to prevent spiral of death (e.g., after tab was inactive)
      const clampedDelta = Math.min(deltaTime, 100);

      // Accumulate time for fixed timestep physics updates
      this.accumulator += clampedDelta;

      // Run physics updates at fixed timestep for consistency
      while (this.accumulator >= this.fixedTimeStep) {
        // Store previous ball position before physics update for interpolation
        this.previousBallX = this.gameState.ball.x;
        this.previousBallY = this.gameState.ball.y;

        this.update();
        this.accumulator -= this.fixedTimeStep;
      }

      // Calculate interpolation factor (how far between physics steps we are)
      const alpha = this.accumulator / this.fixedTimeStep;

      // Interpolate ball position for smooth rendering
      const interpolatedBallX = this.lerp(this.previousBallX, this.gameState.ball.x, alpha);
      const interpolatedBallY = this.lerp(this.previousBallY, this.gameState.ball.y, alpha);

      // Create interpolated state for rendering
      const renderState: GameState = {
        ...this.gameState,
        ball: {
          ...this.gameState.ball,
          x: interpolatedBallX,
          y: interpolatedBallY,
        },
      };

      render(this.ctx, renderState);
    } else {
      // Reset accumulator when not playing to prevent catch-up when resuming
      this.accumulator = 0;
      // Reset interpolation state
      this.previousBallX = this.gameState.ball.x;
      this.previousBallY = this.gameState.ball.y;

      // Render without interpolation when not playing
      render(this.ctx, this.gameState);
    }

    if (this.gameState.status !== 'finished') {
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  };

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  setOnGameEnd(
    callback: (winner: string, player1Score: number, player2Score: number) => void
  ): void {
    this.onGameEnd = callback;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.inputHandler.destroy();
  }
}
