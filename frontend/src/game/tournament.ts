import type { Tournament, TournamentPlayer, TournamentMatch } from '../types/tournament'

export class TournamentManager {
  private tournament: Tournament
  private nextPlayerId: number = 1
  private nextMatchId: number = 1

  constructor() {
    this.tournament = {
      id: Date.now(),
      players: [],
      matches: [],
      currentMatchIndex: 0,
      status: 'registration',
      winner: null,
    }
  }

  // Add a player to the tournament (max 8 players)
  addPlayer(alias: string): boolean {
    if (this.tournament.players.length >= 8) {
      return false // Tournament is full
    }

    if (this.tournament.status !== 'registration') {
      return false // Tournament already started
    }

    // Check for duplicate aliases
    if (this.tournament.players.some((p) => p.alias === alias)) {
      return false // Alias already exists
    }

    const player: TournamentPlayer = {
      id: this.nextPlayerId++,
      alias,
    }

    this.tournament.players.push(player)
    return true
  }

  // Remove a player from the tournament (only during registration)
  removePlayer(playerId: number): boolean {
    if (this.tournament.status !== 'registration') {
      return false
    }

    const index = this.tournament.players.findIndex((p) => p.id === playerId)
    if (index === -1) {
      return false
    }

    this.tournament.players.splice(index, 1)
    return true
  }

  // Start the tournament and generate bracket
  startTournament(): boolean {
    if (this.tournament.players.length < 2) {
      return false // Need at least 2 players
    }

    if (this.tournament.status !== 'registration') {
      return false // Already started
    }

    // Generate single elimination bracket
    this.generateBracket()
    this.tournament.status = 'in-progress'
    return true
  }

  private generateBracket(): void {
    const players = [...this.tournament.players]
    const playerCount = players.length

    if (playerCount < 2 || playerCount > 8) return

    // Predefined bracket templates
    // Each template defines: [round, player1Index, player2Index]
    // Negative index means TBD with a reference to which R1 match winner (e.g., -1 = R1 match 0 winner)
    const bracketTemplates: { [key: number]: Array<[number, number, number]> } = {
      2: [
        [1, 0, 1], // Finals: P1 vs P2
      ],
      3: [
        [1, 1, 2], // R1: P2 vs P3
        [2, 0, -1], // Finals: P1 vs winner(P2 vs P3)
      ],
      4: [
        [1, 0, 3], // R1: P1 vs P4
        [1, 1, 2], // R1: P2 vs P3
        [2, -1, -2], // Finals: winner(P1 vs P4) vs winner(P2 vs P3)
      ],
      5: [
        [1, 3, 4], // R1: P4 vs P5
        [2, 0, -1], // R2: P1 vs winner(P4 vs P5)
        [2, 1, 2], // R2: P2 vs P3
        [3, -2, -3], // Finals: winner(P1 vs winner) vs winner(P2 vs P3)
      ],
      6: [
        [1, 3, 4], // R1: P4 vs P5
        [1, 2, 5], // R1: P3 vs P6
        [2, 0, -1], // R2: P1 vs winner(P4 vs P5)
        [2, 1, -2], // R2: P2 vs winner(P3 vs P6)
        [3, -3, -4], // Finals: winner vs winner
      ],
      7: [
        [1, 3, 4], // R1: P4 vs P5
        [1, 1, 6], // R1: P2 vs P7
        [1, 2, 5], // R1: P3 vs P6
        [2, 0, -1], // R2: P1 vs winner(P4 vs P5)
        [2, -2, -3], // R2: winner(P2 vs P7) vs winner(P3 vs P6)
        [3, -4, -5], // Finals: winner vs winner
      ],
      8: [
        [1, 0, 7], // R1: P1 vs P8
        [1, 3, 4], // R1: P4 vs P5
        [1, 1, 6], // R1: P2 vs P7
        [1, 2, 5], // R1: P3 vs P6
        [2, -1, -2], // R2: winner vs winner
        [2, -3, -4], // R2: winner vs winner
        [3, -5, -6], // Finals: winner vs winner
      ],
    }

    const template = bracketTemplates[playerCount]
    if (!template) return

    // Create matches from template
    this.tournament.matches = template.map(([round, p1Idx, p2Idx]) => {
      const getPlayer = (idx: number): TournamentPlayer => {
        if (idx >= 0) {
          return players[idx]
        } else {
          // TBD placeholder with reference to which match it depends on
          return { id: idx, alias: 'TBD' }
        }
      }

      return {
        matchId: this.nextMatchId++,
        player1: getPlayer(p1Idx),
        player2: getPlayer(p2Idx),
        player1Score: 0,
        player2Score: 0,
        winner: null,
        status: 'pending',
        round,
      }
    })

    this.tournament.currentMatchIndex = 0
  }

  // Get the next match to play
  getCurrentMatch(): TournamentMatch | null {
    const pendingMatch = this.tournament.matches.find(
      (m) => m.status === 'pending' && m.player1.alias !== 'TBD' && m.player2.alias !== 'TBD'
    )
    return pendingMatch || null
  }

  // Record match result
  recordMatchResult(matchId: number, winnerId: number, score1: number, score2: number): boolean {
    const match = this.tournament.matches.find((m) => m.matchId === matchId)
    if (!match || match.status === 'finished') {
      return false
    }

    match.player1Score = score1
    match.player2Score = score2
    match.winner = winnerId === match.player1.id ? match.player1 : match.player2
    match.status = 'finished'

    // Immediately update the next round match with the winner
    this.advanceWinnerToNextRound(match)

    // Check if tournament is complete
    this.checkTournamentComplete()

    return true
  }

  private advanceWinnerToNextRound(finishedMatch: TournamentMatch): void {
    if (!finishedMatch.winner) return

    // Find all matches with TBD placeholders
    // Replace the first TBD we find (sequential replacement matches how matches are played)
    for (const match of this.tournament.matches) {
      if (match.player1.alias === 'TBD' && match.player1.id < 0) {
        match.player1 = finishedMatch.winner
        return
      }
      if (match.player2.alias === 'TBD' && match.player2.id < 0) {
        match.player2 = finishedMatch.winner
        return
      }
    }
  }

  private checkTournamentComplete(): void {
    // Check if all matches are finished
    const allFinished = this.tournament.matches.every((m) => m.status === 'finished')

    if (allFinished && this.tournament.matches.length > 0) {
      // The last match's winner is the tournament winner
      const finalMatch = this.tournament.matches[this.tournament.matches.length - 1]
      if (finalMatch.winner) {
        this.tournament.winner = finalMatch.winner
        this.tournament.status = 'finished'
      }
    }
  }

  // Get tournament bracket organized by rounds
  getBracket(): TournamentMatch[][] {
    const bracket: TournamentMatch[][] = []
    const matches = [...this.tournament.matches]

    if (matches.length === 0) return bracket

    // Group matches by their assigned round number
    const maxRound = Math.max(...matches.map(m => m.round || 1))

    for (let roundNum = 1; roundNum <= maxRound; roundNum++) {
      const roundMatches = matches.filter(m => (m.round || 1) === roundNum)
      if (roundMatches.length > 0) {
        bracket.push(roundMatches)
      }
    }

    return bracket
  }

  getTournament(): Tournament {
    return this.tournament
  }

  getPlayerCount(): number {
    return this.tournament.players.length
  }

  canAddPlayers(): boolean {
    return this.tournament.status === 'registration' && this.tournament.players.length < 8
  }

  canStartTournament(): boolean {
    return this.tournament.status === 'registration' && this.tournament.players.length >= 2
  }
}
