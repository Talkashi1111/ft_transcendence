import type { Tournament, TournamentPlayer, TournamentMatch } from '../types/tournament';

export class TournamentManager {
  private tournament: Tournament;
  private nextPlayerId: number = 1;
  private nextMatchId: number = 1;

  constructor() {
    this.tournament = {
      id: Date.now(),
      players: [],
      matches: [],
      currentMatchIndex: 0,
      status: 'registration',
      winner: null,
    };
  }

  /**
   * Add a player to the tournament (max 8 players)
   * @param alias - The player's display name
   * @returns true if player was successfully added, false if:
   *   - Tournament is full (8 players)
   *   - Tournament has already started
   *   - Alias already exists (duplicates not allowed)
   */
  addPlayer(alias: string): boolean {
    if (this.tournament.players.length >= 8) {
      return false; // Tournament is full
    }

    if (this.tournament.status !== 'registration') {
      return false; // Tournament already started
    }

    // Check for duplicate aliases
    if (this.tournament.players.some((p) => p.alias === alias)) {
      return false; // Alias already exists
    }

    const player: TournamentPlayer = {
      id: this.nextPlayerId++,
      alias,
    };

    this.tournament.players.push(player);
    return true;
  }

  /**
   * Remove a player from the tournament (only during registration)
   * @param playerId - The unique ID of the player to remove
   * @returns true if player was successfully removed, false if:
   *   - Tournament has already started
   *   - Player ID doesn't exist
   */
  removePlayer(playerId: number): boolean {
    if (this.tournament.status !== 'registration') {
      return false;
    }

    const index = this.tournament.players.findIndex((p) => p.id === playerId);
    if (index === -1) {
      return false;
    }

    this.tournament.players.splice(index, 1);
    return true;
  }

  /**
   * Start the tournament and generate the bracket
   * Generates a single-elimination bracket based on player count (2-8 players).
   * Higher-seeded players (lower indices) receive byes in odd player counts.
   * @returns true if tournament started successfully, false if:
   *   - Less than 2 players registered
   *   - Tournament already started
   */
  startTournament(): boolean {
    if (this.tournament.players.length < 2) {
      return false; // Need at least 2 players
    }

    if (this.tournament.status !== 'registration') {
      return false; // Already started
    }

    // Generate single elimination bracket
    this.generateBracket();
    this.tournament.status = 'in-progress';
    return true;
  }

