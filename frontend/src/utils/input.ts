import { KEYS } from '../game/config';

export class InputHandler {
  private keysPressed: Set<string> = new Set();
  private listeners: Map<string, () => void> = new Map();
  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;

  constructor() {
    // Store event handler references so they can be removed later
    this.keydownHandler = (e: KeyboardEvent) => {
      this.keysPressed.add(e.key.toLowerCase());

      // Trigger single-press actions
      const listener = this.listeners.get(e.key);
      if (listener) {
        e.preventDefault();
        listener();
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.key.toLowerCase());
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }

  isKeyPressed(key: string): boolean {
    return this.keysPressed.has(key.toLowerCase());
  }

  isPlayer1UpPressed(): boolean {
    return this.isKeyPressed(KEYS.player1Up);
  }

  isPlayer1DownPressed(): boolean {
    return this.isKeyPressed(KEYS.player1Down);
  }

  isPlayer2UpPressed(): boolean {
    return this.isKeyPressed(KEYS.player2Up);
  }

  isPlayer2DownPressed(): boolean {
    return this.isKeyPressed(KEYS.player2Down);
  }

  onPause(callback: () => void): void {
    this.listeners.set(KEYS.pause, callback);
    this.listeners.set(KEYS.escape, callback);
  }

  clearListeners(): void {
    this.listeners.clear();
  }

  destroy(): void {
    // Remove event listeners to prevent memory leaks
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);

    this.keysPressed.clear();
    this.listeners.clear();
  }
}
