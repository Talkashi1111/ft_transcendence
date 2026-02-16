import { PongGame } from '../game/pong';
import { BotPongGame } from '../game/bot-pong';
import { RemotePongGame } from '../game/remote-pong';
import { TournamentManager } from '../game/tournament';
import type { TournamentMatch } from '../types/tournament';
import type { Match } from '../types/game';
import { toast } from '../utils/toast';
import { showConfirmModal } from '../utils/modal';
import { escapeHtml } from '../utils/sanitize';
import { isAuthenticated, getCurrentUser } from '../utils/auth';
import { getWebSocketManager } from '../utils/websocket';
import type { AvailableMatch } from '../utils/websocket';
import { t } from '../i18n/i18n';
import { BotLevel } from '../types/game';

// ============================================
// Shared state & types
// ============================================

/**
 * Mutable state shared between play-local and play-remote via the PlayContext.
 */
export interface PlayState {
	lastGameMode: 'local' | 'bot';
	currentGame: PongGame | null;
	remoteGame: RemotePongGame | null;
	tournamentManager: TournamentManager | null;
	matchListUnsubscribe: (() => void) | null;
	loggedInUserAlias: string | null;
	loggedInUserId: number | null;
	isInActiveRemoteGame: boolean;
}

/**
 * The shared "toolbox" passed to each sub-module so they can access
 * shared DOM refs, helpers, and mutable state.
 */
export interface PlayContext {
	// State accessors
	getState: () => PlayState;
	setState: (partial: Partial<PlayState>) => void;

	// Shared UI helpers
	showScreen: (screen: HTMLElement, pushHistory?: boolean) => void;
	showResultScreen: (
		winner: string,
		player1: string,
		player2: string,
		score1: number,
		score2: number,
		isRemoteGame?: boolean
	) => void;

	// Shared DOM refs (screens)
	modeSelection: HTMLElement | null;
	gameSetup: HTMLElement | null;
	gameBotSetup: HTMLElement | null;
	gameScreen: HTMLElement | null;
	resultScreen: HTMLElement | null;
	tournamentScreen: HTMLElement | null;
	tournamentRegistration: HTMLElement | null;
	tournamentBracket: HTMLElement | null;
	remoteWaitingScreen: HTMLElement | null;
	joinMatchScreen: HTMLElement | null;
	remoteGameScreen: HTMLElement | null;
	canvas: HTMLCanvasElement;

	// Callback for remote module to react to screen changes
	onScreenChange?: (screenId: string) => void;
}

// Constants
const GAME_END_DELAY_MS = 2000; // Delay before showing result screen after game ends

// Store cleanup function for page navigation
let pageCleanup: (() => void) | null = null;
let isInActiveRemoteGame = false;

// Track current play screen for i18n rerender logic
let lastPlayScreenId = 'mode-selection';
let playNeedsRerenderAfterGame = false;
let lastWinnerName = ''; // Store winner name for language change re-translation

function requestPlayRerenderIfNeeded(): void {
	if (!playNeedsRerenderAfterGame) return;
	playNeedsRerenderAfterGame = false;
	window.dispatchEvent(new CustomEvent('play:rerender'));
}

export function markPlayNeedsRerenderAfterGame(): void {
	playNeedsRerenderAfterGame = true;
}

export function isPlayInNoRerenderScreen(): boolean {
	// Don't rerender during active games, setup screens, or waiting/join screens (to preserve user input)
	return (
		lastPlayScreenId === 'game-screen' ||
		lastPlayScreenId === 'result-screen' ||
		lastPlayScreenId === 'remote-game-screen' ||
		lastPlayScreenId === 'game-setup' ||
		lastPlayScreenId === 'bot-game-setup' ||
		lastPlayScreenId === 'join-match-screen' ||
		lastPlayScreenId === 'remote-waiting-screen' ||
		lastPlayScreenId === 'tournament-screen'
	);
}

