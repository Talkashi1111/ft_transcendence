// Match Manager - handles match creation, joining, and lifecycle

import type { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type {
  Match,
  MatchMode,
  MatchStatus,
  MatchPlayer,
  WSMessage,
  PlayerInput,
} from './game.types.js';
import { GameEngine } from './engine/index.js';
import { RECONNECT_TIMEOUT } from './engine/config.js';
import { Gauge } from 'prom-client';

const activeMatchesGauge = new Gauge({
  name: 'transcendence_active_remote_matches_total',
  help: 'Number of active remote matches currently ongoing',
  labelNames: ['mode'], // We will label them as '1v1' or 'tournament'
});

interface ActiveMatch {
  id: string;
  mode: MatchMode;
  status: MatchStatus;
  player1: MatchPlayer & { socket: WebSocket | null };
  player2: (MatchPlayer & { socket: WebSocket | null }) | null;
  engine: GameEngine | null;
  createdAt: Date;
  startedAt: Date | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
}

// Callback for broadcasting match list updates
type MatchListUpdateCallback = () => void;

export class MatchManager {
  private matches: Map<string, ActiveMatch> = new Map();
  private playerMatches: Map<string, string> = new Map(); // playerId -> matchId
  private onMatchListUpdate: MatchListUpdateCallback | null = null;

  /**
   * Set callback for match list updates (used by gateway for broadcasting)
   */
  setMatchListUpdateCallback(callback: MatchListUpdateCallback): void {
    this.onMatchListUpdate = callback;
  }

  /**
   * Notify subscribers that match list has changed
   */
  private notifyMatchListUpdate(): void {
    if (this.onMatchListUpdate) {
      this.onMatchListUpdate();
    }
  }

  /**
   * Create a new match
   */
  createMatch(
    playerId: string,
    username: string,
    socket: WebSocket,
    mode: MatchMode = '1v1'
  ): ActiveMatch {
    // Check if player is already in a match
    const existingMatchId = this.playerMatches.get(playerId);
    if (existingMatchId) {
      const existingMatch = this.matches.get(existingMatchId);
      if (
        existingMatch &&
        existingMatch.status !== 'finished' &&
        existingMatch.status !== 'cancelled'
      ) {
        throw new Error('Player is already in an active match');
      }
    }

    const matchId = randomUUID();
    const match: ActiveMatch = {
      id: matchId,
      mode,
      status: 'waiting',
      player1: {
        id: playerId,
        username,
        connected: true,
        socket,
      },
      player2: null,
      engine: null,
      createdAt: new Date(),
      startedAt: null,
      reconnectTimeout: null,
    };

    this.matches.set(matchId, match);
    this.playerMatches.set(playerId, matchId);

    console.log(`[MatchManager] Match ${matchId} created by ${username}`);
    
    activeMatchesGauge.inc({ mode: mode }); // +1 for this specific mode

    // Notify about new available match
    this.notifyMatchListUpdate();

    return match;
  }

  /**
   * Join an existing match
   */
  joinMatch(matchId: string, playerId: string, username: string, socket: WebSocket): ActiveMatch {
    const match = this.matches.get(matchId);

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== 'waiting') {
      throw new Error('Match is not available for joining');
    }

    if (match.player2 !== null) {
      throw new Error('Match is already full');
    }

    if (match.player1.id === playerId) {
      throw new Error('Cannot join your own match');
    }

    // Check if player is already in another match
    const existingMatchId = this.playerMatches.get(playerId);
    if (existingMatchId && existingMatchId !== matchId) {
      const existingMatch = this.matches.get(existingMatchId);
      if (
        existingMatch &&
        existingMatch.status !== 'finished' &&
        existingMatch.status !== 'cancelled'
      ) {
        throw new Error('Player is already in an active match');
      }
    }

    match.player2 = {
      id: playerId,
      username,
      connected: true,
      socket,
    };

    this.playerMatches.set(playerId, matchId);

    // Notify player 1 that opponent joined
    this.sendToPlayer(match.player1, 'match:opponent_joined', { opponent: username });

    console.log(`[MatchManager] ${username} joined match ${matchId}`);

    // Notify that match is no longer available
    this.notifyMatchListUpdate();

    // Start the game
    this.startMatch(match);

    return match;
  }

  /**
   * Find an available match to join (quick match)
   */
  findAvailableMatch(mode: MatchMode, excludePlayerId: string): ActiveMatch | null {
    for (const match of this.matches.values()) {
      if (
        match.mode === mode &&
        match.status === 'waiting' &&
        match.player1.id !== excludePlayerId &&
        match.player2 === null
      ) {
        return match;
      }
    }
    return null;
  }

  /**
   * Start the game engine for a match
   */
  private startMatch(match: ActiveMatch): void {
    if (!match.player2) {
      throw new Error('Cannot start match without two players');
    }

    match.status = 'countdown';
    match.startedAt = new Date();

    // Create game engine
    match.engine = new GameEngine(
      match.player1.id,
      match.player1.username,
      match.player2.id,
      match.player2.username
    );

    // Set up event broadcasting
    match.engine.setOnStateUpdate((event, data) => {
      // Update match status when game transitions to playing
      if (event === 'game:start') {
        match.status = 'playing';
      }
      this.broadcastToMatch(match, event, data);
    });

    // Handle game end
    match.engine.setOnGameEnd((winnerId, score1, score2) => {
      match.status = 'finished';
      console.log(
        `[MatchManager] Match ${match.id} finished. Winner: ${winnerId}, Score: ${score1}-${score2}`
      );
      // Clean up after a delay
      setTimeout(() => this.cleanupMatch(match.id), 5000);
    });

    // Start the game
    match.engine.start();

    console.log(`[MatchManager] Match ${match.id} started`);
  }

  /**
   * Handle player input
   */
  handlePlayerInput(playerId: string, direction: PlayerInput): void {
    const matchId = this.playerMatches.get(playerId);
    if (!matchId) return;

    const match = this.matches.get(matchId);
    if (!match || !match.engine) return;

    match.engine.setPlayerInput(playerId, direction);
  }

  /**
   * Handle player disconnection
   */
  handleDisconnect(playerId: string): void {
    const matchId = this.playerMatches.get(playerId);
    if (!matchId) return;

    const match = this.matches.get(matchId);
    if (!match) return;

    const isPlayer1 = match.player1.id === playerId;
    const player = isPlayer1 ? match.player1 : match.player2;
    const otherPlayer = isPlayer1 ? match.player2 : match.player1;

    if (!player) return;

    // Skip if player already marked as disconnected (e.g., from leaveMatch)
    if (!player.connected) {
      console.log(`[MatchManager] Player ${playerId} already disconnected, skipping`);
      return;
    }

    player.connected = false;
    player.socket = null;

    console.log(`[MatchManager] Player ${playerId} disconnected from match ${matchId}`);

    // If match hasn't started yet, cancel it
    if (match.status === 'waiting') {
      this.cancelMatch(match.id);
      return;
    }

    // If game is in progress, pause and start reconnect timer
    if (match.status === 'playing' || match.status === 'countdown') {
      match.engine?.pause('opponent_disconnected');
      match.status = 'paused';

      // Notify other player
      if (otherPlayer?.connected) {
        this.sendToPlayer(otherPlayer, 'match:opponent_disconnected', {
          reconnectTimeout: RECONNECT_TIMEOUT / 1000,
        });
      }

      // Start reconnection timeout
      match.reconnectTimeout = setTimeout(() => {
        // Award victory to connected player
        if (otherPlayer?.connected && match.engine) {
          match.engine.forceEnd(otherPlayer.id);
        } else {
          this.cancelMatch(match.id);
        }
      }, RECONNECT_TIMEOUT);
    }
  }

  /**
   * Handle player reconnection
   */
  handleReconnect(playerId: string, socket: WebSocket): ActiveMatch | null {
    const matchId = this.playerMatches.get(playerId);
    if (!matchId) return null;

    const match = this.matches.get(matchId);
    if (!match) return null;

    const isPlayer1 = match.player1.id === playerId;
    const player = isPlayer1 ? match.player1 : match.player2;
    const otherPlayer = isPlayer1 ? match.player2 : match.player1;

    if (!player) return null;

    // Update connection status
    player.connected = true;
    player.socket = socket;

    console.log(`[MatchManager] Player ${playerId} reconnected to match ${matchId}`);

    // Clear reconnect timeout
    if (match.reconnectTimeout) {
      clearTimeout(match.reconnectTimeout);
      match.reconnectTimeout = null;
    }

    // Notify other player
    if (otherPlayer?.connected) {
      this.sendToPlayer(otherPlayer, 'match:opponent_reconnected', {});
    }

    // Resume game if both players connected and game was paused
    if (match.status === 'paused' && player.connected && otherPlayer?.connected) {
      match.status = 'countdown'; // Will become 'playing' after countdown
      match.engine?.resume();

      // Notify both players that game is resuming
      this.broadcastToMatch(match, 'game:resumed', {});
    }

    return match;
  }

  /**
   * Leave a match voluntarily
   */
  leaveMatch(playerId: string): void {
    const matchId = this.playerMatches.get(playerId);
    if (!matchId) return;

    const match = this.matches.get(matchId);
    if (!match) return;

    const isPlayer1 = match.player1.id === playerId;
    const leavingPlayer = isPlayer1 ? match.player1 : match.player2;
    const otherPlayer = isPlayer1 ? match.player2 : match.player1;

    console.log(`[MatchManager] Player ${playerId} left match ${matchId}`);

    // Mark leaving player as disconnected and remove from tracking
    // This prevents handleDisconnect from re-processing
    if (leavingPlayer) {
      leavingPlayer.connected = false;
      leavingPlayer.socket = null;
    }
    this.playerMatches.delete(playerId);

    // Clear any existing reconnection timeout
    if (match.reconnectTimeout) {
      clearTimeout(match.reconnectTimeout);
      match.reconnectTimeout = null;
    }

    // If game is in progress, award win to other player
    if (match.status === 'playing' || match.status === 'countdown' || match.status === 'paused') {
      if (otherPlayer?.connected && match.engine) {
        // Force end the game with opponent as winner
        // This will send game:end event which shows winner properly
        match.engine.forceEnd(otherPlayer.id);
      } else {
        this.cancelMatch(matchId);
      }
    } else {
      // Cancel match if still waiting
      this.cancelMatch(matchId);
    }
  }

  /**
   * Cancel a match
   */
  private cancelMatch(matchId: string): void {
    const match = this.matches.get(matchId);
    if (!match) return;

    const wasWaiting = match.status === 'waiting';
    match.status = 'cancelled';
    match.engine?.stop();

    // Notify players
    this.broadcastToMatch(match, 'match:opponent_left', {});

    console.log(`[MatchManager] Match ${matchId} cancelled`);

    // Notify about match list change if match was available
    if (wasWaiting) {
      this.notifyMatchListUpdate();
    }

    this.cleanupMatch(matchId);
  }

  /**
   * Clean up match resources
   */
  private cleanupMatch(matchId: string): void {
    const match = this.matches.get(matchId);
    if (!match) return;

    // Stop engine
    match.engine?.stop();

    // Clear timeout
    if (match.reconnectTimeout) {
      clearTimeout(match.reconnectTimeout);
    }

    // Remove player mappings
    this.playerMatches.delete(match.player1.id);
    if (match.player2) {
      this.playerMatches.delete(match.player2.id);
    }

    activeMatchesGauge.dec({ mode: match.mode }); // -1 for this specific mode

    // Remove match
    this.matches.delete(matchId);

    console.log(`[MatchManager] Match ${matchId} cleaned up`);
  }

  /**
   * Get match by ID
   */
  getMatch(matchId: string): ActiveMatch | undefined {
    return this.matches.get(matchId);
  }

  /**
   * Get match for a player
   */
  getPlayerMatch(playerId: string): ActiveMatch | null {
    const matchId = this.playerMatches.get(playerId);
    if (!matchId) return null;
    return this.matches.get(matchId) || null;
  }

  /**
   * Check if player is in an active match (not finished/cancelled)
   * Used to prevent alias changes during matches/tournaments
   */
  isPlayerInActiveMatch(playerId: string): boolean {
    const match = this.getPlayerMatch(playerId);
    if (!match) return false;
    return match.status !== 'finished' && match.status !== 'cancelled';
  }

  /**
   * Get available matches for listing
   */
  getAvailableMatches(mode?: MatchMode): Match[] {
    const matches: Match[] = [];
    for (const match of this.matches.values()) {
      if (match.status === 'waiting' && (!mode || match.mode === mode)) {
        matches.push(this.toMatchResponse(match));
      }
    }
    return matches;
  }

  /**
   * Convert internal match to response format
   */
  toMatchResponse(match: ActiveMatch): Match {
    return {
      id: match.id,
      mode: match.mode,
      status: match.status,
      player1: {
        id: match.player1.id,
        username: match.player1.username,
        connected: match.player1.connected,
      },
      player2: match.player2
        ? {
            id: match.player2.id,
            username: match.player2.username,
            connected: match.player2.connected,
          }
        : null,
      score1: match.engine?.getScores().score1 ?? 0,
      score2: match.engine?.getScores().score2 ?? 0,
      winnerId: null,
      createdAt: match.createdAt,
      startedAt: match.startedAt,
    };
  }

  /**
   * Send message to a specific player
   */
  private sendToPlayer(
    player: MatchPlayer & { socket: WebSocket | null },
    event: string,
    data: unknown
  ): void {
    if (player.socket && player.connected) {
      const message: WSMessage = { event, data };
      player.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all players in a match
   */
  private broadcastToMatch(match: ActiveMatch, event: string, data: unknown): void {
    const message: WSMessage = { event, data };
    const messageStr = JSON.stringify(message);

    if (match.player1.socket && match.player1.connected) {
      match.player1.socket.send(messageStr);
    }
    if (match.player2?.socket && match.player2.connected) {
      match.player2.socket.send(messageStr);
    }
  }
}

// Singleton instance
export const matchManager = new MatchManager();