  private generateBracket(): void {
    const players = [...this.tournament.players];
    const playerCount = players.length;

    if (playerCount < 2 || playerCount > 8) return;

    /**
     * Bracket Generation Templates
     *
     * Each template defines a complete single-elimination tournament bracket for a specific player count.
     * Templates are arrays of match definitions, where each match is: [round, player1Index, player2Index]
     *
     * INDEX SYSTEM:
     * - Positive indices (0, 1, 2, ...): Direct reference to a player in the players array
     *   Example: 0 = players[0], 1 = players[1], etc.
     *
     * - Negative indices (-1, -2, -3, ...): Reference to a match winner (TBD placeholder)
     *   The negative index maps to the match ORDER (not round):
     *   - -1 = winner of the 1st match (index 0 in template array)
     *   - -2 = winner of the 2nd match (index 1 in template array)
     *   - -3 = winner of the 3rd match (index 2 in template array)
     *   And so on...
     *
     * HOW IT WORKS:
     * 1. Matches are created in the order they appear in the template
     * 2. Matches with positive indices get actual players immediately
     * 3. Matches with negative indices get TBD placeholders
     * 4. When a match finishes, advanceWinnerToNextRound() finds the next TBD and replaces it
     * 5. The last match in each template is always the Finals
     *
     * EXAMPLE (4 players):
     * [1, 0, 3]   -> Match #0 (Round 1): Player[0] vs Player[3]
     * [1, 1, 2]   -> Match #1 (Round 1): Player[1] vs Player[2]
     * [2, -1, -2] -> Match #2 (Finals):  Winner of Match #0 vs Winner of Match #1
     *
     * BYES (odd player counts):
     * Higher-seeded players (lower indices) receive byes and advance directly to later rounds.
     * Example with 3 players:
     * - Player[0] gets a bye to the finals (appears only in round 2)
     * - Player[1] and Player[2] play in round 1
     * - Winner faces Player[0] in the finals
     */
    const bracketTemplates: { [key: number]: Array<[number, number, number]> } = {
      // 2 PLAYERS: Direct finals match
      2: [
        [1, 0, 1], // Finals: Player[0] vs Player[1]
      ],

      // 3 PLAYERS: One round 1 match + finals (Player[0] gets bye)
      3: [
        [1, 1, 2], // Match #0 (Round 1): Player[1] vs Player[2]
        [2, 0, -1], // Match #1 (Finals): Player[0] vs Winner of Match #0
      ],

      // 4 PLAYERS: Classic bracket (2 semifinals, 1 final)
      4: [
        [1, 0, 3], // Match #0 (Round 1): Player[0] vs Player[3]
        [1, 1, 2], // Match #1 (Round 1): Player[1] vs Player[2]
        [2, -1, -2], // Match #2 (Finals): Winner of Match #0 vs Winner of Match #1
      ],

      // 5 PLAYERS: 1 R1 match, 2 R2 matches, 1 final (Player[0] and Player[1] get byes to R2)
      5: [
        [1, 3, 4], // Match #0 (Round 1): Player[3] vs Player[4]
        [2, 0, -1], // Match #1 (Round 2): Player[0] vs Winner of Match #0
        [2, 1, 2], // Match #2 (Round 2): Player[1] vs Player[2]
        [3, -2, -3], // Match #3 (Finals): Winner of Match #1 vs Winner of Match #2
      ],

      // 6 PLAYERS: 2 R1 matches, 2 R2 matches, 1 final (Player[0] and Player[1] get byes to R2)
      6: [
        [1, 3, 4], // Match #0 (Round 1): Player[3] vs Player[4]
        [1, 2, 5], // Match #1 (Round 1): Player[2] vs Player[5]
        [2, 0, -1], // Match #2 (Round 2): Player[0] vs Winner of Match #0
        [2, 1, -2], // Match #3 (Round 2): Player[1] vs Winner of Match #1
        [3, -3, -4], // Match #4 (Finals): Winner of Match #2 vs Winner of Match #3
      ],

      // 7 PLAYERS: 3 R1 matches, 2 R2 matches, 1 final (Player[0] gets bye to R2)
      7: [
        [1, 3, 4], // Match #0 (Round 1): Player[3] vs Player[4]
        [1, 1, 6], // Match #1 (Round 1): Player[1] vs Player[6]
        [1, 2, 5], // Match #2 (Round 1): Player[2] vs Player[5]
        [2, 0, -1], // Match #3 (Round 2): Player[0] vs Winner of Match #0
        [2, -2, -3], // Match #4 (Round 2): Winner of Match #1 vs Winner of Match #2
        [3, -4, -5], // Match #5 (Finals): Winner of Match #3 vs Winner of Match #4
      ],

      // 8 PLAYERS: Full bracket (4 R1 matches, 2 R2 matches, 1 final)
      8: [
        [1, 0, 7], // Match #0 (Round 1): Player[0] vs Player[7]
        [1, 3, 4], // Match #1 (Round 1): Player[3] vs Player[4]
        [1, 1, 6], // Match #2 (Round 1): Player[1] vs Player[6]
        [1, 2, 5], // Match #3 (Round 1): Player[2] vs Player[5]
        [2, -1, -2], // Match #4 (Round 2): Winner of Match #0 vs Winner of Match #1
        [2, -3, -4], // Match #5 (Round 2): Winner of Match #2 vs Winner of Match #3
        [3, -5, -6], // Match #6 (Finals): Winner of Match #4 vs Winner of Match #5
      ],
    };

    const template = bracketTemplates[playerCount];
    if (!template) return;

    // Create matches from template
    this.tournament.matches = template.map(([round, p1Idx, p2Idx]) => {
      const getPlayer = (idx: number): TournamentPlayer => {
        if (idx >= 0) {
          return players[idx];
        } else {
          // TBD placeholder with reference to which match it depends on
          return { id: idx, alias: 'TBD' };
        }
      };

      return {
        matchId: this.nextMatchId++,
        player1: getPlayer(p1Idx),
        player2: getPlayer(p2Idx),
        player1Score: 0,
        player2Score: 0,
        winner: null,
        status: 'pending',
        round,
      };
    });

    this.tournament.currentMatchIndex = 0;
  }

  /**
   * Get the next match that is ready to be played
   * A match is ready when:
   * - Status is 'pending'
   * - Both players are real (not TBD placeholders)
   * @returns The next playable match, or null if no matches are ready or tournament is complete
   */
  getCurrentMatch(): TournamentMatch | null {
    const pendingMatch = this.tournament.matches.find(
      (m) => m.status === 'pending' && m.player1.id > 0 && m.player2.id > 0
    );
    return pendingMatch || null;
  }

