/**
 * WebSocket Manager for Remote Game Communication
 *
 * Handles connection to game server with:
 * - Automatic reconnection with exponential backoff
 * - JWT authentication via query parameter
 * - Typed event handling
 * - Keep-alive ping/pong
 */

import type { GameState } from '../types/game';

// Client -> Server events
export type ClientEventType =
  | 'player:input'
  | 'player:ready'
  | 'match:join'
  | 'match:leave'
  | 'match:reconnect';

export interface ClientEvents {
  'player:input': { direction: 'up' | 'down' | 'none' };
  'player:ready': Record<string, never>;
  'match:join': { matchId: string };
  'match:leave': Record<string, never>;
  'match:reconnect': Record<string, never>;
}

// Server -> Client events
export type ServerEventType =
  | 'game:state'
  | 'game:countdown'
  | 'game:start'
  | 'game:end'
  | 'game:paused'
  | 'game:resumed'
  | 'match:created'
  | 'match:joined'
  | 'match:waiting'
  | 'match:opponent_joined'
  | 'match:opponent_left'
  | 'match:opponent_disconnected'
  | 'match:opponent_reconnected'
  | 'matches:updated'
  | 'session:replaced' // Close code 4001 - another tab took over
  | 'friend:online'
  | 'friend:offline'
  | 'friend:accepted'
  | 'notification:new'
  | 'error'
  | 'pong';

export interface RemotePlayer {
  id: string;
  alias: string;
}

export interface AvailableMatch {
  id: string;
  mode: string;
  status: string;
  player1: { id: string; username: string };
  createdAt: string;
}

export interface ServerEvents {
  'game:state': GameState & { player1: RemotePlayer; player2: RemotePlayer };
  'game:countdown': { count: number };
  'game:start': Record<string, never>;
  'game:end': { winner: string; winnerId: string; score1: number; score2: number };
  'game:paused': { reason: 'opponent_disconnected' };
  'game:resumed': Record<string, never>;
  'match:created': { matchId: string };
  'match:joined': { matchId: string; opponent: string; playerNumber: 1 | 2 };
  'match:waiting': { matchId: string };
  'match:opponent_joined': { opponent: string };
  'match:opponent_left': Record<string, never>;
  'match:opponent_disconnected': { reconnectTimeout: number };
  'match:opponent_reconnected': Record<string, never>;
  'matches:updated': { matches: AvailableMatch[] };
  'session:replaced': Record<string, never>;
  'friend:online': { friendId: string; friendAlias: string };
  'friend:offline': { friendId: string; friendAlias: string };
  'friend:accepted': { friendId: string; friendAlias: string };
  'notification:new': { id: string; type: string; data: unknown; createdAt: string };
  error: { code: string; message: string };
  pong: Record<string, never>;
}

type EventHandler<T> = (data: T) => void;
type EventHandlers = {
  [K in ServerEventType]?: EventHandler<ServerEvents[K]>[];
};

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface WebSocketManagerOptions {
  maxReconnectAttempts?: number;
  baseReconnectDelay?: number;
  maxReconnectDelay?: number;
  pingInterval?: number;
}

