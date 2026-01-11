import type { Ball, Paddle } from '../types/game';
import { GAME_CONFIG } from './config';

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
  // Check if ball intersects with paddle
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
  // velocityX and velocityY form a vector with magnitude = ball.speed
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

/**
 * Predicts where the ball will be vertically (y) when it reaches a specific horizontal coordinate (targetX).
 * Simulates wall bounces instantly.
 */
export function predictBallY(ball: Ball, targetX: number): number | null {
  // 1. Safety checks. If ball is not moving horizontally, it will never reach targetX
  if (Math.abs(ball.velocityX) < 0.01) {
    return null;
  }

  // Check direction: if ball is moving AWAY from target, return null. If target is to the right (> ball.x) but ball moves left (< 0) -> Impossible
  if (targetX > ball.x && ball.velocityX < 0) return null;
  if (targetX < ball.x && ball.velocityX > 0) return null;

  // 2. Simulation variables (copied to not mutate the real ball)
  let currentX = ball.x;
  let currentY = ball.y;
  let velocityY = ball.velocityY;
  const velocityX = ball.velocityX;

  const radius = ball.radius;
  const canvasHeight = GAME_CONFIG.canvasHeight;

  // 3. Iterative calculation (Raycasting with bounces)
  // We advance step by step: from current pos -> next wall hit -> next wall hit -> target

  // Safety break to prevent infinite loops (max 10 bounces is plenty for Pong)
  let iterations = 0;
  const maxIterations = 20;

  while ((velocityX > 0 && currentX < targetX) || (velocityX < 0 && currentX > targetX)) {
    if (iterations++ > maxIterations) break;

    const distRemainingX = targetX - currentX;

    // If moving purely horizontal (vy=0), we go straight to target
    if (Math.abs(velocityY) < 0.01) {
      return currentY;
    }

    // Determine distance to the next HORIZONTAL wall (i.e. top or bottom) based on current vertical direction
    let distToWallY: number;
    if (velocityY > 0) {
      // Moving down: target is bottom wall (height - radius)
      distToWallY = canvasHeight - radius - currentY;
    } else {
      distToWallY = currentY - radius;
    }

    // Calculate time to hit that wall
    // time = distance / speed
    const timeToWall = distToWallY / Math.abs(velocityY);

    // Calculate how much X distance we travel during that time
    const distToWallX = Math.abs(velocityX * timeToWall);

    // CHECK: Will we hit the wall before reaching the target X?
    if (distToWallX < Math.abs(distRemainingX)) {
      // YES: We hit the wall first
      // Advance simulation to the collision point
      currentX += velocityX > 0 ? distToWallX : -distToWallX;

      // Y is now exactly at the wall limit
      currentY = velocityY > 0 ? canvasHeight - radius : radius;

      // Bounce! (Flip vertical velocity)
      velocityY = -velocityY;
    } else {
      // We reach the target X before hitting the wall
      // Calculate time to reach target
      const timeToTarget = Math.abs(distRemainingX / velocityX);

      // Advance Y to the final position
      currentY += velocityY * timeToTarget;

      // We arrived
      return currentY;
    }
  }

  return currentY;
}
