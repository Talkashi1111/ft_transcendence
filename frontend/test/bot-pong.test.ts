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
    // NOTE: Mock Math.random to return 0.5.
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

  describe('User Input Overrides', () => {
    it('should move Player 1 paddle when P1 controls are used', () => {
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_1);
      const p1Paddle = game.getGameState().player1.paddle;
      const initialY = p1Paddle.y; // Starts in the middle

      // 1. Access the protected inputHandler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inputHandler = (game as any).inputHandler;

      // 2. Simulate P1 pressing "UP" (W key)
      const upSpy = vi.spyOn(inputHandler, 'isPlayer1UpPressed').mockReturnValue(true);
      
      runBotFrame(game);
      expect(p1Paddle.y).toBeLessThan(initialY); // Y decreases when going Up

      // 3. Reset and simulate P1 pressing "DOWN" (S key)
      upSpy.mockReturnValue(false);
      const downSpy = vi.spyOn(inputHandler, 'isPlayer1DownPressed').mockReturnValue(true);
      
      // Capture new position before moving down
      const currentY = p1Paddle.y;
      runBotFrame(game);
      expect(p1Paddle.y).toBeGreaterThan(currentY); // Y increases when going Down
      
      // Cleanup
      downSpy.mockRestore();
    });

    it('should allow Player 2 keys to also control Player 1 paddle', () => {
      // The code specifically checks: isPlayer1UpPressed OR isPlayer2UpPressed
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_1);
      const p1Paddle = game.getGameState().player1.paddle;
      const initialY = p1Paddle.y;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inputHandler = (game as any).inputHandler;

      // Simulate P2 pressing "UP" (Arrow Up)
      // This verifies the "|| this.inputHandler.isPlayer2UpPressed()" logic
      const p2UpSpy = vi.spyOn(inputHandler, 'isPlayer2UpPressed').mockReturnValue(true);

      runBotFrame(game);
      expect(p1Paddle.y).toBeLessThan(initialY);

      p2UpSpy.mockRestore();
    });
  });

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
    it('should move up if ball is above paddle', () => {
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_2);
      const state = game.getGameState();
      
      state.player2.paddle.y = 300;
      state.ball.y = 100;

      runBotFrame(game);
      expect(state.player2.paddle.y).toBeLessThan(300);
    });
    it('should move down if ball is below paddle', () => {
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_2);
      const state = game.getGameState();
      
      // Setup: Paddle in middle (y=300, center=350), Ball below (y=500)
      state.player2.paddle.y = 300;
      state.ball.y = 500;
      
      runBotFrame(game);
      
      // Paddle should move DOWN (y increases)
      expect(state.player2.paddle.y).toBeGreaterThan(300);
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
    it('should return to center area when ball moves away', () => {
      // 1. Setup Level 3 Bot
      game = new BotPongGame(canvas, 'P1', BotLevel.LEVEL_3);
      const state = game.getGameState();

      // 2. Setup Scenario: Ball moving AWAY from bot (Left)
      // This causes predictBallY to return null, triggering the 'else' block
      state.ball.velocityX = -5;
      
      // 3. Place paddle at the top (y=0) so we can clearly see it move down
      state.player2.paddle.y = 0;

      // 4. Advance timer > 1000ms to trigger the "Reflection" phase
      vi.advanceTimersByTime(1100);

      // 5. Run the logic
      runBotFrame(game);

      // 6. Assertions
      // Since Math.random() is mocked to 0.5, offset is 0.
      // Target = Center (300).
      // Paddle at 0 should move DOWN (increase Y) towards 300.
      expect(state.player2.paddle.y).toBeGreaterThan(0);
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

  describe('Default Fallback', () => {
    it('should default to Patrol strategy for unknown levels', () => {
      // 1. Spy on console.warn to check if our warning fires (and silence it in test output)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // 2. Instantiate with an invalid level (e.g., 999)
      // We cast to 'any' because TypeScript normally prevents this error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      game = new BotPongGame(canvas, 'P1', 999 as any);

      // 3. Verify the Warning (If you added the console.warn line)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown BotLevel'));

      // 4. Verify the Behavior (Should match Level 1 - Patrol)
      const paddle = game.getGameState().player2.paddle;
      
      // Force paddle to top edge -> Should move DOWN
      paddle.y = 0;
      runBotFrame(game);
      expect(paddle.y).toBeGreaterThan(0);

      // Clean up the spy
      consoleSpy.mockRestore();
    });
  });
});