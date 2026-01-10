import { PongGame } from './pong';
import { movePaddle, predictBallY } from './physics';
import { GAME_CONFIG } from './config';
import { BotLevel } from '../types/game';

export class BotPongGame extends PongGame {
  private botDirection: 'up' | 'down' = 'down';

  private lastDecisionTime: number = 0;
  private targetY: number | null = null; // Ball predicted Y position at paddle X
  private replacedItselfAfterHit: boolean = false;

  private cachedImpactY: number | null = null;

  private readonly runBotStrategy: () => void; // Function pointer that will hold the logic for the selected level

  constructor(canvas: HTMLCanvasElement, player1Alias: string, selectedLevel: BotLevel) {
    super(canvas, player1Alias, `Bot Lvl ${selectedLevel}`);

    switch (selectedLevel) {
      case BotLevel.LEVEL_1:
        this.runBotStrategy = this.patrolBot;
        break;
      case BotLevel.LEVEL_2:
        this.runBotStrategy = this.trackingBallYBot;
        break;
      case BotLevel.LEVEL_3:
        this.runBotStrategy = this.humanLikeBot;
        break;
      case BotLevel.LEVEL_4:
        this.runBotStrategy = this.godLikeBot;
        break;
      default:
        this.runBotStrategy = this.patrolBot;
        break;
    }

    // Bind 'this' to the strategy so it can access class properties
    this.runBotStrategy = this.runBotStrategy.bind(this);
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
    this.runBotStrategy();
  }

  // Level 1: patrol from top to bottom and from bottom to top continuously
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

  // Level 2: Track the ball's vertical position (ball.y)
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

  // Level 3: Human behavior; bot sees the gamestate once per second, predicts Ball Y (including bounces) with a margin error
  private humanLikeBot(): void {
    const now = Date.now();
    const paddle = this.gameState.player2.paddle;
    const ball = this.gameState.ball;

    // --- PHASE 1 : Reflection (once per second) ---
    if (now - this.lastDecisionTime > 1000) {
      this.lastDecisionTime = now;

      // 1. calculate future ball's Y at paddle's X
      const exactPredictionY = predictBallY(ball, paddle.x);

      // 2. Calculate a margin to simulate human approximation and add it to exactPredictionY
      if (exactPredictionY !== null) {
        this.replacedItselfAfterHit = false;
        const distanceToBall = Math.abs(paddle.x - ball.x);
        const maxDistance = GAME_CONFIG.canvasWidth;
        const ratio = Math.min(distanceToBall / maxDistance, 1); // Distance ratio (0.0 = closest/hitting, 1.0 = furthest)
        const maxError = GAME_CONFIG.canvasHeight * 0.25; // Max possible error/margin corresponds to 1/4 of board height
        const errorOffset = (Math.random() - 0.5) * 2 * (maxError * ratio); // The error is a random value between −maxError and +maxError, weighted by the distance

        this.targetY = exactPredictionY + errorOffset;
      } else {
        // Ball moving away: return to center with random offset
        if (!this.replacedItselfAfterHit) {
          const center = GAME_CONFIG.canvasHeight / 2;
          const randomOffset = (Math.random() - 0.5) * GAME_CONFIG.canvasHeight * 0.25;
          this.targetY = center + randomOffset;
          this.replacedItselfAfterHit = true;
        }
      }
    }

    // --- PHASE 2 : Action ---
    if (this.targetY !== null) {
      const paddleCenter = paddle.y + paddle.height / 2;
      
      if (Math.abs(paddleCenter - this.targetY) > 10) {
        movePaddle(paddle, paddleCenter < this.targetY ? 'down' : 'up');
      }
    }
  }

  // Level 4: God-like; Optimized perfect prediction + offensive aiming
  private godLikeBot(): void {
    const ball = this.gameState.ball;
    const paddle = this.gameState.player2.paddle;
    const player1Paddle = this.gameState.player1.paddle;

    // If ball moving away, clear cache and idle
    if (ball.velocityX <= 0) {
      this.cachedImpactY = null;
      const center = GAME_CONFIG.canvasHeight / 2;
      const paddleCenter = paddle.y + paddle.height / 2;
      
      if (Math.abs(paddleCenter - center) > 5) {
        movePaddle(paddle, paddleCenter < center ? 'down' : 'up');
      }
      return;
    }

    // Calculate prediction once per incoming volley
    if (this.cachedImpactY === null) {
      this.cachedImpactY = predictBallY(ball, paddle.x);
    }
    
    const impactY = this.cachedImpactY;
    
    // Fallback if prediction failed (should not happen if velocity > 0)
    if (impactY === null) return;
    
    // Offensive Logic: Aim away from opponent
    const player1Center = player1Paddle.y + player1Paddle.height / 2;
    const screenCenter = GAME_CONFIG.canvasHeight / 2;
    // If opponent is below center, we aim top. If above center, we aim bottom.
    const targetY = (player1Center > screenCenter) ? GAME_CONFIG.ballRadius : GAME_CONFIG.canvasHeight - GAME_CONFIG.ballRadius;

    const distanceX = Math.abs(paddle.x - (player1Paddle.x + player1Paddle.width));
    const deltaY = targetY - impactY; // Difference between target and ball's future impact on bot paddle
    
    // Max slope is about 1.0 (45 degrees defined in physics.ts). If we ask for too much, we saturate at the maximum possible (-1 or 1)
    let requiredSlope = deltaY / distanceX;
    requiredSlope = Math.max(-1, Math.min(1, requiredSlope));

    const desiredHitPos = (requiredSlope / 2) + 0.5;
    const targetPaddleY = impactY - (paddle.height * desiredHitPos);

    if (Math.abs(paddle.y - targetPaddleY) > 5) {
      movePaddle(paddle, paddle.y < targetPaddleY ? 'down' : 'up');
    }
  }
}
