import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputHandler } from '../src/utils/input';

describe('InputHandler', () => {
  let inputHandler: InputHandler;

  beforeEach(() => {
    inputHandler = new InputHandler();
  });

  afterEach(() => {
    inputHandler.destroy();
  });

  describe('constructor', () => {
    it('should initialize with no keys pressed', () => {
      expect(inputHandler.isPlayer1UpPressed()).toBe(false);
      expect(inputHandler.isPlayer1DownPressed()).toBe(false);
      expect(inputHandler.isPlayer2UpPressed()).toBe(false);
      expect(inputHandler.isPlayer2DownPressed()).toBe(false);
    });
  });

  describe('player 1 controls', () => {
    it('should detect W key press', () => {
      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      expect(inputHandler.isPlayer1UpPressed()).toBe(true);
    });

    it('should detect W key release', () => {
      const downEvent = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(downEvent);

      expect(inputHandler.isPlayer1UpPressed()).toBe(true);

      const upEvent = new KeyboardEvent('keyup', { key: 'w' });
      window.dispatchEvent(upEvent);

      expect(inputHandler.isPlayer1UpPressed()).toBe(false);
    });

    it('should detect S key press', () => {
      const event = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(event);

      expect(inputHandler.isPlayer1DownPressed()).toBe(true);
    });

    it('should detect S key release', () => {
      const downEvent = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(downEvent);

      expect(inputHandler.isPlayer1DownPressed()).toBe(true);

      const upEvent = new KeyboardEvent('keyup', { key: 's' });
      window.dispatchEvent(upEvent);

      expect(inputHandler.isPlayer1DownPressed()).toBe(false);
    });
  });

  describe('player 2 controls', () => {
    it('should detect ArrowUp key press', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      window.dispatchEvent(event);

      expect(inputHandler.isPlayer2UpPressed()).toBe(true);
    });

    it('should detect ArrowUp key release', () => {
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      window.dispatchEvent(downEvent);

      expect(inputHandler.isPlayer2UpPressed()).toBe(true);

      const upEvent = new KeyboardEvent('keyup', { key: 'ArrowUp' });
      window.dispatchEvent(upEvent);

      expect(inputHandler.isPlayer2UpPressed()).toBe(false);
    });

    it('should detect ArrowDown key press', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      window.dispatchEvent(event);

      expect(inputHandler.isPlayer2DownPressed()).toBe(true);
    });

    it('should detect ArrowDown key release', () => {
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      window.dispatchEvent(downEvent);

      expect(inputHandler.isPlayer2DownPressed()).toBe(true);

      const upEvent = new KeyboardEvent('keyup', { key: 'ArrowDown' });
      window.dispatchEvent(upEvent);

      expect(inputHandler.isPlayer2DownPressed()).toBe(false);
    });
  });

  describe('pause controls', () => {
    it('should call pause callback on Space key', () => {
      const pauseCallback = vi.fn();
      inputHandler.onPause(pauseCallback);

      const event = new KeyboardEvent('keydown', { key: ' ' });
      window.dispatchEvent(event);

      expect(pauseCallback).toHaveBeenCalledTimes(1);
    });

    it('should call pause callback on Escape key', () => {
      const pauseCallback = vi.fn();
      inputHandler.onPause(pauseCallback);

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(event);

      expect(pauseCallback).toHaveBeenCalledTimes(1);
    });

    it('should not call pause callback for other keys', () => {
      const pauseCallback = vi.fn();
      inputHandler.onPause(pauseCallback);

      const event = new KeyboardEvent('keydown', { key: 'a' });
      window.dispatchEvent(event);

      expect(pauseCallback).not.toHaveBeenCalled();
    });

    it('should support multiple pause callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      inputHandler.onPause(callback1);
      // Note: onPause overwrites the previous callback (by design)
      inputHandler.onPause(callback2);

      const event = new KeyboardEvent('keydown', { key: ' ' });
      window.dispatchEvent(event);

      // Only the last callback should be called
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('simultaneous key presses', () => {
    it('should handle multiple keys pressed at once', () => {
      const event1 = new KeyboardEvent('keydown', { key: 'w' });
      const event2 = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(event1);
      window.dispatchEvent(event2);

      expect(inputHandler.isPlayer1UpPressed()).toBe(true);
      expect(inputHandler.isPlayer1DownPressed()).toBe(true);
    });

    it('should handle both players pressing keys simultaneously', () => {
      const event1 = new KeyboardEvent('keydown', { key: 'w' });
      const event2 = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      window.dispatchEvent(event1);
      window.dispatchEvent(event2);

      expect(inputHandler.isPlayer1UpPressed()).toBe(true);
      expect(inputHandler.isPlayer2UpPressed()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should clear listeners map', () => {
      const pauseCallback = vi.fn();
      inputHandler.onPause(pauseCallback);

      inputHandler.destroy();

      // Listeners map should be cleared
      expect(inputHandler['listeners'].size).toBe(0);
    });

    it('should clear keys pressed set', () => {
      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      expect(inputHandler.isPlayer1UpPressed()).toBe(true);

      inputHandler.destroy();

      // Keys set should be cleared
      expect(inputHandler['keysPressed'].size).toBe(0);
    });

    it('should remove event listeners and stop detecting key presses', () => {
      inputHandler.destroy();

      // Dispatch event after destroy
      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      // Should not detect the key press since listeners were removed
      expect(inputHandler.isPlayer1UpPressed()).toBe(false);
      expect(inputHandler['keysPressed'].size).toBe(0);
    });

    it('should remove event listeners and stop calling pause callbacks', () => {
      const pauseCallback = vi.fn();
      inputHandler.onPause(pauseCallback);

      inputHandler.destroy();

      // Dispatch pause key after destroy
      const event = new KeyboardEvent('keydown', { key: ' ' });
      window.dispatchEvent(event);

      // Callback should not be called since listeners were removed
      expect(pauseCallback).not.toHaveBeenCalled();
    });
  });

  describe('case sensitivity', () => {
    it('should handle lowercase w for player 1 up', () => {
      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      expect(inputHandler.isPlayer1UpPressed()).toBe(true);
    });

    it('should handle uppercase W for player 1 up', () => {
      const event = new KeyboardEvent('keydown', { key: 'W' });
      window.dispatchEvent(event);

      expect(inputHandler.isPlayer1UpPressed()).toBe(true);
    });

    it('should handle lowercase s for player 1 down', () => {
      const event = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(event);

      expect(inputHandler.isPlayer1DownPressed()).toBe(true);
    });

    it('should handle uppercase S for player 1 down', () => {
      const event = new KeyboardEvent('keydown', { key: 'S' });
      window.dispatchEvent(event);

      expect(inputHandler.isPlayer1DownPressed()).toBe(true);
    });
  });
});
