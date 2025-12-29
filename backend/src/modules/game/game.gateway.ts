// WebSocket Gateway for real-time game communication

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { WSMessage, ClientEvents, PlayerInput } from './game.types.js';
import { matchManager } from './match-manager.js';
import { prisma } from '../../utils/prisma.js';

interface AuthenticatedSocket extends WebSocket {
  userId: string;
  username: string;
  isAlive: boolean;
}

// Track connected sockets by user ID
const connectedSockets = new Map<string, AuthenticatedSocket>();

/**
 * Broadcast a message to all connected clients
 */
function broadcastToAll(event: string, data: unknown): void {
  for (const socket of connectedSockets.values()) {
    sendMessage(socket, event, data);
  }
}

/**
 * Broadcast updated match list to all clients
 */
function broadcastMatchListUpdate(): void {
  const matches = matchManager.getAvailableMatches();
  broadcastToAll('matches:updated', { matches });
}

/**
 * Authenticate WebSocket connection using JWT from cookie
 * Fetches user's alias from database for display in matches/tournaments
 */
async function authenticateSocket(
  server: FastifyInstance,
  request: FastifyRequest
): Promise<{ userId: string; username: string } | null> {
  try {
    const token = request.cookies?.token;
    if (!token) return null;

    const decoded = server.jwt.verify<{ id: string; email: string }>(token);

    // Fetch user's alias from database (alias is always present and unique)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { alias: true },
    });

    if (!user) return null;

    return {
      userId: decoded.id,
      username: user.alias,
    };
  } catch {
    return null;
  }
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(socket: AuthenticatedSocket, message: string): void {
  try {
    const parsed = JSON.parse(message) as WSMessage<unknown>;
    const { event, data } = parsed;

    switch (event) {
      case 'match:create':
        handleMatchCreate(socket);
        break;

      case 'match:join':
        handleMatchJoin(socket, data as ClientEvents['match:join']);
        break;

      case 'match:quickmatch':
        handleQuickMatch(socket);
        break;

      case 'match:leave':
        handleMatchLeave(socket);
        break;

      case 'match:reconnect':
        handleMatchReconnect(socket);
        break;

      case 'player:input':
        handlePlayerInput(socket, data as ClientEvents['player:input']);
        break;

      case 'ping':
        // Respond to client ping with pong
        sendMessage(socket, 'pong', {});
        break;

      default:
        sendError(socket, 'UNKNOWN_EVENT', `Unknown event: ${event}`);
    }
  } catch {
    sendError(socket, 'PARSE_ERROR', 'Failed to parse message');
  }
}

/**
 * Handle match creation
 */
function handleMatchCreate(socket: AuthenticatedSocket): void {
  try {
    const match = matchManager.createMatch(socket.userId, socket.username, socket, '1v1');

    sendMessage(socket, 'match:created', { matchId: match.id });
    sendMessage(socket, 'match:waiting', { matchId: match.id });

    console.log(`[WS] User ${socket.username} created match ${match.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create match';
    sendError(socket, 'CREATE_FAILED', message);
  }
}

/**
 * Handle joining a specific match
 */
function handleMatchJoin(socket: AuthenticatedSocket, data: ClientEvents['match:join']): void {
  try {
    const { matchId } = data;
    const match = matchManager.joinMatch(matchId, socket.userId, socket.username, socket);

    sendMessage(socket, 'match:joined', {
      matchId: match.id,
      opponent: match.player1.username,
      playerNumber: 2,
    });

    // Also send to player 1
    const player1Socket = connectedSockets.get(match.player1.id);
    if (player1Socket) {
      sendMessage(player1Socket, 'match:joined', {
        matchId: match.id,
        opponent: socket.username,
        playerNumber: 1,
      });
    }

    console.log(`[WS] User ${socket.username} joined match ${matchId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to join match';
    sendError(socket, 'JOIN_FAILED', message);
  }
}

/**
 * Handle quick match (auto matchmaking)
 */
function handleQuickMatch(socket: AuthenticatedSocket): void {
  try {
    // Try to find an existing match
    const existingMatch = matchManager.findAvailableMatch('1v1', socket.userId);

    if (existingMatch) {
      // Join existing match
      const match = matchManager.joinMatch(
        existingMatch.id,
        socket.userId,
        socket.username,
        socket
      );

      sendMessage(socket, 'match:joined', {
        matchId: match.id,
        opponent: match.player1.username,
        playerNumber: 2,
      });

      // Notify player 1
      const player1Socket = connectedSockets.get(match.player1.id);
      if (player1Socket) {
        sendMessage(player1Socket, 'match:joined', {
          matchId: match.id,
          opponent: socket.username,
          playerNumber: 1,
        });
      }

      console.log(`[WS] User ${socket.username} quick-joined match ${match.id}`);
    } else {
      // Create new match and wait
      const match = matchManager.createMatch(socket.userId, socket.username, socket, '1v1');

      sendMessage(socket, 'match:created', { matchId: match.id });
      sendMessage(socket, 'match:waiting', { matchId: match.id });

      console.log(`[WS] User ${socket.username} created match ${match.id} via quickmatch`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to find match';
    sendError(socket, 'QUICKMATCH_FAILED', message);
  }
}

/**
 * Handle leaving a match
 */
function handleMatchLeave(socket: AuthenticatedSocket): void {
  matchManager.leaveMatch(socket.userId);
  console.log(`[WS] User ${socket.username} left their match`);
}

/**
 * Handle reconnection request to existing match
 */
function handleMatchReconnect(socket: AuthenticatedSocket): void {
  const existingMatch = matchManager.handleReconnect(socket.userId, socket as unknown as WebSocket);
  if (existingMatch) {
    console.log(`[WS] User ${socket.username} reconnected to match ${existingMatch.id}`);

    // Send current match state
    const playerNumber = existingMatch.player1.id === socket.userId ? 1 : 2;
    const opponent =
      playerNumber === 1 ? existingMatch.player2?.username : existingMatch.player1.username;

    sendMessage(socket, 'match:joined', {
      matchId: existingMatch.id,
      opponent: opponent || '',
      playerNumber,
    });

    // Send current game state if game is in progress
    if (existingMatch.engine) {
      sendMessage(socket, 'game:state', existingMatch.engine.getState());
    }
  }
}

/**
 * Handle player input
 */
function handlePlayerInput(socket: AuthenticatedSocket, data: ClientEvents['player:input']): void {
  const direction = data.direction as PlayerInput;
  matchManager.handlePlayerInput(socket.userId, direction);
}

/**
 * Handle socket disconnection
 */
function handleDisconnect(socket: AuthenticatedSocket): void {
  console.log(`[WS] User ${socket.username} disconnected`);

  connectedSockets.delete(socket.userId);
  matchManager.handleDisconnect(socket.userId);
}

/**
 * Send a message to a socket
 */
function sendMessage(socket: WebSocket, event: string, data: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ event, data }));
  }
}