// Updates language strings on screen during a game or setup
export function applyPlayInGameTranslations(): void {
	// Game screen translations
	const endBtn = document.getElementById('end-game-btn');
	if (endBtn) endBtn.textContent = t('play.endgame.button');

	// Result screen translations (always update these elements when they exist)
	const gameOverTitle = document.getElementById('gameover-title');
	if (gameOverTitle) gameOverTitle.textContent = t('play.gameover.title');

	const winnerNameEl = document.getElementById('winner-name');
	if (winnerNameEl && lastWinnerName) {
		winnerNameEl.textContent = t('play.gameover.winner', { winner: lastWinnerName });
	}

	const player1Label = document.getElementById('result-player1');
	if (player1Label) player1Label.textContent = t('play.player1.label');

	const player2Label = document.getElementById('result-player2');
	if (player2Label) player2Label.textContent = t('play.player2.label');

	const backBtn = document.getElementById('back-to-menu-btn');
	if (backBtn) backBtn.textContent = t('play.gameover.backtomenu.button');

	const playAgain = document.getElementById('play-again-btn');
	if (playAgain) playAgain.textContent = t('play.gameover.playagain.button');

	const leaveRemote = document.getElementById('leave-remote-game-btn');
	if (leaveRemote) leaveRemote.textContent = t('play.remote.leavegame.button');

	// Game setup (1v1) translations
	const gameSetup = document.getElementById('game-setup');
	if (gameSetup && !gameSetup.classList.contains('hidden')) {
		const title = gameSetup.querySelector('h3');
		if (title) title.textContent = t('play.game_setup.title');

		const labels = gameSetup.querySelectorAll('label');
		if (labels[0]) labels[0].textContent = t('play.game_setup.player1.alias.label');
		if (labels[1]) labels[1].textContent = t('play.game_setup.player2.alias.label');

		const player1Input = document.getElementById('player1-alias') as HTMLInputElement | null;
		if (player1Input) player1Input.placeholder = t('play.game_setup.player1.alias.placeholder');

		const player2Input = document.getElementById('player2-alias') as HTMLInputElement | null;
		if (player2Input) player2Input.placeholder = t('play.game_setup.player2.alias.placeholder');

		const controlsTitle = gameSetup.querySelector('.bg-blue-50 h4');
		if (controlsTitle) controlsTitle.textContent = t('play.game_setup.controls.label');

		// Update control instructions
		const controlsBox = gameSetup.querySelector('.bg-blue-50');
		if (controlsBox) {
			const controlParagraphs = controlsBox.querySelectorAll('p');
			if (controlParagraphs[0]) {
				controlParagraphs[0].innerHTML = `<strong>${t('play.game_setup.controls.player1.key')}</strong> ${t('play.game_setup.controls.player1.value')}`;
			}
			if (controlParagraphs[1]) {
				controlParagraphs[1].innerHTML = `<strong>${t('play.game_setup.controls.player2.key')}</strong> ${t('play.game_setup.controls.player2.value')}`;
			}
			if (controlParagraphs[2]) {
				controlParagraphs[2].innerHTML = `<strong>${t('play.game_setup.controls.pause.key')}</strong> ${t('play.game_setup.controls.pause.value')}`;
			}
		}

		const startBtn = document.getElementById('start-game-btn');
		if (startBtn) startBtn.textContent = t('play.game_setup.button.start');

		const backToModeBtn = document.getElementById('back-to-mode-btn');
		if (backToModeBtn) backToModeBtn.textContent = t('play.game_setup.button.back');
	}

	// Bot game setup translations
	const botSetup = document.getElementById('bot-game-setup');
	if (botSetup && !botSetup.classList.contains('hidden')) {
		const title = botSetup.querySelector('h3');
		if (title) title.textContent = t('play.local.1vbot.title');

		const difficultyLabel = botSetup.querySelector('.block.text-sm');
		if (difficultyLabel) difficultyLabel.textContent = t('play.local.1vbot.text');

		const btn1 = document.getElementById('botlvl-1-btn');
		const btn2 = document.getElementById('botlvl-2-btn');
		const btn3 = document.getElementById('botlvl-3-btn');
		const btn4 = document.getElementById('botlvl-4-btn');
		if (btn1) btn1.textContent = t('play.local.1vbot.paw');
		if (btn2) btn2.textContent = t('play.local.1vbot.tracky');
		if (btn3) btn3.textContent = t('play.local.1vbot.human');
		if (btn4) btn4.textContent = t('play.local.1vbot.god');

		const controlsTitle = botSetup.querySelector('.bg-blue-50 h4');
		if (controlsTitle) controlsTitle.textContent = t('play.local.1vbot.controls');

		// Update control instructions
		const controlsBox = botSetup.querySelector('.bg-blue-50');
		if (controlsBox) {
			const controlParagraphs = controlsBox.querySelectorAll('p');
			if (controlParagraphs[0]) {
				controlParagraphs[0].innerHTML = `<strong>${t('play.local.1vbot.controls.up.label')}</strong>${t('play.local.1vbot.controls.up')}`;
			}
			if (controlParagraphs[1]) {
				controlParagraphs[1].innerHTML = `<strong>${t('play.local.1vbot.controls.down.label')}</strong>${t('play.local.1vbot.controls.down')}`;
			}
			if (controlParagraphs[2]) {
				controlParagraphs[2].innerHTML = `<strong>${t('play.local.1vbot.controls.pause.label')}</strong>${t('play.local.1vbot.controls.pause')}`;
			}
		}

		const startBotBtn = document.getElementById('start-bot-game-btn');
		if (startBotBtn) startBotBtn.textContent = t('play.local.1vbot.start.button');

		const backFromBotBtn = document.getElementById('back-to-mode-from-bot-btn');
		if (backFromBotBtn) backFromBotBtn.textContent = t('play.local.1vbot.back.button');
	}

	// Join match screen translations
	const joinMatchScreen = document.getElementById('join-match-screen');
	if (joinMatchScreen && !joinMatchScreen.classList.contains('hidden')) {
		const title = joinMatchScreen.querySelector('h3');
		if (title) title.textContent = t('play.remote.join.match.title');

		const matchIdLabel = joinMatchScreen.querySelector('label[for="match-id-input"]');
		if (matchIdLabel) matchIdLabel.textContent = t('play.remote.matchID.label');

		const matchIdInput = document.getElementById('match-id-input') as HTMLInputElement | null;
		if (matchIdInput) matchIdInput.placeholder = t('play.remote.matchID.placeholder');

		const confirmBtn = document.getElementById('confirm-join-btn');
		if (confirmBtn) confirmBtn.textContent = t('play.remote.join.match.confirm.button');

		const cancelBtn = document.getElementById('cancel-join-btn');
		if (cancelBtn) cancelBtn.textContent = t('play.remote.join.match.cancel.button');

		const availableTitle = joinMatchScreen.querySelector('.border-t h4');
		if (availableTitle) availableTitle.textContent = t('play.remote.available.matches.title');

		const refreshBtn = document.getElementById('refresh-matches-btn');
		if (refreshBtn) refreshBtn.textContent = t('play.remote.available.matches.refresh.button');

		// Update empty matches text if shown
		const availableMatchesList = document.getElementById('available-matches-list');
		if (availableMatchesList) {
			const emptyText = availableMatchesList.querySelector('p.text-gray-500');
			if (emptyText && availableMatchesList.children.length === 1) {
				emptyText.textContent = t('play.remote.available.matches.empty');
			}
		}
	}

	// Remote waiting screen translations
	const remoteWaitingScreen = document.getElementById('remote-waiting-screen');
	if (remoteWaitingScreen && !remoteWaitingScreen.classList.contains('hidden')) {
		const title = document.getElementById('remote-waiting-title');
		if (title) title.textContent = t('play.remote.waiting.room.title');

		const status = document.getElementById('remote-waiting-status');
		if (status) status.textContent = t('play.remote.waiting.room.status');

		const controlsTitle = remoteWaitingScreen.querySelector('.bg-blue-50 h4');
		if (controlsTitle) controlsTitle.textContent = t('play.remote.waiting.room.controls.title');

		const controlsBox = remoteWaitingScreen.querySelector('.bg-blue-50');
		if (controlsBox) {
			const controlParagraphs = controlsBox.querySelectorAll('p');
			if (controlParagraphs[0]) {
				controlParagraphs[0].innerHTML = `<strong>${t('play.remote.waiting.room.controls.up.label')}</strong> ${t('play.remote.waiting.room.controls.up.value')}`;
			}
			if (controlParagraphs[1]) {
				controlParagraphs[1].innerHTML = `<strong>${t('play.remote.waiting.room.controls.down.label')}</strong> ${t('play.remote.waiting.room.controls.down.value')}`;
			}
		}

		const cancelBtn = document.getElementById('cancel-remote-btn');
		if (cancelBtn) cancelBtn.textContent = t('play.remote.waiting.room.cancel.button');
	}

	// Tournament registration screen translations
	const tournamentRegistration = document.getElementById('tournament-registration');
	if (tournamentRegistration && !tournamentRegistration.classList.contains('hidden')) {
		const title = tournamentRegistration.querySelector('h3');
		if (title) title.textContent = t('play.local.tournament.registration.title');

		const desc = tournamentRegistration.querySelector('p.text-gray-600');
		if (desc) desc.textContent = t('play.local.tournament.registration.text');

		const aliasInput = document.getElementById(
			'tournament-player-alias'
		) as HTMLInputElement | null;
		if (aliasInput) aliasInput.placeholder = t('play.local.tournament.registration.placeholder');

		const addBtn = document.getElementById('add-tournament-player-btn');
		if (addBtn) addBtn.textContent = t('play.local.tournament.registration.addplayer.button');

		const startBtn = document.getElementById('start-tournament-btn');
		if (startBtn)
			startBtn.textContent = t('play.local.tournament.registration.starttournament.button');

		const backBtn = document.getElementById('back-from-tournament-btn');
		if (backBtn) backBtn.textContent = t('play.local.tournament.registration.backtomenu.button');

		// Update the "/ 8 players" label
		const playersLabel = document.getElementById('tournament-players-label');
		if (playersLabel)
			playersLabel.textContent = ` / 8 ${t('play.local.tournament.registration.players')}`;

		// Update status message based on current player count
		const statusMessage = document.getElementById('tournament-status-message');
		const playerCountEl = document.getElementById('tournament-player-count');
		if (statusMessage && playerCountEl) {
			const playerCount = parseInt(playerCountEl.textContent || '0', 10);
			if (playerCount === 0) {
				statusMessage.textContent = t('play.local.tournament.registration.smalltext');
			} else if (playerCount === 1) {
				statusMessage.textContent = t('play.local.tournament.registration.smalltext.onemore');
			} else if (playerCount < 8) {
				const remaining = 8 - playerCount;
				statusMessage.textContent = t('play.local.tournament.registration.smalltext.ready', {
					remaining,
				});
			} else {
				statusMessage.textContent = t('play.local.tournament.registration.smalltext.full');
			}
		}

		// Update "(you)" text and remove button in player list
		const playersList = document.getElementById('tournament-players-list');
		if (playersList) {
			const youLabels = playersList.querySelectorAll('.text-blue-600');
			youLabels.forEach((label) => {
				label.textContent = t('play.local.tournament.registration.you');
			});
			const removeButtons = playersList.querySelectorAll('.remove-player-btn');
			removeButtons.forEach((btn) => {
				btn.textContent = t('play.local.tournament.registration.remove.button');
			});
		}
	}

	// Tournament bracket screen translations
	const tournamentBracket = document.getElementById('tournament-bracket');
	if (tournamentBracket && !tournamentBracket.classList.contains('hidden')) {
		const title = tournamentBracket.querySelector('h3');
		if (title) title.textContent = t('play.local.tournament.bracket.title');

		const endBtn = document.getElementById('end-tournament-btn');
		if (endBtn) endBtn.textContent = t('play.local.tournament.bracket.end.button');
	}
}

