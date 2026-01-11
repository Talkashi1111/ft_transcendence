import { PongGame } from '../game/pong';
import { RemotePongGame } from '../game/remote-pong';
import { TournamentManager } from '../game/tournament';
import type { TournamentMatch } from '../types/tournament';
import type { Match } from '../types/game';
import { toast } from '../utils/toast';
import { showConfirmModal } from '../utils/modal';
import { escapeHtml } from '../utils/sanitize';
import { isAuthenticated } from '../utils/auth';
import { getWebSocketManager } from '../utils/websocket';
import type { AvailableMatch } from '../utils/websocket';
import { t } from '../i18n/i18n';

// Constants
const GAME_END_DELAY_MS = 2000; // Delay before showing result screen after game ends

// Store cleanup function for page navigation
let pageCleanup: (() => void) | null = null;
let isInActiveRemoteGame = false;

/**
 * Check if user is in an active remote game
 */
export function hasActiveRemoteGame(): boolean {
  return isInActiveRemoteGame;
}

/**
 * Leave the current remote game (forfeits the match)
 */
export function leaveRemoteGame(): void {
  if (pageCleanup) {
    pageCleanup();
    pageCleanup = null;
  }
  isInActiveRemoteGame = false;
}

/**
 * Cleanup function to be called when navigating away from play page
 */
export function cleanupPlayPage(): void {
  if (pageCleanup) {
    pageCleanup();
    pageCleanup = null;
  }
  isInActiveRemoteGame = false;
}

