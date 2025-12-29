import './index.css';
import {
  renderPlayPage,
  cleanupPlayPage,
  hasActiveRemoteGame,
  leaveRemoteGame,
} from './pages/play';
import { renderLoginPage } from './pages/login';
import { renderRegisterPage } from './pages/register';
import { renderSettingsPage } from './pages/settings';
import { isAuthenticated, logout, getCurrentUser } from './utils/auth';
import { getWebSocketManager, resetWebSocketManager } from './utils/websocket';
import { showConfirmModal } from './utils/modal';

// Types
interface Match {
  matchId: string;
  tournamentId: string;
  player1Id: string;
  player1Alias: string;
  player2Id: string;
  player2Alias: string;
  score1: string;
  score2: string;
  timestamp: string;
  recordedBy: string;
}

interface TournamentData {
  tournamentId: number;
  matchIds: string[];
  matches: Match[];
}

// Utility functions
function formatAddress(address: string): string {
  if (address.length <= 18) {
    return address;
  }
  return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
}

// Router
let currentPage: 'home' | 'login' | 'register' | 'play' | 'tournaments' | 'settings' = 'home';

/**
 * Connect global WebSocket when authenticated
 * This shared connection is used for:
 * - Match list updates (play page)
 * - Game state (remote games)
 * - Friends online status (future)
 */
async function connectGlobalWebSocket(): Promise<void> {
  const wsManager = getWebSocketManager();
  if (!wsManager.isConnected) {
    try {
      await wsManager.connect();
      console.log('[App] Global WebSocket connected');
    } catch (err) {
      console.warn('[App] Failed to connect global WebSocket:', err);
      // Non-fatal - features will fall back to REST or retry later
    }
  }
}

async function navigate(page: 'home' | 'login' | 'register' | 'play' | 'tournaments' | 'settings') {
  // Check if leaving an active game - show confirmation
  if (currentPage === 'play' && hasActiveRemoteGame()) {
    const confirmed = await showConfirmModal({
      title: 'Leave Game?',
      message: 'You are in an active game. Leaving will forfeit the match. Are you sure?',
      confirmText: 'Leave Game',
      cancelText: 'Stay',
      isDangerous: true,
    });

    if (!confirmed) {
      return; // User cancelled, stay on play page
    }

    // User confirmed, leave the game
    leaveRemoteGame();
  } else if (currentPage === 'play') {
    cleanupPlayPage();
  }

  currentPage = page;
  // Update browser history
  window.history.pushState({ page }, '', `/${page === 'home' ? '' : page}`);
  render();
}

// Handle browser back/forward buttons
window.addEventListener('popstate', async (event) => {
  // Check if leaving an active game - show confirmation
  if (currentPage === 'play' && hasActiveRemoteGame()) {
    const confirmed = await showConfirmModal({
      title: 'Leave Game?',
      message: 'You are in an active game. Leaving will forfeit the match. Are you sure?',
      confirmText: 'Leave Game',
      cancelText: 'Stay',
      isDangerous: true,
    });

    if (!confirmed) {
      // User cancelled - push back to play page in history
      window.history.pushState({ page: 'play' }, '', '/play');
      return;
    }

    leaveRemoteGame();
  } else if (currentPage === 'play') {
    cleanupPlayPage();
  }

  if (event.state && event.state.page) {
    currentPage = event.state.page;
  } else {
    // Default to home if no state
    currentPage = 'home';
  }
  render();
});

// Render function
async function render() {
  const app = document.getElementById('root');
  if (!app) return;

  if (currentPage === 'login') {
    renderLoginPage(app, renderNavBar, setupNavigation, async () => {
      // After successful login, connect WebSocket and go to home
      await connectGlobalWebSocket();
      navigate('home');
    });
  } else if (currentPage === 'register') {
    renderRegisterPage(app, renderNavBar, setupNavigation, () => {
      // After successful registration, go to login
      navigate('login');
    });
  } else if (currentPage === 'home') {
    // Connect WebSocket if authenticated (for real-time features)
    const authenticated = await isAuthenticated();
    if (authenticated) {
      await connectGlobalWebSocket();
    }
    renderHome(app);
  } else if (currentPage === 'play') {
    // Play page is accessible to everyone - local games don't require login
    // Remote games are protected within the play page UI
    const authenticated = await isAuthenticated();
    if (authenticated) {
      await connectGlobalWebSocket();
    }
    renderPlayPage(app, (page) => renderNavBar(page, authenticated), setupNavigation);
  } else if (currentPage === 'tournaments') {
    // Protect tournaments page - redirect to login if not authenticated
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      navigate('login');
      return;
    }
    await connectGlobalWebSocket();
    renderTournaments(app, authenticated);
  } else if (currentPage === 'settings') {
    // Protect settings page - redirect to login if not authenticated
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      navigate('login');
      return;
    }
    await connectGlobalWebSocket();
    renderSettingsPage(app, (page) => renderNavBar(page, authenticated), setupNavigation);
  }
}

