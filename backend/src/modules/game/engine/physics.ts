// Server-side physics engine (mirrors frontend physics)

import type { Ball, Paddle } from '../game.types.js';
import { GAME_CONFIG } from './config.js';

export function updateBallPosition(ball: Ball): void {
  ball.x += ball.velocityX;
  ball.y += ball.velocityY;
}

export function checkWallCollision(ball: Ball): void {
  // Top wall
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.velocityY = -ball.velocityY;
  }

  // Bottom wall
  if (ball.y + ball.radius >= GAME_CONFIG.canvasHeight) {
    ball.y = GAME_CONFIG.canvasHeight - ball.radius;
    ball.velocityY = -ball.velocityY;
  }
}

export function checkPaddleCollision(ball: Ball, paddle: Paddle): boolean {
  const ballLeft = ball.x - ball.radius;
  const ballRight = ball.x + ball.radius;
  const ballTop = ball.y - ball.radius;
  const ballBottom = ball.y + ball.radius;

  const paddleLeft = paddle.x;
  const paddleRight = paddle.x + paddle.width;
  const paddleTop = paddle.y;
  const paddleBottom = paddle.y + paddle.height;

  if (
    ballRight >= paddleLeft &&
    ballLeft <= paddleRight &&
    ballBottom >= paddleTop &&
    ballTop <= paddleBottom
  ) {
    // Calculate where the ball hit the paddle (0 = top, 0.5 = middle, 1 = bottom)
    const hitPosition = (ball.y - paddle.y) / paddle.height;

    // Adjust angle based on where it hit (-0.5 to 0.5)
    const angleMultiplier = (hitPosition - 0.5) * 2;

    // Reverse horizontal direction
    ball.velocityX = -ball.velocityX;

    // Adjust vertical velocity based on hit position
    ball.velocityY = ball.speed * angleMultiplier;

    // Increase speed slightly (but cap at max)
    ball.speed = Math.min(ball.speed * 1.05, GAME_CONFIG.ballMaxSpeed);
    ball.velocityX = ball.velocityX > 0 ? ball.speed : -ball.speed;

    // Move ball out of paddle to prevent stuck
    if (ball.x < GAME_CONFIG.canvasWidth / 2) {
      ball.x = paddleRight + ball.radius;
    } else {
      ball.x = paddleLeft - ball.radius;
    }

    return true;
  }

  return false;
}

export function checkScore(ball: Ball): 'player1' | 'player2' | null {
  // Player 2 scores (ball went past left edge)
  if (ball.x - ball.radius <= 0) {
    return 'player2';
  }

  // Player 1 scores (ball went past right edge)
  if (ball.x + ball.radius >= GAME_CONFIG.canvasWidth) {
    return 'player1';
  }

  return null;
}

export function resetBall(ball: Ball, direction: 'left' | 'right' = 'left'): void {
  ball.x = GAME_CONFIG.canvasWidth / 2;
  ball.y = GAME_CONFIG.canvasHeight / 2;
  ball.speed = GAME_CONFIG.ballInitialSpeed;

  // Random angle between -30 and 30 degrees
  const angle = (Math.random() * 60 - 30) * (Math.PI / 180);

  // Calculate velocity components to maintain constant speed
  const baseVelocityX = ball.speed * Math.cos(angle);
  ball.velocityX = direction === 'left' ? -baseVelocityX : baseVelocityX;
  ball.velocityY = ball.speed * Math.sin(angle);
}

export function movePaddle(paddle: Paddle, direction: 'up' | 'down'): void {
  if (direction === 'up') {
    paddle.y = Math.max(0, paddle.y - paddle.speed);
  } else {
    paddle.y = Math.min(GAME_CONFIG.canvasHeight - paddle.height, paddle.y + paddle.speed);
  }
}
