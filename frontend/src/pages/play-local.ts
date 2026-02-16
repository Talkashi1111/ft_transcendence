import { PongGame } from '../game/pong';
import { BotPongGame } from '../game/bot-pong';
import { TournamentManager } from '../game/tournament';
import type { TournamentMatch } from '../types/tournament';
import { toast } from '../utils/toast';
import { showConfirmModal } from '../utils/modal';
import { escapeHtml } from '../utils/sanitize';
import { isAuthenticated, getCurrentUser } from '../utils/auth';
import { t } from '../i18n/i18n';
import { BotLevel } from '../types/game';
import { setModuleCurrentGame, setModuleTournamentManager } from './play';
import type { PlayContext } from './play';

// Constants
const GAME_END_DELAY_MS = 2000; // Delay before showing result screen after game ends

/**
 * Sets up all local game event listeners: 1v1, bot, and tournament.
 */
export function setupLocalGameEvents(ctx: PlayContext): void {
  // Destructure shared context
  const {
    getState,
    setState,
    showScreen,
    showResultScreen,
    modeSelection,
    gameSetup,
    gameBotSetup,
    gameScreen,
    tournamentScreen,
    tournamentRegistration,
    tournamentBracket,
    canvas,
  } = ctx;

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

  // Setup screen elements
  const player1AliasInput = document.getElementById('player1-alias') as HTMLInputElement;
  const player2AliasInput = document.getElementById('player2-alias') as HTMLInputElement;
  const startGameBtn = document.getElementById('start-game-btn');
  const backToModeBtn = document.getElementById('back-to-mode-btn');

  // Setup bot game screen elements
  const startBotGameBtn = document.getElementById('start-bot-game-btn');
  const backToModeFromBotBtn = document.getElementById('back-to-mode-from-bot-btn');

  // Game screen elements
  const endGameBtn = document.getElementById('end-game-btn');

  // Result screen elements
  const playAgainBtn = document.getElementById('play-again-btn');
  const backToMenuBtn = document.getElementById('back-to-menu-btn');

  // Error message elements
  const player1ErrorEl = document.getElementById('player1-error');
  const player2ErrorEl = document.getElementById('player2-error');
  const tournamentErrorEl = document.getElementById('tournament-error');

  // Local game buttons
  const localGameBtn = document.getElementById('local-game-btn');
  const gameVersusBotBtn = document.getElementById('bot-opponent-btn');
  const tournamentBtn = document.getElementById('tournament-btn');

  // ============================================
  // Helper functions
  // ============================================

  function syncTournamentToModule(): void {
    const state = getState();
    setModuleTournamentManager(state.tournamentManager);
    setModuleCurrentGame(state.currentGame);
  }

  /**
   * Record a completed local match to the database (only for logged-in users)
   */
  async function recordLocalMatch(
    mode: 'LOCAL_1V1' | 'VS_BOT',
    player1Alias: string,
    player2Alias: string,
    score1: number,
    score2: number
  ): Promise<void> {
    const authenticated = await isAuthenticated();
    if (!authenticated) return;

    try {
      await fetch('/api/game/local-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode,
          player1Alias,
          player2Alias,
          score1,
          score2,
        }),
      });
    } catch (err) {
      console.error('[Play] Failed to record local match:', err);
    }
  }

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

  function validatePlayerAlias(alias: string): { valid: boolean; error?: string } {
    const trimmed = alias.trim();

    if (trimmed === '') {
      return { valid: true };
    }

    if (trimmed.length > 20) {
      return { valid: false, error: 'Player alias must be 20 characters or less' };
    }

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

  // ============================================
  // Tournament functions
  // ============================================

  function showTournamentPhase(phase: 'registration' | 'bracket'): void {
    tournamentRegistration?.classList.toggle('hidden', phase !== 'registration');
    tournamentBracket?.classList.toggle('hidden', phase !== 'bracket');
  }

  function updateTournamentUI(): void {
    const state = getState();
    if (!state.tournamentManager) return;

    const playerCount = state.tournamentManager.getPlayerCount();
    if (tournamentPlayerCount) {
      tournamentPlayerCount.textContent = playerCount.toString();
    }

    if (startTournamentBtn) {
      (startTournamentBtn as HTMLButtonElement).disabled =
        !state.tournamentManager.canStartTournament();
    }

    if (tournamentStatusMessage) {
      if (playerCount === 0) {
        tournamentStatusMessage.textContent = t('play.local.tournament.registration.smalltext');
      } else if (playerCount === 1) {
        tournamentStatusMessage.textContent = t(
          'play.local.tournament.registration.smalltext.onemore'
        );
      } else if (playerCount < 8) {
        const remaining = 8 - playerCount;
        tournamentStatusMessage.textContent = t(
          'play.local.tournament.registration.smalltext.ready',
          {
            remaining,
          }
        );
      } else {
        tournamentStatusMessage.textContent = t(
          'play.local.tournament.registration.smalltext.full'
        );
      }
    }

    if (tournamentPlayersList) {
      const players = state.tournamentManager.getTournament().players;
      tournamentPlayersList.innerHTML = players
        .map((player) => {
          const isLoggedInUser =
            state.loggedInUserId !== null && player.id === state.loggedInUserId;
          return `
          <div class="flex items-center justify-between p-3 ${isLoggedInUser ? 'bg-blue-50 border border-blue-200' : 'bg-purple-50'} rounded-lg">
            <span class="font-medium text-gray-800" style="white-space: pre-wrap;">
              ${escapeHtml(player.alias)}
              ${isLoggedInUser ? `<span class="text-xs text-blue-600 ml-2">${t('play.local.tournament.registration.you')}</span>` : ''}
            </span>
            ${
              isLoggedInUser
                ? ''
                : `<button class="remove-player-btn px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition" data-player-id="${player.id}">
              ${t('play.local.tournament.registration.remove.button')}
            </button>`
            }
          </div>
        `;
        })
        .join('');
    }
  }

  async function startNextTournamentMatch(): Promise<void> {
    const state = getState();
    if (!state.tournamentManager) return;

    const match = state.tournamentManager.getCurrentMatch();
    if (!match) {
      await showTournamentWinner();
      return;
    }

    if (tournamentCurrentMatch) {
      const round = match.round || 1;

      tournamentCurrentMatch.innerHTML = `
        <div class="text-center mb-4">
          <h3 class="text-2xl font-bold mb-2"> ${t('play.local.tournament.bracket.round', { round })}</h3>
          <p class="text-xl mb-4">
            <span class="text-blue-400" style="white-space: pre-wrap;">${escapeHtml(match.player1.alias)}</span>
            ${t('play.local.tournament.bracket.versus')}
            <span class="text-green-400" style="white-space: pre-wrap;">${escapeHtml(match.player2.alias)}</span>
          </p>
          <button id="playMatchBtn" class="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-bold transition-colors">
            ${t('play.local.tournament.bracket.play.button')}
          </button>
        </div>
      `;
    }
  }

  function startMatchGame(match: TournamentMatch): void {
    const state = getState();
    if (state.currentGame) {
      state.currentGame.destroy();
      setState({ currentGame: null });
    }

    if (tournamentBracket) tournamentBracket.classList.add('hidden');
    if (gameScreen) gameScreen.classList.remove('hidden');
    if (canvas) canvas.classList.remove('hidden');

    const currentGame = new PongGame(canvas, match.player1.alias, match.player2.alias);
    setState({ currentGame });

    currentGame.setOnGameEnd((winner: string, player1Score: number, player2Score: number) => {
      const winnerId = winner === match.player1.alias ? match.player1.id : match.player2.id;
      void handleMatchEnd(match.matchId, winnerId, player1Score, player2Score);
    });

    currentGame.start();
  }

  async function handleMatchEnd(
    matchId: number,
    winnerId: number,
    score1: number,
    score2: number
  ): Promise<void> {
    const state = getState();
    if (!state.tournamentManager) return;

    if (state.currentGame) {
      state.currentGame.destroy();
      setState({ currentGame: null });
    }

    state.tournamentManager.recordMatchResult(matchId, winnerId, score1, score2);

    if (gameScreen) gameScreen.classList.add('hidden');
    if (canvas) canvas.classList.add('hidden');
    if (tournamentBracket) tournamentBracket.classList.remove('hidden');

    renderTournamentBracket();

    const nextMatch = state.tournamentManager.getCurrentMatch();
    if (!nextMatch) {
      await showTournamentWinner();
    } else {
      await startNextTournamentMatch();
    }
  }

  // Bracket layout constants
  const PLAYER_SLOT_HEIGHT = 45;
  const MATCH_BOX_HEIGHT = 100;
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
          <span class="${p1Class}" style="white-space: pre-wrap;">
            ${escapeHtml(match.player1.alias)}
          </span>
          <span class="${p1ScoreClass}">${p1IsTBD ? '-' : match.player1Score}</span>
        </div>

        <!-- Player 2 -->
        <div class="bracket-player-slot" style="height: ${PLAYER_SLOT_HEIGHT}px;">
          <span class="${p2Class}" style="white-space: pre-wrap;">
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
          <span class="bracket-player-name bracket-player-name--tbd">${t('play.local.tournament.bracket.tbd')}</span>
          <span class="bracket-player-score bracket-player-score--tbd">-</span>
        </div>

        <!-- Player 2 -->
        <div class="bracket-player-slot" style="height: ${PLAYER_SLOT_HEIGHT}px;">
          <span class="bracket-player-name bracket-player-name--tbd">${t('play.local.tournament.bracket.tbd')}</span>
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

    let matchesToShow: number;
    if (roundIndex === 0) {
      matchesToShow = roundMatches.length;
    } else {
      const expectedMatches = Math.ceil(Math.pow(2, totalRounds - roundIndex - 1));
      matchesToShow = Math.max(roundMatches.length, expectedMatches);
    }
    const index = roundIndex + 1;
    let html = `
      <div class="bracket-round-column">
        <h3 class="text-lg font-bold text-center mb-6 text-white">
          ${isLastRound ? t('play.local.tournament.bracket.islastround.finals') : t('play.local.tournament.bracket.islastround.round', { index })}
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
    const state = getState();
    if (!state.tournamentManager || !tournamentBracketDisplay) return;

    const tournament = state.tournamentManager.getTournament();
    const bracket = state.tournamentManager.getBracket();
    const currentMatch = state.tournamentManager.getCurrentMatch();
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

  async function recordTournamentOnBlockchain(): Promise<{
    success: boolean;
    blockchainId?: string;
    txHash?: string;
    snowtraceUrl?: string;
  }> {
    const state = getState();
    if (!state.tournamentManager) return { success: false };

    const tournament = state.tournamentManager.getTournament();
    if (!tournament.winner) return { success: false };

    const authenticated = await isAuthenticated();
    if (!authenticated) return { success: false };

    const players = tournament.players.map((p) => p.alias);
    const matches = tournament.matches
      .filter((m) => m.status === 'finished')
      .map((m) => ({
        player1: m.player1.alias,
        player2: m.player2.alias,
        score1: m.player1Score,
        score2: m.player2Score,
        round: m.round || 1,
      }));

    try {
      const response = await fetch('/api/tournaments/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ players, matches }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          blockchainId: data.blockchainId,
          txHash: data.txHash,
          snowtraceUrl: data.snowtraceUrl,
        };
      }
    } catch (err) {
      console.error('[Tournament] Failed to record on blockchain:', err);
    }

    return { success: false };
  }

  async function showTournamentWinner(): Promise<void> {
    const state = getState();
    if (!state.tournamentManager || !tournamentCurrentMatch) return;

    const bracket = state.tournamentManager.getBracket();
    const finalMatch = bracket[bracket.length - 1]?.[0];

    if (finalMatch?.winner) {
      const winner = finalMatch.winner;

      const authenticated = await isAuthenticated();
      let blockchainHtml = '';

      if (authenticated) {
        tournamentCurrentMatch.innerHTML = `
          <div class="text-center">
            <h2 class="text-4xl font-bold mb-4 text-yellow-400">🏆 ${t('play.local.tournament.bracket.complete.title')} 🏆</h2>
            <p class="text-2xl mb-4">
              ${t('play.local.tournament.bracket.complete.winner.label')} <span class="text-green-400 font-bold" style="white-space: pre-wrap;">${escapeHtml(winner.alias)}</span>
            </p>
            <p class="text-gray-400 mb-6">Recording tournament on blockchain...</p>
          </div>
        `;

        const result = await recordTournamentOnBlockchain();
        if (result.success) {
          blockchainHtml = `
            <div class="mt-4 p-4 bg-green-900/30 rounded-lg border border-green-600">
              <p class="text-green-400 font-semibold mb-2">✅ Recorded on Blockchain</p>
              <p class="text-sm text-gray-300">Tournament ID: #${result.blockchainId}</p>
              <a href="${result.snowtraceUrl}" target="_blank" rel="noopener noreferrer"
                 class="text-sm text-blue-400 hover:text-blue-300 underline">
                View on Snowtrace →
              </a>
            </div>
          `;
        } else {
          blockchainHtml = `
            <div class="mt-4 p-4 bg-yellow-900/30 rounded-lg border border-yellow-600">
              <p class="text-yellow-400 text-sm">⚠️ Could not record on blockchain</p>
            </div>
          `;
        }
      }

      tournamentCurrentMatch.innerHTML = `
        <div class="text-center">
          <h2 class="text-4xl font-bold mb-4 text-yellow-400">🏆 ${t('play.local.tournament.bracket.complete.title')} 🏆</h2>
          <p class="text-2xl mb-6">
            ${t('play.local.tournament.bracket.complete.winner.label')} <span class="text-green-400 font-bold" style="white-space: pre-wrap;">${escapeHtml(winner.alias)}</span>
          </p>
          ${blockchainHtml}
          <button id="newTournamentBtn" class="mt-6 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold transition-colors">
            ${t('play.local.tournament.bracket.complete.startnew.button')}
          </button>
        </div>
      `;
    }
  }

  async function resetTournament(): Promise<void> {
    const state = getState();
    if (state.currentGame) {
      state.currentGame.destroy();
      setState({ currentGame: null });
    }

    const tm = new TournamentManager();
    setState({ tournamentManager: tm });
    syncTournamentToModule();

    const user = await getCurrentUser();
    if (user) {
      setState({ loggedInUserAlias: user.alias });
      tm.addPlayer(user.alias);
      const players = tm.getTournament().players;
      setState({ loggedInUserId: players.length > 0 ? players[0].id : null });
    } else {
      setState({ loggedInUserAlias: null, loggedInUserId: null });
    }

    showTournamentPhase('registration');
    updateTournamentUI();
  }

  // ============================================
  // Event: Local Game button
  // ============================================
  localGameBtn?.addEventListener('click', async () => {
    showScreen(gameSetup!, true);
    player2AliasInput.value = '';

    const user = await getCurrentUser();
    if (user) {
      setState({ loggedInUserAlias: user.alias });
      player1AliasInput.value = user.alias;
      player1AliasInput.disabled = true;
      player1AliasInput.classList.add('bg-gray-100', 'cursor-not-allowed');
      player2AliasInput.focus();
    } else {
      setState({ loggedInUserAlias: null });
      player1AliasInput.value = '';
      player1AliasInput.disabled = false;
      player1AliasInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
      player1AliasInput.focus();
    }
  });

  // Event: Local GameVersusBot button
  gameVersusBotBtn?.addEventListener('click', async () => {
    const user = await getCurrentUser();
    setState({ loggedInUserAlias: user?.alias || null });
    showScreen(gameBotSetup!, true);
  });

  // Event: Tournament button
  tournamentBtn?.addEventListener('click', async () => {
    const tm = new TournamentManager();
    setState({ tournamentManager: tm });
    syncTournamentToModule();

    const user = await getCurrentUser();
    if (user) {
      setState({ loggedInUserAlias: user.alias });
      tm.addPlayer(user.alias);
      const players = tm.getTournament().players;
      setState({ loggedInUserId: players.length > 0 ? players[0].id : null });
    } else {
      setState({ loggedInUserAlias: null, loggedInUserId: null });
    }

    updateTournamentUI();
    showTournamentPhase('registration');
    showScreen(tournamentScreen!, true);
    tournamentPlayerAliasInput?.focus();
  });

  // Event: Add tournament player
  const handleAddPlayer = () => {
    const state = getState();
    if (!state.tournamentManager || !tournamentPlayerAliasInput) return;

    const alias = tournamentPlayerAliasInput.value.trim();

    hideInlineError(tournamentErrorEl);

    if (alias === '') {
      showInlineError(tournamentErrorEl, 'Please enter a player alias');
      return;
    }

    const validation = validatePlayerAlias(alias);
    if (!validation.valid) {
      showInlineError(tournamentErrorEl, validation.error || 'Invalid alias');
      return;
    }

    if (state.tournamentManager.addPlayer(alias)) {
      tournamentPlayerAliasInput.value = '';
      hideInlineError(tournamentErrorEl);
      updateTournamentUI();
      tournamentPlayerAliasInput.focus();
      toast.success(t('play.local.tournament.registration.added.msg', { alias }));
    } else {
      if (!state.tournamentManager.canAddPlayers()) {
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
    const state = getState();
    if (!state.tournamentManager) return;

    if (state.tournamentManager.startTournament()) {
      syncTournamentToModule();
      showTournamentPhase('bracket');
      window.history.pushState(
        { page: 'play', playScreen: 'tournament-bracket' },
        '',
        window.location.href
      );
      renderTournamentBracket();
      startNextTournamentMatch();
      toast.success(t('friends.start.tournament.toast.success'));
    } else {
      toast.error(t('friends.start.tournament.toast.error'));
    }
  });

  // Event: Back to mode selection (from local game setup)
  backToModeBtn?.addEventListener('click', () => {
    window.history.back();
  });

  // Event: Back to mode selection (from bot game setup)
  backToModeFromBotBtn?.addEventListener('click', () => {
    window.history.back();
  });

  backFromTournamentBtn?.addEventListener('click', () => {
    const state = getState();
    if (state.currentGame) {
      state.currentGame.destroy();
      setState({ currentGame: null });
    }

    window.history.back();
    setState({ tournamentManager: null });
    syncTournamentToModule();
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
      const state = getState();
      if (state.currentGame) {
        state.currentGame.destroy();
        setState({ currentGame: null });
      }

      showScreen(modeSelection!);
      window.history.replaceState({ page: 'play' }, '', window.location.href);
      setState({ tournamentManager: null });
      syncTournamentToModule();
      toast.info(t('play.local.tournament.ended'));
    }
  });

  // ============================================
  // Event: Start 1v1 game
  // ============================================
  startGameBtn?.addEventListener('click', () => {
    setState({ lastGameMode: 'local' });
    let player1 = player1AliasInput.value.trim();
    let player2 = player2AliasInput.value.trim();

    hideInlineError(player1ErrorEl);
    hideInlineError(player2ErrorEl);

    if (player1 !== '') {
      const validation = validatePlayerAlias(player1);
      if (!validation.valid) {
        showInlineError(player1ErrorEl, validation.error || 'Invalid alias');
        return;
      }
    } else {
      player1 = t('play.player1.default.label');
    }

    if (player2 !== '') {
      const validation = validatePlayerAlias(player2);
      if (!validation.valid) {
        showInlineError(player2ErrorEl, validation.error || 'Invalid alias');
        return;
      }
    } else {
      player2 = t('play.player2.default.label');
    }

    if (player1 === player2) {
      showInlineError(player2ErrorEl, 'Both players cannot have the same name');
      return;
    }

    const state = getState();
    if (state.currentGame) {
      state.currentGame.destroy();
    }

    const currentGame = new PongGame(canvas, player1, player2);
    setState({ currentGame });

    currentGame.setOnGameEnd((winner, score1, score2) => {
      void recordLocalMatch('LOCAL_1V1', player1, player2, score1, score2);

      setTimeout(() => {
        showResultScreen(winner, player1, player2, score1, score2);
      }, GAME_END_DELAY_MS);
    });

    showScreen(gameScreen!);
    currentGame.start();
    setModuleCurrentGame(currentGame);
  });

  // ============================================
  // Local Game Vs Bot
  // ============================================
  let selectedBotLevel: BotLevel = BotLevel.LEVEL_1;
  const availableLevels = Object.values(BotLevel);
  const getBotBtn = (level: number) => document.getElementById(`botlvl-${level}-btn`);

  function updateBotLevelSelection() {
    availableLevels.forEach((level) => {
      const btn = getBotBtn(level);
      if (!btn) return;

      if (level === selectedBotLevel) {
        btn.classList.remove('bg-gray-200');
        btn.classList.add('bg-gray-400');
      } else {
        btn.classList.remove('bg-gray-400');
        btn.classList.add('bg-gray-200');
      }
    });
  }

  availableLevels.forEach((level) => {
    const btn = getBotBtn(level);
    if (btn) {
      btn.addEventListener('click', () => {
        selectedBotLevel = level;
        updateBotLevelSelection();
      });
    }
  });

  updateBotLevelSelection();

  // Event: Start game vs Bot
  startBotGameBtn?.addEventListener('click', () => {
    setState({ lastGameMode: 'bot' });
    const state = getState();
    const player1 = state.loggedInUserAlias || 'Player';
    const botName = `Bot (Lvl ${selectedBotLevel})`;

    if (state.currentGame) {
      state.currentGame.destroy();
    }

    const currentGame = new BotPongGame(canvas, player1, selectedBotLevel);
    setState({ currentGame });

    currentGame.setOnGameEnd((winner, score1, score2) => {
      void recordLocalMatch('VS_BOT', player1, botName, score1, score2);

      setTimeout(() => {
        showResultScreen(winner, player1, botName, score1, score2);
      }, GAME_END_DELAY_MS);
    });

    showScreen(gameScreen!);
    currentGame.start();
    setModuleCurrentGame(currentGame);
  });

  // ============================================
  // Shared game events (used by local, bot, and tournament)
  // ============================================

  // Event: End game early
  endGameBtn?.addEventListener('click', () => {
    const state = getState();
    if (state.currentGame) {
      state.currentGame.destroy();
      setState({ currentGame: null });
      setModuleCurrentGame(null);
    }

    if (
      state.tournamentManager &&
      state.tournamentManager.getTournament().status === 'in-progress'
    ) {
      if (tournamentBracket) tournamentBracket.classList.remove('hidden');
      if (gameScreen) gameScreen.classList.add('hidden');
      showScreen(tournamentScreen!);
    } else {
      showScreen(modeSelection!);
      window.history.replaceState({ page: 'play' }, '', window.location.href);
    }
  });

  // Event: Play again
  playAgainBtn?.addEventListener('click', () => {
    const state = getState();
    if (state.lastGameMode === 'bot') {
      showScreen(gameBotSetup!);
    } else {
      showScreen(gameSetup!);
      player1AliasInput.focus();
    }
  });

  // Event: Back to menu from results
  backToMenuBtn?.addEventListener('click', () => {
    const state = getState();
    if (state.currentGame) {
      state.currentGame.destroy();
      setState({ currentGame: null });
    }
    showScreen(modeSelection!);
    window.history.replaceState({ page: 'play' }, '', window.location.href);
  });

  // Event delegation for dynamically created buttons in tournament
  tournamentCurrentMatch?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.id === 'playMatchBtn') {
      const state = getState();
      const match = state.tournamentManager?.getCurrentMatch();
      if (match) {
        startMatchGame(match);
      }
    }

    if (target.id === 'newTournamentBtn') {
      resetTournament();
    }
  });

  // Event delegation for remove player buttons
  tournamentPlayersList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains('remove-player-btn')) {
      const state = getState();
      const playerId = parseInt(target.dataset.playerId || '0');
      if (state.tournamentManager && state.tournamentManager.removePlayer(playerId)) {
        updateTournamentUI();
      }
    }
  });
}