/**
 * Send an error message
 */
function sendError(socket: WebSocket, code: string, message: string): void {
  sendMessage(socket, 'error', { code, message });
}

/**
 * Register WebSocket routes
 */
export async function registerGameWebSocket(server: FastifyInstance): Promise<void> {
  // Set up match list update broadcasting
  matchManager.setMatchListUpdateCallback(broadcastMatchListUpdate);

  // Register the websocket plugin route
  // Note: Use preValidation hook for auth instead of async in handler
  // to ensure message handlers are attached synchronously
  server.get(
    '/api/game/ws',
    {
      websocket: true,
      preValidation: async (request, reply) => {
        // Authenticate before WebSocket upgrade
        const auth = await authenticateSocket(server, request);
        if (!auth) {
          return reply.code(401).send({ error: 'Authentication required' });
        }
        // Store auth info on request for use in handler
        (request as FastifyRequest & { wsAuth: { userId: string; username: string } }).wsAuth =
          auth;
      },
    },
    (socket: WebSocket, request: FastifyRequest) => {
      // Get auth from preValidation hook
      const auth = (request as FastifyRequest & { wsAuth: { userId: string; username: string } })
        .wsAuth;

      // Set up authenticated socket
      const authSocket = socket as AuthenticatedSocket;
      authSocket.userId = auth.userId;
      authSocket.username = auth.username;
      authSocket.isAlive = true;

      // IMPORTANT: Attach message handlers SYNCHRONOUSLY before any async work
      // Handle incoming messages
      socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        const message = data.toString();
        handleMessage(authSocket, message);
      });

      // Handle pong for keep-alive
      socket.on('pong', () => {
        authSocket.isAlive = true;
      });

      // Handle disconnection
      socket.on('close', () => {
        handleDisconnect(authSocket);
      });

      // Handle errors
      socket.on('error', (err: Error) => {
        console.error(`[WS] Socket error for ${auth.username}:`, err.message);
        handleDisconnect(authSocket);
      });

      // Now do async work after handlers are attached
      // NOTE: We don't auto-reconnect here anymore. Client must explicitly
      // request reconnection via match:reconnect event when on play page.

      // Store socket reference
      connectedSockets.set(auth.userId, authSocket);

      console.log(`[WS] User ${auth.username} connected`);
    }
  );

  // Keep-alive ping interval
  const pingInterval = setInterval(() => {
    for (const socket of connectedSockets.values()) {
      if (!socket.isAlive) {
        (socket as WebSocket).terminate();
        continue;
      }
      socket.isAlive = false;
      (socket as WebSocket).ping();
    }
  }, 30000);

  // Cleanup on server close
  server.addHook('onClose', () => {
    clearInterval(pingInterval);
    for (const socket of connectedSockets.values()) {
      (socket as WebSocket).close();
    }
    connectedSockets.clear();
  });
}