export async function renderPlayPage(
  app: HTMLElement,
  renderNavBar: (page: 'home' | 'play' | 'tournaments' | 'friends') => Promise<string>,
  setupNavigation: () => void
): Promise<void> {
  const navBar = await renderNavBar('play');
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${navBar}

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Mode Selection -->
        <div id="mode-selection" class="mb-8">
          <h2 class="text-3xl font-bold text-gray-900 mb-4">${t('play.title')}</h2>
          <p class="text-gray-600 mb-6">${t('play.text')}</p>

          <!-- Local Games (No Login Required) -->
          <div class="mb-8">
            <h3 class="text-lg font-semibold text-gray-700 mb-3">${t('play.local.label')}</h3>
            <div class="flex gap-4">
              <button id="local-game-btn" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                ${t('play.local.button1')}
              </button>
              <button id="tournament-btn" class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold">
                ${t('play.local.button2')}
              </button>
            </div>
          </div>

          <!-- Remote Games (Login Required) -->
          <div>
            <h3 class="text-lg font-semibold text-gray-700 mb-3">${t('play.remote.label')}</h3>
            <div class="flex gap-4">
              <button id="remote-quickmatch-btn" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed">
                ${t('play.remote.button1')}
              </button>
              <button id="remote-create-btn" class="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed">
                ${t('play.remote.button2')}
              </button>
              <button id="remote-join-btn" class="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed">
                ${t('play.remote.button3')}
              </button>
            </div>
            <p id="remote-login-hint" class="text-sm text-gray-500 mt-2 hidden">${t('play.remote.text')}</p>
          </div>
        </div>

        <!-- Game Setup Screen -->
        <div id="game-setup" class="hidden">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <h3 class="text-2xl font-bold text-gray-900 mb-6">${t('play.game_setup.title')}</h3>

            <div class="space-y-4">
              <div>
                <label for="player1-alias" class="block text-sm font-medium text-gray-700 mb-2">
                  ${t('play.game_setup.player1.alias.label')}
                </label>
                <input
                  type="text"
                  id="player1-alias"
                  placeholder="${t('play.game_setup.player1.alias.placeholder')}"
                  maxlength="20"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span id="player1-error" class="text-red-600 text-sm mt-1 hidden"></span>
              </div>

              <div>
                <label for="player2-alias" class="block text-sm font-medium text-gray-700 mb-2">
                  ${t('play.game_setup.player2.alias.label')}
                </label>
                <input
                  type="text"
                  id="player2-alias"
                  placeholder="${t('play.game_setup.player2.alias.placeholder')}"
                  maxlength="20"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span id="player2-error" class="text-red-600 text-sm mt-1 hidden"></span>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-semibold text-blue-900 mb-2">${t('play.game_setup.controls.label')}</h4>
                <div class="text-sm text-blue-800 space-y-1">
                  <p><strong>${t('play.game_setup.controls.player1.key')}</strong> ${t('play.game_setup.controls.player1.value')}</p>
                  <p><strong>${t('play.game_setup.controls.player2.key')}</strong> ${t('play.game_setup.controls.player2.value')}</p>
                  <p><strong>${t('play.game_setup.controls.pause.key')}</strong> ${t('play.game_setup.controls.pause.value')}</p>
                </div>
              </div>

              <div class="flex gap-4">
                <button id="start-game-btn" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
                  ${t('play.game_setup.button.start')}
                </button>
                <button id="back-to-mode-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                  ${t('play.game_setup.button.back')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Game Canvas Screen -->
        <div id="game-screen" class="hidden">
          <div class="flex flex-col items-center">
            <div class="bg-white rounded-lg shadow-2xl p-4 mb-4">
              <canvas id="pong-canvas" class="block"></canvas>
            </div>

            <div class="flex gap-4">
              <button id="end-game-btn" class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                ${t('play.endgame.button')}
              </button>
            </div>
          </div>
        </div>

        <!-- Game Result Screen -->
        <div id="result-screen" class="hidden">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto text-center">
            <h3 class="text-3xl font-bold text-gray-900 mb-4">${t('play.gameover.title')}</h3>

            <div class="mb-6">
              <p class="text-5xl font-bold text-blue-600 mb-4" id="winner-name">Winner</p>
              <div class="flex justify-center gap-8 text-2xl">
                <div>
                  <p class="text-gray-600" id="result-player1">${t('play.player1.label')}</p>
                  <p class="font-bold text-gray-900" id="result-score1">0</p>
                </div>
                <div class="text-gray-400">-</div>
                <div>
                  <p class="text-gray-600" id="result-player2">${t('play.player2.label')}</p>
                  <p class="font-bold text-gray-900" id="result-score2">0</p>
                </div>
              </div>
            </div>

            <div class="flex gap-4 justify-center">
              <button id="play-again-btn" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                ${t('play.gameover.playagain.button')}
              </button>
              <button id="back-to-menu-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                ${t('play.gameover.backtomenu.button')}
              </button>
            </div>
          </div>
        </div>

        <!-- Remote Match Waiting Room -->
        <div id="remote-waiting-screen" class="hidden">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto text-center">
            <h3 class="text-2xl font-bold text-gray-900 mb-4" id="remote-waiting-title">Waiting for Opponent</h3>

            <div class="mb-6">
              <div class="animate-pulse flex justify-center mb-4">
                <div class="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p class="text-gray-600 mb-2" id="remote-waiting-status">Looking for an opponent...</p>
              <p class="text-sm text-gray-500" id="remote-match-id-display"></p>
            </div>

            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 class="font-semibold text-blue-900 mb-2">Controls:</h4>
              <div class="text-sm text-blue-800 space-y-1">
                <p><strong>Move Up:</strong> W or ↑</p>
                <p><strong>Move Down:</strong> S or ↓</p>
              </div>
            </div>

            <button id="cancel-remote-btn" class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">
              Cancel
            </button>
          </div>
        </div>

        <!-- Join Match Dialog -->
        <div id="join-match-screen" class="hidden">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
            <h3 class="text-2xl font-bold text-gray-900 mb-6">Join a Match</h3>

            <div class="space-y-4">
              <div>
                <label for="match-id-input" class="block text-sm font-medium text-gray-700 mb-2">
                  Match ID
                </label>
                <input
                  type="text"
                  id="match-id-input"
                  placeholder="Enter match ID..."
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <span id="join-match-error" class="text-red-600 text-sm mt-1 hidden"></span>
              </div>

              <div class="flex gap-4">
                <button id="confirm-join-btn" class="flex-1 px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-semibold">
                  Join Match
                </button>
                <button id="cancel-join-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                  Cancel
                </button>
              </div>
            </div>

            <!-- Available Matches -->
            <div class="mt-6 pt-6 border-t border-gray-200">
              <h4 class="text-lg font-semibold text-gray-800 mb-3">Available Matches</h4>
              <div id="available-matches-list" class="space-y-2 max-h-48 overflow-y-auto">
                <p class="text-gray-500 text-sm">Loading matches...</p>
              </div>
              <button id="refresh-matches-btn" class="mt-3 text-sm text-cyan-600 hover:text-cyan-700">
                ↻ Refresh
              </button>
            </div>
          </div>
        </div>

        <!-- Remote Game Screen -->
        <div id="remote-game-screen" class="hidden">
          <div class="flex flex-col items-center">
            <div class="bg-white rounded-lg shadow-2xl p-4 mb-4">
              <canvas id="remote-pong-canvas" class="block"></canvas>
            </div>

            <div id="remote-connection-status" class="mb-4 text-sm text-gray-600"></div>

            <div class="flex gap-4">
              <button id="leave-remote-game-btn" class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                Leave Game
              </button>
            </div>
          </div>
        </div>

        <!-- Tournament Screen -->
        <div id="tournament-screen" class="hidden">
          <!-- Registration Phase -->
          <div id="tournament-registration" class="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold text-gray-900 mb-4">Tournament Registration</h3>
            <p class="text-gray-600 mb-6">Add up to 8 players. Minimum 2 players required to start.</p>

            <div class="mb-6">
              <div class="flex gap-2 mb-4">
                <input
                  type="text"
                  id="tournament-player-alias"
                  placeholder="Player alias..."
                  maxlength="20"
                  class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button id="add-tournament-player-btn" class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold">
                  Add Player
                </button>
              </div>
              <span id="tournament-error" class="text-red-600 text-sm mt-1 hidden"></span>

              <!-- Players List -->
              <div id="tournament-players-list" class="space-y-2 mb-4 min-h-[100px]">
                <!-- Players will be added here dynamically -->
              </div>

              <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span class="text-gray-700">
                  <span id="tournament-player-count" class="font-bold text-purple-600">0</span> / 8 players
                </span>
                <span id="tournament-status-message" class="text-sm text-gray-500">Add at least 2 players to start</span>
              </div>
            </div>

            <div class="flex gap-4">
              <button id="start-tournament-btn" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed" disabled>
                Start Tournament
              </button>
              <button id="back-from-tournament-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                Back to Menu
              </button>
            </div>
          </div>

          <!-- Bracket Phase -->
          <div id="tournament-bracket" class="hidden">
            <div class="max-w-6xl mx-auto">
              <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold text-gray-900">Tournament Bracket</h3>
                <button id="end-tournament-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">
                  End Tournament
                </button>
              </div>

              <!-- Current Match -->
              <div id="tournament-current-match" class="bg-white rounded-lg shadow-lg p-6 mb-6">
                <!-- Current match info will be displayed here -->
              </div>

              <!-- Bracket Visualization -->
              <div id="tournament-bracket-display" class="bg-white rounded-lg shadow-lg p-6">
                <!-- Bracket will be displayed here -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Setup navigation
  setupNavigation();

  setupPlayPageEvents();
}

