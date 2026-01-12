import { KEYS } from '../game/config';

export class InputHandler {
  private keysPressed: Set<string> = new Set();
  private listeners: Map<string, () => void> = new Map();
  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;
  private blurHandler: () => void;
  private contextMenuHandler: () => void;
  private visibilityChangeHandler: () => void;

  constructor() {
    // Store event handler references so they can be removed later
    this.keydownHandler = (e: KeyboardEvent) => {
      this.keysPressed.add(e.key.toLowerCase());

      // Prevent default browser behavior for game control keys
      // (e.g., arrow keys scrolling the page, space scrolling down)
      const gameKeys = [
        KEYS.player1Up,
        KEYS.player1Down,
        KEYS.player2Up,
        KEYS.player2Down,
        KEYS.pause,
      ];
      if (gameKeys.includes(e.key)) {
        e.preventDefault();
      }

      // Trigger single-press actions
      const listener = this.listeners.get(e.key);
      if (listener) {
        listener();
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.key.toLowerCase());
    };

    // Clear all keys when window loses focus (prevents stuck keys)
    this.blurHandler = () => {
      this.keysPressed.clear();
    };

    // Clear all keys on right-click (context menu can steal keyup events)
    this.contextMenuHandler = () => {
      this.keysPressed.clear();
    };

    // Clear all keys when tab becomes hidden
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        this.keysPressed.clear();
      }
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
    window.addEventListener('blur', this.blurHandler);
    window.addEventListener('contextmenu', this.contextMenuHandler);
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
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
    window.removeEventListener('blur', this.blurHandler);
    window.removeEventListener('contextmenu', this.contextMenuHandler);
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);

    this.keysPressed.clear();
    this.listeners.clear();
  }
}
