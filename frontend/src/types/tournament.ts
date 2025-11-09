// Tournament type definitions

export interface TournamentPlayer {
  id: number
  alias: string
}

export interface TournamentMatch {
  matchId: number
  player1: TournamentPlayer
  player2: TournamentPlayer
  player1Score: number
  player2Score: number
  winner: TournamentPlayer | null
  status: 'pending' | 'playing' | 'finished'
}

export interface Tournament {
  id: number
  players: TournamentPlayer[]
  matches: TournamentMatch[]
  currentMatchIndex: number
  status: 'registration' | 'in-progress' | 'finished'
  winner: TournamentPlayer | null
}

export interface BracketRound {
  roundNumber: number
  matches: TournamentMatch[]
}
