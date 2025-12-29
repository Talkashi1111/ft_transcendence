/**
 * Remote Pong Game Client
 *
 * Renders game state received from server via WebSocket.
 * Features:
 * - Receives authoritative game state from server at 60 tick/s
 * - Interpolates between states for smooth rendering
 * - Sends player input to server
 * - Handles connection/disconnection states
 */

import type { GameState, RemoteGameState } from '../types/game';
import { GAME_CONFIG, COLORS } from './config';
import { render, setupCanvas, clearCanvas, drawCenterLine } from './renderer';
import { InputHandler } from '../utils/input';
import { WebSocketManager, getWebSocketManager } from '../utils/websocket';

export type RemoteGameCallbacks = {
  onGameEnd?: (winner: string, winnerId: string, score1: number, score2: number) => void;
  onOpponentJoined?: (opponent: string) => void;
  onOpponentLeft?: () => void;
  onOpponentDisconnected?: (timeout: number) => void;
  onOpponentReconnected?: () => void;
  onError?: (code: string, message: string) => void;
  onConnectionStateChange?: (state: 'connected' | 'disconnected' | 'reconnecting') => void;
  onWaitingForOpponent?: (matchId: string) => void;
  onMatchJoined?: (matchId: string, opponent: string, playerNumber: 1 | 2) => void;
};

export class RemotePongGame {
  private ctx: CanvasRenderingContext2D;
  private ws: WebSocketManager;
  private inputHandler: InputHandler;
  private animationId: number | null = null;
  private callbacks: RemoteGameCallbacks;
  private playerNumber: 1 | 2 = 1;
  private matchId: string | null = null;

  // State interpolation
  private currentState: RemoteGameState | null = null;
  private previousState: RemoteGameState | null = null;
  private lastStateTime: number = 0;
  private readonly SERVER_TICK_MS = 1000 / 60; // Server runs at 60 tick/s

  // Input tracking - send on change only
  private lastSentDirection: 'up' | 'down' | 'none' = 'none';