export function resetPlayUIState(): void {
	lastPlayScreenId = 'mode-selection';
	playNeedsRerenderAfterGame = false;
}

// Module-level tournament state for popstate handler
let moduleTournamentManager: TournamentManager | null = null;
let moduleCurrentGame: PongGame | null = null;

// Function to update module-level refs (called from setupPlayPageEvents)
export function setModuleTournamentManager(tm: TournamentManager | null): void {
	moduleTournamentManager = tm;
}

export function setModuleCurrentGame(game: PongGame | null): void {
	moduleCurrentGame = game;
}

// Module-level popstate handler for tournament back confirmation
let tournamentPopstateRegistered = false;

async function handleTournamentPopstate(event: PopStateEvent): Promise<void> {
	// Only handle if tournament is in progress
	if (moduleTournamentManager && moduleTournamentManager.getTournament().status === 'in-progress') {
		// Prevent main.ts from handling this event
		event.stopImmediatePropagation();

		// User pressed back while tournament is in progress
		// Push the state back to prevent navigation
		window.history.pushState(
			{ page: 'play', playScreen: 'tournament-bracket' },
			'',
			window.location.href
		);

		// Show confirmation modal
		const confirmed = await showConfirmModal({
			title: 'Leave Tournament?',
			message:
				'The tournament is in progress. Are you sure you want to leave? All progress will be lost.',
			confirmText: 'Leave Tournament',
			cancelText: 'Stay',
			isDangerous: true,
		});

		if (confirmed) {
			// Clean up any running game
			if (moduleCurrentGame) {
				moduleCurrentGame.destroy();
				moduleCurrentGame = null;
			}

			// Reset tournament
			moduleTournamentManager = null;

			// Re-enable language selectors
			setLanguageSelectorsEnabledGlobal(true);

			// Hide all play sub-screens and show mode selection
			const modeSelection = document.getElementById('mode-selection');
			const tournamentScreen = document.getElementById('tournament-screen');
			const gameScreen = document.getElementById('game-screen');
			if (gameScreen) gameScreen.classList.add('hidden');
			if (tournamentScreen) tournamentScreen.classList.add('hidden');
			if (modeSelection) modeSelection.classList.remove('hidden');

			// Replace current state so back goes to previous page
			window.history.replaceState(
				{ page: 'play', playScreen: 'mode-selection' },
				'',
				window.location.href
			);
			toast.info(t('play.local.tournament.ended'));
		}
	}
}

