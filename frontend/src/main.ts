import './index.css'

// Types
interface Match {
  matchId: string
  tournamentId: string
  player1Id: string
  player1Alias: string
  player2Id: string
  player2Alias: string
  score1: string
  score2: string
  timestamp: string
  recordedBy: string
}

interface TournamentData {
  tournamentId: number
  matchIds: string[]
  matches: Match[]
}

// Utility functions
function formatAddress(address: string): string {
  if (address.length <= 18) {
    return address
  }
  return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`
}

// Router
let currentPage = 'home'

function navigate(page: string) {
  currentPage = page
  render()
}

// Render function
function render() {
  const app = document.getElementById('root')
  if (!app) return

  if (currentPage === 'home') {
    renderHome(app)
  } else if (currentPage === 'tournaments') {
    renderTournaments(app)
  }
}

// Navigation bar component
function renderNavBar(activePage: 'home' | 'tournaments'): string {
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
            <button id="nav-tournaments" class="px-3 py-2 rounded-md text-sm font-medium ${activePage === 'tournaments' ? 'text-white bg-blue-600' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}">
              Tournaments
            </button>
          </div>
        </div>
      </div>
    </nav>
  `
}

// Home page
function renderHome(app: HTMLElement) {
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${renderNavBar('home')}

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="max-w-2xl mx-auto">
          <div class="bg-white rounded-lg shadow-lg p-8">
            <h2 class="text-3xl font-bold text-gray-900 mb-6">Welcome</h2>

            <div class="space-y-6">
              <div class="p-4 bg-blue-50 rounded-lg">
                <h3 class="text-xl font-semibold text-blue-800 mb-2">Counter Demo</h3>
                <div class="flex items-center justify-between">
                  <button id="decrement" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition">
                    -
                  </button>
                  <span id="counter" class="text-3xl font-bold text-gray-800">0</span>
                  <button id="increment" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition">
                    +
                  </button>
                </div>
                <div id="error" class="mt-2 text-red-600 text-sm hidden"></div>
              </div>

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
  `

  // Setup navigation
  setupNavigation()

  // Setup counter
  setupCounter()
}

// Tournaments page
function renderTournaments(app: HTMLElement) {
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${renderNavBar('tournaments')}

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
  `

  // Setup navigation
  setupNavigation()

  // Setup tournament loading
  setupTournamentLoader()
}

// Setup navigation
function setupNavigation() {
  const homeBtn = document.getElementById('nav-home')
  const tournamentsBtn = document.getElementById('nav-tournaments')

  homeBtn?.addEventListener('click', () => navigate('home'))
  tournamentsBtn?.addEventListener('click', () => navigate('tournaments'))
}

// Setup counter functionality
function setupCounter() {
  const counterEl = document.getElementById('counter')
  const incrementBtn = document.getElementById('increment')
  const decrementBtn = document.getElementById('decrement')
  const errorEl = document.getElementById('error')

  if (!counterEl || !incrementBtn || !decrementBtn || !errorEl) return

  let count = 0

  const fetchCounter = async () => {
    try {
      const response = await fetch('/api/counter')
      if (!response.ok) {
        throw new Error('Failed to fetch counter')
      }
      const data = await response.json()
      count = data.value
      counterEl.textContent = count.toString()
    } catch (err) {
      showError('Failed to load counter from server')
      console.error(err)
    }
  }

  const updateCounter = async (newValue: number) => {
    try {
      const response = await fetch('/api/counter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue }),
      })
      if (!response.ok) {
        throw new Error('Failed to update counter')
      }
      count = newValue
      counterEl.textContent = count.toString()
      hideError()
    } catch (err) {
      showError('Failed to update counter on server')
      console.error(err)
    }
  }

  const showError = (message: string) => {
    errorEl.textContent = message
    errorEl.classList.remove('hidden')
  }

  const hideError = () => {
    errorEl.classList.add('hidden')
  }

  incrementBtn.addEventListener('click', () => {
    updateCounter(count + 1)
  })

  decrementBtn.addEventListener('click', () => {
    updateCounter(count - 1)
  })

  fetchCounter()
}

// Setup tournament loader
function setupTournamentLoader() {
  const loadBtn = document.getElementById('load-tournament')
  const tournamentIdInput = document.getElementById('tournament-id') as HTMLInputElement
  const matchesContainer = document.getElementById('matches-container')
  const loadingEl = document.getElementById('loading')
  const errorMessageEl = document.getElementById('error-message')

  if (!loadBtn || !tournamentIdInput || !matchesContainer || !loadingEl || !errorMessageEl) return

  const showLoading = () => {
    loadingEl.classList.remove('hidden')
    matchesContainer.innerHTML = ''
    errorMessageEl.classList.add('hidden')
  }

  const hideLoading = () => {
    loadingEl.classList.add('hidden')
  }

  const showError = (message: string) => {
    errorMessageEl.querySelector('p')!.textContent = message
    errorMessageEl.classList.remove('hidden')
    hideLoading()
  }

  const renderMatches = (data: TournamentData) => {
    hideLoading()

    if (data.matches.length === 0) {
      matchesContainer.innerHTML = `
        <div class="text-center py-12 text-gray-500">
          No matches found for tournament ${data.tournamentId}
        </div>
      `
      return
    }

    matchesContainer.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 class="font-semibold text-blue-900">Tournament ID: ${data.tournamentId}</h3>
        <p class="text-blue-700 text-sm">Total Matches: ${data.matches.length}</p>
      </div>
      ${data.matches.map(match => `
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
      `).join('')}
    `
  }

  const loadTournament = async () => {
    const tournamentId = tournamentIdInput.value.trim()

    if (!tournamentId || isNaN(Number(tournamentId))) {
      showError('Please enter a valid tournament ID')
      return
    }

    showLoading()

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/matches`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: TournamentData = await response.json()
      renderMatches(data)
    } catch (err) {
      console.error('Error loading tournament:', err)
      showError(`Failed to load tournament matches: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  loadBtn.addEventListener('click', loadTournament)

  tournamentIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadTournament()
    }
  })
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  render()
})
