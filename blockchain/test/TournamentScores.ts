import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("TournamentScores", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Should record a match", async function () {
    const tournamentScores = await viem.deployContract("TournamentScores");
    const [owner] = await viem.getWalletClients();

    const tournamentId = 1n;
    const player1Id = 42n;
    const player1Alias = "PongMaster";
    const player2Id = 99n;
    const player2Alias = "FastPaddle";
    const score1 = 5n;
    const score2 = 3n;

    // Record a match
    const hash = await tournamentScores.write.recordMatch(
      [tournamentId, player1Id, player1Alias, player2Id, player2Alias, score1, score2],
      { account: owner.account }
    );

    await publicClient.waitForTransactionReceipt({ hash });

    // Verify the match was recorded
    const matchCount = await tournamentScores.read.getTotalMatches();
    assert.equal(matchCount, 1n, "Should have 1 match recorded");

    // Get match details
    const match = await tournamentScores.read.getMatch([0n]);
    assert.equal(match[0], tournamentId, "Tournament ID should match");
    assert.equal(match[1], player1Id, "Player 1 ID should match");
    assert.equal(match[2], player1Alias, "Player 1 alias should match");
    assert.equal(match[3], player2Id, "Player 2 ID should match");
    assert.equal(match[4], player2Alias, "Player 2 alias should match");
    assert.equal(match[5], score1, "Score 1 should match");
    assert.equal(match[6], score2, "Score 2 should match");
  });

  it("Should get tournament matches", async function () {
    const tournamentScores = await viem.deployContract("TournamentScores");
    const [owner] = await viem.getWalletClients();

    const tournamentId = 2n;

    // Record multiple matches for the same tournament
    await tournamentScores.write.recordMatch(
      [tournamentId, 1n, "Alice", 2n, "Bob", 10n, 5n],
      { account: owner.account }
    );
    await tournamentScores.write.recordMatch(
      [tournamentId, 2n, "Bob", 3n, "Charlie", 7n, 8n],
      { account: owner.account }
    );

    // Get all matches for the tournament
    const matchIds = await tournamentScores.read.getTournamentMatches([tournamentId]);
    assert.equal(matchIds.length, 2, "Should have 2 matches for tournament");
  });

  it("Should reject invalid player IDs", async function () {
    const tournamentScores = await viem.deployContract("TournamentScores");
    const [owner] = await viem.getWalletClients();

    // Should reject when player1 ID is 0
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordMatch(
          [1n, 0n, "InvalidPlayer", 2n, "Bob", 5n, 3n],
          { account: owner.account }
        );
      },
      /Invalid player1 ID/,
      "Should reject zero ID for player1"
    );
  });

  it("Should reject when players are the same", async function () {
    const tournamentScores = await viem.deployContract("TournamentScores");
    const [owner] = await viem.getWalletClients();

    // Should reject when both players have the same ID
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordMatch(
          [1n, 1n, "Alice", 1n, "Alice", 5n, 3n],
          { account: owner.account }
        );
      },
      /Players must be different/,
      "Should reject when players are the same"
    );
  });

  it("Should emit MatchRecorded event", async function () {
    const tournamentScores = await viem.deployContract("TournamentScores");
    const [owner] = await viem.getWalletClients();
    const deploymentBlockNumber = await publicClient.getBlockNumber();

    const tournamentId = 3n;
    const player1Id = 10n;
    const player1Alias = "EventPlayer1";
    const player2Id = 20n;
    const player2Alias = "EventPlayer2";
    const score1 = 15n;
    const score2 = 10n;

    // Record a match
    const hash = await tournamentScores.write.recordMatch(
      [tournamentId, player1Id, player1Alias, player2Id, player2Alias, score1, score2],
      { account: owner.account }
    );

    await publicClient.waitForTransactionReceipt({ hash });

    // Check that the event was emitted
    const events = await publicClient.getContractEvents({
      address: tournamentScores.address,
      abi: tournamentScores.abi,
      eventName: "MatchRecorded",
      fromBlock: deploymentBlockNumber,
      strict: true,
    });

    assert.ok(events.length > 0, "Should emit MatchRecorded event");

    const lastEvent = events[events.length - 1];
    assert.equal(lastEvent.args.tournamentId, tournamentId, "Event tournament ID should match");
    assert.equal(lastEvent.args.player1Id, player1Id, "Event player1 ID should match");
    assert.equal(lastEvent.args.player1Alias, player1Alias, "Event player1 alias should match");
    assert.equal(lastEvent.args.score1, score1, "Event score1 should match");
  });

  it("Should only allow owner to record matches", async function () {
    const tournamentScores = await viem.deployContract("TournamentScores");
    const [owner, attacker] = await viem.getWalletClients();

    // Attacker should not be able to record a match
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordMatch(
          [1n, 1n, "Alice", 2n, "Bob", 5n, 3n],
          { account: attacker.account }
        );
      },
      /Only owner can call this function/,
      "Should reject non-owner calls"
    );

    // Owner should be able to record
    const hash = await tournamentScores.write.recordMatch(
      [1n, 1n, "Alice", 2n, "Bob", 5n, 3n],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash });

    const matchCount = await tournamentScores.read.getTotalMatches();
    assert.equal(matchCount, 1n, "Owner should be able to record matches");
  });

  it("Should transfer ownership", async function () {
    const tournamentScores = await viem.deployContract("TournamentScores");
    const [owner, newOwner] = await viem.getWalletClients();

    // Verify initial owner
    const initialOwner = await tournamentScores.read.owner();
    assert.equal(initialOwner.toLowerCase(), owner.account.address.toLowerCase(), "Initial owner should be deployer");

    // Transfer ownership
    const hash = await tournamentScores.write.transferOwnership(
      [newOwner.account.address],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash });

    // Verify new owner
    const currentOwner = await tournamentScores.read.owner();
    assert.equal(currentOwner.toLowerCase(), newOwner.account.address.toLowerCase(), "Owner should be transferred");

    // Old owner should not be able to record
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordMatch(
          [1n, 1n, "Alice", 2n, "Bob", 5n, 3n],
          { account: owner.account }
        );
      },
      /Only owner can call this function/,
      "Old owner should not be able to record"
    );

    // New owner should be able to record
    const recordHash = await tournamentScores.write.recordMatch(
      [1n, 1n, "Alice", 2n, "Bob", 5n, 3n],
      { account: newOwner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: recordHash });

    const matchCount = await tournamentScores.read.getTotalMatches();
    assert.equal(matchCount, 1n, "New owner should be able to record matches");
  });

  it("Should validate tournament ID", async function () {
    const tournamentScores = await viem.deployContract("TournamentScores");
    const [owner] = await viem.getWalletClients();

    // Should reject when tournament ID is 0
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordMatch(
          [0n, 1n, "Alice", 2n, "Bob", 5n, 3n],
          { account: owner.account }
        );
      },
      /Invalid tournament ID/,
      "Should reject zero tournament ID"
    );
  });

  it("Should validate alias length", async function () {
    const tournamentScores = await viem.deployContract("TournamentScores");
    const [owner] = await viem.getWalletClients();

    const longAlias = "a".repeat(51); // 51 characters, exceeds 50 limit

    // Should reject when alias is too long
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordMatch(
          [1n, 1n, longAlias, 2n, "Bob", 5n, 3n],
          { account: owner.account }
        );
      },
      /Player1 alias too long/,
      "Should reject alias longer than 50 characters"
    );
  });
});

