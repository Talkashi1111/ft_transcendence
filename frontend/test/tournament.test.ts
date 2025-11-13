import { describe, it, expect, beforeEach } from 'vitest'
import { TournamentManager } from '../src/game/tournament'

describe('TournamentManager', () => {
  let manager: TournamentManager

  beforeEach(() => {
    manager = new TournamentManager()
  })

  describe('addPlayer', () => {
    it('should add a player successfully', () => {
      const result = manager.addPlayer('Player1')
      expect(result).toBe(true)
      expect(manager.getPlayerCount()).toBe(1)
    })

    it('should not add duplicate player aliases', () => {
      manager.addPlayer('Player1')
      const result = manager.addPlayer('Player1')
      expect(result).toBe(false)
      expect(manager.getPlayerCount()).toBe(1)
    })

    it('should not add more than 8 players', () => {
      for (let i = 1; i <= 8; i++) {
        manager.addPlayer(`Player${i}`)
      }
      const result = manager.addPlayer('Player9')
      expect(result).toBe(false)
      expect(manager.getPlayerCount()).toBe(8)
    })

    it('should not add players after tournament starts', () => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      manager.startTournament()
      const result = manager.addPlayer('Player3')
      expect(result).toBe(false)
    })
  })

  describe('removePlayer', () => {
    beforeEach(() => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
    })

    it('should remove a player successfully', () => {
      const tournament = manager.getTournament()
      const playerId = tournament.players[0].id
      const result = manager.removePlayer(playerId)
      expect(result).toBe(true)
      expect(manager.getPlayerCount()).toBe(1)
    })

    it('should return false when removing non-existent player', () => {
      const result = manager.removePlayer(9999)
      expect(result).toBe(false)
      expect(manager.getPlayerCount()).toBe(2)
    })

    it('should not remove players after tournament starts', () => {
      manager.startTournament()
      const tournament = manager.getTournament()
      const playerId = tournament.players[0].id
      const result = manager.removePlayer(playerId)
      expect(result).toBe(false)
    })
  })

  describe('startTournament', () => {
    it('should start tournament with 2 players', () => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      const result = manager.startTournament()
      expect(result).toBe(true)
      const tournament = manager.getTournament()
      expect(tournament.status).toBe('in-progress')
      expect(tournament.matches.length).toBeGreaterThan(0)
    })

    it('should not start tournament with less than 2 players', () => {
      manager.addPlayer('Player1')
      const result = manager.startTournament()
      expect(result).toBe(false)
      const tournament = manager.getTournament()
      expect(tournament.status).toBe('registration')
    })

    it('should not start tournament if already started', () => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      manager.startTournament()
      const result = manager.startTournament()
      expect(result).toBe(false)
    })

    it('should generate correct number of matches for 2 players', () => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      manager.startTournament()
      const tournament = manager.getTournament()
      expect(tournament.matches.length).toBe(1)
    })

    it('should generate correct bracket for 4 players', () => {
      const players = ['Player1', 'Player2', 'Player3', 'Player4']
      players.forEach(p => manager.addPlayer(p))

      manager.startTournament()
      const bracket = manager.getBracket()
      // With the new template system, all rounds are pre-generated
      expect(bracket.length).toBe(2) // Round 1 + Finals
      expect(bracket[0].length).toBe(2) // 2 matches in round 1
      expect(bracket[1].length).toBe(1) // 1 match in finals (TBD vs TBD)
    })

    it('should generate correct bracket for 3 players with bye', () => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      manager.addPlayer('Player3')
      manager.startTournament()
      const tournament = manager.getTournament()
      // With 3 players, need 4 spots, so 1 bye (one player advances automatically)
      const bracket = manager.getBracket()
      expect(bracket.length).toBe(2) // Round 1 and Round 2 (with TBD) are pre-generated
      // Round 1: Player2 vs Player3, Round 2: Player1 vs TBD
      expect(bracket[0].length).toBe(1) // 1 match in Round 1
      expect(bracket[1].length).toBe(1) // 1 match in Round 2
      expect(bracket[0][0].player1.alias).toBe('Player2')
      expect(bracket[0][0].player2.alias).toBe('Player3')
      expect(bracket[1][0].player1.alias).toBe('Player1')
      expect(bracket[1][0].player2.alias).toBe('TBD')
      expect(tournament.matches.length).toBe(2)
    })

    it('should generate correct bracket for 8 players', () => {
      const players = ['Player1', 'Player2', 'Player3', 'Player4', 'Player5', 'Player6', 'Player7', 'Player8']
      players.forEach(p => manager.addPlayer(p))

      manager.startTournament()
      const bracket = manager.getBracket()
      // With the new template system, all rounds are pre-generated
      expect(bracket.length).toBe(3) // Round 1, Round 2, Finals
      expect(bracket[0].length).toBe(4) // 4 matches in round 1
      expect(bracket[1].length).toBe(2) // 2 matches in round 2 (TBD)
      expect(bracket[2].length).toBe(1) // 1 match in finals (TBD)
    })
  })

  describe('getCurrentMatch', () => {
    beforeEach(() => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      manager.addPlayer('Player3')
      manager.addPlayer('Player4')
      manager.startTournament()
    })

    it('should return the first match initially', () => {
      const match = manager.getCurrentMatch()
      expect(match).not.toBeNull()
      expect(match?.status).toBe('pending')
    })

    it('should return null when all matches are complete', () => {
      let match = manager.getCurrentMatch()
      while (match) {
        // Record winner as player1
        manager.recordMatchResult(
          match.matchId,
          match.player1.id,
          5,
          3
        )
        match = manager.getCurrentMatch()
      }
      expect(match).toBeNull()
      const tournament = manager.getTournament()
      expect(tournament.status).toBe('finished')
    })
  })

  describe('recordMatchResult', () => {
    beforeEach(() => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      manager.addPlayer('Player3')
      manager.addPlayer('Player4')
      manager.startTournament()
    })

    it('should record match result successfully', () => {
      const match = manager.getCurrentMatch()!
      const result = manager.recordMatchResult(
        match.matchId,
        match.player1.id,
        5,
        3
      )
      expect(result).toBe(true)
      expect(match.status).toBe('finished')
      expect(match.winner).not.toBeNull()
      expect(match.winner?.id).toBe(match.player1.id)
      expect(match.player1Score).toBe(5)
      expect(match.player2Score).toBe(3)
    })

    it('should return false for invalid match ID', () => {
      const result = manager.recordMatchResult(9999, 1, 5, 3)
      expect(result).toBe(false)
    })

    it('should handle invalid winner ID by assigning to player2', () => {
      const match = manager.getCurrentMatch()!
      const result = manager.recordMatchResult(
        match.matchId,
        9999, // Invalid ID
        5,
        3
      )
      // The implementation doesn't validate winner ID, it assigns player2 if not player1
      expect(result).toBe(true)
      expect(match.winner).toBe(match.player2)
    })

    it('should advance tournament to next match', () => {
      const firstMatch = manager.getCurrentMatch()!
      const firstMatchId = firstMatch.matchId

      manager.recordMatchResult(
        firstMatch.matchId,
        firstMatch.player1.id,
        5,
        3
      )

      const secondMatch = manager.getCurrentMatch()
      expect(secondMatch).not.toBeNull()
      expect(secondMatch?.matchId).not.toBe(firstMatchId)
    })

    it('should generate next round after current round completes', () => {
      const bracket = manager.getBracket()
      const round1MatchCount = bracket[0].length

      // Complete all round 1 matches
      for (let i = 0; i < round1MatchCount; i++) {
        const match = manager.getCurrentMatch()!
        manager.recordMatchResult(
          match.matchId,
          match.player1.id,
          5,
          3
        )
      }

      const updatedBracket = manager.getBracket()
      // With the new template system, bracket length doesn't change (all rounds pre-generated)
      // But the Finals match should now have real players instead of TBD
      expect(updatedBracket.length).toBe(bracket.length)
      const finalsMatch = updatedBracket[updatedBracket.length - 1][0]
      expect(finalsMatch.player1.alias).not.toBe('TBD')
      expect(finalsMatch.player2.alias).not.toBe('TBD')
    })

    it('should complete tournament and set winner', () => {
      let match = manager.getCurrentMatch()
      while (match) {
        manager.recordMatchResult(
          match.matchId,
          match.player1.id,
          5,
          3
        )
        match = manager.getCurrentMatch()
      }

      const tournament = manager.getTournament()
      expect(tournament.status).toBe('finished')
      expect(tournament.winner).not.toBeNull()
    })
  })

  describe('getBracket', () => {
    it('should return empty bracket before tournament starts', () => {
      const bracket = manager.getBracket()
      expect(bracket).toEqual([])
    })

    it('should organize matches into rounds', () => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      manager.addPlayer('Player3')
      manager.addPlayer('Player4')
      manager.startTournament()

      const bracket = manager.getBracket()
      expect(Array.isArray(bracket)).toBe(true)
      expect(bracket.length).toBeGreaterThan(0)
      bracket.forEach((round) => {
        expect(Array.isArray(round)).toBe(true)
      })
    })

    it('should show completed matches with scores', () => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      manager.startTournament()

      const match = manager.getCurrentMatch()!
      manager.recordMatchResult(match.matchId, match.player1.id, 5, 3)

      const bracket = manager.getBracket()
      const completedMatch = bracket[0][0]
      expect(completedMatch.status).toBe('finished')
      expect(completedMatch.player1Score).toBe(5)
      expect(completedMatch.player2Score).toBe(3)
    })
  })

  describe('utility methods', () => {
    it('should get player count', () => {
      expect(manager.getPlayerCount()).toBe(0)
      manager.addPlayer('Player1')
      expect(manager.getPlayerCount()).toBe(1)
      manager.addPlayer('Player2')
      expect(manager.getPlayerCount()).toBe(2)
    })

    it('should check if can add players', () => {
      expect(manager.canAddPlayers()).toBe(true)
      for (let i = 1; i <= 8; i++) {
        manager.addPlayer(`Player${i}`)
      }
      expect(manager.canAddPlayers()).toBe(false)
    })

    it('should not allow adding players after tournament starts', () => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      expect(manager.canAddPlayers()).toBe(true)
      manager.startTournament()
      expect(manager.canAddPlayers()).toBe(false)
    })

    it('should check if can start tournament', () => {
      expect(manager.canStartTournament()).toBe(false)
      manager.addPlayer('Player1')
      expect(manager.canStartTournament()).toBe(false)
      manager.addPlayer('Player2')
      expect(manager.canStartTournament()).toBe(true)
      manager.startTournament()
      expect(manager.canStartTournament()).toBe(false)
    })

    it('should get tournament details', () => {
      const tournament = manager.getTournament()
      expect(tournament).toHaveProperty('id')
      expect(tournament).toHaveProperty('players')
      expect(tournament).toHaveProperty('matches')
      expect(tournament).toHaveProperty('status')
      expect(tournament).toHaveProperty('winner')
    })
  })

  describe('edge cases', () => {
    it('should handle 5 players with byes correctly', () => {
      for (let i = 1; i <= 5; i++) {
        manager.addPlayer(`Player${i}`)
      }
      manager.startTournament()

      const bracket = manager.getBracket()
      const tournament = manager.getTournament()

      // 5 players need 8 spots, so 3 byes
      // Total matches: 4 (round 1) + 2 (round 2) + 1 (final) = 7
      // But some will be automatically won due to byes
      expect(tournament.matches.length).toBeGreaterThan(0)
      expect(bracket.length).toBeGreaterThan(0)
    })

    it('should handle 6 players correctly', () => {
      for (let i = 1; i <= 6; i++) {
        manager.addPlayer(`Player${i}`)
      }
      manager.startTournament()

      const bracket = manager.getBracket()
      expect(bracket.length).toBeGreaterThan(0)
      expect(manager.getCurrentMatch()).not.toBeNull()
    })

    it('should handle 7 players correctly', () => {
      for (let i = 1; i <= 7; i++) {
        manager.addPlayer(`Player${i}`)
      }
      manager.startTournament()

      const bracket = manager.getBracket()
      expect(bracket.length).toBeGreaterThan(0)
      expect(manager.getCurrentMatch()).not.toBeNull()
    })

    it('should maintain player IDs consistently', () => {
      manager.addPlayer('Player1')
      manager.addPlayer('Player2')
      const tournament1 = manager.getTournament()
      const player1Id = tournament1.players[0].id
      const player2Id = tournament1.players[1].id

      manager.startTournament()
      const tournament2 = manager.getTournament()

      expect(tournament2.players[0].id).toBe(player1Id)
      expect(tournament2.players[1].id).toBe(player2Id)
    })

    it('should assign unique match IDs', () => {
      for (let i = 1; i <= 4; i++) {
        manager.addPlayer(`Player${i}`)
      }
      manager.startTournament()

      const tournament = manager.getTournament()
      const matchIds = tournament.matches.map(m => m.matchId)
      const uniqueIds = new Set(matchIds)

      expect(uniqueIds.size).toBe(matchIds.length)
    })
  })
})
