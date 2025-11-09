import { PongGame } from '../game/pong'

export function renderPlayPage(
  app: HTMLElement,
  renderNavBar: (page: 'home' | 'play' | 'tournaments') => string,
  setupNavigation: () => void
): void {
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${renderNavBar('play')}

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Mode Selection -->
        <div id="mode-selection" class="mb-8">
          <h2 class="text-3xl font-bold text-gray-900 mb-4">Play Pong</h2>
          <p class="text-gray-600 mb-6">Choose a game mode to start playing</p>
          <div class="flex gap-4">
            <button id="local-game-btn" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
              Local Game (1v1)
            </button>
            <button id="tournament-btn" class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold">
              Tournament
            </button>
          </div>
        </div>

        <!-- Game Setup Screen -->
        <div id="game-setup" class="hidden">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <h3 class="text-2xl font-bold text-gray-900 mb-6">Game Setup</h3>

            <div class="space-y-4">
              <div>
                <label for="player1-alias" class="block text-sm font-medium text-gray-700 mb-2">
                  Player 1 Alias
                </label>
                <input
                  type="text"
                  id="player1-alias"
                  placeholder="Enter name..."
                  maxlength="20"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label for="player2-alias" class="block text-sm font-medium text-gray-700 mb-2">
                  Player 2 Alias
                </label>
                <input
                  type="text"
                  id="player2-alias"
                  placeholder="Enter name..."
                  maxlength="20"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-semibold text-blue-900 mb-2">Controls:</h4>
                <div class="text-sm text-blue-800 space-y-1">
                  <p><strong>Player 1:</strong> W (Up) / S (Down)</p>
                  <p><strong>Player 2:</strong> ↑ (Up) / ↓ (Down)</p>
                  <p><strong>Pause:</strong> SPACE or ESC</p>
                </div>
              </div>

              <div class="flex gap-4">
                <button id="start-game-btn" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
                  Start Game
                </button>
                <button id="back-to-mode-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                  Back
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
                End Game
              </button>
            </div>
          </div>
        </div>

        <!-- Game Result Screen -->
        <div id="result-screen" class="hidden">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto text-center">
            <h3 class="text-3xl font-bold text-gray-900 mb-4">Game Over!</h3>

            <div class="mb-6">
              <p class="text-5xl font-bold text-blue-600 mb-4" id="winner-name">Winner</p>
              <div class="flex justify-center gap-8 text-2xl">
                <div>
                  <p class="text-gray-600" id="result-player1">Player 1</p>
                  <p class="font-bold text-gray-900" id="result-score1">0</p>
                </div>
                <div class="text-gray-400">-</div>
                <div>
                  <p class="text-gray-600" id="result-player2">Player 2</p>
                  <p class="font-bold text-gray-900" id="result-score2">0</p>
                </div>
              </div>
            </div>

            <div class="flex gap-4 justify-center">
              <button id="play-again-btn" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                Play Again
              </button>
              <button id="back-to-menu-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                Back to Menu
              </button>
            </div>
          </div>
        </div>

        <!-- Tournament Screen (Placeholder) -->
        <div id="tournament-screen" class="hidden">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto text-center">
            <h3 class="text-2xl font-bold text-gray-900 mb-4">Tournament Mode</h3>
            <p class="text-gray-600 mb-6">Coming soon! Tournament mode will allow multiple players to compete in a bracket-style competition.</p>
            <button id="back-from-tournament-btn" class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  `

  // Setup navigation
  setupNavigation()

  setupPlayPageEvents()
}

function setupPlayPageEvents(): void {
  let currentGame: PongGame | null = null

  // Mode selection
  const localGameBtn = document.getElementById('local-game-btn')
  const tournamentBtn = document.getElementById('tournament-btn')

  // Screens
  const modeSelection = document.getElementById('mode-selection')
  const gameSetup = document.getElementById('game-setup')
  const gameScreen = document.getElementById('game-screen')
  const resultScreen = document.getElementById('result-screen')
  const tournamentScreen = document.getElementById('tournament-screen')

  // Setup screen elements
  const player1AliasInput = document.getElementById('player1-alias') as HTMLInputElement
  const player2AliasInput = document.getElementById('player2-alias') as HTMLInputElement
  const startGameBtn = document.getElementById('start-game-btn')
  const backToModeBtn = document.getElementById('back-to-mode-btn')

  // Game screen elements
  const canvas = document.getElementById('pong-canvas') as HTMLCanvasElement
  const endGameBtn = document.getElementById('end-game-btn')

  // Result screen elements
  const winnerNameEl = document.getElementById('winner-name')
  const resultPlayer1El = document.getElementById('result-player1')
  const resultScore1El = document.getElementById('result-score1')
  const resultPlayer2El = document.getElementById('result-player2')
  const resultScore2El = document.getElementById('result-score2')
  const playAgainBtn = document.getElementById('play-again-btn')
  const backToMenuBtn = document.getElementById('back-to-menu-btn')

  // Tournament elements
  const backFromTournamentBtn = document.getElementById('back-from-tournament-btn')

  function showScreen(screen: HTMLElement): void {
    modeSelection?.classList.add('hidden')
    gameSetup?.classList.add('hidden')
    gameScreen?.classList.add('hidden')
    resultScreen?.classList.add('hidden')
    tournamentScreen?.classList.add('hidden')
    screen.classList.remove('hidden')
  }

  // Event: Local Game button
  localGameBtn?.addEventListener('click', () => {
    showScreen(gameSetup!)
    player1AliasInput.value = ''
    player2AliasInput.value = ''
    player1AliasInput.focus()
  })

  // Event: Tournament button
  tournamentBtn?.addEventListener('click', () => {
    showScreen(tournamentScreen!)
  })

  // Event: Back to mode selection
  backToModeBtn?.addEventListener('click', () => {
    showScreen(modeSelection!)
  })

  backFromTournamentBtn?.addEventListener('click', () => {
    showScreen(modeSelection!)
  })

  // Event: Start game
  startGameBtn?.addEventListener('click', () => {
    const player1 = player1AliasInput.value.trim() || 'Player 1'
    const player2 = player2AliasInput.value.trim() || 'Player 2'

    if (currentGame) {
      currentGame.destroy()
    }

    currentGame = new PongGame(canvas, player1, player2)

    currentGame.setOnGameEnd((winner, score1, score2) => {
      // Show result screen after a short delay
      setTimeout(() => {
        showResultScreen(winner, player1, player2, score1, score2)
      }, 2000)
    })

    showScreen(gameScreen!)
    currentGame.start()
  })

  // Event: End game early
  endGameBtn?.addEventListener('click', () => {
    if (currentGame) {
      currentGame.destroy()
      currentGame = null
    }
    showScreen(modeSelection!)
  })

  // Event: Play again
  playAgainBtn?.addEventListener('click', () => {
    showScreen(gameSetup!)
    player1AliasInput.focus()
  })

  // Event: Back to menu from results
  backToMenuBtn?.addEventListener('click', () => {
    if (currentGame) {
      currentGame.destroy()
      currentGame = null
    }
    showScreen(modeSelection!)
  })

  function showResultScreen(
    winner: string,
    player1: string,
    player2: string,
    score1: number,
    score2: number
  ): void {
    if (winnerNameEl) winnerNameEl.textContent = `${winner} WINS!`
    if (resultPlayer1El) resultPlayer1El.textContent = player1
    if (resultScore1El) resultScore1El.textContent = score1.toString()
    if (resultPlayer2El) resultPlayer2El.textContent = player2
    if (resultScore2El) resultScore2El.textContent = score2.toString()

    showScreen(resultScreen!)
  }
}
