import './index.css';
import { onLangChange, getLang, setLang } from './i18n/i18n';
import { t } from './i18n/i18n';
import {
  renderPlayPage,
  cleanupPlayPage,
  hasActiveRemoteGame,
  leaveRemoteGame,
} from './pages/play';
import { renderLoginPage } from './pages/login';
import { renderRegisterPage } from './pages/register';
import { renderSettingsPage } from './pages/settings';
import { renderFriendsPage, cleanupFriendsPage } from './pages/friends';
import { isAuthenticated, logout, getCurrentUser } from './utils/auth';
import { getWebSocketManager, resetWebSocketManager } from './utils/websocket';
import { showConfirmModal } from './utils/modal';
import { escapeHtml } from './utils/sanitize';

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
let currentPage: 'home' | 'login' | 'register' | 'play' | 'tournaments' | 'settings' | 'friends' =
  'home';

// Notification state (updated via WebSocket and REST)
let unreadNotificationCount = 0;
let notificationListenerRegistered = false;

/**
 * Connect global WebSocket when authenticated
 * This shared connection is used for:
 * - Match list updates (play page)
 * - Game state (remote games)
 * - Friends online status
 * - Real-time notifications
 */
// Flag to skip auto-reconnect after session was replaced
let sessionWasReplaced = false;

/**
 * Fetch unread notification count from server
 */
