// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title TournamentScores
 * @dev Store and retrieve local tournament results on the blockchain
 * @notice Only the contract owner can record tournaments to prevent unauthorized entries
 *
 * This contract stores complete tournament data including:
 * - Organizer info (database user ID + alias at time of tournament)
 * - All players (aliases)
 * - All matches with scores and rounds
 * - Winner information
 *
 * Data is immutable once recorded, providing tamper-proof verification.
 */
contract TournamentScores {
    /**
     * @dev Represents a single match within a tournament
     * @param player1 Alias of first player
     * @param player2 Alias of second player
     * @param score1 Score of first player (0-255, uint8 sufficient for pong)
     * @param score2 Score of second player
     * @param round Tournament round (1 = first round, 2 = semi-finals, 3 = finals, etc.)
     */
    struct Match {
        string player1;
        string player2;
        uint8 score1;
        uint8 score2;
        uint8 round;
    }

    /**
     * @dev Represents a complete tournament
     * @param odUserId Organizer's database user ID as UUID string (preserved even if user is later deleted)
     * @param organizer Organizer's alias at time of tournament
     * @param players Array of all player aliases (first player is always the organizer)
     * @param matches Array of all matches played
     * @param winner Alias of tournament winner
     * @param timestamp Block timestamp when tournament was recorded
     * @param recordedBy Address that recorded the tournament (backend server)
     */
    struct Tournament {
        string odUserId;
        string organizer;
        string[] players;
        Match[] matches;
        string winner;
        uint256 timestamp;
        address recordedBy;
    }

    // Owner of the contract (backend server)
    address public owner;

    // Mapping from tournament ID to Tournament data
    mapping(uint256 => Tournament) private tournaments;

    // Counter for tournament IDs
    uint256 public tournamentCount;

    // Events
    event TournamentRecorded(
        uint256 indexed tournamentId,
        string odUserId,
        string organizer,
        uint8 playerCount,
        uint8 matchCount,
        string winner,
        uint256 timestamp
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev Constructor sets the original owner of the contract
     */
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @dev Transfer ownership to a new address
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @dev Record a complete tournament result in a single transaction
     * @param odUserId Organizer's database user ID (UUID string)
     * @param organizer Organizer's alias
     * @param players Array of all player aliases (2-8 players)
     * @param matchPlayers1 Array of player1 aliases for each match
     * @param matchPlayers2 Array of player2 aliases for each match
     * @param matchScores1 Array of player1 scores for each match
     * @param matchScores2 Array of player2 scores for each match
     * @param matchRounds Array of round numbers for each match
     * @param winner Winner's alias
     * @return tournamentId The ID of the recorded tournament
     * @notice Only the owner (backend) can record tournaments
     *
     * Note: We use separate arrays for match data instead of Match[] because
     * Solidity doesn't support passing arrays of structs from external calls easily.
     */
    function recordTournament(
        string memory odUserId,
        string memory organizer,
        string[] memory players,
        string[] memory matchPlayers1,
        string[] memory matchPlayers2,
        uint8[] memory matchScores1,
        uint8[] memory matchScores2,
        uint8[] memory matchRounds,
        string memory winner
    ) public onlyOwner returns (uint256) {
        // Validate inputs
        require(bytes(odUserId).length == 36, "Invalid user ID (must be UUID)");
        require(bytes(organizer).length > 0, "Organizer alias cannot be empty");
        require(bytes(organizer).length <= 50, "Organizer alias too long");
        require(players.length >= 2, "Minimum 2 players required");
        require(players.length <= 8, "Maximum 8 players allowed");
        require(bytes(winner).length > 0, "Winner alias cannot be empty");
        require(bytes(winner).length <= 50, "Winner alias too long");

        // Validate match arrays have same length
        uint256 numMatches = matchPlayers1.length;
        require(numMatches > 0, "At least one match required");
        require(
            matchPlayers2.length == numMatches &&
            matchScores1.length == numMatches &&
            matchScores2.length == numMatches &&
            matchRounds.length == numMatches,
            "Match arrays must have same length"
        );

        // Validate each player alias
        for (uint256 i = 0; i < players.length; i++) {
            require(bytes(players[i]).length > 0, "Player alias cannot be empty");
            require(bytes(players[i]).length <= 50, "Player alias too long");
        }

        // Create tournament ID
        uint256 tournamentId = tournamentCount;
        unchecked {
            tournamentCount++;
        }

        // Store tournament data
        Tournament storage t = tournaments[tournamentId];
        t.odUserId = odUserId;
        t.organizer = organizer;
        t.winner = winner;
        t.timestamp = block.timestamp;
        t.recordedBy = msg.sender;

        // Copy players array
        for (uint256 i = 0; i < players.length; i++) {
            t.players.push(players[i]);
        }

        // Build and store matches
        for (uint256 i = 0; i < numMatches; i++) {
            require(bytes(matchPlayers1[i]).length > 0, "Match player1 alias cannot be empty");
            require(bytes(matchPlayers2[i]).length > 0, "Match player2 alias cannot be empty");

            t.matches.push(Match({
                player1: matchPlayers1[i],
                player2: matchPlayers2[i],
                score1: matchScores1[i],
                score2: matchScores2[i],
                round: matchRounds[i]
            }));
        }

        emit TournamentRecorded(
            tournamentId,
            odUserId,
            organizer,
            uint8(players.length),
            uint8(numMatches),
            winner,
            block.timestamp
        );

        return tournamentId;
    }

    /**
     * @dev Get tournament basic info
     * @param tournamentId The tournament identifier
     */
    function getTournament(
        uint256 tournamentId
    )
        public
        view
        returns (
            string memory odUserId,
            string memory organizer,
            string[] memory players,
            string memory winner,
            uint256 timestamp,
            address recordedBy
        )
    {
        require(tournamentId < tournamentCount, "Tournament does not exist");

        Tournament storage t = tournaments[tournamentId];
        return (
            t.odUserId,
            t.organizer,
            t.players,
            t.winner,
            t.timestamp,
            t.recordedBy
        );
    }

    /**
     * @dev Get all matches for a tournament
     * @param tournamentId The tournament identifier
     * @return player1s Array of player1 aliases
     * @return player2s Array of player2 aliases
     * @return scores1 Array of player1 scores
     * @return scores2 Array of player2 scores
     * @return rounds Array of round numbers
     */
    function getTournamentMatches(
        uint256 tournamentId
    )
        public
        view
        returns (
            string[] memory player1s,
            string[] memory player2s,
            uint8[] memory scores1,
            uint8[] memory scores2,
            uint8[] memory rounds
        )
    {
        require(tournamentId < tournamentCount, "Tournament does not exist");

        Tournament storage t = tournaments[tournamentId];
        uint256 numMatches = t.matches.length;

        player1s = new string[](numMatches);
        player2s = new string[](numMatches);
        scores1 = new uint8[](numMatches);
        scores2 = new uint8[](numMatches);
        rounds = new uint8[](numMatches);

        for (uint256 i = 0; i < numMatches; i++) {
            player1s[i] = t.matches[i].player1;
            player2s[i] = t.matches[i].player2;
            scores1[i] = t.matches[i].score1;
            scores2[i] = t.matches[i].score2;
            rounds[i] = t.matches[i].round;
        }

        return (player1s, player2s, scores1, scores2, rounds);
    }

    /**
     * @dev Get total number of tournaments recorded
     */
    function getTournamentCount() public view returns (uint256) {
        return tournamentCount;
    }

    /**
     * @dev Get match count for a tournament
     * @param tournamentId The tournament identifier
     */
    function getMatchCount(uint256 tournamentId) public view returns (uint256) {
        require(tournamentId < tournamentCount, "Tournament does not exist");
        return tournaments[tournamentId].matches.length;
    }

    /**
     * @dev Get player count for a tournament
     * @param tournamentId The tournament identifier
     */
    function getPlayerCount(uint256 tournamentId) public view returns (uint256) {
        require(tournamentId < tournamentCount, "Tournament does not exist");
        return tournaments[tournamentId].players.length;
    }
}
