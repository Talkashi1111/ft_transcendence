import { RemotePongGame } from '../game/remote-pong';
import type { Match } from '../types/game';
import { toast } from '../utils/toast';
import { showConfirmModal } from '../utils/modal';
import { escapeHtml } from '../utils/sanitize';
import { isAuthenticated } from '../utils/auth';
import { getWebSocketManager } from '../utils/websocket';
import type { AvailableMatch } from '../utils/websocket';
import { t } from '../i18n/i18n';
import type { PlayContext } from './play';

/**
 * Sets up all remote game event listeners: quickmatch, create, join.
 */
export function setupRemoteGameEvents(ctx: PlayContext): void {
  const { getState, setState, showScreen, showResultScreen, modeSelection } = ctx;

  // Remote game buttons
  const remoteQuickmatchBtn = document.getElementById('remote-quickmatch-btn');
  const remoteCreateBtn = document.getElementById('remote-create-btn');
  const remoteJoinBtn = document.getElementById('remote-join-btn');
  const remoteLoginHint = document.getElementById('remote-login-hint');

  // Remote game screens
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

      console.log('[Play] Found active match:', match.id, 'status:', match.status);

      if (match.status === 'finished' || match.status === 'cancelled') {
        return;
      }

      showScreen(remoteGameScreen!);

      if (remoteConnectionStatus) {
        remoteConnectionStatus.textContent = `Match ID: ${match.id.slice(0, 8)}...`;
      }

      toast.info(t('play.rejoining.active.match'));

      const remoteGame = new RemotePongGame(remotePongCanvas, {
        onGameEnd: (winner, _winnerId, score1, score2) => {
          handleRemoteGameEnd(winner, score1, score2);
        },
        onOpponentJoined: (opponentName) => {
          toast.success(t('friends.join.match.toast.success', { opponentName }));
        },
        onOpponentLeft: () => {
          toast.warning(t('friends.left.match.toast.warning'));
          cleanupRemoteGame();
          showScreen(modeSelection!);
          window.history.replaceState({ page: 'play' }, '', window.location.href);
        },
        onOpponentDisconnected: (timeout) => {
          if (remoteConnectionStatus) {
            remoteConnectionStatus.textContent = `Opponent disconnected. Waiting ${timeout}s for reconnection...`;
          }
        },
        onOpponentReconnected: () => {
          if (remoteConnectionStatus) {
            remoteConnectionStatus.textContent = `Match ID: ${match.id.slice(0, 8)}...`;
          }
          toast.success(t('friends.opponent.reconnect.toast.success'));
        },
        onError: (code, message) => {
          if (code === 'UNKNOWN_EVENT') {
            console.warn('[RemoteGame] Unknown event warning:', message);
            return;
          }
          toast.error(message);
          cleanupRemoteGame();
          showScreen(modeSelection!);
          window.history.replaceState({ page: 'play' }, '', window.location.href);
        },
        onConnectionStateChange: (state) => {
          if (remoteConnectionStatus) {
            if (state === 'reconnecting') {
              remoteConnectionStatus.textContent = 'Reconnecting...';
            } else if (state === 'disconnected') {
              remoteConnectionStatus.textContent = 'Disconnected';
            } else if (state === 'connected') {
              remoteConnectionStatus.textContent = `Match ID: ${match.id.slice(0, 8)}...`;
            }
          }
        },
        onMatchJoined: (_matchId, opponentName, playerNumber) => {
          if (opponentName) {
            toast.success(
              t('friends.opponent.join.match.toast.success', { opponent: opponentName })
            );
          } else {
            toast.success(t('friends.rejoin.match.toast.success', { playerNumber }));
          }
        },
      });

      setState({ remoteGame });

      await remoteGame.connect(match.id);
      remoteGame.start();

      setState({ isInActiveRemoteGame: true });
    } catch (err) {
      console.error('[Play] Error checking for active match:', err);
    }
  }

  async function startMatchListSubscription(): Promise<void> {
    stopMatchListSubscription();

    const wsManager = getWebSocketManager();

    if (!wsManager.isConnected) {
      try {
        await wsManager.connect();
      } catch (err) {
        console.error('[Play] Failed to connect WebSocket:', err);
        const matches = await fetchAvailableMatches();
        renderAvailableMatches(matches);
        return;
      }
    }

    const unsubscribe = wsManager.on('matches:updated', (data) => {
      renderAvailableMatchesFromWs(data.matches);
    });
    setState({ matchListUnsubscribe: unsubscribe });

    const matches = await fetchAvailableMatches();
    renderAvailableMatches(matches);
  }

  function stopMatchListSubscription(): void {
    const state = getState();
    if (state.matchListUnsubscribe) {
      state.matchListUnsubscribe();
      setState({ matchListUnsubscribe: null });
    }
  }

  function renderAvailableMatchesFromWs(matches: AvailableMatch[]): void {
    if (!availableMatchesList) return;

    if (matches.length === 0) {
      availableMatchesList.innerHTML = `<p class="text-gray-500 text-sm">${t('play.remote.available.matches.empty')}</p>`;
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
            ${t('play.remote.available.matches.ws.join.button')}
          </button>
        </div>
      `
      )
      .join('');
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
      availableMatchesList.innerHTML = `<p class="text-gray-500 text-sm">${t('play.remote.available.matches.empty')}</p>`;
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
            ${t('play.remote.available.matches.join.button')}
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
    cleanupRemoteGame();

    try {
      let endpoint = '/api/game/match';
      const method = 'POST';
      let body: string | undefined = undefined;

      if (mode === 'quickmatch') {
        endpoint = '/api/game/quickmatch';
      } else if (mode === 'create') {
        body = JSON.stringify({ mode: '1v1' });
      } else if (mode === 'join' && joinMatchId) {
        endpoint = `/api/game/match/${joinMatchId}/join`;
      }

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

      showScreen(remoteGameScreen!, true);

      if (remoteConnectionStatus) {
        remoteConnectionStatus.textContent = `Match ID: ${matchId.slice(0, 8)}...`;
      }

      const remoteGame = new RemotePongGame(remotePongCanvas, {
        onGameEnd: (winner, _winnerId, score1, score2) => {
          handleRemoteGameEnd(winner, score1, score2);
        },
        onOpponentJoined: (opponent) => {
          toast.success(t('friends.opponent.join.match.toast.success', { opponent }));
        },
        onOpponentLeft: () => {
          toast.warning(t('friends.left.match.toast.warning'));
          cleanupRemoteGame();
          showScreen(modeSelection!);
          window.history.replaceState({ page: 'play' }, '', window.location.href);
        },
        onOpponentDisconnected: (timeout) => {
          if (remoteConnectionStatus) {
            remoteConnectionStatus.textContent = `Opponent disconnected. Waiting ${timeout}s for reconnection...`;
          }
        },
        onOpponentReconnected: () => {
          if (remoteConnectionStatus) {
            remoteConnectionStatus.textContent = `Match ID: ${matchId.slice(0, 8)}...`;
          }
          toast.success(t('friends.opponent.reconnect.toast.success'));
        },
        onError: (code, message) => {
          if (code === 'UNKNOWN_EVENT') {
            console.warn('[RemoteGame] Unknown event warning:', message);
            return;
          }
          toast.error(message);
          cleanupRemoteGame();
          showScreen(modeSelection!);
          window.history.replaceState({ page: 'play' }, '', window.location.href);
        },
        onConnectionStateChange: (connState) => {
          if (remoteConnectionStatus) {
            if (connState === 'reconnecting') {
              remoteConnectionStatus.textContent = 'Reconnecting...';
            } else if (connState === 'disconnected') {
              remoteConnectionStatus.textContent = 'Disconnected';
            } else if (connState === 'connected') {
              remoteConnectionStatus.textContent = `Match ID: ${matchId.slice(0, 8)}...`;
            }
          }
        },
        onMatchJoined: () => {
          // Don't show toast here - for new matches, wait for opponent_joined event
        },
      });

      setState({ remoteGame });

      await remoteGame.connect(matchId);
      remoteGame.start();

      setState({ isInActiveRemoteGame: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start game';
      toast.error(message);
      cleanupRemoteGame();
    }
  }

  function handleRemoteGameEnd(winner: string, score1: number, score2: number): void {
    const state = getState();
    const player1 = state.remoteGame?.getCurrentState()?.player1.alias || t('play.player1.label');
    const player2 = state.remoteGame?.getCurrentState()?.player2.alias || t('play.player2.label');

    cleanupRemoteGame();

    showResultScreen(winner, player1, player2, score1, score2, true);
  }

  function cleanupRemoteGame(): void {
    const state = getState();
    if (state.remoteGame) {
      state.remoteGame.disconnect();
      setState({ remoteGame: null });
    }
    setState({ isInActiveRemoteGame: false });
  }

  // ============================================
  // Initialize
  // ============================================
  updateRemoteButtonsState();
  checkForActiveMatch();

  // ============================================
  // Remote Game Events
  // ============================================

  // Subscribe/unsubscribe to match list when join screen is shown/hidden
  // This is handled by showScreen in play.ts calling our exported handler
  ctx.onScreenChange = (screenId: string) => {
    if (screenId === 'join-match-screen') {
      startMatchListSubscription();
    } else {
      stopMatchListSubscription();
    }
  };

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
    showScreen(joinMatchScreen!, true);
    matchIdInput.value = '';
    hideInlineError(joinMatchError);

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
    window.history.back();
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
    window.history.replaceState({ page: 'play' }, '', window.location.href);
  });

  // Event: Leave remote game
  leaveRemoteGameBtn?.addEventListener('click', async () => {
    const confirmed = await showConfirmModal({
      title: t('play.remote.leavegame.popup.title'),
      message: t('play.remote.leavegame.popup.message'),
      confirmText: t('play.remote.leavegame.popup.leave.button'),
      cancelText: t('play.remote.leavegame.popup.stay.button'),
      isDangerous: true,
    });

    if (confirmed) {
      cleanupRemoteGame();
      showScreen(modeSelection!);
      window.history.replaceState({ page: 'play' }, '', window.location.href);
    }
  });
}
