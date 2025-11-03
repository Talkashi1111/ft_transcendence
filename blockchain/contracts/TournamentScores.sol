// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title TournamentScores
 * @dev Store and retrieve tournament match scores on the blockchain
 * @notice Only the contract owner can record matches to prevent unauthorized entries
 */
contract TournamentScores {
    struct Match {
        uint256 tournamentId;
        uint256 player1Id;
        string player1Alias;
        uint256 player2Id;
        string player2Alias;
        uint256 score1;
        uint256 score2;
        uint256 timestamp;
        address recordedBy;
    }

    // Owner of the contract (backend server)
    address public owner;

    // Mapping from match ID to Match data
    mapping(uint256 => Match) public matches;

    // Counter for match IDs (uint256 max is ~10^77, practically impossible to overflow)
    uint256 public matchCount;

    // Mapping from tournament ID to array of match IDs
    mapping(uint256 => uint256[]) public tournamentMatches;

    // Events
    event MatchRecorded(
        uint256 indexed matchId,
        uint256 indexed tournamentId,
        uint256 indexed player1Id,
        uint256 player2Id,
        string player1Alias,
        string player2Alias,
        uint256 score1,
        uint256 score2,
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
     * @dev Record a new match result
     * @param tournamentId The tournament identifier
     * @param player1Id ID of first player
     * @param player1Alias Alias of first player
     * @param player2Id ID of second player
     * @param player2Alias Alias of second player
     * @param score1 Score of first player
     * @param score2 Score of second player
     * @notice Only the owner (backend) can record matches
     */
    function recordMatch(
        uint256 tournamentId,
        uint256 player1Id,
        string memory player1Alias,
        uint256 player2Id,
        string memory player2Alias,
        uint256 score1,
        uint256 score2
    ) public onlyOwner returns (uint256) {
        require(tournamentId > 0, "Invalid tournament ID");
        require(player1Id > 0, "Invalid player1 ID");
        require(player2Id > 0, "Invalid player2 ID");
        require(player1Id != player2Id, "Players must be different");
        require(
            bytes(player1Alias).length > 0,
            "Player1 alias cannot be empty"
        );
        require(
            bytes(player2Alias).length > 0,
            "Player2 alias cannot be empty"
        );
        require(bytes(player1Alias).length <= 50, "Player1 alias too long");
        require(bytes(player2Alias).length <= 50, "Player2 alias too long");

        // Note: matchCount overflow is practically impossible (uint256 max = ~10^77)
        // Would need to record 10^60 matches per second for universe lifetime
        uint256 matchId = matchCount;
        unchecked {
            matchCount++; // Safe to use unchecked for gas optimization
        }

        matches[matchId] = Match({
            tournamentId: tournamentId,
            player1Id: player1Id,
            player1Alias: player1Alias,
            player2Id: player2Id,
            player2Alias: player2Alias,
            score1: score1,
            score2: score2,
            timestamp: block.timestamp,
            recordedBy: msg.sender
        });

        tournamentMatches[tournamentId].push(matchId);

        emit MatchRecorded(
            matchId,
            tournamentId,
            player1Id,
            player2Id,
            player1Alias,
            player2Alias,
            score1,
            score2,
            block.timestamp
        );

        return matchId;
    }

    /**
     * @dev Get match details by match ID
     * @param matchId The match identifier
     */
    function getMatch(
        uint256 matchId
    )
        public
        view
        returns (
            uint256 tournamentId,
            uint256 player1Id,
            string memory player1Alias,
            uint256 player2Id,
            string memory player2Alias,
            uint256 score1,
            uint256 score2,
            uint256 timestamp,
            address recordedBy
        )
    {
        require(matchId < matchCount, "Match does not exist");

        Match memory m = matches[matchId];
        return (
            m.tournamentId,
            m.player1Id,
            m.player1Alias,
            m.player2Id,
            m.player2Alias,
            m.score1,
            m.score2,
            m.timestamp,
            m.recordedBy
        );
    }
    /**
     * @dev Get all match IDs for a tournament
     * @param tournamentId The tournament identifier
     */
    function getTournamentMatches(
        uint256 tournamentId
    ) public view returns (uint256[] memory) {
        return tournamentMatches[tournamentId];
    }

    /**
     * @dev Get total number of matches recorded
     */
    function getTotalMatches() public view returns (uint256) {
        return matchCount;
    }
}