// Navigation bar component
async function renderNavBar(
  activePage: 'home' | 'login' | 'register' | 'play' | 'tournaments' | 'settings',
  authenticated?: boolean
): Promise<string> {
  const isAuth = authenticated ?? (await isAuthenticated());

  // Get user info if authenticated
  let userAlias = '';
  if (isAuth) {
    const user = await getCurrentUser();
    userAlias = user?.alias || '';
  }

  return `
    <nav class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <h1 class="text-2xl font-bold text-gray-900">ft_transcendence</h1>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <button id="nav-home" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'home' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              Home
            </button>
            <button id="nav-play" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'play' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              Play
            </button>
            ${
              isAuth
                ? `
              <button id="nav-tournaments" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'tournaments' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
                Tournaments
              </button>
              <button id="nav-settings" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'settings' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
                Settings
              </button>
              <div class="border-l border-gray-300 h-6 mx-2"></div>
              <span class="flex items-center text-sm text-gray-600 px-2">
                <span class="text-gray-400 mr-1">👤</span>
                <span id="nav-user-alias" class="font-medium">${userAlias}</span>
              </span>
              <button id="nav-logout" class="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition">
                Logout
              </button>
            `
                : `
              <button id="nav-login" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'login' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
                Login
              </button>
              <button id="nav-register" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'register' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
                Register
              </button>
            `
            }
          </div>
        </div>
      </div>
    </nav>
  `;
}

// Home page
async function renderHome(app: HTMLElement) {
  const navBar = await renderNavBar('home');
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${navBar}

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="max-w-2xl mx-auto">
          <div class="bg-white rounded-lg shadow-lg p-8">
            <h2 class="text-3xl font-bold text-gray-900 mb-6">Welcome</h2>

            <div class="space-y-6">
              <div class="p-4 bg-gray-50 rounded-lg">
                <h3 class="text-xl font-semibold text-gray-800 mb-2">Technologies</h3>
                <ul class="list-disc list-inside text-gray-600 space-y-1">
                  <li>TypeScript (vanilla)</li>
                  <li>Tailwind CSS</li>
                  <li>Vite</li>
                  <li>Fastify Backend</li>
                  <li>Blockchain (Avalanche Fuji)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Setup navigation
  setupNavigation();
}

