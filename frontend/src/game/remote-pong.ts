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
import { t } from '../i18n/i18n';
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

  // Network quality: jitter tracking from game state inter-arrival times
  private stateArrivalTimes: number[] = [];
  private readonly JITTER_WINDOW = 30; // track last 30 arrivals (~0.5s at 60Hz)
  private _jitter = 0; // average absolute deviation from expected 16.67ms

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
        const newState = state as RemoteGameState;

        // Detect ball reset (e.g., after scoring) by checking for large position jump
        // If ball jumped more than 100 pixels, it was likely reset - skip interpolation
        if (this.currentState && this.currentState.status === 'playing') {
          const dx = Math.abs(newState.ball.x - this.currentState.ball.x);
          const dy = Math.abs(newState.ball.y - this.currentState.ball.y);
          if (dx > 100 || dy > 100) {
            // Ball was reset, don't interpolate from old position
            this.previousState = null;
          } else {
            this.previousState = this.currentState;
          }
        } else {
          this.previousState = this.currentState;
        }

        this.currentState = newState;
        this.lastStateTime = performance.now();

        // Track inter-arrival jitter
        this.stateArrivalTimes.push(this.lastStateTime);
        if (this.stateArrivalTimes.length > this.JITTER_WINDOW + 1) {
          this.stateArrivalTimes.shift();
        }
        if (this.stateArrivalTimes.length >= 2) {
          this.computeJitter();
        }
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
    const unsubStateChange = this.ws.setStateChangeHandler((state) => {
      if (state === 'connected') {
        this.callbacks.onConnectionStateChange?.('connected');
      } else if (state === 'disconnected') {
        this.callbacks.onConnectionStateChange?.('disconnected');
      } else if (state === 'reconnecting') {
        this.callbacks.onConnectionStateChange?.('reconnecting');
      }
    });
    this.unsubscribeFunctions.push(unsubStateChange);
  }

  /**
   * Connect to server and notify it we're ready for game state
   * @param matchId - Match ID to track (for display purposes)
   */
  async connect(matchId?: string): Promise<void> {
    // Store match ID immediately so it can be displayed while connecting
    if (matchId) {
      this.matchId = matchId;
    }

    // Connect if not already connected (reuse existing connection)
    if (!this.ws.isConnected) {
      await this.ws.connect();
    }

    // The REST API already added us to the match (quickmatch, create, or join)
    // Tell the server we're ready to receive game state via match:reconnect
    if (matchId) {
      this.ws.reconnectToMatch();
    }
  }

  /**
   * Start the render loop
   */
  start(): void {
    // Ensure we don't have multiple render loops running
    if (this.animationId !== null) {
      console.warn('[RemotePong] Render loop already running, stopping previous');
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
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

    // Draw network quality indicator (top-right corner of canvas)
    if (state.status === 'playing' || state.status === 'countdown') {
      this.drawNetworkIndicator();
    }

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

    // Calculate interpolation / extrapolation factor
    const elapsed = performance.now() - this.lastStateTime;
    const t = elapsed / this.SERVER_TICK_MS;

    if (t <= 1) {
      // Normal interpolation between previous and current state
      return {
        ...this.currentState,
        ball: {
          ...this.currentState.ball,
          x: this.lerp(this.previousState.ball.x, this.currentState.ball.x, t),
          y: this.lerp(this.previousState.ball.y, this.currentState.ball.y, t),
        },
      };
    }

    // Extrapolation: continue ball along its velocity when server tick is late
    // Cap extrapolation to 3 ticks to avoid runaway (e.g., tab was backgrounded)
    const extraT = Math.min(t - 1, 3);
    const vx = this.currentState.ball.x - this.previousState.ball.x;
    const vy = this.currentState.ball.y - this.previousState.ball.y;

    let extraX = this.currentState.ball.x + vx * extraT;
    let extraY = this.currentState.ball.y + vy * extraT;

    // Clamp to canvas bounds so the ball doesn't fly off screen
    extraX = Math.max(0, Math.min(GAME_CONFIG.canvasWidth, extraX));
    extraY = Math.max(0, Math.min(GAME_CONFIG.canvasHeight, extraY));

    return {
      ...this.currentState,
      ball: {
        ...this.currentState.ball,
        x: extraX,
        y: extraY,
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
    this.ctx.fillText(
      t('play.remote.connecting'),
      GAME_CONFIG.canvasWidth / 2,
      GAME_CONFIG.canvasHeight / 2
    );

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

  /**
   * Compute jitter from recent state arrival times.
   * Jitter = average |delta - expected| across the window.
   */
  private computeJitter(): void {
    const times = this.stateArrivalTimes;
    const deltas: number[] = [];
    for (let i = 1; i < times.length; i++) {
      deltas.push(times[i] - times[i - 1]);
    }
    if (deltas.length === 0) return;

    const jitter =
      deltas.reduce((sum, d) => sum + Math.abs(d - this.SERVER_TICK_MS), 0) / deltas.length;

    this._jitter = jitter;
  }

  /**
   * Draw network quality indicator in top-right corner of canvas.
   * Uses jitter from 60Hz game state arrivals for real-time accuracy,
   * with ping RTT shown as a secondary metric.
   */
  private drawNetworkIndicator(): void {
    const jitter = this._jitter;
    const ctx = this.ctx;

    // Quality tiers based on jitter (deviation from expected 16.67ms)
    let color: string;
    let bars: number;
    if (this.stateArrivalTimes.length < 5) {
      // Not enough data yet
      color = '#888';
      bars = 0;
    } else if (jitter < 3) {
      color = '#22c55e'; // green — excellent
      bars = 4;
    } else if (jitter < 8) {
      color = '#84cc16'; // lime — good
      bars = 3;
    } else if (jitter < 20) {
      color = '#eab308'; // yellow — fair
      bars = 2;
    } else {
      color = '#ef4444'; // red — poor
      bars = 1;
    }

    const x = GAME_CONFIG.canvasWidth - 70;
    const y = 8;

    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = color;

    // Show jitter
    const jitterText = this.stateArrivalTimes.length >= 5 ? `±${Math.round(jitter)}ms` : '---';
    ctx.fillText(jitterText, x - 4, y + 10);

    // Draw signal bars
    const barWidth = 4;
    const barGap = 2;
    const maxBarHeight = 14;
    const barStartX = x;
    const barBaseY = y + 12;

    for (let i = 0; i < 4; i++) {
      const barHeight = ((i + 1) / 4) * maxBarHeight;
      const bx = barStartX + i * (barWidth + barGap);
      const by = barBaseY - barHeight;

      ctx.fillStyle = i < bars ? color : 'rgba(255,255,255,0.15)';
      ctx.fillRect(bx, by, barWidth, barHeight);
    }

    ctx.restore();
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