  /**
   * Record the result of a completed match
   * Automatically advances the winner to the next round and checks if tournament is complete.
   * @param matchId - The unique ID of the match
   * @param winnerId - The ID of the winning player (must match player1 or player2)
   * @param score1 - Player 1's final score
   * @param score2 - Player 2's final score
   * @returns true if result was recorded successfully, false if:
   *   - Match ID doesn't exist
   *   - Match already finished
   *   - Winner ID doesn't match either player
   */
  recordMatchResult(matchId: number, winnerId: number, score1: number, score2: number): boolean {
    const match = this.tournament.matches.find((m) => m.matchId === matchId);
    if (!match || match.status === 'finished') {
      return false;
    }

    // Validate that winnerId matches one of the players
    if (winnerId !== match.player1.id && winnerId !== match.player2.id) {
      return false;
    }

    match.player1Score = score1;
    match.player2Score = score2;
    match.winner = winnerId === match.player1.id ? match.player1 : match.player2;
    match.status = 'finished';

    // Immediately update the next round match with the winner
    this.advanceWinnerToNextRound(match);

    // Check if tournament is complete
    this.checkTournamentComplete();

    return true;
  }

  private advanceWinnerToNextRound(finishedMatch: TournamentMatch): void {
    if (!finishedMatch.winner) return;

    // Find the index of the finished match in the matches array
    const finishedMatchIndex = this.tournament.matches.findIndex(
      (m) => m.matchId === finishedMatch.matchId
    );
    if (finishedMatchIndex === -1) return;

    // The negative index reference for this match winner
    // -1 means "winner of match at index 0", -2 means "winner of match at index 1", etc.
    const winnerReference = -(finishedMatchIndex + 1);

    // Find the match that should receive this winner based on the negative index
    for (const match of this.tournament.matches) {
      if (match.player1.id === winnerReference) {
        match.player1 = finishedMatch.winner;
        return;
      }
      if (match.player2.id === winnerReference) {
        match.player2 = finishedMatch.winner;
        return;
      }
    }
  }

  private checkTournamentComplete(): void {
    // Check if all matches are finished
    const allFinished = this.tournament.matches.every((m) => m.status === 'finished');

    if (allFinished && this.tournament.matches.length > 0) {
      // The last match's winner is the tournament winner
      const finalMatch = this.tournament.matches[this.tournament.matches.length - 1];
      if (finalMatch.winner) {
        this.tournament.winner = finalMatch.winner;
        this.tournament.status = 'finished';
      }
    }
  }

  /**
   * Get the tournament bracket organized by rounds
   * @returns A 2D array where each inner array contains all matches for that round.
   *   - bracket[0] = Round 1 matches
   *   - bracket[1] = Round 2 matches (semifinals)
   *   - bracket[n-1] = Finals
   *   Returns empty array if tournament hasn't started.
   */
  getBracket(): TournamentMatch[][] {
    const bracket: TournamentMatch[][] = [];
    const matches = [...this.tournament.matches];

    if (matches.length === 0) return bracket;

    // Group matches by their assigned round number
    const maxRound = Math.max(...matches.map((m) => m.round || 1));

    for (let roundNum = 1; roundNum <= maxRound; roundNum++) {
      const roundMatches = matches.filter((m) => (m.round || 1) === roundNum);
      if (roundMatches.length > 0) {
        bracket.push(roundMatches);
      }
    }

    return bracket;
  }

  /**
   * Get the complete tournament data
   * @returns The full tournament object including players, matches, status, and winner
   */
  getTournament(): Tournament {
    return this.tournament;
  }

  /**
   * Get the current number of registered players
   * @returns The number of players currently in the tournament
   */
  getPlayerCount(): number {
    return this.tournament.players.length;
  }

  /**
   * Check if more players can be added to the tournament
   * @returns true if tournament is in registration phase and has less than 8 players
   */
  canAddPlayers(): boolean {
    return this.tournament.status === 'registration' && this.tournament.players.length < 8;
  }

  /**
   * Check if the tournament can be started
   * @returns true if tournament is in registration phase and has at least 2 players
   */
  canStartTournament(): boolean {
    return this.tournament.status === 'registration' && this.tournament.players.length >= 2;
  }
}
