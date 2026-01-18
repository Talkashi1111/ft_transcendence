import { t } from '../i18n/i18n';
import { escapeHtml } from '../utils/sanitize';

// Types
interface TournamentData {
  blockchainId: string;
  odUserId: string;
  organizer: string;
  players: string[];
  winner: string;
  timestamp: string;
  recordedBy: string;
  matches: {
    player1: string;
    player2: string;
    score1: number;
    score2: number;
    round: number;
  }[];
}

// User tournament from database
interface UserTournament {
  id: string;
  blockchainId: number | null;
  organizerAlias: string;
  playerCount: number;
  winner: string;
  txHash: string | null;
  createdAt: string;
  recordedAt: string | null;
  matches: {
    player1Alias: string;
    player2Alias: string;
    score1: number;
    score2: number;
    round: number;
  }[];
}

// Utility function for formatting blockchain addresses
function formatAddress(address: string): string {
  if (address.length <= 18) {
    return address;
  }
  return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
}

export async function renderTournamentsPage(
  app: HTMLElement,
  renderNavBar: (page: 'home' | 'play' | 'tournaments' | 'settings' | 'friends') => Promise<string>,
  setupNavigation: () => void
): Promise<void> {
  const navBar = await renderNavBar('tournaments');
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${navBar}

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="mb-8">
          <h2 class="text-3xl font-bold text-gray-900 mb-2">${t('tournaments.title')}</h2>
          <p class="text-gray-600">${t('tournaments.text')}</p>
        </div>

        <!-- My Tournaments Section -->
        <div id="my-tournaments-section" class="bg-white rounded-lg shadow p-6 mb-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">${t('tournaments.my.title')}</h3>
          <div id="my-tournaments-loading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">${t('tournaments.my.loading')}</p>
          </div>
          <div id="my-tournaments-list" class="hidden space-y-4"></div>
          <!-- Detail view inside section -->
          <div id="my-tournaments-detail" class="hidden">
            <button id="back-to-my-list" class="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
              ${t('tournaments.detail.back')}
            </button>
            <div id="my-tournaments-detail-content"></div>
          </div>
        </div>

        <!-- Recent Global Tournaments Section -->
        <div id="global-tournaments-section" class="bg-white rounded-lg shadow p-6 mb-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">${t('tournaments.global.title')}</h3>
          <div id="global-tournaments-loading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">${t('tournaments.my.loading')}</p>
          </div>
          <div id="global-tournaments-list" class="hidden space-y-4"></div>
          <!-- Detail view inside section -->
          <div id="global-tournaments-detail" class="hidden">
            <button id="back-to-global-list" class="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
              ${t('tournaments.detail.back')}
            </button>
            <div id="global-tournaments-detail-content"></div>
          </div>
        </div>

        <!-- Blockchain Verification Section -->
        <div class="bg-white rounded-lg shadow p-6 mb-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-2">${t('tournaments.verify.title')}</h3>
          <p class="text-gray-600 text-sm mb-4">${t('tournaments.verify.text')}</p>
          <label for="tournament-id" class="block text-sm font-medium text-gray-700 mb-2">
            ${t('tournaments.input.label')}
          </label>
          <div class="flex gap-2">
            <input
              type="number"
              min="0"
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
          <p class="mt-2 text-gray-600">${t('tournaments.my.loading')}</p>
        </div>

        <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p class="text-red-800"></p>
        </div>

        <div id="matches-container" class="space-y-4"></div>
      </div>
    </div>
  `;

  // Setup navigation
  setupNavigation();

  // Setup tournament loading
  setupTournamentLoader();

  // Load user's tournaments
  loadUserTournaments();

  // Load global tournaments
  loadGlobalTournaments();
}

// Setup tournament loader for blockchain verification
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

  const renderBlockchainTournament = (data: TournamentData) => {
    hideLoading();

    const maxRound = Math.max(...data.matches.map((m) => m.round));

    matchesContainer.innerHTML = `
      <div class="bg-white rounded-lg shadow p-6">
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <h3 class="font-semibold text-green-900">${t('tournaments.my.blockchain.verified')}</h3>
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-green-700">${t('tournaments.detail.blockchain')}:</span>
              <span class="font-mono text-green-900">${data.blockchainId}</span>
            </div>
            <div>
              <span class="text-green-700">${t('tournaments.my.organizer')}:</span>
              <span class="text-green-900">${escapeHtml(data.organizer)}</span>
            </div>
            <div>
              <span class="text-green-700">${t('tournaments.my.winner', { name: '' }).replace(': ', '')}:</span>
              <span class="font-semibold text-green-900">${escapeHtml(data.winner)}</span>
            </div>
            <div>
              <span class="text-green-700">${t('tournaments.detail.recorded')}:</span>
              <span class="text-green-900">${new Date(Number(data.timestamp) * 1000).toLocaleString()}</span>
            </div>
          </div>
          <div class="mt-2 text-xs text-green-600">
            Recorded by: <span class="font-mono">${formatAddress(data.recordedBy)}</span>
          </div>
        </div>

        <h4 class="font-semibold text-gray-900 mb-4">Players: ${data.players.map((p) => escapeHtml(p)).join(', ')}</h4>

        <div class="space-y-4">
          ${data.matches
            .map(
              (match) => `
            <div class="bg-gray-50 border rounded-lg p-4">
              <div class="text-xs text-gray-500 mb-2">
                ${match.round === maxRound ? t('tournaments.detail.finals') : t('tournaments.detail.round', { round: match.round })}
              </div>
              <div class="grid grid-cols-3 gap-4 items-center">
                <div class="text-center">
                  <div class="font-semibold text-gray-900">${escapeHtml(match.player1)}</div>
                  <div class="text-2xl font-bold text-blue-600">${match.score1}</div>
                </div>
                <div class="text-center text-gray-400 font-semibold">${t('tournaments.detail.vs')}</div>
                <div class="text-center">
                  <div class="font-semibold text-gray-900">${escapeHtml(match.player2)}</div>
                  <div class="text-2xl font-bold text-blue-600">${match.score2}</div>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  };

  const loadTournament = async () => {
    const tournamentId = tournamentIdInput.value.trim();

    if (!tournamentId || isNaN(Number(tournamentId)) || Number(tournamentId) < 0) {
      showError('Please enter a valid blockchain tournament ID (0 or higher)');
      return;
    }

    showLoading();

    try {
      const response = await fetch(`/api/tournaments/blockchain/${tournamentId}`);

      if (!response.ok) {
        if (response.status === 500) {
          throw new Error('Tournament not found on blockchain');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TournamentData = await response.json();
      renderBlockchainTournament(data);
    } catch (err) {
      console.error('Error loading tournament:', err);
      showError(
        `Failed to verify tournament: ${err instanceof Error ? err.message : 'Unknown error'}`
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

// Load user's tournaments from database
async function loadUserTournaments() {
  const loadingEl = document.getElementById('my-tournaments-loading');
  const listEl = document.getElementById('my-tournaments-list');
  const detailEl = document.getElementById('my-tournaments-detail');
  const detailContentEl = document.getElementById('my-tournaments-detail-content');
  const backBtn = document.getElementById('back-to-my-list');

  if (!loadingEl || !listEl || !detailEl || !detailContentEl || !backBtn) return;

  // Hide detail view and show list
  const showList = () => {
    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
  };

  // Handle browser back/forward buttons
  const handlePopState = (e: PopStateEvent) => {
    if (e.state?.myTournamentDetail) {
      // This is a tournament detail state - stop other handlers
      e.stopImmediatePropagation();
      if (e.state?.tournament) {
        // Going forward to detail view - re-render the detail
        renderDetail(e.state.tournament);
      } else {
        // Going back to list view (detail flag but no data)
        showList();
      }
    }
  };
  // Use capture phase to run before global handler
  window.addEventListener('popstate', handlePopState, true);

  // Render detail view content (used by showDetail and popstate)
  const renderDetail = (tournament: UserTournament) => {
    listEl.classList.add('hidden');
    detailEl.classList.remove('hidden');

    const maxRound = Math.max(...tournament.matches.map((m) => m.round));

    detailContentEl.innerHTML = `
      <div class="mb-6">
        <h3 class="text-xl font-semibold text-gray-900 mb-2">${escapeHtml(tournament.organizerAlias)}'s Tournament</h3>
        <div class="flex flex-wrap gap-4 text-sm text-gray-600">
          <div>${t('tournaments.my.players', { count: tournament.playerCount })}</div>
          <div>${t('tournaments.my.winner', { name: escapeHtml(tournament.winner) })}</div>
          <div>${t('tournaments.detail.recorded')}: ${new Date(tournament.createdAt).toLocaleString()}</div>
        </div>
        ${
          tournament.blockchainId !== null
            ? `
          <div class="mt-2 flex items-center gap-2 text-green-600 text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            ${t('tournaments.my.blockchain.verified')} - ID: ${tournament.blockchainId}
          </div>
          ${
            tournament.txHash
              ? `
          <a href="https://testnet.snowtrace.io/tx/${tournament.txHash}" target="_blank" rel="noopener noreferrer"
             class="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block">
            ${t('tournaments.detail.txhash')}: ${formatAddress(tournament.txHash)}
          </a>
          `
              : ''
          }
        `
            : `
          <div class="mt-2 text-yellow-600 text-sm">${t('tournaments.my.blockchain.pending')}</div>
        `
        }
      </div>

      <div class="space-y-4">
        ${tournament.matches
          .map(
            (match) => `
          <div class="bg-gray-50 border rounded-lg p-4">
            <div class="text-xs text-gray-500 mb-2">
              ${match.round === maxRound ? t('tournaments.detail.finals') : t('tournaments.detail.round', { round: match.round })}
            </div>
            <div class="grid grid-cols-3 gap-4 items-center">
              <div class="text-center">
                <div class="font-semibold text-gray-900">${escapeHtml(match.player1Alias)}</div>
                <div class="text-2xl font-bold text-blue-600">${match.score1}</div>
              </div>
              <div class="text-center text-gray-400 font-semibold">${t('tournaments.detail.vs')}</div>
              <div class="text-center">
                <div class="font-semibold text-gray-900">${escapeHtml(match.player2Alias)}</div>
                <div class="text-2xl font-bold text-blue-600">${match.score2}</div>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  };

  // Show detail view for a tournament
  const showDetail = (tournament: UserTournament) => {
    // Push state with tournament data so browser forward button works
    // Include page so global router knows we're on tournaments
    window.history.pushState(
      { page: 'tournaments', myTournamentDetail: true, tournament },
      '',
      window.location.href
    );
    renderDetail(tournament);
  };

  backBtn.addEventListener('click', () => {
    window.history.back();
  });

  // Check if we navigated here with detail state (forward button)
  const initialState = window.history.state;
  if (initialState?.myTournamentDetail && initialState?.tournament) {
    loadingEl.classList.add('hidden');
    renderDetail(initialState.tournament);
    return; // Don't load list, we're showing detail
  }

  try {
    const response = await fetch('/api/tournaments/me');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: { tournaments: UserTournament[]; total: number } = await response.json();

    loadingEl.classList.add('hidden');
    listEl.classList.remove('hidden');

    if (data.tournaments.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
          </svg>
          <p>${t('tournaments.my.empty')}</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = data.tournaments
      .map(
        (tournament) => `
      <div class="border rounded-lg p-4 hover:shadow-md transition cursor-pointer my-tournament-card" data-id="${tournament.id}">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-semibold text-gray-900">${t('tournaments.my.players', { count: tournament.playerCount })}</h4>
              ${
                tournament.blockchainId !== null
                  ? `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/>
                  </svg>
                  #${tournament.blockchainId}
                </span>
              `
                  : `
                <span class="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">${t('tournaments.my.status.pending')}</span>
              `
              }
            </div>
            <p class="text-sm text-gray-600 mt-1">${t('tournaments.my.winner', { name: escapeHtml(tournament.winner) })}</p>
            <p class="text-xs text-gray-400 mt-1">${new Date(tournament.createdAt).toLocaleString()}</p>
          </div>
          <button class="text-blue-600 hover:text-blue-800 text-sm font-medium" data-id="${tournament.id}">
            ${t('tournaments.my.view')} →
          </button>
        </div>
      </div>
    `
      )
      .join('');

    // Add click handlers for tournament cards
    const tournaments = data.tournaments;
    listEl.querySelectorAll('.my-tournament-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const tournament = tournaments.find((to) => to.id === id);
        if (tournament) showDetail(tournament);
      });
    });
  } catch (err) {
    console.error('Error loading user tournaments:', err);
    loadingEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    listEl.innerHTML = `
      <div class="text-center py-8 text-red-500">
        Failed to load your tournaments. Please try again later.
      </div>
    `;
  }
}

// Load global tournaments from database
async function loadGlobalTournaments() {
  const loadingEl = document.getElementById('global-tournaments-loading');
  const listEl = document.getElementById('global-tournaments-list');
  const detailEl = document.getElementById('global-tournaments-detail');
  const detailContentEl = document.getElementById('global-tournaments-detail-content');
  const backBtn = document.getElementById('back-to-global-list');

  if (!loadingEl || !listEl || !detailEl || !detailContentEl || !backBtn) return;

  // Hide detail view and show list
  const showList = () => {
    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
  };

  // Handle browser back/forward buttons
  const handlePopState = (e: PopStateEvent) => {
    if (e.state?.globalTournamentDetail) {
      // This is a tournament detail state - stop other handlers
      e.stopImmediatePropagation();
      if (e.state?.tournament) {
        // Going forward to detail view - re-render the detail
        renderDetail(e.state.tournament);
      } else {
        // Going back to list view (detail flag but no data)
        showList();
      }
    }
  };
  // Use capture phase to run before global handler
  window.addEventListener('popstate', handlePopState, true);

  // Render detail view content (used by showDetail and popstate)
  const renderDetail = (tournament: UserTournament) => {
    listEl.classList.add('hidden');
    detailEl.classList.remove('hidden');

    const maxRound = Math.max(...tournament.matches.map((m) => m.round));

    detailContentEl.innerHTML = `
      <div class="mb-6">
        <h3 class="text-xl font-semibold text-gray-900 mb-2">${escapeHtml(tournament.organizerAlias)}'s Tournament</h3>
        <div class="flex flex-wrap gap-4 text-sm text-gray-600">
          <div>${t('tournaments.my.players', { count: tournament.playerCount })}</div>
          <div>${t('tournaments.my.winner', { name: escapeHtml(tournament.winner) })}</div>
          <div>${t('tournaments.detail.recorded')}: ${new Date(tournament.createdAt).toLocaleString()}</div>
        </div>
        ${
          tournament.blockchainId !== null
            ? `
          <div class="mt-2 flex items-center gap-2 text-green-600 text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            ${t('tournaments.my.blockchain.verified')} - ID: ${tournament.blockchainId}
          </div>
          ${
            tournament.txHash
              ? `
          <a href="https://testnet.snowtrace.io/tx/${tournament.txHash}" target="_blank" rel="noopener noreferrer"
             class="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block">
            ${t('tournaments.detail.txhash')}: ${formatAddress(tournament.txHash)}
          </a>
          `
              : ''
          }
        `
            : `
          <div class="mt-2 text-yellow-600 text-sm">${t('tournaments.my.blockchain.pending')}</div>
        `
        }
      </div>

      <div class="space-y-4">
        ${tournament.matches
          .map(
            (match) => `
          <div class="bg-gray-50 border rounded-lg p-4">
            <div class="text-xs text-gray-500 mb-2">
              ${match.round === maxRound ? t('tournaments.detail.finals') : t('tournaments.detail.round', { round: match.round })}
            </div>
            <div class="grid grid-cols-3 gap-4 items-center">
              <div class="text-center">
                <div class="font-semibold text-gray-900">${escapeHtml(match.player1Alias)}</div>
                <div class="text-2xl font-bold text-blue-600">${match.score1}</div>
              </div>
              <div class="text-center text-gray-400 font-semibold">${t('tournaments.detail.vs')}</div>
              <div class="text-center">
                <div class="font-semibold text-gray-900">${escapeHtml(match.player2Alias)}</div>
                <div class="text-2xl font-bold text-blue-600">${match.score2}</div>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  };

  // Show detail view for a tournament
  const showDetail = (tournament: UserTournament) => {
    // Push state with tournament data so browser forward button works
    // Include page so global router knows we're on tournaments
    window.history.pushState(
      { page: 'tournaments', globalTournamentDetail: true, tournament },
      '',
      window.location.href
    );
    renderDetail(tournament);
  };

  backBtn.addEventListener('click', () => {
    window.history.back();
  });

  // Check if we navigated here with detail state (forward button)
  const initialState = window.history.state;
  if (initialState?.globalTournamentDetail && initialState?.tournament) {
    loadingEl.classList.add('hidden');
    renderDetail(initialState.tournament);
    return; // Don't load list, we're showing detail
  }

  try {
    const response = await fetch('/api/tournaments/recent?limit=20');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: { tournaments: UserTournament[]; total: number } = await response.json();

    loadingEl.classList.add('hidden');
    listEl.classList.remove('hidden');

    if (data.tournaments.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
          </svg>
          <p>${t('tournaments.global.empty')}</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = data.tournaments
      .map(
        (tournament) => `
      <div class="border rounded-lg p-4 hover:shadow-md transition cursor-pointer global-tournament-card" data-id="${tournament.id}">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-semibold text-gray-900">${escapeHtml(tournament.organizerAlias)}</h4>
              ${
                tournament.blockchainId !== null
                  ? `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/>
                  </svg>
                  #${tournament.blockchainId}
                </span>
              `
                  : `
                <span class="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">${t('tournaments.my.status.pending')}</span>
              `
              }
            </div>
            <p class="text-sm text-gray-600 mt-1">${t('tournaments.my.players', { count: tournament.playerCount })} · ${t('tournaments.my.winner', { name: escapeHtml(tournament.winner) })}</p>
            <p class="text-xs text-gray-400 mt-1">${new Date(tournament.createdAt).toLocaleString()}</p>
          </div>
          <button class="text-blue-600 hover:text-blue-800 text-sm font-medium" data-id="${tournament.id}">
            ${t('tournaments.my.view')} →
          </button>
        </div>
      </div>
    `
      )
      .join('');

    // Add click handlers for tournament cards
    const tournaments = data.tournaments;
    listEl.querySelectorAll('.global-tournament-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const tournament = tournaments.find((to) => to.id === id);
        if (tournament) showDetail(tournament);
      });
    });
  } catch (err) {
    console.error('Error loading global tournaments:', err);
    loadingEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    listEl.innerHTML = `
      <div class="text-center py-8 text-red-500">
        Failed to load tournaments. Please try again later.
      </div>
    `;
  }
}
