import { PongGame } from './pong';
import { movePaddle, predictBallY } from './physics';
import { GAME_CONFIG } from './config';
import { BotLevel } from '../types/game';

export class BotPongGame extends PongGame {
  private botDirection: 'up' | 'down' = 'down';
  private readonly level: BotLevel;

  private lastDecisionTime: number = 0;
  private targetY: number | null = null; // Ball predicted Y position at paddle X
  private replacedItselfAfterHit: boolean = false;

  constructor(canvas: HTMLCanvasElement, player1Alias: string, selectedLevel: BotLevel) {
    super(canvas, player1Alias, `Bot Lvl ${selectedLevel}`);
    this.level = selectedLevel;
  }

  // Override handleInput to replace player 2 controls with bot logic
  protected override handleInput(): void {
    // Player/User controls
    if (this.inputHandler.isPlayer1UpPressed() || this.inputHandler.isPlayer2UpPressed()) {
      movePaddle(this.gameState.player1.paddle, 'up');
    }
    if (this.inputHandler.isPlayer1DownPressed() || this.inputHandler.isPlayer2DownPressed()) {
      movePaddle(this.gameState.player1.paddle, 'down');
    }

    // IA Control
    this.handleBotMovement();
  }

  private handleBotMovement(): void {
    switch (this.level) {
      case BotLevel.LEVEL_1:
        this.patrolBot();
        break;
      case BotLevel.LEVEL_2:
        this.trackingBallYBot();
        break;
      case BotLevel.LEVEL_3:
        this.humanLikeBot();
        break;
      case BotLevel.LEVEL_4:
        this.godLikeBot();
        break;
      default:
        this.patrolBot();
        break;
    }
  }

  // patrol from top to bottom and from bottom to top continuously
  private patrolBot(): void {
    const paddle = this.gameState.player2.paddle;

    if (paddle.y + paddle.height >= GAME_CONFIG.canvasHeight) {
      this.botDirection = 'up';
    }
    if (paddle.y <= 0) {
      this.botDirection = 'down';
    }

    movePaddle(paddle, this.botDirection);
  }

  // Track the ball's vertical position (ball.y)
  private trackingBallYBot(): void {
    const ball = this.gameState.ball;
    const paddle = this.gameState.player2.paddle;
    const paddleCenter = paddle.y + paddle.height / 2;

    // Add a margin of 10px to prevent jittery movement
    if (ball.y < paddleCenter - 10) {
      movePaddle(paddle, 'up');
    } else if (ball.y > paddleCenter + 10) {
      movePaddle(paddle, 'down');
    }
    // Else, do nothing (ball is within margin)
  }

  // Human behavior; bot sees the gamestate once per second, predicts Ball Y (including bounces) with a margin error
  private humanLikeBot(): void {
    const now = Date.now();
    const paddle = this.gameState.player2.paddle;
    const ball = this.gameState.ball;

    // --- PHASE 1 : REFLEXION (once per second) ---
    if (now - this.lastDecisionTime > 1000) {
      this.lastDecisionTime = now;

      // 1. calculate future ball's Y at paddle's X
      const exactPredictionY = predictBallY(ball, paddle.x);

      // 2. Calculate a margin to simulate human approximation and add to exactPredictionY
      if (exactPredictionY !== null) {
        this.replacedItselfAfterHit = false;
        const distanceToBall = Math.abs(paddle.x - ball.x);
        const maxDistance = GAME_CONFIG.canvasWidth;
        
        const ratio = Math.min(distanceToBall / maxDistance, 1); // Distance ratio (0.0 = closest/hitting, 1.0 = furthest)

        // Max possible error/margin corresponds to 1/4 of board height
        const maxError = GAME_CONFIG.canvasHeight * 0.25;
        
        // The error is a random value between −maxError and +maxError, weighted by the distance
        const errorOffset = (Math.random() - 0.5) * 2 * (maxError * ratio);

        this.targetY = exactPredictionY + errorOffset;
      } else {
        if (!this.replacedItselfAfterHit) {
          const center = GAME_CONFIG.canvasHeight / 2;
          const randomOffset = (Math.random() - 0.5) * GAME_CONFIG.canvasHeight * 0.25;
          this.targetY = center + randomOffset;
          this.replacedItselfAfterHit = true;
        }
      }
    }

    // --- PHASE 2 : ACTION ---
    // The bot moves the paddle until reaching targetY
    if (this.targetY !== null) {
      const paddleCenter = paddle.y + paddle.height / 2;
      
      if (Math.abs(paddleCenter - this.targetY) > 10) {
        if (paddleCenter < this.targetY) {
          movePaddle(paddle, 'down');
        } else {
          movePaddle(paddle, 'up');
        }
      }
    }
  }

  /* Impossible level:
  - No view delay (sees the gamestate every frame)
  - Replaces itself at the center after hitting the ball
  - Offensive gameplay; will hit the ball so it lands to the furthest of the opponent's position
  */
  private godLikeBot(): void {
    const ball = this.gameState.ball;
    const paddle = this.gameState.player2.paddle;
    const player1Paddle = this.gameState.player1.paddle;

    const impactY = predictBallY(ball, paddle.x);

    // If no impact predicted, center the paddle
    if (impactY === null) {
      const center = GAME_CONFIG.canvasHeight / 2;
      if (Math.abs((paddle.y + paddle.height / 2) - center) > 5) {
        movePaddle(paddle, (paddle.y + paddle.height / 2) < center ? 'down' : 'up');
      }
      return;
    }
    
    const player1Center = player1Paddle.y + player1Paddle.height / 2;
    const screenCenter = GAME_CONFIG.canvasHeight / 2;
    
    // If opponent is below center, we aim top. If above center, we aim bottom.
    const targetY = (player1Center > screenCenter) ? GAME_CONFIG.ballRadius : GAME_CONFIG.canvasHeight - GAME_CONFIG.ballRadius;

    const distanceX = Math.abs(paddle.x - (player1Paddle.x + player1Paddle.width)); // Horizontal distance between the two paddles 
    const deltaY = targetY - impactY; // Difference between target and ball's future impact on bot paddle
    
    // Max slope is about 1.0 (45 degrees defined in physics.ts). If we ask for too much, we saturate at the maximum possible (-1 or 1)
    let requiredSlope = deltaY / distanceX; // ratio Y/X
    requiredSlope = Math.max(-1, Math.min(1, requiredSlope));

    // Calculate where on the paddle to hit the ball to achieve the desired slope
    const desiredHitPos = (requiredSlope / 2) + 0.5;
    const targetPaddleY = impactY - (paddle.height * desiredHitPos);

    if (Math.abs(paddle.y - targetPaddleY) > 5) {
      if (paddle.y < targetPaddleY) {
        movePaddle(paddle, 'down');
      } else {
        movePaddle(paddle, 'up');
      }
    }
  }
}