// Tournaments page
async function renderTournaments(app: HTMLElement, authenticated?: boolean) {
  const navBar = await renderNavBar('tournaments', authenticated);
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${navBar}

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="mb-8">
          <h2 class="text-3xl font-bold text-gray-900 mb-2">Tournament Matches</h2>
          <p class="text-gray-600">View matches from the blockchain</p>
        </div>

        <div class="bg-white rounded-lg shadow p-6 mb-6">
          <label for="tournament-id" class="block text-sm font-medium text-gray-700 mb-2">
            Enter Tournament ID:
          </label>
          <div class="flex gap-2">
            <input
              type="number"
              id="tournament-id"
              placeholder="e.g., 1"
              class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
            />
            <button
              id="load-tournament"
              class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Load Matches
            </button>
          </div>
        </div>

        <div id="loading" class="hidden text-center py-8">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p class="mt-2 text-gray-600">Loading matches...</p>
        </div>

        <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p class="text-red-800"></p>
        </div>

        <div id="matches-container" class="space-y-4">
          <div class="text-center py-12 text-gray-500">
            Enter a tournament ID to view matches
          </div>
        </div>
      </div>
    </div>
  `;

  // Setup navigation
  setupNavigation();

  // Setup tournament loading
  setupTournamentLoader();
}

// Setup navigation
function setupNavigation() {
  const homeBtn = document.getElementById('nav-home');
  const playBtn = document.getElementById('nav-play');
  const tournamentsBtn = document.getElementById('nav-tournaments');
  const settingsBtn = document.getElementById('nav-settings');
  const loginBtn = document.getElementById('nav-login');
  const registerBtn = document.getElementById('nav-register');
  const logoutBtn = document.getElementById('nav-logout');

  homeBtn?.addEventListener('click', () => navigate('home'));
  playBtn?.addEventListener('click', () => navigate('play'));
  tournamentsBtn?.addEventListener('click', () => navigate('tournaments'));
  settingsBtn?.addEventListener('click', () => navigate('settings'));
  loginBtn?.addEventListener('click', () => navigate('login'));
  registerBtn?.addEventListener('click', () => navigate('register'));

  logoutBtn?.addEventListener('click', async () => {
    // Check if in an active game - show confirmation first
    if (currentPage === 'play' && hasActiveRemoteGame()) {
      const confirmed = await showConfirmModal({
        title: 'Leave Game?',
        message: 'You are in an active game. Logging out will forfeit the match. Are you sure?',
        confirmText: 'Logout',
        cancelText: 'Stay',
        isDangerous: true,
      });

      if (!confirmed) {
        return; // User cancelled, don't logout
      }

      // User confirmed, leave the game
      leaveRemoteGame();
    } else if (currentPage === 'play') {
      cleanupPlayPage();
    }

    await logout();
    // Disconnect global WebSocket on logout
    resetWebSocketManager();
    navigate('home');
  });
}

// Setup tournament loader
function setupTournamentLoader() {
  const loadBtn = document.getElementById('load-tournament');
  const tournamentIdInput = document.getElementById('tournament-id') as HTMLInputElement;
  const matchesContainer = document.getElementById('matches-container');
  const loadingEl = document.getElementById('loading');
  const errorMessageEl = document.getElementById('error-message');

  if (!loadBtn || !tournamentIdInput || !matchesContainer || !loadingEl || !errorMessageEl) return;

  const showLoading = () => {
    loadingEl.classList.remove('hidden');
    matchesContainer.innerHTML = '';
    errorMessageEl.classList.add('hidden');
  };

  const hideLoading = () => {
    loadingEl.classList.add('hidden');
  };

  const showError = (message: string) => {
    errorMessageEl.querySelector('p')!.textContent = message;
    errorMessageEl.classList.remove('hidden');
    hideLoading();
  };

  const renderMatches = (data: TournamentData) => {
    hideLoading();

    if (data.matches.length === 0) {
      matchesContainer.innerHTML = `
        <div class="text-center py-12 text-gray-500">
          No matches found for tournament ${data.tournamentId}
        </div>
      `;
      return;
    }

    matchesContainer.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 class="font-semibold text-blue-900">Tournament ID: ${data.tournamentId}</h3>
        <p class="text-blue-700 text-sm">Total Matches: ${data.matches.length}</p>
      </div>
      ${data.matches
        .map(
          (match) => `
        <div class="bg-white border rounded-lg p-6 hover:shadow-md transition">
          <div class="flex justify-between items-start mb-4">
            <div>
              <span class="text-xs text-gray-500">Match ID: ${match.matchId}</span>
            </div>
            <div class="text-xs text-gray-500">
              ${new Date(Number(match.timestamp) * 1000).toLocaleString()}
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4 items-center">
            <div class="text-center">
              <div class="text-lg font-bold text-gray-900">${match.player1Alias}</div>
              <div class="text-sm text-gray-500">ID: ${match.player1Id}</div>
              <div class="text-3xl font-bold text-blue-600 mt-2">${match.score1}</div>
            </div>

            <div class="text-center">
              <div class="text-gray-400 font-semibold">VS</div>
            </div>

            <div class="text-center">
              <div class="text-lg font-bold text-gray-900">${match.player2Alias}</div>
              <div class="text-sm text-gray-500">ID: ${match.player2Id}</div>
              <div class="text-3xl font-bold text-blue-600 mt-2">${match.score2}</div>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t text-xs text-gray-500">
            <div>Recorded by: <span class="font-mono">${formatAddress(match.recordedBy)}</span></div>
          </div>
        </div>
      `
        )
        .join('')}
    `;
  };

  const loadTournament = async () => {
    const tournamentId = tournamentIdInput.value.trim();

    if (!tournamentId || isNaN(Number(tournamentId))) {
      showError('Please enter a valid tournament ID');
      return;
    }

    showLoading();

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/matches`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TournamentData = await response.json();
      renderMatches(data);
    } catch (err) {
      console.error('Error loading tournament:', err);
      showError(
        `Failed to load tournament matches: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  loadBtn.addEventListener('click', loadTournament);

  tournamentIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadTournament();
    }
  });
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Determine initial page from URL
  const path = window.location.pathname.substring(1); // Remove leading slash
  if (
    path === 'play' ||
    path === 'tournaments' ||
    path === 'login' ||
    path === 'register' ||
    path === 'settings'
  ) {
    currentPage = path;
  } else {
    currentPage = 'home';
  }

  // Set initial history state
  window.history.replaceState(
    { page: currentPage },
    '',
    `/${currentPage === 'home' ? '' : currentPage}${window.location.search}`
  );

  // Listen for custom navigation events (from login/register links)
  window.addEventListener('navigate', ((event: CustomEvent) => {
    const page = event.detail.page;
    if (
      page === 'home' ||
      page === 'login' ||
      page === 'register' ||
      page === 'play' ||
      page === 'tournaments' ||
      page === 'settings'
    ) {
      navigate(page);
    }
  }) as EventListener);

  render();
});
