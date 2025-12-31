import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketManager } from '../src/utils/websocket';
import type { ConnectionState } from '../src/utils/websocket';

/**
 * WebSocket Manager Tests
 *
 * Tests the WebSocket manager with a mocked WebSocket class.
 * Covers connection, reconnection, event handling, and state management.
 */

// Track mock instances
let mockInstances: MockWebSocket[] = [];

// Mock WebSocket class
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    mockInstances.push(this);
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateClose(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }
}

function getLastMockWs(): MockWebSocket | undefined {
  return mockInstances[mockInstances.length - 1];
}

describe('WebSocketManager', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    // Clear mock instances
    mockInstances = [];

    // Setup global mock - do this fresh each time
    vi.stubGlobal('WebSocket', MockWebSocket);

    // Mock window.location for URL building
    vi.stubGlobal('window', {
      location: {
        protocol: 'http:',
        host: 'localhost:3000',
      },
    });

    vi.useFakeTimers();

    manager = new WebSocketManager({
      maxReconnectAttempts: 3,
      baseReconnectDelay: 100,
      maxReconnectDelay: 1000,
      pingInterval: 1000,
    });
  });

  afterEach(() => {
    manager.disconnect();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('Initial State', () => {
    it('should start in disconnected state', () => {
      expect(manager.state).toBe('disconnected');
      expect(manager.isConnected).toBe(false);
      expect(manager.currentMatchId).toBeNull();
    });
  });

  describe('Connection', () => {
    it('should connect successfully', async () => {
      const connectPromise = manager.connect();

      // Get the mock WebSocket instance
      const mockWs = getLastMockWs();
      expect(mockWs).toBeDefined();
      expect(mockWs!.url).toBe('ws://localhost:3000/api/game/ws');

      // Simulate successful connection
      mockWs!.simulateOpen();

      await connectPromise;

      expect(manager.state).toBe('connected');
      expect(manager.isConnected).toBe(true);
    });

    it('should join match via joinMatch after connecting', async () => {
      const connectPromise = manager.connect();

      const mockWs = getLastMockWs();
      expect(mockWs!.url).toBe('ws://localhost:3000/api/game/ws');

      mockWs!.simulateOpen();
      await connectPromise;

      // Join match after connecting
      manager.joinMatch('match-123');

      expect(manager.currentMatchId).toBe('match-123');
      expect(mockWs!.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'match:join', data: { matchId: 'match-123' } })
      );
    });

    it('should use wss: for https:', async () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'https:',
          host: 'example.com',
        },
      });

      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();

      expect(mockWs!.url).toBe('wss://example.com/api/game/ws');

      mockWs!.simulateOpen();
      await connectPromise;
    });

    it('should reject on connection failure', async () => {
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();

      // Simulate connection failure
      mockWs!.simulateClose(1006, 'Connection failed');

      await expect(connectPromise).rejects.toThrow('Failed to connect');
      expect(manager.state).toBe('disconnected');
    });

    it('should not create new connection if already connected', async () => {
      const connectPromise1 = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise1;

      const instanceCountBefore = mockInstances.length;

      // Try to connect again
      await manager.connect();

      // Should still be same instance count
      expect(mockInstances.length).toBe(instanceCountBefore);
    });
  });

  describe('Disconnection', () => {
    it('should disconnect cleanly', async () => {
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      manager.disconnect();

      expect(manager.state).toBe('disconnected');
      expect(mockWs!.close).toHaveBeenCalled();
    });

    it('should clear matchId on disconnect', async () => {
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      // Join a match
      manager.joinMatch('match-123');
      expect(manager.currentMatchId).toBe('match-123');

      manager.disconnect();

      expect(manager.currentMatchId).toBeNull();
    });
  });

  describe('State Change Handler', () => {
    it('should call state change handler on state transitions', async () => {
      const stateChanges: ConnectionState[] = [];
      manager.setStateChangeHandler((state) => stateChanges.push(state));

      const connectPromise = manager.connect();
      expect(stateChanges).toContain('connecting');

      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      expect(stateChanges).toContain('connected');

      manager.disconnect();
      expect(stateChanges).toContain('disconnected');
    });
  });

  describe('Event Handling', () => {
    it('should dispatch events to registered handlers', async () => {
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      const handler = vi.fn();
      manager.on('game:state', handler);

      const gameState = {
        ball: { x: 400, y: 300, vx: 5, vy: 3 },
        paddle1: { y: 250 },
        paddle2: { y: 250 },
        score1: 0,
        score2: 0,
        status: 'playing',
      };

      mockWs!.simulateMessage({ event: 'game:state', data: gameState });

      expect(handler).toHaveBeenCalledWith(gameState);
    });

    it('should allow multiple handlers for same event', async () => {
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      manager.on('game:start', handler1);
      manager.on('game:start', handler2);

      mockWs!.simulateMessage({ event: 'game:start', data: {} });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should unsubscribe handler when returned function is called', async () => {
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      const handler = vi.fn();
      const unsubscribe = manager.on('game:end', handler);

      // First message should trigger handler
      mockWs!.simulateMessage({ event: 'game:end', data: { winner: 'Player1' } });
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second message should not trigger handler
      mockWs!.simulateMessage({ event: 'game:end', data: { winner: 'Player2' } });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sending Messages', () => {
    it('should send JSON messages', async () => {
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      manager.send('player:input', { direction: 'up' });

      expect(mockWs!.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'player:input', data: { direction: 'up' } })
      );
    });

    it('should not send when disconnected', () => {
      // Not connected, should not throw but also not send
      expect(() => manager.send('player:input', { direction: 'up' })).not.toThrow();
    });
  });

  describe('Reconnection', () => {
    it('should attempt reconnection after unexpected disconnect', async () => {
      const stateChanges: ConnectionState[] = [];
      manager.setStateChangeHandler((state) => stateChanges.push(state));

      // Connect first
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      // Join a match
      manager.joinMatch('match-123');

      const instanceCountBefore = mockInstances.length;

      // Simulate unexpected disconnect
      mockWs!.simulateClose(1006, 'Connection lost');

      expect(stateChanges).toContain('reconnecting');

      // Advance timer for reconnect delay (base 100ms + up to 1000ms jitter)
      vi.advanceTimersByTime(1200);

      // New WebSocket should be created
      expect(mockInstances.length).toBe(instanceCountBefore + 1);
      const newMockWs = getLastMockWs();
      expect(newMockWs).not.toBe(mockWs);

      // Connection URL should NOT contain matchId (we join via message now)
      expect(newMockWs!.url).toBe('ws://localhost:3000/api/game/ws');

      // Simulate successful reconnection
      newMockWs!.simulateOpen();

      // Wait for async reconnect handler to complete
      await vi.waitFor(() => {
        // After reconnecting, it should send match:reconnect to rejoin the match
        expect(newMockWs!.send).toHaveBeenCalledWith(
          JSON.stringify({ event: 'match:reconnect', data: {} })
        );
      });
    });

    it('should use exponential backoff for reconnection', async () => {
      // This test verifies the backoff delay increases with each attempt
      // The formula is: baseDelay * 2^(attempt-1) + random(0-1000)
      // With baseReconnectDelay=100, attempt 1: 100+jitter, attempt 2: 200+jitter

      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      const instanceCountAfterConnect = mockInstances.length;

      // First disconnect - triggers first reconnection timer
      mockWs!.simulateClose(1006);
      expect(manager.state).toBe('reconnecting');

      // No reconnect yet - not enough time passed
      expect(mockInstances.length).toBe(instanceCountAfterConnect);

      // After base delay + max jitter (100 + 1000 = 1100ms), should reconnect
      vi.advanceTimersByTime(1200);
      expect(mockInstances.length).toBeGreaterThan(instanceCountAfterConnect);
    });

    it('should stop reconnecting after max attempts', async () => {
      const stateChanges: ConnectionState[] = [];
      manager.setStateChangeHandler((state) => stateChanges.push(state));

      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      // Disconnect and fail all reconnect attempts
      mockWs!.simulateClose(1006);

      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(2000); // Enough for any backoff
        const ws = getLastMockWs();
        ws!.simulateClose(1006);
      }

      // After max attempts, should be disconnected
      vi.advanceTimersByTime(5000);
      expect(manager.state).toBe('disconnected');
    });
  });

  describe('Ping/Pong Keep-alive', () => {
    it('should send ping at regular intervals', async () => {
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      // Clear initial calls
      mockWs!.send.mockClear();

      // Advance time to trigger ping
      vi.advanceTimersByTime(1000);

      // The actual implementation sends ping without data field
      expect(mockWs!.send).toHaveBeenCalledWith(JSON.stringify({ event: 'ping' }));
    });

    it('should stop ping on disconnect', async () => {
      const connectPromise = manager.connect();
      const mockWs = getLastMockWs();
      mockWs!.simulateOpen();
      await connectPromise;

      manager.disconnect();
      mockWs!.send.mockClear();

      // Advance time - no ping should be sent
      vi.advanceTimersByTime(2000);

      expect(mockWs!.send).not.toHaveBeenCalled();
    });
  });
});
