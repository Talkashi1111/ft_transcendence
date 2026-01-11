import { describe, it, expect } from 'vitest';
import {
  updateBallPosition,
  checkWallCollision,
  checkPaddleCollision,
  checkScore,
  resetBall,
  movePaddle,
  predictBallY,
} from '../src/game/physics';
import type { Ball, Paddle } from '../src/types/game';
import { GAME_CONFIG } from '../src/game/config';

describe('Physics Module', () => {
  describe('updateBallPosition', () => {
    it('should update ball position based on velocity', () => {
      const ball: Ball = {
        x: 400,
        y: 300,
        velocityX: 5,
        velocityY: 3,
        radius: 8,
        speed: 5,
      };

      updateBallPosition(ball);

      expect(ball.x).toBe(405);
      expect(ball.y).toBe(303);
    });

    it('should handle negative velocity', () => {
      const ball: Ball = {
        x: 400,
        y: 300,
        velocityX: -5,
        velocityY: -3,
        radius: 8,
        speed: 5,
      };

      updateBallPosition(ball);

      expect(ball.x).toBe(395);
      expect(ball.y).toBe(297);
    });
  });

  describe('checkWallCollision', () => {
    it('should bounce ball off top wall', () => {
      const ball: Ball = {
        x: 400,
        y: 5, // Near top
        velocityX: 5,
        velocityY: -3,
        radius: 8,
        speed: 5,
      };

      checkWallCollision(ball);

      expect(ball.velocityY).toBe(3); // Reversed
    });

    it('should bounce ball off bottom wall', () => {
      const ball: Ball = {
        x: 400,
        y: 595, // Near bottom (600 - 5)
        velocityX: 5,
        velocityY: 3,
        radius: 8,
        speed: 5,
      };

      checkWallCollision(ball);

      expect(ball.velocityY).toBe(-3); // Reversed
    });

    it('should not bounce if not hitting wall', () => {
      const ball: Ball = {
        x: 400,
        y: 300, // Middle
        velocityX: 5,
        velocityY: 3,
        radius: 8,
        speed: 5,
      };

      checkWallCollision(ball);

      expect(ball.velocityY).toBe(3); // Unchanged
    });
  });

  describe('checkPaddleCollision', () => {
    it('should bounce ball off left paddle', () => {
      const ball: Ball = {
        x: 30, // Near left paddle
        y: 300,
        velocityX: -5,
        velocityY: 0,
        radius: 8,
        speed: 5,
      };

      const leftPaddle: Paddle = {
        x: 20,
        y: 250, // Ball is in range
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      const result = checkPaddleCollision(ball, leftPaddle);

      expect(result).toBe(true);
      expect(ball.velocityX).toBeGreaterThan(0); // Reversed to positive
    });

    it('should bounce ball off right paddle', () => {
      const ball: Ball = {
        x: 770, // Near right paddle
        y: 300,
        velocityX: 5,
        velocityY: 0,
        radius: 8,
        speed: 5,
      };

      const rightPaddle: Paddle = {
        x: 765,
        y: 250, // Ball is in range
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      const result = checkPaddleCollision(ball, rightPaddle);

      expect(result).toBe(true);
      expect(ball.velocityX).toBeLessThan(0); // Reversed to negative
    });

    it('should increase ball speed on paddle hit', () => {
      const ball: Ball = {
        x: 30,
        y: 300,
        velocityX: -5,
        velocityY: 0,
        radius: 8,
        speed: 5,
      };

      const leftPaddle: Paddle = {
        x: 20,
        y: 250,
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      checkPaddleCollision(ball, leftPaddle);

      expect(ball.speed).toBeGreaterThan(5); // Speed increased
    });

    it('should cap ball speed at maxSpeed', () => {
      const ball: Ball = {
        x: 30,
        y: 300,
        velocityX: -11,
        velocityY: 0,
        radius: 8,
        speed: 11.5, // Near max
      };

      const leftPaddle: Paddle = {
        x: 20,
        y: 250,
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      checkPaddleCollision(ball, leftPaddle);

      expect(ball.speed).toBeLessThanOrEqual(GAME_CONFIG.ballMaxSpeed);
    });

    it('should adjust vertical velocity based on hit position', () => {
      const ball: Ball = {
        x: 30,
        y: 260, // Hit near top of paddle
        velocityX: -5,
        velocityY: 0,
        radius: 8,
        speed: 5,
      };

      const leftPaddle: Paddle = {
        x: 20,
        y: 250,
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      checkPaddleCollision(ball, leftPaddle);

      expect(ball.velocityY).toBeLessThan(0); // Should go upward
    });

    it('should return false if ball misses paddle', () => {
      const ball: Ball = {
        x: 30,
        y: 100, // Above paddle
        velocityX: -5,
        velocityY: 0,
        radius: 8,
        speed: 5,
      };

      const leftPaddle: Paddle = {
        x: 20,
        y: 250, // Ball is out of range
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      const result = checkPaddleCollision(ball, leftPaddle);

      expect(result).toBe(false);
      expect(ball.velocityX).toBe(-5); // Unchanged
    });
  });

  describe('checkScore', () => {
    it('should detect left side score (player 2 scores)', () => {
      const ball: Ball = {
        x: -10, // Past left edge
        y: 300,
        velocityX: -5,
        velocityY: 0,
        radius: 8,
        speed: 5,
      };

      const result = checkScore(ball);

      expect(result).toBe('player2');
    });

    it('should detect right side score (player 1 scores)', () => {
      const ball: Ball = {
        x: 810, // Past right edge
        y: 300,
        velocityX: 5,
        velocityY: 0,
        radius: 8,
        speed: 5,
      };

      const result = checkScore(ball);

      expect(result).toBe('player1');
    });

    it('should return null if no score', () => {
      const ball: Ball = {
        x: 400, // Middle
        y: 300,
        velocityX: 5,
        velocityY: 0,
        radius: 8,
        speed: 5,
      };

      const result = checkScore(ball);

      expect(result).toBeNull();
    });
  });

  describe('resetBall', () => {
    it('should center ball position', () => {
      const ball: Ball = {
        x: 100,
        y: 100,
        velocityX: 5,
        velocityY: 3,
        radius: 8,
        speed: 10,
      };

      resetBall(ball);

      expect(ball.x).toBe(GAME_CONFIG.canvasWidth / 2);
      expect(ball.y).toBe(GAME_CONFIG.canvasHeight / 2);
    });

    it('should reset speed to initial', () => {
      const ball: Ball = {
        x: 100,
        y: 100,
        velocityX: 5,
        velocityY: 3,
        radius: 8,
        speed: 10,
      };

      resetBall(ball);

      expect(ball.speed).toBe(GAME_CONFIG.ballInitialSpeed);
    });

    it('should set random velocity direction', () => {
      const ball: Ball = {
        x: 100,
        y: 100,
        velocityX: 0,
        velocityY: 0,
        radius: 8,
        speed: 5,
      };

      resetBall(ball);

      // Should have some velocity
      expect(Math.abs(ball.velocityX)).toBeGreaterThan(0);
      // VelocityY might be 0 if angle is exactly horizontal
      expect(ball.velocityX !== 0 || ball.velocityY !== 0).toBe(true);
    });
  });

  describe('movePaddle', () => {
    it('should move paddle up', () => {
      const paddle: Paddle = {
        x: 20,
        y: 300,
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      movePaddle(paddle, 'up');

      expect(paddle.y).toBe(294); // 300 - 6
    });

    it('should move paddle down', () => {
      const paddle: Paddle = {
        x: 20,
        y: 300,
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      movePaddle(paddle, 'down');

      expect(paddle.y).toBe(306); // 300 + 6
    });

    it('should not move paddle above top boundary', () => {
      const paddle: Paddle = {
        x: 20,
        y: 0,
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      movePaddle(paddle, 'up');

      expect(paddle.y).toBe(0); // Clamped at 0
    });

    it('should not move paddle below bottom boundary', () => {
      const paddle: Paddle = {
        x: 20,
        y: 500, // 600 - 100 = max position
        width: 15,
        height: 100,
        speed: 6,
        score: 0,
      };

      movePaddle(paddle, 'down');

      expect(paddle.y).toBe(500); // Clamped at canvasHeight - height
    });
  });

  describe('predictBallY', () => {
    // Helper to create a ball with default values
    const createBall = (props: Partial<Ball>): Ball => ({
      x: 400,
      y: 300,
      velocityX: 5,
      velocityY: 0,
      radius: 8,
      speed: 5,
      ...props,
    });

    it('should return null if ball has no horizontal velocity', () => {
      const ball = createBall({ velocityX: 0 });
      const result = predictBallY(ball, 800);
      expect(result).toBeNull();
    });

    it('should return null if ball is moving away from target', () => {
      // Ball is at 400, target is 800 (right), but ball moves left (-5)
      const ball = createBall({ x: 400, velocityX: -5 });
      const result = predictBallY(ball, 800);
      expect(result).toBeNull();
    });

    it('should predict exact Y for straight line movement', () => {
      // Ball moves diagonally down-right
      const ball = createBall({
        x: 0,
        y: 100,
        velocityX: 10,
        velocityY: 10,
      });

      // Target is 100px away. Time = 10 frames.
      // New Y = 100 + (10 * 10) = 200
      const result = predictBallY(ball, 100);
      expect(result).toBeCloseTo(200);
    });

    it('should calculate a bounce off the bottom wall', () => {
      // Canvas height is 600. Ball starts near bottom (500).
      // Moving steep down-right: vx=10, vy=10
      const ball = createBall({
        x: 0,
        y: 500,
        velocityX: 10,
        velocityY: 10,
      });

      // Distance to bottom wall (y=592 due to radius 8) = 92px
      // Time to hit wall = 9.2 frames.
      // X distance traveled to wall = 92px.

      // Target X is 200. Remaining X distance = 200 - 92 = 108px.
      // Remaining time = 10.8 frames.
      // Velocity Y flips to -10.
      // New Y = 592 + (-10 * 10.8) = 592 - 108 = 484.

      const result = predictBallY(ball, 200);

      expect(result).not.toBeNull();
      // Use closeTo because of floating point math
      expect(result).toBeCloseTo(484, 0);
    });
    it('should return current Y immediately if ball is already at target X', () => {
      const ball = createBall({
        x: 400,
        y: 300,
        velocityX: 5,
      });

      // Target is exactly where the ball is
      const result = predictBallY(ball, 400);

      // Should return current Y (300) without entering the loop
      expect(result).toBe(300);
    });
  });
});