function setupPlayPageEvents(): void {
  let currentGame: PongGame | null = null;
  let remoteGame: RemotePongGame | null = null;
  let tournamentManager: TournamentManager | null = null;
  let matchListUnsubscribe: (() => void) | null = null;

  // Set up page cleanup function for when user navigates away
  pageCleanup = () => {
    // If in active remote game, leave the match properly
    if (remoteGame) {
      // This calls stop() which sends match:leave, then disconnects
      remoteGame.disconnect();
      remoteGame = null;
    } else if (isInActiveRemoteGame) {
      // If we're marked as in a game but remoteGame is null (edge case),
      // make sure to leave the match via WebSocket
      const wsManager = getWebSocketManager();
      if (wsManager.isConnected) {
        wsManager.leaveMatch();
      }
    }
    // Clean up local game
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }
    // Clean up match list subscription
    if (matchListUnsubscribe) {
      matchListUnsubscribe();
      matchListUnsubscribe = null;
    }
  };

  // Mode selection
  const localGameBtn = document.getElementById('local-game-btn');
  const tournamentBtn = document.getElementById('tournament-btn');

  // Remote game buttons
  const remoteQuickmatchBtn = document.getElementById('remote-quickmatch-btn');
  const remoteCreateBtn = document.getElementById('remote-create-btn');
  const remoteJoinBtn = document.getElementById('remote-join-btn');
  const remoteLoginHint = document.getElementById('remote-login-hint');

  // Screens
  const modeSelection = document.getElementById('mode-selection');
  const gameSetup = document.getElementById('game-setup');
  const gameScreen = document.getElementById('game-screen');
  const resultScreen = document.getElementById('result-screen');
  const tournamentScreen = document.getElementById('tournament-screen');
  const tournamentRegistration = document.getElementById('tournament-registration');
  const tournamentBracket = document.getElementById('tournament-bracket');

  // Remote game screens
  const remoteWaitingScreen = document.getElementById('remote-waiting-screen');
  const cancelRemoteBtn = document.getElementById('cancel-remote-btn');
  const joinMatchScreen = document.getElementById('join-match-screen');
  const matchIdInput = document.getElementById('match-id-input') as HTMLInputElement;
  const joinMatchError = document.getElementById('join-match-error');
  const confirmJoinBtn = document.getElementById('confirm-join-btn');
  const cancelJoinBtn = document.getElementById('cancel-join-btn');
  const availableMatchesList = document.getElementById('available-matches-list');
  const refreshMatchesBtn = document.getElementById('refresh-matches-btn');
  const remoteGameScreen = document.getElementById('remote-game-screen');
  const remotePongCanvas = document.getElementById('remote-pong-canvas') as HTMLCanvasElement;
  const remoteConnectionStatus = document.getElementById('remote-connection-status');
  const leaveRemoteGameBtn = document.getElementById('leave-remote-game-btn');

  // Setup screen elements
  const player1AliasInput = document.getElementById('player1-alias') as HTMLInputElement;
  const player2AliasInput = document.getElementById('player2-alias') as HTMLInputElement;
  const startGameBtn = document.getElementById('start-game-btn');
  const backToModeBtn = document.getElementById('back-to-mode-btn');

  // Tournament elements
  const tournamentPlayerAliasInput = document.getElementById(
    'tournament-player-alias'
  ) as HTMLInputElement;
  const addTournamentPlayerBtn = document.getElementById('add-tournament-player-btn');
  const tournamentPlayersList = document.getElementById('tournament-players-list');
  const tournamentPlayerCount = document.getElementById('tournament-player-count');
  const tournamentStatusMessage = document.getElementById('tournament-status-message');
  const startTournamentBtn = document.getElementById('start-tournament-btn');
  const backFromTournamentBtn = document.getElementById('back-from-tournament-btn');
  const endTournamentBtn = document.getElementById('end-tournament-btn');
  const tournamentCurrentMatch = document.getElementById('tournament-current-match');
  const tournamentBracketDisplay = document.getElementById('tournament-bracket-display');

  // Game screen elements
  const canvas = document.getElementById('pong-canvas') as HTMLCanvasElement;
  const endGameBtn = document.getElementById('end-game-btn');

  // Result screen elements
  const winnerNameEl = document.getElementById('winner-name');
  const resultPlayer1El = document.getElementById('result-player1');
  const resultScore1El = document.getElementById('result-score1');
  const resultPlayer2El = document.getElementById('result-player2');
  const resultScore2El = document.getElementById('result-score2');
  const playAgainBtn = document.getElementById('play-again-btn');
  const backToMenuBtn = document.getElementById('back-to-menu-btn');

  // Error message elements
  const player1ErrorEl = document.getElementById('player1-error');
  const player2ErrorEl = document.getElementById('player2-error');
  const tournamentErrorEl = document.getElementById('tournament-error');

  // Initialize remote buttons based on auth state
  updateRemoteButtonsState();

  // Check for active match and rejoin if needed
  checkForActiveMatch();

  // Helper functions for error display
  function showInlineError(element: HTMLElement | null, message: string): void {
    if (element) {
      element.textContent = message;
      element.classList.remove('hidden');
    }
  }

  function hideInlineError(element: HTMLElement | null): void {
    if (element) {
      element.textContent = '';
      element.classList.add('hidden');
    }
  }

  function showScreen(screen: HTMLElement): void {
    modeSelection?.classList.add('hidden');
    gameSetup?.classList.add('hidden');
    gameScreen?.classList.add('hidden');
    resultScreen?.classList.add('hidden');
    tournamentScreen?.classList.add('hidden');
    remoteWaitingScreen?.classList.add('hidden');
    joinMatchScreen?.classList.add('hidden');
    remoteGameScreen?.classList.add('hidden');
    screen.classList.remove('hidden');

    // Subscribe to match list updates when join screen is visible
    if (screen === joinMatchScreen) {
      startMatchListSubscription();
    } else {
      stopMatchListSubscription();
    }
  }

  async function startMatchListSubscription(): Promise<void> {
    stopMatchListSubscription(); // Clear any existing subscription

    const wsManager = getWebSocketManager();

    // Connect if not already connected (shared connection)
    if (!wsManager.isConnected) {
      try {
        await wsManager.connect();
      } catch (err) {
        console.error('[Play] Failed to connect WebSocket:', err);
        // Fall back to REST fetch only
        const matches = await fetchAvailableMatches();
        renderAvailableMatches(matches);
        return;
      }
    }

    // Subscribe to match list updates (don't disconnect - shared connection)
    matchListUnsubscribe = wsManager.on('matches:updated', (data) => {
      renderAvailableMatchesFromWs(data.matches);
    });

    // Fetch initial list via REST (WS will push updates after)
    const matches = await fetchAvailableMatches();
    renderAvailableMatches(matches);
  }

  function stopMatchListSubscription(): void {
    // Just unsubscribe from event - don't disconnect (shared connection)
    if (matchListUnsubscribe) {
      matchListUnsubscribe();
      matchListUnsubscribe = null;
    }
  }

  function renderAvailableMatchesFromWs(matches: AvailableMatch[]): void {
    if (!availableMatchesList) return;

    if (matches.length === 0) {
      availableMatchesList.innerHTML =
        '<p class="text-gray-500 text-sm">No matches available. Create one!</p>';
      return;
    }

    availableMatchesList.innerHTML = matches
      .map(
        (match) => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span class="text-sm">
            <span class="font-medium">${escapeHtml(match.player1.username)}</span>
            <span class="text-gray-400 text-xs ml-2">${match.id.slice(0, 8)}...</span>
          </span>
          <button class="join-available-match-btn px-3 py-1 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700" data-match-id="${match.id}">
            Join
          </button>
        </div>
      `
      )
      .join('');
  }

  function showTournamentPhase(phase: 'registration' | 'bracket'): void {
    tournamentRegistration?.classList.toggle('hidden', phase !== 'registration');
    tournamentBracket?.classList.toggle('hidden', phase !== 'bracket');
  }

  function updateTournamentUI(): void {
    if (!tournamentManager) return;

    const playerCount = tournamentManager.getPlayerCount();
    if (tournamentPlayerCount) {
      tournamentPlayerCount.textContent = playerCount.toString();
    }

    // Update start button state
    if (startTournamentBtn) {
      (startTournamentBtn as HTMLButtonElement).disabled = !tournamentManager.canStartTournament();
    }

    // Update status message
    if (tournamentStatusMessage) {
      if (playerCount === 0) {
        tournamentStatusMessage.textContent = 'Add at least 2 players to start';
      } else if (playerCount === 1) {
        tournamentStatusMessage.textContent = 'Need at least 1 more player';
      } else if (playerCount < 8) {
        tournamentStatusMessage.textContent = `Ready to start! (Can add ${8 - playerCount} more)`;
      } else {
        tournamentStatusMessage.textContent = 'Tournament is full!';
      }
    }

    // Render players list
    if (tournamentPlayersList) {
      const players = tournamentManager.getTournament().players;
      tournamentPlayersList.innerHTML = players
        .map(
          (player) => `
          <div class="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <span class="font-medium text-gray-800">${escapeHtml(player.alias)}</span>
            <button class="remove-player-btn px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition" data-player-id="${player.id}">
              Remove
            </button>
          </div>
        `
        )
        .join('');
    }
  }

  function validatePlayerAlias(alias: string): { valid: boolean; error?: string } {
    const trimmed = alias.trim();

    // Allow empty for default names in local game
    if (trimmed === '') {
      return { valid: true };
    }

    // Validate maximum length
    if (trimmed.length > 20) {
      return { valid: false, error: 'Player alias must be 20 characters or less' };
    }

    // Validate allowed characters (alphanumeric, spaces, basic punctuation)
    const validAliasPattern = /^[a-zA-Z0-9\s._-]+$/;
    if (!validAliasPattern.test(trimmed)) {
      return {
        valid: false,
        error:
          'Player alias can only contain letters, numbers, spaces, dots, underscores, and hyphens',
      };
    }

    return { valid: true };
  }

  function startNextTournamentMatch(): void {
    if (!tournamentManager) return;

    const match = tournamentManager.getCurrentMatch();
    if (!match) {
      // Tournament is complete
      showTournamentWinner();
      return;
    }

    // Display match info
    if (tournamentCurrentMatch) {
      const round = match.round || 1;

      tournamentCurrentMatch.innerHTML = `
        <div class="text-center mb-4">
          <h3 class="text-2xl font-bold mb-2">Round ${round}</h3>
          <p class="text-xl mb-4">
            <span class="text-blue-400">${escapeHtml(match.player1.alias)}</span>
            vs
            <span class="text-green-400">${escapeHtml(match.player2.alias)}</span>
          </p>
          <button id="playMatchBtn" class="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-bold transition-colors">
            Play Match
          </button>
        </div>
      `;
    }
  }

  function startMatchGame(match: TournamentMatch): void {
    // Destroy any existing game first
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }

    // Hide tournament UI, show game canvas
    if (tournamentBracket) tournamentBracket.classList.add('hidden');
    if (gameScreen) gameScreen.classList.remove('hidden');
    if (canvas) canvas.classList.remove('hidden');

    // Create game with tournament players
    currentGame = new PongGame(canvas, match.player1.alias, match.player2.alias);

    // Set up game end callback
    currentGame.setOnGameEnd((winner: string, player1Score: number, player2Score: number) => {
      // Determine winner ID based on name
      const winnerId = winner === match.player1.alias ? match.player1.id : match.player2.id;
      handleMatchEnd(match.matchId, winnerId, player1Score, player2Score);
    });

    currentGame.start();
  }

  function handleMatchEnd(matchId: number, winnerId: number, score1: number, score2: number): void {
    if (!tournamentManager) return;

    // Clean up the game
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }

    // Record the result
    tournamentManager.recordMatchResult(matchId, winnerId, score1, score2);

    // Hide game canvas
    if (gameScreen) gameScreen.classList.add('hidden');
    if (canvas) canvas.classList.add('hidden');

    // Show tournament bracket
    if (tournamentBracket) tournamentBracket.classList.remove('hidden');

    // Update bracket visualization
    renderTournamentBracket();

    // Check if tournament is complete
    const nextMatch = tournamentManager.getCurrentMatch();
    if (!nextMatch) {
      showTournamentWinner();
    } else {
      startNextTournamentMatch();
    }
  }

  // Bracket layout constants
  const PLAYER_SLOT_HEIGHT = 45;
  const MATCH_BOX_HEIGHT = 100; // Height to fit 2 player slots
  const BASE_VERTICAL_GAP = 20;

  function calculateTournamentRounds(playerCount: number): number {
    let totalRounds = 0;
    let temp = playerCount;
    while (temp > 1) {
      totalRounds++;
      temp = Math.ceil(temp / 2);
    }
    return totalRounds;
  }

  function getPlayerClassName(isWinner: boolean, isLoser: boolean, isTBD: boolean): string {
    if (isTBD) return 'bracket-player-name bracket-player-name--tbd';
    if (isWinner) return 'bracket-player-name bracket-player-name--winner';
    if (isLoser) return 'bracket-player-name bracket-player-name--loser';
    return 'bracket-player-name bracket-player-name--normal';
  }

  function getPlayerScoreClassName(isTBD: boolean): string {
    return isTBD
      ? 'bracket-player-score bracket-player-score--tbd'
      : 'bracket-player-score bracket-player-score--normal';
  }

  function getMatchBoxClassName(isCurrent: boolean, isComplete: boolean): string {
    if (isCurrent) return 'bracket-match-box bracket-match-box--current';
    if (isComplete) return 'bracket-match-box bracket-match-box--finished';
    return 'bracket-match-box bracket-match-box--pending';
  }

  function renderMatch(match: TournamentMatch, currentMatch: TournamentMatch | null): string {
    const isCurrent = currentMatch?.matchId === match.matchId;
    const isComplete = match.status === 'finished';
    const matchBoxClass = getMatchBoxClassName(isCurrent, isComplete);

    const p1IsTBD = match.player1.id < 0;
    const p2IsTBD = match.player2.id < 0;
    const p1IsWinner = match.winner?.id === match.player1.id;
    const p2IsWinner = match.winner?.id === match.player2.id;

    const p1Class = getPlayerClassName(p1IsWinner, p2IsWinner && isComplete, p1IsTBD);
    const p2Class = getPlayerClassName(p2IsWinner, p1IsWinner && isComplete, p2IsTBD);
    const p1ScoreClass = getPlayerScoreClassName(p1IsTBD);
    const p2ScoreClass = getPlayerScoreClassName(p2IsTBD);

    return `
      <div class="${matchBoxClass}" style="height: ${MATCH_BOX_HEIGHT}px;">
        <!-- Player 1 -->
        <div class="bracket-player-slot bracket-player-slot--top" style="height: ${PLAYER_SLOT_HEIGHT}px;">
          <span class="${p1Class}">
            ${escapeHtml(match.player1.alias)}
          </span>
          <span class="${p1ScoreClass}">${p1IsTBD ? '-' : match.player1Score}</span>
        </div>

        <!-- Player 2 -->
        <div class="bracket-player-slot" style="height: ${PLAYER_SLOT_HEIGHT}px;">
          <span class="${p2Class}">
            ${escapeHtml(match.player2.alias)}
          </span>
          <span class="${p2ScoreClass}">${p2IsTBD ? '-' : match.player2Score}</span>
        </div>
      </div>
    `;
  }

  function renderTBDPlaceholder(): string {
    return `
      <div class="bracket-match-box bracket-match-box--tbd" style="height: ${MATCH_BOX_HEIGHT}px;">
        <!-- Player 1 -->
        <div class="bracket-player-slot bracket-player-slot--top" style="height: ${PLAYER_SLOT_HEIGHT}px;">
          <span class="bracket-player-name bracket-player-name--tbd">TBD</span>
          <span class="bracket-player-score bracket-player-score--tbd">-</span>
        </div>

        <!-- Player 2 -->
        <div class="bracket-player-slot" style="height: ${PLAYER_SLOT_HEIGHT}px;">
          <span class="bracket-player-name bracket-player-name--tbd">TBD</span>
          <span class="bracket-player-score bracket-player-score--tbd">-</span>
        </div>
      </div>
    `;
  }

  function renderRound(
    roundIndex: number,
    roundMatches: TournamentMatch[],
    totalRounds: number,
    currentMatch: TournamentMatch | null
  ): string {
    const isLastRound = roundIndex === totalRounds - 1;
    const verticalGap = BASE_VERTICAL_GAP * Math.pow(2, roundIndex);

    // For Round 1, only show actual matches (no TBD placeholders)
    // For later rounds, show expected matches including TBD placeholders
    let matchesToShow: number;
    if (roundIndex === 0) {
      matchesToShow = roundMatches.length;
    } else {
      const expectedMatches = Math.ceil(Math.pow(2, totalRounds - roundIndex - 1));
      matchesToShow = Math.max(roundMatches.length, expectedMatches);
    }

    let html = `
      <div class="bracket-round-column">
        <h3 class="text-lg font-bold text-center mb-6 text-white">
          ${isLastRound ? 'Finals' : `Round ${roundIndex + 1}`}
        </h3>
        <div class="bracket-matches-container" style="gap: ${verticalGap}px;">
    `;

    for (let i = 0; i < matchesToShow; i++) {
      const match = roundMatches[i];
      html += match ? renderMatch(match, currentMatch) : renderTBDPlaceholder();
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  function renderTournamentBracket(): void {
    if (!tournamentManager || !tournamentBracketDisplay) return;

    const tournament = tournamentManager.getTournament();
    const bracket = tournamentManager.getBracket();
    const currentMatch = tournamentManager.getCurrentMatch();
    const playerCount = tournament.players.length;

    const totalRounds = calculateTournamentRounds(playerCount);

    let html = '<div class="tournament-bracket-container">';

    for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
      const roundMatches = bracket[roundIndex] || [];
      html += renderRound(roundIndex, roundMatches, totalRounds, currentMatch);
    }

    html += '</div>';
    tournamentBracketDisplay.innerHTML = html;
  }

  function showTournamentWinner(): void {
    if (!tournamentManager || !tournamentCurrentMatch) return;

    const bracket = tournamentManager.getBracket();
    const finalMatch = bracket[bracket.length - 1]?.[0];

    if (finalMatch?.winner) {
      const winner = finalMatch.winner;

      tournamentCurrentMatch.innerHTML = `
        <div class="text-center">
          <h2 class="text-4xl font-bold mb-4 text-yellow-400">🏆 Tournament Complete! 🏆</h2>
          <p class="text-2xl mb-6">
            Winner: <span class="text-green-400 font-bold">${escapeHtml(winner.alias)}</span>
          </p>
          <button id="newTournamentBtn" class="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold transition-colors">
            Start New Tournament
          </button>
        </div>
      `;
    }
  }

  function resetTournament(): void {
    // Clean up any running game
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }

    tournamentManager = new TournamentManager();
    showTournamentPhase('registration');
    updateTournamentUI();
  }

  // ============================================
  // Remote Game Functions
  // ============================================

  async function updateRemoteButtonsState(): Promise<void> {
    const authenticated = await isAuthenticated();
    const buttons = [remoteQuickmatchBtn, remoteCreateBtn, remoteJoinBtn];

    buttons.forEach((btn) => {
      if (btn) {
        (btn as HTMLButtonElement).disabled = !authenticated;
      }
    });

    if (remoteLoginHint) {
      remoteLoginHint.classList.toggle('hidden', authenticated);
    }
  }

  /**
   * Check if user has an active match and rejoin it
   */
  async function checkForActiveMatch(): Promise<void> {
    const authenticated = await isAuthenticated();
    if (!authenticated) return;

    try {
      const response = await fetch('/api/game/current', {
        credentials: 'include',
      });
      if (!response.ok) return;

      const data = await response.json();
      const match = data.match;
      if (!match) return;

      // User has an active match - rejoin it
      console.log('[Play] Found active match:', match.id, 'status:', match.status);

      if (match.status === 'finished' || match.status === 'cancelled') {
        // Match is finished or cancelled - nothing to rejoin
        return;
      }

      // Show game screen - canvas will show status
      showScreen(remoteGameScreen!);

      // Show match ID in status area
      if (remoteConnectionStatus) {
        remoteConnectionStatus.textContent = `Match ID: ${match.id.slice(0, 8)}...`;
      }

      toast.info('Rejoining your active match...');

      // Create remote game and reconnect
      remoteGame = new RemotePongGame(remotePongCanvas, {
        onGameEnd: (winner, _winnerId, score1, score2) => {
          handleRemoteGameEnd(winner, score1, score2);
        },
        onOpponentJoined: (opponentName) => {
          toast.success(`${opponentName} joined the match!`);
        },
        onOpponentLeft: () => {
          toast.warning('Opponent left the match');
          cleanupRemoteGame();
          showScreen(modeSelection!);
        },
        onOpponentDisconnected: (timeout) => {
          if (remoteConnectionStatus) {
            remoteConnectionStatus.textContent = `Opponent disconnected. Waiting ${timeout}s for reconnection...`;
          }
        },
        onOpponentReconnected: () => {
          if (remoteConnectionStatus) {
            remoteConnectionStatus.textContent = '';
          }
          toast.success('Opponent reconnected!');
        },
        onError: (code, message) => {
          // Don't disconnect for non-fatal errors like unknown events
          if (code === 'UNKNOWN_EVENT') {
            console.warn('[RemoteGame] Unknown event warning:', message);
            return;
          }
          toast.error(message);
          cleanupRemoteGame();
          showScreen(modeSelection!);
        },
        onConnectionStateChange: (state) => {
          if (remoteConnectionStatus) {
            if (state === 'reconnecting') {
              remoteConnectionStatus.textContent = 'Reconnecting...';
            } else if (state === 'disconnected') {
              remoteConnectionStatus.textContent = 'Disconnected';
            } else if (state === 'connected') {
              // Preserve match ID display
              remoteConnectionStatus.textContent = `Match ID: ${match.id.slice(0, 8)}...`;
            }
          }
        },
        onMatchJoined: (_matchId, _opponentName, playerNumber) => {
          toast.success(`Rejoined match as Player ${playerNumber}!`);
        },
      });

      // Connect to the match via WebSocket and start render loop
      // Server auto-reconnects on connection when user has active match
      await remoteGame.connect(match.id);
      remoteGame.start();

      // Mark as in active remote game
      isInActiveRemoteGame = true;
    } catch (err) {
      console.error('[Play] Error checking for active match:', err);
      // Silently fail - user can still create new matches
    }
  }

  async function fetchAvailableMatches(): Promise<Match[]> {
    try {
      const response = await fetch('/api/game/matches', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.matches || [];
    } catch {
      return [];
    }
  }

  function renderAvailableMatches(matches: Match[]): void {
    if (!availableMatchesList) return;

    if (matches.length === 0) {
      availableMatchesList.innerHTML =
        '<p class="text-gray-500 text-sm">No matches available. Create one!</p>';
      return;
    }

    availableMatchesList.innerHTML = matches
      .map(
        (match) => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span class="text-sm">
            <span class="font-medium">${escapeHtml(match.player1.username)}</span>
            <span class="text-gray-400 text-xs ml-2">${match.id.slice(0, 8)}...</span>
          </span>
          <button class="join-available-match-btn px-3 py-1 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700" data-match-id="${match.id}">
            Join
          </button>
        </div>
      `
      )
      .join('');
  }

  async function startRemoteGame(
    mode: 'quickmatch' | 'create' | 'join',
    joinMatchId?: string
  ): Promise<void> {
    // Clean up any existing games
    cleanupRemoteGame();

    try {
      let endpoint = '/api/game/match';
      const method = 'POST';
      let body: string | undefined = undefined;

      if (mode === 'quickmatch') {
        endpoint = '/api/game/quickmatch';
      } else if (mode === 'create') {
        // Send mode: '1v1' for creating a match
        body = JSON.stringify({ mode: '1v1' });
      } else if (mode === 'join' && joinMatchId) {
        endpoint = `/api/game/match/${joinMatchId}/join`;
      }

      // Create/join match via REST API
      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start game');
      }

      const matchData = await response.json();
      const matchId = matchData.match?.id || matchData.id;

      // Always show game screen - the canvas will show status
      showScreen(remoteGameScreen!);

      // Show match ID in status area
      if (remoteConnectionStatus) {
        remoteConnectionStatus.textContent = `Match ID: ${matchId.slice(0, 8)}...`;
      }

      // Create remote game and connect
      remoteGame = new RemotePongGame(remotePongCanvas, {
        onGameEnd: (winner, _winnerId, score1, score2) => {
          handleRemoteGameEnd(winner, score1, score2);
        },
        onOpponentJoined: (opponent) => {
          toast.success(`${opponent} joined the match!`);
        },
        onOpponentLeft: () => {
          toast.warning('Opponent left the match');
          cleanupRemoteGame();
          showScreen(modeSelection!);
        },
        onOpponentDisconnected: (timeout) => {
          if (remoteConnectionStatus) {
            remoteConnectionStatus.textContent = `Opponent disconnected. Waiting ${timeout}s for reconnection...`;
          }
        },
        onOpponentReconnected: () => {
          if (remoteConnectionStatus) {
            remoteConnectionStatus.textContent = '';
          }
          toast.success('Opponent reconnected!');
        },
        onError: (code, message) => {
          // Don't disconnect for non-fatal errors like unknown events
          if (code === 'UNKNOWN_EVENT') {
            console.warn('[RemoteGame] Unknown event warning:', message);
            return;
          }
          toast.error(message);
          cleanupRemoteGame();
          showScreen(modeSelection!);
        },
        onConnectionStateChange: (state) => {
          if (remoteConnectionStatus) {
            if (state === 'reconnecting') {
              remoteConnectionStatus.textContent = 'Reconnecting...';
            } else if (state === 'disconnected') {
              remoteConnectionStatus.textContent = 'Disconnected';
            } else if (state === 'connected') {
              // Preserve match ID display
              remoteConnectionStatus.textContent = `Match ID: ${matchId.slice(0, 8)}...`;
            }
          }
        },
        onMatchJoined: (_matchId, _opponent, playerNumber) => {
          toast.success(`Joined match as Player ${playerNumber}!`);
        },
      });

      // Connect WebSocket and start render loop
      // REST API already added us to the match, just tell server we're ready
      await remoteGame.connect(matchId);
      remoteGame.start();

      // Mark as in active remote game
      isInActiveRemoteGame = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start game';
      toast.error(message);
      cleanupRemoteGame();
    }
  }

  function handleRemoteGameEnd(winner: string, score1: number, score2: number): void {
    // Get player aliases from the last game state
    const player1 = remoteGame?.getCurrentState()?.player1.alias || t('play.player1.label');
    const player2 = remoteGame?.getCurrentState()?.player2.alias || t('play.player2.label');

    cleanupRemoteGame();

    showResultScreen(winner, player1, player2, score1, score2, true); // true = isRemoteGame
  }

  function cleanupRemoteGame(): void {
    if (remoteGame) {
      remoteGame.disconnect();
      remoteGame = null;
    }
    // Only reset WebSocket manager when truly cleaning up, not when starting a new game
    // The WebSocket connection will be reused for the new game
    isInActiveRemoteGame = false;
  }

  // Event: Local Game button
  localGameBtn?.addEventListener('click', () => {
    showScreen(gameSetup!);
    player1AliasInput.value = '';
    player2AliasInput.value = '';
    player1AliasInput.focus();
  });

  // Event: Tournament button
  tournamentBtn?.addEventListener('click', () => {
    // Create new tournament
    tournamentManager = new TournamentManager();
    updateTournamentUI();
    showTournamentPhase('registration');
    showScreen(tournamentScreen!);
    tournamentPlayerAliasInput?.focus();
  });

  // ============================================
  // Remote Game Events
  // ============================================

  // Event: Quick Match button
  remoteQuickmatchBtn?.addEventListener('click', async () => {
    await startRemoteGame('quickmatch');
  });

  // Event: Create Match button
  remoteCreateBtn?.addEventListener('click', async () => {
    await startRemoteGame('create');
  });

  // Event: Join Match button (shows join screen)
  remoteJoinBtn?.addEventListener('click', async () => {
    showScreen(joinMatchScreen!);
    matchIdInput.value = '';
    hideInlineError(joinMatchError);

    // Load available matches
    const matches = await fetchAvailableMatches();
    renderAvailableMatches(matches);
  });

  // Event: Confirm Join Match
  confirmJoinBtn?.addEventListener('click', async () => {
    const matchId = matchIdInput.value.trim();
    if (!matchId) {
      showInlineError(joinMatchError, 'Please enter a match ID');
      return;
    }
    hideInlineError(joinMatchError);
    await startRemoteGame('join', matchId);
  });

  // Event: Cancel Join
  cancelJoinBtn?.addEventListener('click', () => {
    showScreen(modeSelection!);
  });

  // Event: Refresh available matches
  refreshMatchesBtn?.addEventListener('click', async () => {
    const matches = await fetchAvailableMatches();
    renderAvailableMatches(matches);
  });

  // Event delegation for join buttons in available matches list
  availableMatchesList?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('join-available-match-btn')) {
      const matchId = target.dataset.matchId;
      if (matchId) {
        await startRemoteGame('join', matchId);
      }
    }
  });

  // Event: Cancel waiting for remote game
  cancelRemoteBtn?.addEventListener('click', async () => {
    cleanupRemoteGame();
    showScreen(modeSelection!);
  });

  // Event: Leave remote game
  leaveRemoteGameBtn?.addEventListener('click', async () => {
    const confirmed = await showConfirmModal({
      title: 'Leave Game',
      message: 'Are you sure you want to leave the game?',
      confirmText: 'Leave',
      cancelText: 'Stay',
      isDangerous: true,
    });

    if (confirmed) {
      cleanupRemoteGame();
      showScreen(modeSelection!);
    }
  });

  // Event: Add tournament player
  const handleAddPlayer = () => {
    if (!tournamentManager || !tournamentPlayerAliasInput) return;

    const alias = tournamentPlayerAliasInput.value.trim();

    // Hide previous errors
    hideInlineError(tournamentErrorEl);

    // Validate empty input (required for tournament)
    if (alias === '') {
      showInlineError(tournamentErrorEl, 'Please enter a player alias');
      return;
    }

    // Validate alias format
    const validation = validatePlayerAlias(alias);
    if (!validation.valid) {
      showInlineError(tournamentErrorEl, validation.error || 'Invalid alias');
      return;
    }

    if (tournamentManager.addPlayer(alias)) {
      tournamentPlayerAliasInput.value = '';
      hideInlineError(tournamentErrorEl);
      updateTournamentUI();
      tournamentPlayerAliasInput.focus();
      toast.success(`${alias} added to tournament`);
    } else {
      if (!tournamentManager.canAddPlayers()) {
        showInlineError(tournamentErrorEl, 'Tournament is full (8 players max)');
      } else {
        showInlineError(tournamentErrorEl, 'This alias is already taken');
      }
    }
  };

  addTournamentPlayerBtn?.addEventListener('click', handleAddPlayer);
  tournamentPlayerAliasInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAddPlayer();
    }
  });

  // Event: Start tournament
  startTournamentBtn?.addEventListener('click', () => {
    if (!tournamentManager) return;

    if (tournamentManager.startTournament()) {
      showTournamentPhase('bracket');
      renderTournamentBracket(); // Show full bracket with TBD
      startNextTournamentMatch();
      toast.success('Tournament started!');
    } else {
      toast.error('Cannot start tournament. Need at least 2 players.');
    }
  });

  // Event: Back to mode selection
  backToModeBtn?.addEventListener('click', () => {
    showScreen(modeSelection!);
  });

  backFromTournamentBtn?.addEventListener('click', () => {
    // Clean up any running game
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }

    showScreen(modeSelection!);
    tournamentManager = null;
  });

  // Event: End Tournament button
  endTournamentBtn?.addEventListener('click', async () => {
    const confirmed = await showConfirmModal({
      title: 'End Tournament',
      message: 'Are you sure you want to end this tournament?\nAll progress will be lost.',
      confirmText: 'End Tournament',
      cancelText: 'Cancel',
      isDangerous: true,
    });

    if (confirmed) {
      // Clean up any running game
      if (currentGame) {
        currentGame.destroy();
        currentGame = null;
      }

      // Reset tournament
      showScreen(modeSelection!);
      tournamentManager = null;
      toast.info('Tournament ended');
    }
  });

  // Event: Start game
  startGameBtn?.addEventListener('click', () => {
    let player1 = player1AliasInput.value.trim();
    let player2 = player2AliasInput.value.trim();

    // Hide previous errors
    hideInlineError(player1ErrorEl);
    hideInlineError(player2ErrorEl);

    // Validate player 1 alias
    if (player1 !== '') {
      const validation = validatePlayerAlias(player1);
      if (!validation.valid) {
        showInlineError(player1ErrorEl, validation.error || 'Invalid alias');
        return;
      }
    } else {
      player1 = t('play.player1.label'); // Default name
    }

    // Validate player 2 alias
    if (player2 !== '') {
      const validation = validatePlayerAlias(player2);
      if (!validation.valid) {
        showInlineError(player2ErrorEl, validation.error || 'Invalid alias');
        return;
      }
    } else {
      player2 = t('play.player2.label'); // Default name
    }

    // Check for duplicate names
    if (player1.toLowerCase() === player2.toLowerCase()) {
      showInlineError(player2ErrorEl, 'Both players cannot have the same name');
      return;
    }

    if (currentGame) {
      currentGame.destroy();
    }

    currentGame = new PongGame(canvas, player1, player2);

    currentGame.setOnGameEnd((winner, score1, score2) => {
      // Show result screen after a short delay to let players see final game state
      setTimeout(() => {
        showResultScreen(winner, player1, player2, score1, score2);
      }, GAME_END_DELAY_MS);
    });

    showScreen(gameScreen!);
    currentGame.start();
  });

  // Event: End game early
  endGameBtn?.addEventListener('click', () => {
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }

    // If we're in a tournament, go back to tournament bracket
    if (tournamentManager && tournamentManager.getTournament().status === 'in-progress') {
      if (tournamentBracket) tournamentBracket.classList.remove('hidden');
      if (gameScreen) gameScreen.classList.add('hidden');
      showScreen(tournamentScreen!);
    } else {
      showScreen(modeSelection!);
    }
  });

  // Event: Play again
  playAgainBtn?.addEventListener('click', () => {
    showScreen(gameSetup!);
    player1AliasInput.focus();
  });

  // Event: Back to menu from results
  backToMenuBtn?.addEventListener('click', () => {
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }
    showScreen(modeSelection!);
  });

  // Event delegation for dynamically created buttons in tournament
  tournamentCurrentMatch?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle "Play Match" button
    if (target.id === 'playMatchBtn') {
      const match = tournamentManager?.getCurrentMatch();
      if (match) {
        startMatchGame(match);
      }
    }

    // Handle "Start New Tournament" button
    if (target.id === 'newTournamentBtn') {
      resetTournament();
    }
  });

  // Event delegation for remove player buttons
  tournamentPlayersList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle "Remove" button
    if (target.classList.contains('remove-player-btn')) {
      const playerId = parseInt(target.dataset.playerId || '0');
      if (tournamentManager && tournamentManager.removePlayer(playerId)) {
        updateTournamentUI();
      }
    }
  });

  function showResultScreen(
    winner: string,
    player1: string,
    player2: string,
    score1: number,
    score2: number,
    isRemoteGame: boolean = false
  ): void {
    if (winnerNameEl) winnerNameEl.textContent = t('play.gameover.winner', { winner });
    if (resultPlayer1El) resultPlayer1El.textContent = player1;
    if (resultScore1El) resultScore1El.textContent = score1.toString();
    if (resultPlayer2El) resultPlayer2El.textContent = player2;
    if (resultScore2El) resultScore2El.textContent = score2.toString();

    // Hide "Play Again" button for remote games (only show for local games)
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) {
      playAgainBtn.style.display = isRemoteGame ? 'none' : 'block';
    }

    showScreen(resultScreen!);
  }
}