// Register the handler once at module load (capture phase to run before main.ts)
function ensureTournamentPopstateHandler(): void {
	if (!tournamentPopstateRegistered) {
		window.addEventListener('popstate', handleTournamentPopstate, true);
		tournamentPopstateRegistered = true;
	}
}

// Call immediately when module loads
ensureTournamentPopstateHandler();

/**
 * Helper to enable/disable language selectors (module-level for use in popstate handler)
 */
function setLanguageSelectorsEnabledGlobal(enabled: boolean): void {
	const selectors = [
		document.getElementById('nav-lang'),
		document.getElementById('nav-lang-mobile'),
	];
	selectors.forEach((el) => {
		if (el) {
			if (enabled) {
				(el as HTMLSelectElement).disabled = false;
				el.classList.remove('opacity-50', 'cursor-not-allowed');
				el.title = '';
			} else {
				(el as HTMLSelectElement).disabled = true;
				el.classList.add('opacity-50', 'cursor-not-allowed');
				el.title = 'Language change disabled during game';
			}
		}
	});
}

/**
 * Check if user is in an active remote game
 */
export function hasActiveRemoteGame(): boolean {
	return isInActiveRemoteGame;
}

/**
 * Pause any active local game (used when session is replaced by another tab)
 */
export function pauseLocalGame(): void {
	if (moduleCurrentGame) {
		moduleCurrentGame.pause();
	}
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
                ${t('play.local.local1v1.button')}
              </button>
              <button id="bot-opponent-btn" class="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold">
                ${t('play.local.1vbot.button')}
              </button>
              <button id="tournament-btn" class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold">
                ${t('play.local.tournament.button')}
              </button>
            </div>
          </div>

          <!-- Remote Games (Login Required) -->
          <div>
            <h3 class="text-lg font-semibold text-gray-700 mb-3">${t('play.remote.label')}</h3>
            <div class="flex gap-4">
              <button id="remote-quickmatch-btn" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed">
                ${t('play.remote.quickmatch.button')}
              </button>
              <button id="remote-create-btn" class="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed">
                ${t('play.remote.create.button')}
              </button>
              <button id="remote-join-btn" class="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed">
                ${t('play.remote.join.button')}
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

        <!-- Game Setup Screen VS Bot -->
        <div id="bot-game-setup" class="hidden">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <h3 class="text-2xl font-bold text-gray-900 mb-6">${t('play.local.1vbot.title')}</h3>
            <div class="space-y-4">

              <div>
                <div class="block text-sm font-medium text-gray-700 mb-2">
                  ${t('play.local.1vbot.text')}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4">
                  <button id="botlvl-1-btn" class="bg-gray-200 p-2 border border-gray-300 hover:bg-gray-400 transition">${t('play.local.1vbot.paw')}</button>
                  <button id="botlvl-2-btn" class="bg-gray-200 p-2 border border-gray-300 hover:bg-gray-400 transition">${t('play.local.1vbot.tracky')}</button>
                  <button id="botlvl-3-btn" class="bg-gray-200 p-2 border border-gray-300 hover:bg-gray-400 transition">${t('play.local.1vbot.human')}</button>
                  <button id="botlvl-4-btn" class="bg-gray-200 p-2 border border-gray-300 hover:bg-gray-400 transition">${t('play.local.1vbot.god')}</button>
                </div>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-semibold text-blue-900 mb-2">${t('play.local.1vbot.controls')}</h4>
                <div class="text-sm text-blue-800 space-y-1">
                  <p><strong>${t('play.local.1vbot.controls.up.label')}</strong>${t('play.local.1vbot.controls.up')}</p>
                  <p><strong>${t('play.local.1vbot.controls.down.label')}</strong>${t('play.local.1vbot.controls.down')}</p>
                  <p><strong>${t('play.local.1vbot.controls.pause.label')}</strong>${t('play.local.1vbot.controls.pause')}</p>
                </div>
              </div>

              <div class="flex gap-4">
                <button id="start-bot-game-btn" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
                  ${t('play.local.1vbot.start.button')}
                </button>
                <button id="back-to-mode-from-bot-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                  ${t('play.local.1vbot.back.button')}
                </button>
              </div>

            </div>
          </div>
        </div>

        <!-- Game Setup Screen VS Bot -->
        <div id="bot-game-setup" class="hidden">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <h3 class="text-2xl font-bold text-gray-900 mb-6">Game Setup Versus Bot</h3>
            <div class="space-y-4">

              <div>
                <div class="block text-sm font-medium text-gray-700 mb-2">
                  ${t('play.local.1vbot.hidden.text')}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4">
                  <button id="botlvl-1-btn" class="bg-gray-200 p-2 border border-gray-300 hover:bg-gray-400 transition">${t('play.local.1vbot.hidden.paw')}</button>
                  <button id="botlvl-2-btn" class="bg-gray-200 p-2 border border-gray-300 hover:bg-gray-400 transition">${t('play.local.1vbot.hidden.tracky')}</button>
                  <button id="botlvl-3-btn" class="bg-gray-200 p-2 border border-gray-300 hover:bg-gray-400 transition">${t('play.local.1vbot.hidden.human')}</button>
                  <button id="botlvl-4-btn" class="bg-gray-200 p-2 border border-gray-300 hover:bg-gray-400 transition">${t('play.local.1vbot.hidden.god')}</button>
                </div>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-semibold text-blue-900 mb-2">Controls:</h4>
                <div class="text-sm text-blue-800 space-y-1">
                  <p><strong>Up:</strong> W or ↑</p>
                  <p><strong>Down:</strong> S or ↓</p>
                  <p><strong>Pause:</strong> SPACE or ESC</p>
                </div>
              </div>

              <div class="flex gap-4">
                <button id="start-bot-game-btn" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
                  ${t('play.local.1vbot.hidden.start.button')}
                </button>
                <button id="back-to-mode-from-bot-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                  ${t('play.local.1vbot.hidden.back.button')}
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
            <h3 id="gameover-title" class="text-3xl font-bold text-gray-900 mb-4">${t('play.gameover.title')}</h3>

            <div class="mb-6">
              <p class="text-5xl font-bold text-blue-600 mb-4" id="winner-name" style="white-space: pre-wrap;">Winner</p>
              <div class="flex justify-center gap-8 text-2xl">
                <div>
                  <p class="text-gray-600" id="result-player1" style="white-space: pre-wrap;">${t('play.player1.label')}</p>
                  <p class="font-bold text-gray-900" id="result-score1">0</p>
                </div>
                <div class="text-gray-400">-</div>
                <div>
                  <p class="text-gray-600" id="result-player2" style="white-space: pre-wrap;">${t('play.player2.label')}</p>
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
                ${t('play.remote.waiting.room.cancel.button')}
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
                  ${t('play.remote.matchID.label')}
                </label>
                <input
                  type="text"
                  id="match-id-input"
                  placeholder="${t('play.remote.matchID.placeholder')}"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <span id="join-match-error" class="text-red-600 text-sm mt-1 hidden"></span>
              </div>

              <div class="flex gap-4">
                <button id="confirm-join-btn" class="flex-1 px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-semibold">
                  ${t('play.remote.join.match.confirm.button')}
                </button>
                <button id="cancel-join-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                  ${t('play.remote.join.match.cancel.button')}
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
                ${t('play.remote.available.matches.refresh.button')}
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
                ${t('play.remote.leavegame.button')}
              </button>
            </div>
          </div>
        </div>

        <!-- Tournament Screen -->
        <div id="tournament-screen" class="hidden">
          <!-- Registration Phase -->
          <div id="tournament-registration" class="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
            <h3 class="text-2xl font-bold text-gray-900 mb-4">${t('play.local.tournament.registration.title')}</h3>
            <p class="text-gray-600 mb-6">${t('play.local.tournament.registration.text')}</p>

            <div class="mb-6">
              <div class="flex gap-2 mb-4">
                <input
                  type="text"
                  id="tournament-player-alias"
                  placeholder="${t('play.local.tournament.registration.placeholder')}"
                  maxlength="20"
                  class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button id="add-tournament-player-btn" class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold">
                  ${t('play.local.tournament.registration.addplayer.button')}
                </button>
              </div>
              <span id="tournament-error" class="text-red-600 text-sm mt-1 hidden"></span>

              <!-- Players List -->
              <div id="tournament-players-list" class="space-y-2 mb-4 min-h-[100px]">
                <!-- Players will be added here dynamically -->
              </div>

              <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span class="text-gray-700">
                  <span id="tournament-player-count" class="font-bold text-purple-600">0</span><span id="tournament-players-label"> / 8 ${t('play.local.tournament.registration.players')}</span>
                </span>
                <span id="tournament-status-message" class="text-sm text-gray-500">${t('play.local.tournament.registration.smalltext')}</span>
              </div>
            </div>

            <div class="flex gap-4">
              <button id="start-tournament-btn" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed" disabled>
                ${t('play.local.tournament.registration.starttournament.button')}
              </button>
              <button id="back-from-tournament-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                ${t('play.local.tournament.registration.backtomenu.button')}
              </button>
            </div>
          </div>

          <!-- Bracket Phase -->
          <div id="tournament-bracket" class="hidden">
            <div class="max-w-6xl mx-auto">
              <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold text-gray-900">${t('play.local.tournament.bracket.title')}</h3>
                <button id="end-tournament-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">
                  ${t('play.local.tournament.bracket.end.button')}
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
	let lastGameMode: 'local' | 'bot' = 'local';
	let currentGame: PongGame | null = null;
	let remoteGame: RemotePongGame | null = null;
	let tournamentManager: TournamentManager | null = null;
	let matchListUnsubscribe: (() => void) | null = null;
	let loggedInUserAlias: string | null = null;
	let loggedInUserId: number | null = null; // Track first player ID for tournament

	// Helper to sync local tournamentManager to module level for popstate handler
	function syncTournamentToModule(): void {
		setModuleTournamentManager(tournamentManager);
		// Also sync current game for cleanup
		setModuleCurrentGame(currentGame);
	}

	// Set up page cleanup function for when user navigates away
	pageCleanup = () => {
		// Clear module-level refs
		setModuleTournamentManager(null);
		setModuleCurrentGame(null);
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
	const gameVersusBotBtn = document.getElementById('bot-opponent-btn');
	const tournamentBtn = document.getElementById('tournament-btn');

	// Remote game buttons
	const remoteQuickmatchBtn = document.getElementById('remote-quickmatch-btn');
	const remoteCreateBtn = document.getElementById('remote-create-btn');
	const remoteJoinBtn = document.getElementById('remote-join-btn');
	const remoteLoginHint = document.getElementById('remote-login-hint');

	// Screens
	const modeSelection = document.getElementById('mode-selection');
	const gameSetup = document.getElementById('game-setup');
	const gameBotSetup = document.getElementById('bot-game-setup');
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

	// Setup bot game screen elements
	const startBotGameBtn = document.getElementById('start-bot-game-btn');
	const backToModeFromBotBtn = document.getElementById('back-to-mode-from-bot-btn');

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
		// Only record if user is logged in
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

	// Get current screen ID for history state
	function getScreenId(screen: HTMLElement | null): string | null {
		if (!screen) return null;
		if (screen === modeSelection) return 'mode-selection';
		if (screen === gameSetup) return 'game-setup';
		if (screen === gameBotSetup) return 'bot-game-setup';
		if (screen === gameScreen) return 'game-screen';
		if (screen === resultScreen) return 'result-screen';
		if (screen === tournamentScreen) return 'tournament-screen';
		if (screen === remoteWaitingScreen) return 'remote-waiting-screen';
		if (screen === joinMatchScreen) return 'join-match-screen';
		if (screen === remoteGameScreen) return 'remote-game-screen';
		return null;
	}

	// Show a screen and optionally push history state
	function showScreen(screen: HTMLElement, pushHistory = false): void {
		modeSelection?.classList.add('hidden');
		gameSetup?.classList.add('hidden');
		gameBotSetup?.classList.add('hidden');
		gameScreen?.classList.add('hidden');
		resultScreen?.classList.add('hidden');
		tournamentScreen?.classList.add('hidden');
		remoteWaitingScreen?.classList.add('hidden');
		joinMatchScreen?.classList.add('hidden');
		remoteGameScreen?.classList.add('hidden');
		screen.classList.remove('hidden');

		// Track current screen for i18n rerender logic
		const screenId = getScreenId(screen);
		if (screenId) lastPlayScreenId = screenId;

		// Check if we need to re-render after a game
		if (screen === modeSelection) {
			requestPlayRerenderIfNeeded();
		}

		// Subscribe to match list updates when join screen is visible
		if (screen === joinMatchScreen) {
			startMatchListSubscription();
		} else {
			stopMatchListSubscription();
		}

		// Push history state for setup screens (not for game/result screens)
		if (
			pushHistory &&
			screen !== modeSelection &&
			screen !== gameScreen &&
			screen !== resultScreen
		) {
			if (screenId) {
				window.history.pushState({ page: 'play', playScreen: screenId }, '', window.location.href);
			}
		}
	}

	// NOTE: Browser back navigation for play sub-screens is handled via history.pushState
	// and the back buttons using history.back(). Forward navigation is intentionally NOT
	// supported because setup screens require async operations (user fetch, WebSocket
	// connections, tournament manager creation) that can't be reliably restored.
	// Tournament back button confirmation is handled by module-level popstate handler.

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

		// Render players list
		if (tournamentPlayersList) {
			const players = tournamentManager.getTournament().players;
			tournamentPlayersList.innerHTML = players
				.map((player) => {
					const isLoggedInUser = loggedInUserId !== null && player.id === loggedInUserId;
					return `
          <div class="flex items-center justify-between p-3 ${isLoggedInUser ? 'bg-blue-50 border border-blue-200' : 'bg-purple-50'} rounded-lg">
            <span class="font-medium text-gray-800" style="white-space: pre-wrap;">
              ${escapeHtml(player.alias)}
              ${isLoggedInUser ? `<span class="text-xs text-blue-600 ml-2">${t('play.local.tournament.registration.you')}</span>` : ''}
            </span>
            ${isLoggedInUser
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

	async function startNextTournamentMatch(): Promise<void> {
		if (!tournamentManager) return;

		const match = tournamentManager.getCurrentMatch();
		if (!match) {
			// Tournament is complete
			await showTournamentWinner();
			return;
		}

		// Display match info
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
			await showTournamentWinner();
		} else {
			await startNextTournamentMatch();
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

		// For Round 1, only show actual matches (no TBD placeholders)
		// For later rounds, show expected matches including TBD placeholders
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

	async function recordTournamentOnBlockchain(): Promise<{
		success: boolean;
		blockchainId?: string;
		txHash?: string;
		snowtraceUrl?: string;
	}> {
		if (!tournamentManager) return { success: false };

		const tournament = tournamentManager.getTournament();
		if (!tournament.winner) return { success: false };

		// Check if user is authenticated
		const authenticated = await isAuthenticated();
		if (!authenticated) return { success: false };

		// Build the request payload
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
		if (!tournamentManager || !tournamentCurrentMatch) return;

		const bracket = tournamentManager.getBracket();
		const finalMatch = bracket[bracket.length - 1]?.[0];

		if (finalMatch?.winner) {
			const winner = finalMatch.winner;

			// Check if user is logged in and try to record on blockchain
			const authenticated = await isAuthenticated();
			let blockchainHtml = '';

			if (authenticated) {
				// Show loading state
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
		// Clean up any running game
		if (currentGame) {
			currentGame.destroy();
			currentGame = null;
		}

		tournamentManager = new TournamentManager();
		syncTournamentToModule();

		// If logged in, auto-add the user as the first player (same as tournamentBtn click)
		const user = await getCurrentUser();
		if (user) {
			loggedInUserAlias = user.alias;
			tournamentManager.addPlayer(user.alias);
			// Store the ID of the first player (logged-in user)
			const players = tournamentManager.getTournament().players;
			loggedInUserId = players.length > 0 ? players[0].id : null;
		} else {
			loggedInUserAlias = null;
			loggedInUserId = null;
		}

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

			toast.info(t('play.rejoining.active.match'));

			// Create remote game and reconnect
			remoteGame = new RemotePongGame(remotePongCanvas, {
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
						remoteConnectionStatus.textContent = '';
					}
					toast.success(t('friends.opponent.reconnect.toast.success'));
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
					window.history.replaceState({ page: 'play' }, '', window.location.href);
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
				onMatchJoined: (_matchId, opponentName, playerNumber) => {
					// This is a rejoin - show appropriate toast
					if (opponentName) {
						toast.success(
							t('friends.opponent.join.match.toast.success', { opponent: opponentName })
						);
					} else {
						toast.success(t('friends.rejoin.match.toast.success', { playerNumber }));
					}
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
			showScreen(remoteGameScreen!, true);

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
						remoteConnectionStatus.textContent = '';
					}
					toast.success(t('friends.opponent.reconnect.toast.success'));
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
					window.history.replaceState({ page: 'play' }, '', window.location.href);
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
				onMatchJoined: () => {
					// Don't show toast here - for new matches, wait for opponent_joined event
					// This callback just confirms we've joined the match
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
	localGameBtn?.addEventListener('click', async () => {
		showScreen(gameSetup!, true);
		player2AliasInput.value = '';

		// If logged in, use the user's alias for player 1
		const user = await getCurrentUser();
		if (user) {
			loggedInUserAlias = user.alias;
			player1AliasInput.value = user.alias;
			player1AliasInput.disabled = true;
			player1AliasInput.classList.add('bg-gray-100', 'cursor-not-allowed');
			player2AliasInput.focus();
		} else {
			loggedInUserAlias = null;
			player1AliasInput.value = '';
			player1AliasInput.disabled = false;
			player1AliasInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
			player1AliasInput.focus();
		}
	});

	// Event: Local GameVersusBot button
	gameVersusBotBtn?.addEventListener('click', async () => {
		// If logged in, store the user's alias for bot game
		const user = await getCurrentUser();
		loggedInUserAlias = user?.alias || null;
		showScreen(gameBotSetup!, true);
	});

	// Event: Tournament button
	tournamentBtn?.addEventListener('click', async () => {
		// Create new tournament
		tournamentManager = new TournamentManager();
		syncTournamentToModule();

		// If logged in, auto-add the user as the first player
		const user = await getCurrentUser();
		if (user) {
			loggedInUserAlias = user.alias;
			tournamentManager.addPlayer(user.alias);
			// Store the ID of the first player (logged-in user)
			const players = tournamentManager.getTournament().players;
			loggedInUserId = players.length > 0 ? players[0].id : null;
		} else {
			loggedInUserAlias = null;
			loggedInUserId = null;
		}

		updateTournamentUI();
		showTournamentPhase('registration');
		showScreen(tournamentScreen!, true);
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
		showScreen(joinMatchScreen!, true);
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
		// Update history state so language change doesn't restore the old screen
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
			// Update history state so language change doesn't restore the old screen
			window.history.replaceState({ page: 'play' }, '', window.location.href);
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
			toast.success(t('play.local.tournament.registration.added.msg', { alias }));
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
			// Sync to module level after status change to 'in-progress'
			syncTournamentToModule();
			showTournamentPhase('bracket');
			// Push history state for bracket phase to enable back button confirmation
			window.history.pushState(
				{ page: 'play', playScreen: 'tournament-bracket' },
				'',
				window.location.href
			);
			renderTournamentBracket(); // Show full bracket with TBD
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
		// Clean up any running game
		if (currentGame) {
			currentGame.destroy();
			currentGame = null;
		}

		window.history.back();
		tournamentManager = null;
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
			// Clean up any running game
			if (currentGame) {
				currentGame.destroy();
				currentGame = null;
			}

			// Reset tournament
			showScreen(modeSelection!);
			// Update history state so language change doesn't restore the old screen
			window.history.replaceState({ page: 'play' }, '', window.location.href);
			tournamentManager = null;
			syncTournamentToModule();
			toast.info(t('play.local.tournament.ended'));
		}
	});

	// Event: Start game
	startGameBtn?.addEventListener('click', () => {
		lastGameMode = 'local';
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
			player1 = t('play.player1.default.label'); // Default name
		}

		// Validate player 2 alias
		if (player2 !== '') {
			const validation = validatePlayerAlias(player2);
			if (!validation.valid) {
				showInlineError(player2ErrorEl, validation.error || 'Invalid alias');
				return;
			}
		} else {
			player2 = t('play.player2.default.label'); // Default name
		}

		// Check for duplicate names (case-sensitive)
		if (player1 === player2) {
			showInlineError(player2ErrorEl, 'Both players cannot have the same name');
			return;
		}

		if (currentGame) {
			currentGame.destroy();
		}

		currentGame = new PongGame(canvas, player1, player2);

		currentGame.setOnGameEnd((winner, score1, score2) => {
			// Record completed match for logged-in user
			void recordLocalMatch('LOCAL_1V1', player1, player2, score1, score2);

			// Show result screen after a short delay to let players see final game state
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
	let selectedBotLevel: BotLevel = BotLevel.LEVEL_1; // default
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

	// Event listeners for bot level buttons
	availableLevels.forEach((level) => {
		const btn = getBotBtn(level);
		if (btn) {
			btn.addEventListener('click', () => {
				selectedBotLevel = level;
				updateBotLevelSelection();
			});
		}
	});

	updateBotLevelSelection(); // init

	// Event: Start game vs Bot
	startBotGameBtn?.addEventListener('click', () => {
		lastGameMode = 'bot';
		// Use logged-in user's alias if available, otherwise 'Player'
		const player1 = loggedInUserAlias || 'Player';
		const botName = `Bot (Lvl ${selectedBotLevel})`;

		if (currentGame) {
			currentGame.destroy();
		}

		currentGame = new BotPongGame(canvas, player1, selectedBotLevel);

		currentGame.setOnGameEnd((winner, score1, score2) => {
			// Record completed match for logged-in user
			void recordLocalMatch('VS_BOT', player1, botName, score1, score2);

			setTimeout(() => {
				showResultScreen(winner, player1, botName, score1, score2);
			}, GAME_END_DELAY_MS);
		});

		showScreen(gameScreen!);
		currentGame.start();
		setModuleCurrentGame(currentGame);
	});
	// ====================

	// Event: End game early
	endGameBtn?.addEventListener('click', () => {
		if (currentGame) {
			currentGame.destroy();
			currentGame = null;
			setModuleCurrentGame(null);
		}

		// If we're in a tournament, go back to tournament bracket
		if (tournamentManager && tournamentManager.getTournament().status === 'in-progress') {
			if (tournamentBracket) tournamentBracket.classList.remove('hidden');
			if (gameScreen) gameScreen.classList.add('hidden');
			showScreen(tournamentScreen!);
		} else {
			showScreen(modeSelection!);
			// Update history state so language change doesn't restore the old screen
			window.history.replaceState({ page: 'play' }, '', window.location.href);
		}
	});

	// Event: Play again
	playAgainBtn?.addEventListener('click', () => {
		if (lastGameMode === 'bot') {
			showScreen(gameBotSetup!);
		} else {
			showScreen(gameSetup!);
			player1AliasInput.focus();
		}
	});

	// Event: Back to menu from results
	backToMenuBtn?.addEventListener('click', () => {
		if (currentGame) {
			currentGame.destroy();
			currentGame = null;
			setModuleCurrentGame(null);
		}
		showScreen(modeSelection!);
		// Update history state so language change doesn't restore the old screen
		window.history.replaceState({ page: 'play' }, '', window.location.href);
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
		lastWinnerName = winner; // Store for language change re-translation
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