  // Cleanup functions for event handlers
  private unsubscribeFunctions: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, callbacks: RemoteGameCallbacks = {}) {
    this.ctx = setupCanvas(canvas);
    this.ws = getWebSocketManager();
    this.inputHandler = new InputHandler();
    this.callbacks = callbacks;

    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    // Game state updates
    this.unsubscribeFunctions.push(
      this.ws.on('game:state', (state) => {
        this.previousState = this.currentState;
        this.currentState = state as RemoteGameState;
        this.lastStateTime = performance.now();
      })
    );

    // Game events
    this.unsubscribeFunctions.push(
      this.ws.on('game:countdown', ({ count }) => {
        if (this.currentState) {
          this.currentState.countdown = count;
          this.currentState.status = 'countdown';
        }
      })
    );

    this.unsubscribeFunctions.push(
      this.ws.on('game:start', () => {
        if (this.currentState) {
          this.currentState.status = 'playing';
        }
      })
    );

    this.unsubscribeFunctions.push(
      this.ws.on('game:end', ({ winner, winnerId, score1, score2 }) => {
        if (this.currentState) {
          this.currentState.status = 'finished';
          this.currentState.winner = winner;
        }
        this.callbacks.onGameEnd?.(winner, winnerId, score1, score2);
      })
    );

    this.unsubscribeFunctions.push(
      this.ws.on('game:paused', ({ reason }) => {
        if (this.currentState) {
          this.currentState.status = 'paused';
        }
        if (reason === 'opponent_disconnected') {
          // Will receive separate event with timeout info
        }
      })
    );

    this.unsubscribeFunctions.push(
      this.ws.on('game:resumed', () => {
        if (this.currentState) {
          this.currentState.status = 'countdown';
          // Reset interpolation to prevent stale state issues after reconnect
          this.previousState = null;
          this.lastStateTime = performance.now();
        }
      })
    );

    // Match events
    this.unsubscribeFunctions.push(
      this.ws.on('match:waiting', ({ matchId }) => {
        this.matchId = matchId;
        this.callbacks.onWaitingForOpponent?.(matchId);
      })
    );

    this.unsubscribeFunctions.push(
      this.ws.on('match:joined', ({ matchId, opponent, playerNumber }) => {
        this.matchId = matchId;
        this.playerNumber = playerNumber;
        this.callbacks.onMatchJoined?.(matchId, opponent, playerNumber);
      })
    );

    this.unsubscribeFunctions.push(
      this.ws.on('match:opponent_joined', ({ opponent }) => {
        this.callbacks.onOpponentJoined?.(opponent);
      })
    );

    this.unsubscribeFunctions.push(
      this.ws.on('match:opponent_left', () => {
        this.callbacks.onOpponentLeft?.();
      })
    );

    this.unsubscribeFunctions.push(
      this.ws.on('match:opponent_disconnected', ({ reconnectTimeout }) => {
        this.callbacks.onOpponentDisconnected?.(reconnectTimeout);
      })
    );

    this.unsubscribeFunctions.push(
      this.ws.on('match:opponent_reconnected', () => {
        this.callbacks.onOpponentReconnected?.();
      })
    );

    // Errors
    this.unsubscribeFunctions.push(
      this.ws.on('error', ({ code, message }) => {
        console.error('[RemotePong] Server error:', code, message);
        this.callbacks.onError?.(code, message);
      })
    );

    // Connection state changes
    this.ws.setStateChangeHandler((state) => {
      if (state === 'connected') {
        this.callbacks.onConnectionStateChange?.('connected');
      } else if (state === 'disconnected') {
        this.callbacks.onConnectionStateChange?.('disconnected');
      } else if (state === 'reconnecting') {
        this.callbacks.onConnectionStateChange?.('reconnecting');
      }
    });
  }

  /**
   * Connect to server and optionally join a match
   */
  async connect(matchId?: string): Promise<void> {
    // Store match ID immediately so it can be displayed while connecting
    if (matchId) {
      this.matchId = matchId;
    }
    await this.ws.connect(matchId);
  }

  /**
   * Start the render loop
   */
  start(): void {
    this.renderLoop();
  }

  /**
   * Stop the game and clean up
   */
  stop(): void {
    // Stop render loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Clean up input handler
    this.inputHandler.destroy();

    // Unsubscribe from all WebSocket events
    this.unsubscribeFunctions.forEach((unsub) => unsub());
    this.unsubscribeFunctions = [];

    // Leave match if in one
    if (this.matchId) {
      this.ws.leaveMatch();
      this.matchId = null;
    }
  }

  /**
   * Disconnect from server completely
   */
  disconnect(): void {
    this.stop();
    this.ws.disconnect();
  }

  /**
   * Get current match ID
   */
  getMatchId(): string | null {
    return this.matchId;
  }

  /**
   * Get player number (1 or 2)
   */
  getPlayerNumber(): 1 | 2 {
    return this.playerNumber;
  }
  /**
   * Get current game state
   */
  getCurrentState(): RemoteGameState | null {
    return this.currentState;
  }
  private renderLoop = (): void => {
    this.animationId = requestAnimationFrame(this.renderLoop);

    // Process and send input
    this.processInput();

    // Render current state
    this.renderState();
  };

  private processInput(): void {
    if (!this.currentState || this.currentState.status !== 'playing') {
      return;
    }

    // Determine current input direction
    let direction: 'up' | 'down' | 'none' = 'none';

    // Use different controls based on player number
    // Player 1: W/S keys, Player 2: Arrow keys
    // But for remote play, we use the same keys mapped to "our" paddle
    if (this.inputHandler.isPlayer1UpPressed() || this.inputHandler.isPlayer2UpPressed()) {
      direction = 'up';
    } else if (
      this.inputHandler.isPlayer1DownPressed() ||
      this.inputHandler.isPlayer2DownPressed()
    ) {
      direction = 'down';
    }

    // Only send if direction changed
    if (direction !== this.lastSentDirection) {
      this.ws.sendInput(direction);
      this.lastSentDirection = direction;
    }
  }

  private renderState(): void {
    if (!this.currentState) {
      // Show waiting/connecting screen
      this.renderWaitingScreen();
      return;
    }

    // Interpolate for smooth rendering between server ticks
    const state = this.getInterpolatedState();

    // Convert RemoteGameState to GameState for renderer
    const renderState: GameState = {
      ball: state.ball,
      player1: { alias: state.player1.alias, paddle: state.player1.paddle },
      player2: { alias: state.player2.alias, paddle: state.player2.paddle },
      status: state.status,
      winner: state.winner,
      countdown: state.countdown,
    };

    render(this.ctx, renderState);

    // Draw additional overlays for remote-specific states
    if (state.status === 'paused') {
      this.drawDisconnectedOverlay();
    } else if (state.status === 'waiting') {
      this.drawWaitingForOpponentOverlay();
    }
  }

  private getInterpolatedState(): RemoteGameState {
    if (!this.currentState) {
      throw new Error('No current state');
    }

    if (!this.previousState) {
      return this.currentState;
    }

    // Calculate interpolation factor
    const elapsed = performance.now() - this.lastStateTime;
    const t = Math.min(elapsed / this.SERVER_TICK_MS, 1);

    // Interpolate ball position only (paddles updated instantly, ball interpolated)
    return {
      ...this.currentState,
      ball: {
        ...this.currentState.ball,
        x: this.lerp(this.previousState.ball.x, this.currentState.ball.x, t),
        y: this.lerp(this.previousState.ball.y, this.currentState.ball.y, t),
      },
    };
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private renderWaitingScreen(): void {
    clearCanvas(this.ctx);
    drawCenterLine(this.ctx);

    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Connecting...', GAME_CONFIG.canvasWidth / 2, GAME_CONFIG.canvasHeight / 2);

    // Show match ID if available
    if (this.matchId) {
      this.ctx.font = '18px Arial';
      this.ctx.fillStyle = '#888';
      this.ctx.fillText(
        `Match ID: ${this.matchId.slice(0, 8)}...`,
        GAME_CONFIG.canvasWidth / 2,
        GAME_CONFIG.canvasHeight / 2 + 40
      );
    }

    // Show controls hint
    this.ctx.font = '14px Arial';
    this.ctx.fillStyle = '#666';
    this.ctx.fillText(
      'Controls: W/↑ = Up, S/↓ = Down',
      GAME_CONFIG.canvasWidth / 2,
      GAME_CONFIG.canvasHeight - 30
    );
  }

  private drawWaitingForOpponentOverlay(): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(0, 0, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);

    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      'Waiting for opponent...',
      GAME_CONFIG.canvasWidth / 2,
      GAME_CONFIG.canvasHeight / 2
    );

    if (this.matchId) {
      this.ctx.font = '18px Arial';
      this.ctx.fillText(
        `Match ID: ${this.matchId.slice(0, 8)}...`,
        GAME_CONFIG.canvasWidth / 2,
        GAME_CONFIG.canvasHeight / 2 + 40
      );
    }
  }

  private drawDisconnectedOverlay(): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);

    this.ctx.fillStyle = '#ff6b6b';
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      'Opponent Disconnected',
      GAME_CONFIG.canvasWidth / 2,
      GAME_CONFIG.canvasHeight / 2 - 20
    );

    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = '18px Arial';
    this.ctx.fillText(
      'Waiting for reconnection...',
      GAME_CONFIG.canvasWidth / 2,
      GAME_CONFIG.canvasHeight / 2 + 20
    );
  }
}
