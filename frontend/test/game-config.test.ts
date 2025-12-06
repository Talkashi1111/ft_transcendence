import { describe, it, expect } from 'vitest';
import { GAME_CONFIG, COLORS, KEYS } from '../src/game/config';

describe('Game Configuration', () => {
  describe('GAME_CONFIG', () => {
    it('should have valid canvas dimensions', () => {
      expect(GAME_CONFIG.canvasWidth).toBe(800);
      expect(GAME_CONFIG.canvasHeight).toBe(600);
      expect(GAME_CONFIG.canvasWidth).toBeGreaterThan(0);
      expect(GAME_CONFIG.canvasHeight).toBeGreaterThan(0);
    });

    it('should have valid paddle configuration', () => {
      expect(GAME_CONFIG.paddleWidth).toBe(15);
      expect(GAME_CONFIG.paddleHeight).toBe(100);
      expect(GAME_CONFIG.paddleSpeed).toBe(6);
      expect(GAME_CONFIG.paddleWidth).toBeGreaterThan(0);
      expect(GAME_CONFIG.paddleHeight).toBeGreaterThan(0);
      expect(GAME_CONFIG.paddleSpeed).toBeGreaterThan(0);
    });

    it('should have valid ball configuration', () => {
      expect(GAME_CONFIG.ballRadius).toBe(8);
      expect(GAME_CONFIG.ballInitialSpeed).toBe(5);
      expect(GAME_CONFIG.ballMaxSpeed).toBe(12);
      expect(GAME_CONFIG.ballRadius).toBeGreaterThan(0);
      expect(GAME_CONFIG.ballInitialSpeed).toBeGreaterThan(0);
      expect(GAME_CONFIG.ballMaxSpeed).toBeGreaterThan(GAME_CONFIG.ballInitialSpeed);
    });

    it('should have valid game rules', () => {
      expect(GAME_CONFIG.maxScore).toBe(11);
      expect(GAME_CONFIG.fps).toBe(60);
      expect(GAME_CONFIG.maxScore).toBeGreaterThan(0);
      expect(GAME_CONFIG.fps).toBeGreaterThan(0);
    });
  });

  describe('COLORS', () => {
    it('should have all required color definitions', () => {
      expect(COLORS.background).toBeDefined();
      expect(COLORS.paddle).toBeDefined();
      expect(COLORS.ball).toBeDefined();
      expect(COLORS.centerLine).toBeDefined();
    });

    it('should have valid color values', () => {
      expect(typeof COLORS.background).toBe('string');
      expect(typeof COLORS.paddle).toBe('string');
      expect(typeof COLORS.ball).toBe('string');
      expect(typeof COLORS.centerLine).toBe('string');
      expect(COLORS.background.length).toBeGreaterThan(0);
      expect(COLORS.paddle.length).toBeGreaterThan(0);
      expect(COLORS.ball.length).toBeGreaterThan(0);
      expect(COLORS.centerLine.length).toBeGreaterThan(0);
    });
  });

  describe('KEYS', () => {
    it('should have player 1 controls', () => {
      expect(KEYS.player1Up).toBe('w');
      expect(KEYS.player1Down).toBe('s');
    });

    it('should have player 2 controls', () => {
      expect(KEYS.player2Up).toBe('ArrowUp');
      expect(KEYS.player2Down).toBe('ArrowDown');
    });

    it('should have pause controls', () => {
      expect(KEYS.pause).toBe(' ');
      expect(KEYS.escape).toBe('Escape');
      expect(typeof KEYS.pause).toBe('string');
      expect(typeof KEYS.escape).toBe('string');
    });

    it('should have unique keys for different players', () => {
      expect(KEYS.player1Up).not.toBe(KEYS.player2Up);
      expect(KEYS.player1Down).not.toBe(KEYS.player2Down);
    });
  });
});