const DEFAULT_OPTIONS: Required<WebSocketManagerOptions> = {
  maxReconnectAttempts: 10,
  baseReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  pingInterval: 25000,
};

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketManagerOptions>;
  private handlers: EventHandlers = {};
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private _state: ConnectionState = 'disconnected';
  private matchId: string | null = null;
  private onStateChange?: (state: ConnectionState) => void;

  constructor(options: WebSocketManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  get state(): ConnectionState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  get currentMatchId(): string | null {
    return this.matchId;
  }

  /**
   * Set callback for connection state changes
   */
  setStateChangeHandler(handler: (state: ConnectionState) => void): void {
    this.onStateChange = handler;
  }

  private setState(newState: ConnectionState): void {
    if (this._state !== newState) {
      this._state = newState;
      this.onStateChange?.(newState);
    }
  }

  /**
   * Connect to the game WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    this.setState('connecting');

    return new Promise((resolve, reject) => {
      // Build WebSocket URL (no matchId - join via message after connect)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/game/ws`;

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.setState('connected');
          this.reconnectAttempts = 0;
          this.startPing();
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Disconnected:', event.code, event.reason);
          this.stopPing();

          // Handle session replaced (another tab connected)
          if (event.code === 4001) {
            console.log('[WS] Session replaced by another tab');
            this.setState('disconnected');
            // Emit session:replaced event for UI to handle
            const handlers = this.handlers['session:replaced'];
            console.log('[WS] session:replaced handlers count:', handlers?.length ?? 0);
            if (handlers && handlers.length > 0) {
              handlers.forEach((handler) => handler({} as never));
            } else {
              console.warn('[WS] No session:replaced handlers registered!');
            }
            return; // Don't attempt reconnect
          }

          if (this._state === 'connecting') {
            reject(new Error('Failed to connect'));
            this.setState('disconnected');
          } else if (this._state === 'connected') {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (err) {
        this.setState('disconnected');
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.stopPing();
    this.clearReconnectTimer();
    this.matchId = null;

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect attempt
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
    console.log('[WS] Disconnected by user');
  }

  /**
   * Send an event to the server
   */
  send<E extends ClientEventType>(event: E, data: ClientEvents[E]): void {
    if (!this.isConnected) {
      console.warn('[WS] Cannot send, not connected');
      return;
    }

    const message = JSON.stringify({ event, data });
    this.ws!.send(message);
  }

  /**
   * Send player input
   */
  sendInput(direction: 'up' | 'down' | 'none'): void {
    this.send('player:input', { direction });
  }

  /**
   * Send ready signal
   */
  sendReady(): void {
    this.send('player:ready', {});
  }

  /**
   * Join a specific match
   */
  joinMatch(matchId: string): void {
    this.matchId = matchId;
    this.send('match:join', { matchId });
  }

  /**
   * Leave current match
   */
  leaveMatch(): void {
    this.send('match:leave', {});
    this.matchId = null;
  }

  /**
   * Request reconnection to existing match (if any)
   */
  reconnectToMatch(): void {
    this.send('match:reconnect', {});
  }

  /**
   * Register an event handler
   */
  on<E extends ServerEventType>(event: E, handler: EventHandler<ServerEvents[E]>): () => void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event]!.push(handler as EventHandler<unknown>);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers[event];
      if (handlers) {
        const index = handlers.indexOf(handler as EventHandler<unknown>);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Remove a specific handler for an event, or all handlers if no handler specified
   */
  off<K extends ServerEventType>(event: K, handler?: EventHandler<ServerEvents[K]>): void {
    if (!handler) {
      // Remove all handlers for this event
      delete this.handlers[event];
    } else {
      // Remove specific handler
      // Cast to EventHandler<unknown> to match how handlers are stored in on()
      const handlers = this.handlers[event];
      if (handlers) {
        const index = handlers.indexOf(handler as EventHandler<unknown>);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
        // Clean up empty arrays
        if (handlers.length === 0) {
          delete this.handlers[event];
        }
      }
    }
  }

  /**
   * Clear all event handlers
   */
  clearHandlers(): void {
    this.handlers = {};
  }

  private handleMessage(rawData: string): void {
    try {
      const { event, data } = JSON.parse(rawData) as {
        event: ServerEventType;
        data: unknown;
      };

      // Handle pong silently
      if (event === 'pong') {
        return;
      }

      // Dispatch to handlers
      const handlers = this.handlers[event];
      if (handlers) {
        handlers.forEach((handler) => handler(data as never));
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.ws!.send(JSON.stringify({ event: 'ping' }));
      }
    }, this.options.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      this.setState('disconnected');
      return;
    }

    this.setState('reconnecting');
    this.reconnectAttempts++;

    // Exponential backoff with jitter
    const delay = Math.min(
      this.options.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1) +
        Math.random() * 1000,
      this.options.maxReconnectDelay
    );

    console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        // If we were in a match, request reconnection to it
        if (this.matchId) {
          this.reconnectToMatch();
        }
      } catch {
        // Connection failed, will retry via onclose handler
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }
}

// Singleton instance for the application
let wsManagerInstance: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!wsManagerInstance) {
    wsManagerInstance = new WebSocketManager();
  }
  return wsManagerInstance;
}

export function resetWebSocketManager(): void {
  if (wsManagerInstance) {
    wsManagerInstance.disconnect();
    wsManagerInstance.clearHandlers();
    wsManagerInstance = null;
  }
}
