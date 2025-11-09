import { KEYS } from '../game/config'

export class InputHandler {
  private keysPressed: Set<string> = new Set()
  private listeners: Map<string, () => void> = new Map()

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keysPressed.add(e.key.toLowerCase())

      // Trigger single-press actions
      const listener = this.listeners.get(e.key)
      if (listener) {
        e.preventDefault()
        listener()
      }
    })

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.key.toLowerCase())
    })
  }

  isKeyPressed(key: string): boolean {
    return this.keysPressed.has(key.toLowerCase())
  }

  isPlayer1UpPressed(): boolean {
    return this.isKeyPressed(KEYS.player1Up)
  }

  isPlayer1DownPressed(): boolean {
    return this.isKeyPressed(KEYS.player1Down)
  }

  isPlayer2UpPressed(): boolean {
    return this.isKeyPressed(KEYS.player2Up)
  }

  isPlayer2DownPressed(): boolean {
    return this.isKeyPressed(KEYS.player2Down)
  }

  onPause(callback: () => void): void {
    this.listeners.set(KEYS.pause, callback)
    this.listeners.set(KEYS.escape, callback)
  }

  clearListeners(): void {
    this.listeners.clear()
  }

  destroy(): void {
    this.keysPressed.clear()
    this.listeners.clear()
  }
}
