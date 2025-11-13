import { PongGame } from '../game/pong'
import { TournamentManager } from '../game/tournament'
import type { TournamentMatch } from '../types/tournament'

// Constants
const GAME_END_DELAY_MS = 2000 // Delay before showing result screen after game ends

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
  `

  // Setup navigation
  setupNavigation()

  setupPlayPageEvents()
}

function setupPlayPageEvents(): void {
  let currentGame: PongGame | null = null
  let tournamentManager: TournamentManager | null = null

  // Mode selection
  const localGameBtn = document.getElementById('local-game-btn')
  const tournamentBtn = document.getElementById('tournament-btn')

  // Screens
  const modeSelection = document.getElementById('mode-selection')
  const gameSetup = document.getElementById('game-setup')
  const gameScreen = document.getElementById('game-screen')
  const resultScreen = document.getElementById('result-screen')
  const tournamentScreen = document.getElementById('tournament-screen')
  const tournamentRegistration = document.getElementById('tournament-registration')
  const tournamentBracket = document.getElementById('tournament-bracket')

  // Setup screen elements
  const player1AliasInput = document.getElementById('player1-alias') as HTMLInputElement
  const player2AliasInput = document.getElementById('player2-alias') as HTMLInputElement
  const startGameBtn = document.getElementById('start-game-btn')
  const backToModeBtn = document.getElementById('back-to-mode-btn')

  // Tournament elements
  const tournamentPlayerAliasInput = document.getElementById('tournament-player-alias') as HTMLInputElement
  const addTournamentPlayerBtn = document.getElementById('add-tournament-player-btn')
  const tournamentPlayersList = document.getElementById('tournament-players-list')
  const tournamentPlayerCount = document.getElementById('tournament-player-count')
  const tournamentStatusMessage = document.getElementById('tournament-status-message')
  const startTournamentBtn = document.getElementById('start-tournament-btn')
  const backFromTournamentBtn = document.getElementById('back-from-tournament-btn')
  const endTournamentBtn = document.getElementById('end-tournament-btn')
  const tournamentCurrentMatch = document.getElementById('tournament-current-match')
  const tournamentBracketDisplay = document.getElementById('tournament-bracket-display')

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

  function showScreen(screen: HTMLElement): void {
    modeSelection?.classList.add('hidden')
    gameSetup?.classList.add('hidden')
    gameScreen?.classList.add('hidden')
    resultScreen?.classList.add('hidden')
    tournamentScreen?.classList.add('hidden')
    screen.classList.remove('hidden')
  }

  function showTournamentPhase(phase: 'registration' | 'bracket'): void {
    tournamentRegistration?.classList.toggle('hidden', phase !== 'registration')
    tournamentBracket?.classList.toggle('hidden', phase !== 'bracket')
  }

  function updateTournamentUI(): void {
    if (!tournamentManager) return

    const playerCount = tournamentManager.getPlayerCount()
    if (tournamentPlayerCount) {
      tournamentPlayerCount.textContent = playerCount.toString()
    }

    // Update start button state
    if (startTournamentBtn) {
      ;(startTournamentBtn as HTMLButtonElement).disabled = !tournamentManager.canStartTournament()
    }

    // Update status message
    if (tournamentStatusMessage) {
      if (playerCount === 0) {
        tournamentStatusMessage.textContent = 'Add at least 2 players to start'
      } else if (playerCount === 1) {
        tournamentStatusMessage.textContent = 'Need at least 1 more player'
      } else if (playerCount < 8) {
        tournamentStatusMessage.textContent = `Ready to start! (Can add ${8 - playerCount} more)`
      } else {
        tournamentStatusMessage.textContent = 'Tournament is full!'
      }
    }

    // Render players list
    if (tournamentPlayersList) {
      const players = tournamentManager.getTournament().players
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
        .join('')

      // Add event listeners to remove buttons
      document.querySelectorAll('.remove-player-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const playerId = parseInt((e.target as HTMLElement).dataset.playerId || '0')
          if (tournamentManager && tournamentManager.removePlayer(playerId)) {
            updateTournamentUI()
          }
        })
      })
    }
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  function startNextTournamentMatch(): void {
    if (!tournamentManager) return

    const match = tournamentManager.getCurrentMatch()
    if (!match) {
      // Tournament is complete
      showTournamentWinner()
      return
    }

    // Display match info
    if (tournamentCurrentMatch) {
      const bracket = tournamentManager.getBracket()
      let round = 1
      for (let i = 0; i < bracket.length; i++) {
        if (bracket[i].some((m: TournamentMatch) => m.matchId === match.matchId)) {
          round = i + 1
          break
        }
      }

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
      `

      const playMatchBtn = document.getElementById('playMatchBtn')
      if (playMatchBtn) {
        playMatchBtn.addEventListener('click', () => {
          startMatchGame(match)
        })
      }
    }
  }

  function startMatchGame(match: TournamentMatch): void {
    // Destroy any existing game first
    if (currentGame) {
      currentGame.destroy()
      currentGame = null
    }

    // Hide tournament UI, show game canvas
    if (tournamentBracket) tournamentBracket.classList.add('hidden')
    if (gameScreen) gameScreen.classList.remove('hidden')
    if (canvas) canvas.classList.remove('hidden')

    // Create game with tournament players
    currentGame = new PongGame(
      canvas,
      match.player1.alias,
      match.player2.alias
    )

    // Set up game end callback
    currentGame.setOnGameEnd((winner: string, player1Score: number, player2Score: number) => {
      // Determine winner ID based on name
      const winnerId = winner === match.player1.alias ? match.player1.id : match.player2.id
      handleMatchEnd(match.matchId, winnerId, player1Score, player2Score)
    })

    currentGame.start()
  }

  function handleMatchEnd(matchId: number, winnerId: number, score1: number, score2: number): void {
    if (!tournamentManager) return

    // Clean up the game
    if (currentGame) {
      currentGame.destroy()
      currentGame = null
    }

    // Record the result
    tournamentManager.recordMatchResult(matchId, winnerId, score1, score2)

    // Hide game canvas
    if (gameScreen) gameScreen.classList.add('hidden')
    if (canvas) canvas.classList.add('hidden')

    // Show tournament bracket
    if (tournamentBracket) tournamentBracket.classList.remove('hidden')

    // Update bracket visualization
    renderTournamentBracket()

    // Check if tournament is complete
    const nextMatch = tournamentManager.getCurrentMatch()
    if (!nextMatch) {
      showTournamentWinner()
    } else {
      startNextTournamentMatch()
    }
  }

  function renderTournamentBracket(): void {
    if (!tournamentManager || !tournamentBracketDisplay) return

    const tournament = tournamentManager.getTournament()
    const bracket = tournamentManager.getBracket()
    const currentMatch = tournamentManager.getCurrentMatch()
    const playerCount = tournament.players.length

    // Calculate total rounds needed
    let totalRounds = 0
    let temp = playerCount
    while (temp > 1) {
      totalRounds++
      temp = Math.ceil(temp / 2)
    }

    // Render bracket without SVG lines for now (simpler)
    let html = '<div style="position: relative; display: flex; gap: 60px; overflow-x: auto; padding: 40px; background: #1f2937; border-radius: 8px;">'

    // Render each round as a column
    for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
      const isLastRound = roundIndex === totalRounds - 1
      const roundMatches = bracket[roundIndex] || []

      // For Round 1, only show actual matches (no TBD placeholders)
      // For later rounds, show expected matches including TBD placeholders
      let matchesToShow: number
      if (roundIndex === 0) {
        matchesToShow = roundMatches.length
      } else {
        const expectedMatches = Math.ceil(Math.pow(2, totalRounds - roundIndex - 1))
        matchesToShow = Math.max(roundMatches.length, expectedMatches)
      }

      // Calculate vertical spacing based on round
      const matchHeight = 100 // Height for each match box (2 players)
      const playerHeight = 45 // Height for each player slot
      const baseGap = 20
      const verticalGap = baseGap * Math.pow(2, roundIndex)

      html += `
        <div class="round-column" style="display: flex; flex-direction: column; min-width: 220px;">
          <h3 class="text-lg font-bold mb-6 text-center text-white">
            ${isLastRound ? 'Finals' : `Round ${roundIndex + 1}`}
          </h3>
          <div style="display: flex; flex-direction: column; gap: ${verticalGap}px;">
      `

      // Show actual matches or TBD placeholders
      for (let i = 0; i < matchesToShow; i++) {
        const match = roundMatches[i]

        if (match) {
          // Real match with players (including pre-generated matches with TBD)
          const isCurrent = currentMatch?.matchId === match.matchId
          const isComplete = match.status === 'finished'

          let borderColor = 'border-gray-600'
          let bgColor = 'bg-gray-800'

          if (isCurrent) {
            borderColor = 'border-yellow-400'
            bgColor = 'bg-yellow-900/30'
          } else if (isComplete) {
            borderColor = 'border-green-600'
          }

          // Determine if players are TBD and style accordingly
          const p1IsTBD = match.player1.alias === 'TBD'
          const p2IsTBD = match.player2.alias === 'TBD'
          const p1IsWinner = match.winner?.id === match.player1.id
          const p2IsWinner = match.winner?.id === match.player2.id

          // Style for each player
          const getPlayerStyle = (isWinner: boolean, isLoser: boolean, isTBD: boolean) => {
            if (isTBD) return 'text-gray-500 italic'
            if (isWinner) return 'text-green-400 font-bold'
            if (isLoser) return 'text-gray-500 line-through opacity-50'
            return 'text-white'
          }

          const p1Style = getPlayerStyle(p1IsWinner, p2IsWinner && isComplete, p1IsTBD)
          const p2Style = getPlayerStyle(p2IsWinner, p1IsWinner && isComplete, p2IsTBD)

          html += `
            <div class="match-box border-2 ${borderColor} rounded-lg ${bgColor} overflow-hidden" style="height: ${matchHeight}px;">
              <!-- Player 1 -->
              <div class="flex justify-between items-center px-3 py-2 border-b border-gray-700" style="height: ${playerHeight}px;">
                <span class="text-sm ${p1Style}">
                  ${escapeHtml(match.player1.alias)}
                </span>
                <span class="text-sm ${p1IsTBD ? 'text-gray-600' : 'text-white font-semibold'}">${p1IsTBD ? '-' : match.player1Score}</span>
              </div>

              <!-- Player 2 -->
              <div class="flex justify-between items-center px-3 py-2" style="height: ${playerHeight}px;">
                <span class="text-sm ${p2Style}">
                  ${escapeHtml(match.player2.alias)}
                </span>
                <span class="text-sm ${p2IsTBD ? 'text-gray-600' : 'text-white font-semibold'}">${p2IsTBD ? '-' : match.player2Score}</span>
              </div>
            </div>
          `
        } else {
          // Pure TBD placeholder for rounds that haven't been generated yet
          html += `
            <div class="match-box border-2 border-gray-700 border-dashed rounded-lg bg-gray-900/20 overflow-hidden" style="height: ${matchHeight}px;">
              <!-- Player 1 -->
              <div class="flex justify-between items-center px-3 py-2 border-b border-gray-700" style="height: ${playerHeight}px;">
                <span class="text-sm text-gray-600 italic">TBD</span>
                <span class="text-sm text-gray-600">-</span>
              </div>

              <!-- Player 2 -->
              <div class="flex justify-between items-center px-3 py-2" style="height: ${playerHeight}px;">
                <span class="text-sm text-gray-600 italic">TBD</span>
                <span class="text-sm text-gray-600">-</span>
              </div>
            </div>
          `
        }
      }

      html += `
          </div>
        </div>
      `
    }

    html += '</div>'
    tournamentBracketDisplay.innerHTML = html
  }

  function showTournamentWinner(): void {
    if (!tournamentManager || !tournamentCurrentMatch) return

    const bracket = tournamentManager.getBracket()
    const finalMatch = bracket[bracket.length - 1]?.[0]

    if (finalMatch?.winner) {
      const winner = finalMatch.winner

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
      `

      const newTournamentBtn = document.getElementById('newTournamentBtn')
      if (newTournamentBtn) {
        newTournamentBtn.addEventListener('click', () => {
          resetTournament()
        })
      }
    }
  }

  function resetTournament(): void {
    // Clean up any running game
    if (currentGame) {
      currentGame.destroy()
      currentGame = null
    }

    tournamentManager = new TournamentManager()
    showTournamentPhase('registration')
    updateTournamentUI()
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
    // Create new tournament
    tournamentManager = new TournamentManager()
    updateTournamentUI()
    showTournamentPhase('registration')
    showScreen(tournamentScreen!)
    tournamentPlayerAliasInput?.focus()
  })

  // Event: Add tournament player
  const handleAddPlayer = () => {
    if (!tournamentManager || !tournamentPlayerAliasInput) return

    const alias = tournamentPlayerAliasInput.value.trim()
    if (alias === '') {
      alert('Please enter a player alias')
      return
    }

    if (tournamentManager.addPlayer(alias)) {
      tournamentPlayerAliasInput.value = ''
      updateTournamentUI()
      tournamentPlayerAliasInput.focus()
    } else {
      if (!tournamentManager.canAddPlayers()) {
        alert('Tournament is full (8 players max)')
      } else {
        alert('This alias is already taken')
      }
    }
  }

  addTournamentPlayerBtn?.addEventListener('click', handleAddPlayer)
  tournamentPlayerAliasInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAddPlayer()
    }
  })

  // Event: Start tournament
  startTournamentBtn?.addEventListener('click', () => {
    if (!tournamentManager) return

    if (tournamentManager.startTournament()) {
      showTournamentPhase('bracket')
      renderTournamentBracket() // Show full bracket with TBD
      startNextTournamentMatch()
    } else {
      alert('Cannot start tournament. Need at least 2 players.')
    }
  })

  // Event: Back to mode selection
  backToModeBtn?.addEventListener('click', () => {
    showScreen(modeSelection!)
  })

  backFromTournamentBtn?.addEventListener('click', () => {
    // Clean up any running game
    if (currentGame) {
      currentGame.destroy()
      currentGame = null
    }

    showScreen(modeSelection!)
    tournamentManager = null
  })

  // Event: End Tournament button
  endTournamentBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to end this tournament? All progress will be lost.')) {
      // Clean up any running game
      if (currentGame) {
        currentGame.destroy()
        currentGame = null
      }

      // Reset tournament
      showScreen(modeSelection!)
      tournamentManager = null
    }
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
      // Show result screen after a short delay to let players see final game state
      setTimeout(() => {
        showResultScreen(winner, player1, player2, score1, score2)
      }, GAME_END_DELAY_MS)
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

    // If we're in a tournament, go back to tournament bracket
    if (tournamentManager && tournamentManager.getTournament().status === 'in-progress') {
      if (tournamentBracket) tournamentBracket.classList.remove('hidden')
      if (gameScreen) gameScreen.classList.add('hidden')
      showScreen(tournamentScreen!)
    } else {
      showScreen(modeSelection!)
    }
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
