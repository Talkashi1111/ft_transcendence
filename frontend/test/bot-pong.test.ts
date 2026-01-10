// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { BotPongGame } from '../src/game/bot-pong';
import { BotLevel } from '../src/types/game';
import { GAME_CONFIG } from '../src/game/config';

const mockCanvas = () => { // creates a "fake" canvas that tricks your game into thinking it is running in a browser
  const canvas = document.createElement('canvas');
  canvas.getContext = vi.fn().mockReturnValue({
    fillStyle: '',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 0 }),
    fillText: vi.fn(),
  });
  return canvas;
};

describe('BotPongGame', () => {
  let canvas: HTMLCanvasElement;
  let game: BotPongGame;
  let randomSpy: MockInstance;

  beforeEach(() => {
    canvas = mockCanvas();
    vi.useFakeTimers();
    // FIX: Mock Math.random to return 0.5.
    // In the formula (random - 0.5), this results in 0 error offset.
    // This ensures the bot aims exactly for the true targetY.
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    randomSpy.mockRestore();
  });

  const runBotFrame = (botGame: BotPongGame) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (botGame as any).handleInput();
  };

  describe('Level 1: Patrol', () => {
    it('should switch direction when hitting boundaries', () => {
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_1);
      const paddle = game.getGameState().player2.paddle;

      paddle.y = 0;
      runBotFrame(game);
      expect(paddle.y).toBeGreaterThan(0);

      paddle.y = GAME_CONFIG.canvasHeight;
      runBotFrame(game);
      expect(paddle.y).toBeLessThan(GAME_CONFIG.canvasHeight);
    });
  });

  describe('Level 2: Tracking', () => {
    it('should follow the ball vertically', () => {
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_2);
      const state = game.getGameState();
      
      state.player2.paddle.y = 300;
      state.ball.y = 100;

      runBotFrame(game);
      expect(state.player2.paddle.y).toBeLessThan(300);
    });
  });

  describe('Level 3: Human-Like', () => {
    it('should only update decision once per second', () => {
      // Ensure we start with a known time so the first frame triggers the update
      vi.setSystemTime(10000);
      
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_3);
      const state = game.getGameState();

      state.ball.velocityX = 5; // Move towards bot
      state.ball.y = 100;       // Target is TOP
      state.player2.paddle.y = 500; // Paddle is BOTTOM

      // Frame 1: Trigger update. Target becomes ~100.
      runBotFrame(game);
      const positionAfterFrame1 = state.player2.paddle.y;
      
      // Verify it moved UP
      expect(positionAfterFrame1).toBeLessThan(500);

      // Move ball to BOTTOM. Advance time slightly (should NOT trigger update)
      state.ball.y = 600;
      vi.advanceTimersByTime(100);
      runBotFrame(game);

      // Should continue moving UP (ignoring new ball position)
      expect(state.player2.paddle.y).toBeLessThan(positionAfterFrame1);

      // Advance time past threshold (Trigger update)
      vi.advanceTimersByTime(1000);
      runBotFrame(game);

      // NOW it should move DOWN towards the new ball position
      const currentY = state.player2.paddle.y;
      runBotFrame(game);
      expect(state.player2.paddle.y).toBeGreaterThan(currentY);
    });
  });

  describe('Level 4: God Mode', () => {
    it('should calculate intercept and move aggressively', () => {
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_4);
      const state = game.getGameState();

      state.ball.velocityX = 10;
      state.ball.x = 400;
      state.ball.y = 100;
      state.player2.paddle.y = 500;

      runBotFrame(game);
      expect(state.player2.paddle.y).toBeLessThan(500);
    });

    it('should idle at center when ball moves away', () => {
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_4);
      const state = game.getGameState();

      state.ball.velocityX = -10;
      state.player2.paddle.y = 0;

      runBotFrame(game);
      expect(state.player2.paddle.y).toBeGreaterThan(0);
    });
  });
});