async function fetchUnreadNotificationCount(): Promise<void> {
  try {
    const response = await fetch('/api/notifications/unread-count', {
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      unreadNotificationCount = data.count;
      updateNotificationBadge();
    }
  } catch (err) {
    console.warn('[App] Failed to fetch notification count:', err);
  }
}

/**
 * Update the notification badge in the navbar (desktop and mobile)
 */
function updateNotificationBadge(): void {
  const badges = [
    document.getElementById('notification-badge'),
    document.getElementById('notification-badge-mobile'),
  ];

  for (const badge of badges) {
    if (badge) {
      if (unreadNotificationCount > 0) {
        badge.textContent = unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }
}

/**
 * Update the online status indicator in the navbar (desktop and mobile)
 */
function updateOnlineIndicator(isOnline: boolean): void {
  const indicators = [
    document.getElementById('online-indicator'),
    document.getElementById('online-indicator-mobile'),
  ];

  for (const indicator of indicators) {
    if (indicator) {
      if (isOnline) {
        indicator.classList.remove('bg-gray-400');
        indicator.classList.add('bg-green-500');
        indicator.title = 'Online';
      } else {
        indicator.classList.remove('bg-green-500');
        indicator.classList.add('bg-gray-400');
        indicator.title = 'Offline';
      }
    }
  }
}

async function connectGlobalWebSocket(): Promise<void> {
  // Skip if we were just replaced by another tab (until user explicitly reclaims)
  if (sessionWasReplaced) {
    return;
  }

  const wsManager = getWebSocketManager();

  // Register handlers only once (when not connected)
  if (!wsManager.isConnected) {
    // Track connection state for online indicator
    wsManager.setStateChangeHandler((state) => {
      updateOnlineIndicator(state === 'connected');
    });

    // Handle new notifications via WebSocket
    wsManager.on('notification:new', () => {
      unreadNotificationCount++;
      updateNotificationBadge();
    });

    // Handle session replaced by another tab
    wsManager.on('session:replaced', async () => {
      // Set flag to prevent auto-reconnect from render()
      sessionWasReplaced = true;

      // Clean up frozen game if needed (before showing modal)
      const wasInGame = currentPage === 'play' && hasActiveRemoteGame();
      if (wasInGame) {
        cleanupPlayPage();
        currentPage = 'home';
        window.history.pushState({ page: 'home' }, '', '/');
        render();
      }

      // Show modal with only "Reclaim Session" button
      const reclaim = await showConfirmModal({
        title: 'Session Opened Elsewhere',
        message: wasInGame
          ? 'You opened this game in another tab.\n\nYour game continues there. Click below to take back control.'
          : 'You opened this site in another tab.\n\nClick below to use this tab instead.',
        confirmText: 'Reclaim Session',
        showCancel: false,
      });

      if (reclaim) {
        // User wants to reclaim - reconnect (this will kick the other tab)
        sessionWasReplaced = false; // Allow reconnection
        try {
          await wsManager.connect();
          // If was in a game, navigate to play page to rejoin
          if (wasInGame) {
            currentPage = 'play';
            window.history.pushState({ page: 'play' }, '', '/play');
            render(); // This will call renderPlayPage which detects active match
          }
        } catch {
          console.error('[App] Failed to reclaim session');
        }
      }
    });

    // Handle auto-reconnect to active match (e.g., when opening new tab)
    wsManager.on('match:joined', (data) => {
      // If not on play page and we got match:joined, navigate there
      if (currentPage !== 'play' && data.matchId) {
        console.log('[App] Active match detected, navigating to play page');
        currentPage = 'play';
        window.history.pushState({ page: 'play' }, '', '/play');
        render();
      }
    });

    try {
      await wsManager.connect();
      console.log('[App] Global WebSocket connected');
      updateOnlineIndicator(true);

      // Fetch initial notification count
      await fetchUnreadNotificationCount();

      // Listen for notification count refresh events (from friends page, etc.)
      // Only register once to prevent memory leaks from duplicate listeners
      if (!notificationListenerRegistered) {
        window.addEventListener('notification:countChanged', () => {
          fetchUnreadNotificationCount();
        });
        notificationListenerRegistered = true;
      }

      // Check for active match after connecting (for non-play pages)
      // Play page handles its own reconnect via remoteGame.connect()
      if (currentPage !== 'play') {
        wsManager.reconnectToMatch();
      }
    } catch (err) {
      console.warn('[App] Failed to connect global WebSocket:', err);
      updateOnlineIndicator(false);
      // Non-fatal - features will fall back to REST or retry later
    }
  }
}

async function navigate(
  page: 'home' | 'login' | 'register' | 'play' | 'tournaments' | 'settings' | 'friends'
) {
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
  } else if (currentPage === 'friends') {
    cleanupFriendsPage();
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
  } else if (currentPage === 'friends') {
    cleanupFriendsPage();
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
  } else if (currentPage === 'friends') {
    // Protect friends page - redirect to login if not authenticated
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      navigate('login');
      return;
    }
    await connectGlobalWebSocket();
    renderFriendsPage(app, (page) => renderNavBar(page, authenticated), setupNavigation);
  }
}

// Navigation bar component
async function renderNavBar(
  activePage: 'home' | 'login' | 'register' | 'play' | 'tournaments' | 'settings' | 'friends',
  authenticated?: boolean
): Promise<string> {
  const isAuth = authenticated ?? (await isAuthenticated());
  const wsManager = getWebSocketManager();
  const isOnline = wsManager.isConnected;

  // Get user info if authenticated
  let userAlias = '';
  let avatarUrl = '';
  let userId = '';
  if (isAuth) {
    const user = await getCurrentUser();
    userAlias = user?.alias || '';
    userId = user?.id || '';
    // Build avatar URL with cache-busting timestamp
    if (userId) {
      avatarUrl = `/api/users/${userId}/avatar?t=${Date.now()}`;
    }
  }
  const lang = getLang();
  const isDev = import.meta.env.DEV;

  return `
    <nav class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center gap-2">
              <h1 class="text-xl sm:text-2xl font-bold text-gray-900">ft_transcendence</h1>
              ${
                isDev
                  ? `
  <a
    href="https://sidneybaumann.github.io/ft_transcendence/#"
    target="_blank"
    rel="noopener noreferrer"
    class="
      text-xs font-semibold
      text-red-600
      visited:text-red-600
      active:text-red-600
      focus:text-red-600
      border border-red-600
      rounded px-2 py-0.5
      hover:bg-red-100
      focus:outline-none
      transition
    "
    title="Use Ctrl/Cmd + click to open documentation in a background tab"
    aria-label="Open project documentation (Ctrl or Cmd + click for background tab)"
  >
    DEV
  </a>
`
                  : ''
              }
            </div>
          </div>
          <!-- Mobile menu button -->
          <div class="flex items-center lg:hidden">
            ${
              isAuth
                ? `
              <!-- Mobile: Online indicator -->
              <span id="online-indicator-mobile" class="w-2.5 h-2.5 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}" title="${isOnline ? 'Online' : 'Offline'}"></span>
              <!-- Mobile: Notification Bell -->
              <button id="nav-notifications-mobile" class="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition mr-1" title="Notifications">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <span id="notification-badge-mobile" class="${unreadNotificationCount > 0 ? '' : 'hidden'} absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                  ${unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              </button>
            `
                : ''
            }
            <button id="mobile-menu-btn" class="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path id="menu-icon-open" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                <path id="menu-icon-close" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <!-- Desktop menu -->
          <div class="hidden lg:flex items-center space-x-4">
            <button id="nav-home" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'home' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              ${t('nav.home')}
            </button>
            <button id="nav-play" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'play' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              ${t('nav.play')}
            </button>
            ${
              isAuth
                ? `
              <button id="nav-tournaments" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'tournaments' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
                ${t('nav.tournaments')}
              </button>
              <button id="nav-friends" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'friends' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
                ${t('nav.friends')}
              </button>
              <button id="nav-settings" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'settings' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
                ${t('nav.settings')}
              </button>
              <div class="border-l border-gray-300 h-6 mx-2"></div>
              <!-- Notification Bell -->
              <button id="nav-notifications" class="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition" title="Notifications">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <span id="notification-badge" class="${unreadNotificationCount > 0 ? '' : 'hidden'} absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                  ${unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              </button>
              <!-- User with Avatar and Online Indicator -->
              <span class="flex items-center text-sm text-gray-600 px-2 gap-2">
                <span id="online-indicator" class="w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}" title="${isOnline ? 'Online' : 'Offline'}"></span>
                ${
                  avatarUrl
                    ? `
                  <img
                    id="nav-user-avatar"
                    src="${avatarUrl}"
                    alt="Profile"
                    class="w-6 h-6 rounded-full object-cover border border-gray-300 hover:border-blue-500 transition cursor-pointer"
                    title="View profile"
                  />
                `
                    : `
                  <span class="text-gray-400">👤</span>
                `
                }
                <span id="nav-user-alias" class="font-medium">${escapeHtml(userAlias)}</span>
              </span>
              <button id="nav-logout" class="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition">
                ${t('nav.logout')}
              </button>
            `
                : `
              <button id="nav-login" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'login' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
                ${t('nav.login')}
              </button>
              <button id="nav-register" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'register' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
                ${t('nav.register')}
              </button>
            `
            }
            <select
              id="nav-lang"
              class="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white cursor-pointer hover:text-gray-900 hover:bg-gray-100 appearance-none"
              aria-label="Language"
            >
              <option value="en" ${lang === 'en' ? 'selected' : ''}>EN</option>
              <option value="fr" ${lang === 'fr' ? 'selected' : ''}>FR</option>
              <option value="ja" ${lang === 'ja' ? 'selected' : ''}>JA</option>
              <option value="de" ${lang === 'de' ? 'selected' : ''}>DE</option>
            </select>
          </div>
        </div>
      </div>
      <!-- Mobile menu (hidden by default) -->
      <div id="mobile-menu" class="hidden lg:hidden border-t border-gray-200">
        <div class="px-4 py-3 space-y-2">
          <button id="nav-home-mobile" class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activePage === 'home' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
            Home
          </button>
          <button id="nav-play-mobile" class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activePage === 'play' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
            Play
          </button>
          ${
            isAuth
              ? `
            <button id="nav-tournaments-mobile" class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activePage === 'tournaments' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              Tournaments
            </button>
            <button id="nav-friends-mobile" class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activePage === 'friends' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              Friends
            </button>
            <button id="nav-settings-mobile" class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activePage === 'settings' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              Settings
            </button>
            <div class="border-t border-gray-200 my-2"></div>
            <!-- User info in mobile menu -->
            <div class="flex items-center px-3 py-2 gap-2">
              ${
                avatarUrl
                  ? `
                <img
                  id="nav-user-avatar-mobile"
                  src="${avatarUrl}"
                  alt="Profile"
                  class="w-8 h-8 rounded-full object-cover border border-gray-300"
                />
              `
                  : `
                <span class="text-gray-400 text-xl">👤</span>
              `
              }
              <span id="nav-user-alias-mobile" class="font-medium text-gray-700">${escapeHtml(userAlias)}</span>
            </div>
            <button id="nav-logout-mobile" class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition">
              Logout
            </button>
          `
              : `
            <button id="nav-login-mobile" class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activePage === 'login' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              Login
            </button>
            <button id="nav-register-mobile" class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activePage === 'register' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              Register
            </button>
          `
          }
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
            <h2 class="text-3xl font-bold text-gray-900 mb-6">${t('home.welcome')}</h2>

            <div class="flex justify-center">
              <img
                src="/pong.gif"
                alt="Ping Pong Animation"
                class="rounded-lg max-w-full h-auto"
              />
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
          <h2 class="text-3xl font-bold text-gray-900 mb-2">${t('tournaments.title')}</h2>
          <p class="text-gray-600">${t('tournaments.text')}</p>
        </div>

        <div class="bg-white rounded-lg shadow p-6 mb-6">
          <label for="tournament-id" class="block text-sm font-medium text-gray-700 mb-2">
            ${t('tournaments.input.label')}
          </label>
          <div class="flex gap-2">
            <input
              type="number"
              id="tournament-id"
              placeholder="${t('tournaments.input.placeholder')}"
              class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
            />
            <button
              id="load-tournament"
              class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              ${t('tournaments.load.button')}
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
            ${t('tournaments.bottom.text')}
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
  // Desktop navigation buttons
  const homeBtn = document.getElementById('nav-home');
  const playBtn = document.getElementById('nav-play');
  const tournamentsBtn = document.getElementById('nav-tournaments');
  const friendsBtn = document.getElementById('nav-friends');
  const settingsBtn = document.getElementById('nav-settings');
  const loginBtn = document.getElementById('nav-login');
  const registerBtn = document.getElementById('nav-register');
  const logoutBtn = document.getElementById('nav-logout');
  const notificationsBtn = document.getElementById('nav-notifications');
  const avatarImg = document.getElementById('nav-user-avatar');
  const langSelect = document.getElementById('nav-lang') as HTMLSelectElement | null;

  langSelect?.addEventListener('change', () => {
    setLang(langSelect.value as 'en' | 'fr' | 'ja' | 'de');
  });

  // Mobile navigation buttons
  const homeBtnMobile = document.getElementById('nav-home-mobile');
  const playBtnMobile = document.getElementById('nav-play-mobile');
  const tournamentsBtnMobile = document.getElementById('nav-tournaments-mobile');
  const friendsBtnMobile = document.getElementById('nav-friends-mobile');
  const settingsBtnMobile = document.getElementById('nav-settings-mobile');
  const loginBtnMobile = document.getElementById('nav-login-mobile');
  const registerBtnMobile = document.getElementById('nav-register-mobile');
  const logoutBtnMobile = document.getElementById('nav-logout-mobile');
  const notificationsBtnMobile = document.getElementById('nav-notifications-mobile');

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIconOpen = document.getElementById('menu-icon-open');
  const menuIconClose = document.getElementById('menu-icon-close');

  const closeMobileMenu = () => {
    mobileMenu?.classList.add('hidden');
    menuIconOpen?.classList.remove('hidden');
    menuIconClose?.classList.add('hidden');
  };

  mobileMenuBtn?.addEventListener('click', () => {
    const isHidden = mobileMenu?.classList.toggle('hidden');
    if (isHidden) {
      menuIconOpen?.classList.remove('hidden');
      menuIconClose?.classList.add('hidden');
    } else {
      menuIconOpen?.classList.add('hidden');
      menuIconClose?.classList.remove('hidden');
    }
  });

  // Desktop navigation
  homeBtn?.addEventListener('click', () => navigate('home'));
  playBtn?.addEventListener('click', () => navigate('play'));
  tournamentsBtn?.addEventListener('click', () => navigate('tournaments'));
  friendsBtn?.addEventListener('click', () => navigate('friends'));
  settingsBtn?.addEventListener('click', () => navigate('settings'));
  loginBtn?.addEventListener('click', () => navigate('login'));
  registerBtn?.addEventListener('click', () => navigate('register'));

  // Mobile navigation (closes menu after navigation)
  homeBtnMobile?.addEventListener('click', () => {
    closeMobileMenu();
    navigate('home');
  });
  playBtnMobile?.addEventListener('click', () => {
    closeMobileMenu();
    navigate('play');
  });
  tournamentsBtnMobile?.addEventListener('click', () => {
    closeMobileMenu();
    navigate('tournaments');
  });
  friendsBtnMobile?.addEventListener('click', () => {
    closeMobileMenu();
    navigate('friends');
  });
  settingsBtnMobile?.addEventListener('click', () => {
    closeMobileMenu();
    navigate('settings');
  });
  loginBtnMobile?.addEventListener('click', () => {
    closeMobileMenu();
    navigate('login');
  });
  registerBtnMobile?.addEventListener('click', () => {
    closeMobileMenu();
    navigate('register');
  });

  // Clicking notification bell navigates to friends page (notifications tab)
  notificationsBtn?.addEventListener('click', () => navigate('friends'));
  notificationsBtnMobile?.addEventListener('click', () => {
    closeMobileMenu();
    navigate('friends');
  });

  // Clicking avatar image navigates to settings
  avatarImg?.addEventListener('click', () => navigate('settings'));

  // Logout handler for both desktop and mobile
  const handleLogout = async () => {
    closeMobileMenu();
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
  };

  logoutBtn?.addEventListener('click', handleLogout);
  logoutBtnMobile?.addEventListener('click', handleLogout);
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
              <div class="text-lg font-bold text-gray-900">${escapeHtml(match.player1Alias)}</div>
              <div class="text-sm text-gray-500">ID: ${match.player1Id}</div>
              <div class="text-3xl font-bold text-blue-600 mt-2">${match.score1}</div>
            </div>

            <div class="text-center">
              <div class="text-gray-400 font-semibold">VS</div>
            </div>

            <div class="text-center">
              <div class="text-lg font-bold text-gray-900">${escapeHtml(match.player2Alias)}</div>
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

  onLangChange(render);

  render();
});
