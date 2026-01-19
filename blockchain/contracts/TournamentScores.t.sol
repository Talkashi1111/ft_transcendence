// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {TournamentScores} from "./TournamentScores.sol";
import {Test} from "forge-std/Test.sol";

contract TournamentScoresTest is Test {
    TournamentScores public tournament;
    address public owner;
    address public nonOwner;

    // Test data
    string constant VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
    string constant ORGANIZER = "Alice";
    string constant WINNER = "Alice";

    function setUp() public {
        owner = address(this);
        nonOwner = address(0x1234);
        tournament = new TournamentScores();
    }

    // Helper function to create simple 2-player tournament arrays
    function _getTwoPlayerData()
        internal
        pure
        returns (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        )
    {
        players = new string[](2);
        players[0] = "Alice";
        players[1] = "Bob";

        matchPlayers1 = new string[](1);
        matchPlayers1[0] = "Alice";

        matchPlayers2 = new string[](1);
        matchPlayers2[0] = "Bob";

        matchScores1 = new uint8[](1);
        matchScores1[0] = 5;

        matchScores2 = new uint8[](1);
        matchScores2[0] = 3;

        matchRounds = new uint8[](1);
        matchRounds[0] = 1;
    }

    // Helper function to create 4-player tournament arrays
    function _getFourPlayerData()
        internal
        pure
        returns (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        )
    {
        players = new string[](4);
        players[0] = "Alice";
        players[1] = "Bob";
        players[2] = "Charlie";
        players[3] = "David";

        // 3 matches: 2 semi-finals + 1 final
        matchPlayers1 = new string[](3);
        matchPlayers1[0] = "Alice";
        matchPlayers1[1] = "Charlie";
        matchPlayers1[2] = "Alice";

        matchPlayers2 = new string[](3);
        matchPlayers2[0] = "Bob";
        matchPlayers2[1] = "David";
        matchPlayers2[2] = "Charlie";

        matchScores1 = new uint8[](3);
        matchScores1[0] = 5;
        matchScores1[1] = 4;
        matchScores1[2] = 6;

        matchScores2 = new uint8[](3);
        matchScores2[0] = 3;
        matchScores2[1] = 5;
        matchScores2[2] = 4;

        matchRounds = new uint8[](3);
        matchRounds[0] = 1;
        matchRounds[1] = 1;
        matchRounds[2] = 2;
    }

    function test_InitialState() public view {
        require(tournament.owner() == owner, "Owner should be deployer");
        require(
            tournament.getTournamentCount() == 0,
            "Initial tournament count should be 0"
        );
    }

    function test_RecordTournament() public {
        (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        ) = _getTwoPlayerData();

        uint256 tournamentId = tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );

        require(tournamentId == 0, "First tournament ID should be 0");
        require(
            tournament.getTournamentCount() == 1,
            "Tournament count should be 1"
        );

        (
            string memory odUserId,
            string memory organizer,
            string[] memory storedPlayers,
            string memory winner,
            uint256 timestamp,
            address recordedBy
        ) = tournament.getTournament(tournamentId);

        require(
            keccak256(bytes(odUserId)) == keccak256(bytes(VALID_UUID)),
            "User ID mismatch"
        );
        require(
            keccak256(bytes(organizer)) == keccak256(bytes(ORGANIZER)),
            "Organizer mismatch"
        );
        require(storedPlayers.length == 2, "Should have 2 players");
        require(
            keccak256(bytes(winner)) == keccak256(bytes(WINNER)),
            "Winner mismatch"
        );
        require(timestamp > 0, "Timestamp should be set");
        require(recordedBy == owner, "RecordedBy should be owner");
    }

    function test_RecordFourPlayerTournament() public {
        (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        ) = _getFourPlayerData();

        uint256 tournamentId = tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );

        require(
            tournament.getPlayerCount(tournamentId) == 4,
            "Should have 4 players"
        );
        require(
            tournament.getMatchCount(tournamentId) == 3,
            "Should have 3 matches"
        );
    }

    function test_GetTournamentMatches() public {
        (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        ) = _getFourPlayerData();

        uint256 tournamentId = tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );

        (
            string[] memory player1s,
            string[] memory player2s,
            uint8[] memory scores1,
            uint8[] memory scores2,
            uint8[] memory rounds
        ) = tournament.getTournamentMatches(tournamentId);

        require(player1s.length == 3, "Should have 3 matches");
        require(
            keccak256(bytes(player1s[0])) == keccak256(bytes("Alice")),
            "First match player1 should be Alice"
        );
        require(
            keccak256(bytes(player2s[0])) == keccak256(bytes("Bob")),
            "First match player2 should be Bob"
        );
        require(scores1[0] == 5, "First match score1 should be 5");
        require(scores2[0] == 3, "First match score2 should be 3");
        require(rounds[0] == 1, "First match should be round 1");
        require(rounds[2] == 2, "Final match should be round 2");
    }

    function test_RecordMultipleTournaments() public {
        (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        ) = _getTwoPlayerData();

        // Record first tournament
        uint256 id1 = tournament.recordTournament(
            "550e8400-e29b-41d4-a716-446655440001",
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );

        // Record second tournament
        uint256 id2 = tournament.recordTournament(
            "550e8400-e29b-41d4-a716-446655440002",
            "Bob",
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            "Bob"
        );

        require(id1 == 0, "First tournament ID should be 0");
        require(id2 == 1, "Second tournament ID should be 1");
        require(
            tournament.getTournamentCount() == 2,
            "Tournament count should be 2"
        );
    }

    function test_RevertWhen_InvalidUserId() public {
        (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        ) = _getTwoPlayerData();

        vm.expectRevert("Invalid user ID (must be UUID)");
        tournament.recordTournament(
            "invalid-uuid",
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );
    }

    function test_RevertWhen_EmptyOrganizer() public {
        (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        ) = _getTwoPlayerData();

        vm.expectRevert("Organizer alias cannot be empty");
        tournament.recordTournament(
            VALID_UUID,
            "",
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );
    }

    function test_RevertWhen_TooFewPlayers() public {
        string[] memory players = new string[](1);
        players[0] = "Alice";

        string[] memory matchPlayers1 = new string[](1);
        matchPlayers1[0] = "Alice";

        string[] memory matchPlayers2 = new string[](1);
        matchPlayers2[0] = "Alice";

        uint8[] memory matchScores1 = new uint8[](1);
        matchScores1[0] = 5;

        uint8[] memory matchScores2 = new uint8[](1);
        matchScores2[0] = 3;

        uint8[] memory matchRounds = new uint8[](1);
        matchRounds[0] = 1;

        vm.expectRevert("Minimum 2 players required");
        tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );
    }

    function test_RevertWhen_TooManyPlayers() public {
        string[] memory players = new string[](9);
        for (uint8 i = 0; i < 9; i++) {
            players[i] = "Player";
        }

        string[] memory matchPlayers1 = new string[](1);
        matchPlayers1[0] = "Player";

        string[] memory matchPlayers2 = new string[](1);
        matchPlayers2[0] = "Player";

        uint8[] memory matchScores1 = new uint8[](1);
        matchScores1[0] = 5;

        uint8[] memory matchScores2 = new uint8[](1);
        matchScores2[0] = 3;

        uint8[] memory matchRounds = new uint8[](1);
        matchRounds[0] = 1;

        vm.expectRevert("Maximum 8 players allowed");
        tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );
    }

    function test_RevertWhen_NoMatches() public {
        string[] memory players = new string[](2);
        players[0] = "Alice";
        players[1] = "Bob";

        string[] memory emptyArray = new string[](0);
        uint8[] memory emptyUint8Array = new uint8[](0);

        vm.expectRevert("At least one match required");
        tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            emptyArray,
            emptyArray,
            emptyUint8Array,
            emptyUint8Array,
            emptyUint8Array,
            WINNER
        );
    }

    function test_RevertWhen_MismatchedMatchArrays() public {
        string[] memory players = new string[](2);
        players[0] = "Alice";
        players[1] = "Bob";

        string[] memory matchPlayers1 = new string[](2);
        matchPlayers1[0] = "Alice";
        matchPlayers1[1] = "Alice";

        string[] memory matchPlayers2 = new string[](1);
        matchPlayers2[0] = "Bob";

        uint8[] memory matchScores1 = new uint8[](1);
        matchScores1[0] = 5;

        uint8[] memory matchScores2 = new uint8[](1);
        matchScores2[0] = 3;

        uint8[] memory matchRounds = new uint8[](1);
        matchRounds[0] = 1;

        vm.expectRevert("Match arrays must have same length");
        tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );
    }

    function test_RevertWhen_NonOwnerRecordsTournament() public {
        (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        ) = _getTwoPlayerData();

        vm.prank(nonOwner);
        vm.expectRevert("Only owner can call this function");
        tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );
    }

    function test_RevertWhen_GetNonExistentTournament() public {
        vm.expectRevert("Tournament does not exist");
        tournament.getTournament(0);
    }

    function test_RevertWhen_GetMatchesForNonExistentTournament() public {
        vm.expectRevert("Tournament does not exist");
        tournament.getTournamentMatches(999);
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x5678);

        // Transfer ownership
        tournament.transferOwnership(newOwner);

        require(tournament.owner() == newOwner, "Owner should be updated");

        // Old owner cannot record tournament
        (
            string[] memory players,
            string[] memory matchPlayers1,
            string[] memory matchPlayers2,
            uint8[] memory matchScores1,
            uint8[] memory matchScores2,
            uint8[] memory matchRounds
        ) = _getTwoPlayerData();

        vm.expectRevert("Only owner can call this function");
        tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );

        // New owner can record tournament
        vm.prank(newOwner);
        uint256 tournamentId = tournament.recordTournament(
            VALID_UUID,
            ORGANIZER,
            players,
            matchPlayers1,
            matchPlayers2,
            matchScores1,
            matchScores2,
            matchRounds,
            WINNER
        );

        require(
            tournamentId == 0,
            "New owner should be able to record tournament"
        );
    }

    function test_RevertWhen_TransferToZeroAddress() public {
        vm.expectRevert("New owner cannot be zero address");
        tournament.transferOwnership(address(0));
    }

    function test_RevertWhen_NonOwnerTransfersOwnership() public {
        vm.prank(nonOwner);
        vm.expectRevert("Only owner can call this function");
        tournament.transferOwnership(address(0x5678));
    }
}
