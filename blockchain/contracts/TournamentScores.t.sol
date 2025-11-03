// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {TournamentScores} from "./TournamentScores.sol";
import {Test} from "forge-std/Test.sol";

contract TournamentScoresTest is Test {
    TournamentScores public tournament;
    address public owner;
    address public nonOwner;

    // Test data
    uint256 constant TOURNAMENT_ID = 1;
    uint256 constant PLAYER1_ID = 100;
    string constant PLAYER1_ALIAS = "Alice";
    uint256 constant PLAYER2_ID = 200;
    string constant PLAYER2_ALIAS = "Bob";
    uint256 constant SCORE1 = 5;
    uint256 constant SCORE2 = 3;

    function setUp() public {
        owner = address(this);
        nonOwner = address(0x1234);
        tournament = new TournamentScores();
    }

    function test_InitialState() public view {
        require(tournament.owner() == owner, "Owner should be deployer");
        require(
            tournament.matchCount() == 0,
            "Initial match count should be 0"
        );
        require(tournament.getTotalMatches() == 0, "Total matches should be 0");
    }

    function test_RecordMatch() public {
        uint256 matchId = tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );

        require(matchId == 0, "First match ID should be 0");
        require(tournament.matchCount() == 1, "Match count should be 1");

        (
            uint256 tournamentId,
            uint256 player1Id,
            string memory player1Alias,
            uint256 player2Id,
            string memory player2Alias,
            uint256 score1,
            uint256 score2,
            uint256 timestamp,
            address recordedBy
        ) = tournament.getMatch(matchId);

        require(tournamentId == TOURNAMENT_ID, "Tournament ID mismatch");
        require(player1Id == PLAYER1_ID, "Player1 ID mismatch");
        require(
            keccak256(bytes(player1Alias)) == keccak256(bytes(PLAYER1_ALIAS)),
            "Player1 alias mismatch"
        );
        require(player2Id == PLAYER2_ID, "Player2 ID mismatch");
        require(
            keccak256(bytes(player2Alias)) == keccak256(bytes(PLAYER2_ALIAS)),
            "Player2 alias mismatch"
        );
        require(score1 == SCORE1, "Score1 mismatch");
        require(score2 == SCORE2, "Score2 mismatch");
        require(timestamp > 0, "Timestamp should be set");
        require(recordedBy == owner, "RecordedBy should be owner");
    }

    function test_RecordMultipleMatches() public {
        // Record first match
        uint256 matchId1 = tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );

        // Record second match
        uint256 matchId2 = tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            300,
            "Charlie",
            7,
            2
        );

        require(matchId1 == 0, "First match ID should be 0");
        require(matchId2 == 1, "Second match ID should be 1");
        require(tournament.matchCount() == 2, "Match count should be 2");

        uint256[] memory matches = tournament.getTournamentMatches(
            TOURNAMENT_ID
        );
        require(matches.length == 2, "Should have 2 matches in tournament");
        require(matches[0] == matchId1, "First match ID mismatch");
        require(matches[1] == matchId2, "Second match ID mismatch");
    }

    function test_GetTournamentMatches() public {
        uint256 tournamentId1 = 1;
        uint256 tournamentId2 = 2;

        // Record matches for tournament 1
        tournament.recordMatch(
            tournamentId1,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );
        tournament.recordMatch(
            tournamentId1,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            300,
            "Charlie",
            4,
            4
        );

        // Record match for tournament 2
        tournament.recordMatch(
            tournamentId2,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            300,
            "Charlie",
            6,
            5
        );

        uint256[] memory matches1 = tournament.getTournamentMatches(
            tournamentId1
        );
        uint256[] memory matches2 = tournament.getTournamentMatches(
            tournamentId2
        );

        require(matches1.length == 2, "Tournament 1 should have 2 matches");
        require(matches2.length == 1, "Tournament 2 should have 1 match");
    }

    function test_RevertWhen_InvalidTournamentId() public {
        vm.expectRevert("Invalid tournament ID");
        tournament.recordMatch(
            0,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );
    }

    function test_RevertWhen_InvalidPlayer1Id() public {
        vm.expectRevert("Invalid player1 ID");
        tournament.recordMatch(
            TOURNAMENT_ID,
            0,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );
    }

    function test_RevertWhen_InvalidPlayer2Id() public {
        vm.expectRevert("Invalid player2 ID");
        tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            0,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );
    }

    function test_RevertWhen_SamePlayerIds() public {
        vm.expectRevert("Players must be different");
        tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER1_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );
    }

    function test_RevertWhen_EmptyPlayer1Alias() public {
        vm.expectRevert("Player1 alias cannot be empty");
        tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            "",
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );
    }

    function test_RevertWhen_EmptyPlayer2Alias() public {
        vm.expectRevert("Player2 alias cannot be empty");
        tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            "",
            SCORE1,
            SCORE2
        );
    }

    function test_RevertWhen_Player1AliasTooLong() public {
        string
            memory longAlias = "This alias is way too long and exceeds the maximum allowed length of 50 characters";
        vm.expectRevert("Player1 alias too long");
        tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            longAlias,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );
    }

    function test_RevertWhen_Player2AliasTooLong() public {
        string
            memory longAlias = "This alias is way too long and exceeds the maximum allowed length of 50 characters";
        vm.expectRevert("Player2 alias too long");
        tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            longAlias,
            SCORE1,
            SCORE2
        );
    }

    function test_RevertWhen_NonOwnerRecordsMatch() public {
        vm.prank(nonOwner);
        vm.expectRevert("Only owner can call this function");
        tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );
    }

    function test_RevertWhen_GetNonExistentMatch() public {
        vm.expectRevert("Match does not exist");
        tournament.getMatch(0);
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x5678);

        // Transfer ownership
        tournament.transferOwnership(newOwner);

        require(tournament.owner() == newOwner, "Owner should be updated");

        // Old owner cannot record match
        vm.expectRevert("Only owner can call this function");
        tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );

        // New owner can record match
        vm.prank(newOwner);
        uint256 matchId = tournament.recordMatch(
            TOURNAMENT_ID,
            PLAYER1_ID,
            PLAYER1_ALIAS,
            PLAYER2_ID,
            PLAYER2_ALIAS,
            SCORE1,
            SCORE2
        );

        require(matchId == 0, "New owner should be able to record match");
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

    function testFuzz_RecordMatch(
        uint256 tournamentId,
        uint256 player1Id,
        uint256 player2Id,
        uint256 score1,
        uint256 score2
    ) public {
        // Ensure valid inputs
        vm.assume(tournamentId > 0);
        vm.assume(player1Id > 0);
        vm.assume(player2Id > 0);
        vm.assume(player1Id != player2Id);

        uint256 matchId = tournament.recordMatch(
            tournamentId,
            player1Id,
            PLAYER1_ALIAS,
            player2Id,
            PLAYER2_ALIAS,
            score1,
            score2
        );

        (
            uint256 storedTournamentId,
            uint256 storedPlayer1Id,
            ,
            uint256 storedPlayer2Id,
            ,
            uint256 storedScore1,
            uint256 storedScore2,
            ,

        ) = tournament.getMatch(matchId);

        require(storedTournamentId == tournamentId, "Tournament ID mismatch");
        require(storedPlayer1Id == player1Id, "Player1 ID mismatch");
        require(storedPlayer2Id == player2Id, "Player2 ID mismatch");
        require(storedScore1 == score1, "Score1 mismatch");
        require(storedScore2 == score2, "Score2 mismatch");
    }

    function testFuzz_MultipleMatches(uint8 matchCount) public {
        vm.assume(matchCount > 0 && matchCount <= 100); // Limit to reasonable number

        for (uint8 i = 0; i < matchCount; i++) {
            tournament.recordMatch(
                TOURNAMENT_ID,
                PLAYER1_ID,
                PLAYER1_ALIAS,
                PLAYER2_ID + i,
                PLAYER2_ALIAS,
                SCORE1 + i,
                SCORE2
            );
        }

        require(tournament.matchCount() == matchCount, "Match count mismatch");
        require(
            tournament.getTotalMatches() == matchCount,
            "Total matches mismatch"
        );

        uint256[] memory matches = tournament.getTournamentMatches(
            TOURNAMENT_ID
        );
        require(matches.length == matchCount, "Tournament matches mismatch");
    }
}
