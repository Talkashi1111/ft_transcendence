import { t } from '../i18n/i18n';
import { escapeHtml } from '../utils/sanitize';

// Stats type definition
interface UserStats {
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  byMode: {
    tournament: { played: number; wins: number; losses: number };
    local1v1: { played: number; wins: number; losses: number };
    vsBot: { played: number; wins: number; losses: number };
    remote1v1: { played: number; wins: number; losses: number };
  };
  tournamentsOrganized: number;
  tournamentWins: number;
  recentMatches: {
    id: string;
    mode: string;
    player1Alias: string;
    player2Alias: string;
    score1: number;
    score2: number;
    won: boolean;
    playedAt: string;
  }[];
}

// Helper to format mode name for display
function formatModeName(mode: string): string {
  switch (mode) {
    case 'TOURNAMENT':
      return t('stats.mode.tournament');
    case 'LOCAL_1V1':
      return t('stats.mode.local1v1');
    case 'VS_BOT':
      return t('stats.mode.vsbot');
    case 'REMOTE_1V1':
      return t('stats.mode.remote1v1');
    default:
      return mode;
  }
}

// Helper to get mode badge color
function getModeColor(mode: string): string {
  switch (mode) {
    case 'TOURNAMENT':
      return 'bg-purple-100 text-purple-700';
    case 'LOCAL_1V1':
      return 'bg-blue-100 text-blue-700';
    case 'VS_BOT':
      return 'bg-orange-100 text-orange-700';
    case 'REMOTE_1V1':
      return 'bg-cyan-100 text-cyan-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export async function renderStatsPage(
  app: HTMLElement,
  renderNavBar: (
    page: 'home' | 'login' | 'register' | 'play' | 'tournaments' | 'settings' | 'stats' | 'friends'
  ) => Promise<string>,
  setupNavigation: () => void
): Promise<void> {
  const navBar = await renderNavBar('stats');

  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${navBar}

      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-8">${t('stats.title')}</h1>

        <!-- Loading State -->
        <div id="stats-loading" class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p class="mt-4 text-gray-600">${t('stats.loading')}</p>
        </div>

        <!-- Error State -->
        <div id="stats-error" class="hidden text-center py-8">
          <div class="text-red-600 text-lg">${t('stats.error')}</div>
        </div>

        <!-- Stats Content -->
        <div id="stats-content" class="hidden space-y-8">
          <!-- Overview Stats -->
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">${t('stats.overview')}</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="bg-gray-50 rounded-lg p-4 text-center">
                <div id="stat-total" class="text-3xl font-bold text-gray-900">-</div>
                <div class="text-sm text-gray-600">${t('stats.total.games')}</div>
              </div>
              <div class="bg-green-50 rounded-lg p-4 text-center">
                <div id="stat-wins" class="text-3xl font-bold text-green-600">-</div>
                <div class="text-sm text-gray-600">${t('stats.wins')}</div>
              </div>
              <div class="bg-red-50 rounded-lg p-4 text-center">
                <div id="stat-losses" class="text-3xl font-bold text-red-600">-</div>
                <div class="text-sm text-gray-600">${t('stats.losses')}</div>
              </div>
              <div class="bg-blue-50 rounded-lg p-4 text-center">
                <div id="stat-winrate" class="text-3xl font-bold text-blue-600">-%</div>
                <div class="text-sm text-gray-600">${t('stats.winrate')}</div>
              </div>
            </div>
          </div>

          <!-- Tournament Stats -->
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">${t('stats.tournaments.title')}</h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-purple-50 rounded-lg p-4 text-center">
                <div id="stat-tournaments-organized" class="text-2xl font-bold text-purple-600">-</div>
                <div class="text-sm text-gray-600">${t('stats.tournaments.organized')}</div>
              </div>
              <div class="bg-yellow-50 rounded-lg p-4 text-center">
                <div id="stat-tournaments-won" class="text-2xl font-bold text-yellow-600">-</div>
                <div class="text-sm text-gray-600">${t('stats.tournaments.won')}</div>
              </div>
            </div>
          </div>

          <!-- Stats by Mode -->
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">${t('stats.bymode')}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="border rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-1 text-xs rounded ${getModeColor('TOURNAMENT')}">${t('stats.mode.tournament')}</span>
                </div>
                <div id="stat-mode-tournament" class="text-lg font-medium text-gray-900">-</div>
              </div>
              <div class="border rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-1 text-xs rounded ${getModeColor('LOCAL_1V1')}">${t('stats.mode.local1v1')}</span>
                </div>
                <div id="stat-mode-local1v1" class="text-lg font-medium text-gray-900">-</div>
              </div>
              <div class="border rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-1 text-xs rounded ${getModeColor('VS_BOT')}">${t('stats.mode.vsbot')}</span>
                </div>
                <div id="stat-mode-vsbot" class="text-lg font-medium text-gray-900">-</div>
              </div>
              <div class="border rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-1 text-xs rounded ${getModeColor('REMOTE_1V1')}">${t('stats.mode.remote1v1')}</span>
                </div>
                <div id="stat-mode-remote1v1" class="text-lg font-medium text-gray-900">-</div>
              </div>
            </div>
          </div>

          <!-- Recent Matches -->
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">${t('stats.recent')}</h2>
            <div id="recent-matches" class="space-y-3">
              <div class="text-center py-4 text-gray-500">${t('stats.recent.empty')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupNavigation();
  loadUserStats();
}

async function loadUserStats(): Promise<void> {
  const loadingEl = document.getElementById('stats-loading');
  const errorEl = document.getElementById('stats-error');
  const contentEl = document.getElementById('stats-content');

  if (!loadingEl || !errorEl || !contentEl) return;

  try {
    const response = await fetch('/api/users/me/stats');

    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }

    const stats: UserStats = await response.json();

    // Update overview stats
    const totalEl = document.getElementById('stat-total');
    const winsEl = document.getElementById('stat-wins');
    const lossesEl = document.getElementById('stat-losses');
    const winrateEl = document.getElementById('stat-winrate');

    if (totalEl) totalEl.textContent = stats.totalGames.toString();
    if (winsEl) winsEl.textContent = stats.totalWins.toString();
    if (lossesEl) lossesEl.textContent = stats.totalLosses.toString();
    if (winrateEl) winrateEl.textContent = `${stats.winRate}%`;

    // Update tournament stats
    const tournamentsOrganizedEl = document.getElementById('stat-tournaments-organized');
    const tournamentsWonEl = document.getElementById('stat-tournaments-won');

    if (tournamentsOrganizedEl)
      tournamentsOrganizedEl.textContent = stats.tournamentsOrganized.toString();
    if (tournamentsWonEl) tournamentsWonEl.textContent = stats.tournamentWins.toString();

    // Update mode stats - clearer format
    const formatModeStats = (mode: { played: number; wins: number; losses: number }) =>
      `${mode.played} ${t('stats.games')} · ${mode.wins} ${t('stats.wins').toLowerCase()} / ${mode.losses} ${t('stats.losses').toLowerCase()}`;

    const tournamentModeEl = document.getElementById('stat-mode-tournament');
    const local1v1ModeEl = document.getElementById('stat-mode-local1v1');
    const vsbotModeEl = document.getElementById('stat-mode-vsbot');
    const remote1v1ModeEl = document.getElementById('stat-mode-remote1v1');

    if (tournamentModeEl) tournamentModeEl.textContent = formatModeStats(stats.byMode.tournament);
    if (local1v1ModeEl) local1v1ModeEl.textContent = formatModeStats(stats.byMode.local1v1);
    if (vsbotModeEl) vsbotModeEl.textContent = formatModeStats(stats.byMode.vsBot);
    if (remote1v1ModeEl) remote1v1ModeEl.textContent = formatModeStats(stats.byMode.remote1v1);

    // Update recent matches with mode badges
    const recentMatchesEl = document.getElementById('recent-matches');
    if (recentMatchesEl) {
      if (stats.recentMatches.length === 0) {
        recentMatchesEl.innerHTML = `<div class="text-center py-4 text-gray-500">${t('stats.recent.empty')}</div>`;
      } else {
        recentMatchesEl.innerHTML = stats.recentMatches
          .map(
            (match) => `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2 py-1 text-xs rounded font-medium ${match.won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                ${match.won ? t('stats.recent.won') : t('stats.recent.lost')}
              </span>
              <span class="px-2 py-1 text-xs rounded ${getModeColor(match.mode)}">
                ${formatModeName(match.mode)}
              </span>
              <span class="text-sm text-gray-900">
                ${escapeHtml(match.player1Alias)} vs ${escapeHtml(match.player2Alias)}
              </span>
            </div>
            <div class="flex items-center gap-4">
              <span class="font-medium text-gray-900 text-lg">${match.score1} - ${match.score2}</span>
              <span class="text-xs text-gray-500">${new Date(match.playedAt).toLocaleDateString()}</span>
            </div>
          </div>
        `
          )
          .join('');
      }
    }

    // Show content
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
  } catch (error) {
    console.error('Failed to load stats:', error);
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
  }
}
