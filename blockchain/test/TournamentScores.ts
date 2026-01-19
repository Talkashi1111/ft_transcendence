import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { network } from 'hardhat';

describe('TournamentScores', async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Helper function to record a simple 4-player tournament
  async function recordSimpleTournament(
    contract: Awaited<ReturnType<typeof viem.deployContract>>,
    account: { account: { address: string } },
    odUserId = '550e8400-e29b-41d4-a716-446655440000',
    organizer = 'Alice'
  ) {
    // 4-player tournament: Alice, Bob, Charlie, David
    // Semi-finals (round 1): Alice vs Bob (5-3), Charlie vs David (4-5)
    // Finals (round 2): Alice vs David (6-4)
    // Winner: Alice
    const players = [organizer, 'Bob', 'Charlie', 'David'];
    const matchPlayers1 = [organizer, 'Charlie', organizer];
    const matchPlayers2 = ['Bob', 'David', 'David'];
    const matchScores1 = [5, 4, 6];
    const matchScores2 = [3, 5, 4];
    const matchRounds = [1, 1, 2];
    const winner = organizer;

    const hash = await contract.write.recordTournament(
      [
        odUserId,
        organizer,
        players,
        matchPlayers1,
        matchPlayers2,
        matchScores1,
        matchScores2,
        matchRounds,
        winner,
      ],
      account
    );
    await publicClient.waitForTransactionReceipt({ hash });
    return {
      odUserId,
      players,
      matchPlayers1,
      matchPlayers2,
      matchScores1,
      matchScores2,
      matchRounds,
      winner,
    };
  }

  it('Should record a tournament', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();

    const odUserId = '550e8400-e29b-41d4-a716-446655440000';
    const organizer = 'PongMaster';
    const players = ['PongMaster', 'FastPaddle'];
    const matchPlayers1 = ['PongMaster'];
    const matchPlayers2 = ['FastPaddle'];
    const matchScores1 = [5];
    const matchScores2 = [3];
    const matchRounds = [1];
    const winner = 'PongMaster';

    // Record a tournament
    const hash = await tournamentScores.write.recordTournament(
      [
        odUserId,
        organizer,
        players,
        matchPlayers1,
        matchPlayers2,
        matchScores1,
        matchScores2,
        matchRounds,
        winner,
      ],
      { account: owner.account }
    );

    await publicClient.waitForTransactionReceipt({ hash });

    // Verify the tournament was recorded
    const tournamentCount = await tournamentScores.read.getTournamentCount();
    assert.equal(tournamentCount, 1n, 'Should have 1 tournament recorded');

    // Get tournament details
    const tournament = await tournamentScores.read.getTournament([0n]);
    assert.equal(tournament[0], odUserId, 'User ID should match');
    assert.equal(tournament[1], organizer, 'Organizer should match');
    assert.deepEqual(tournament[2], players, 'Players should match');
    assert.equal(tournament[3], winner, 'Winner should match');
    assert.ok(tournament[4] > 0n, 'Timestamp should be set');
    assert.equal(
      tournament[5].toLowerCase(),
      owner.account.address.toLowerCase(),
      'Recorded by should be owner'
    );
  });

  it('Should record and retrieve tournament matches', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();

    await recordSimpleTournament(tournamentScores, { account: owner.account });

    // Get matches for the tournament
    const matches = await tournamentScores.read.getTournamentMatches([0n]);
    const [player1s, player2s, scores1, scores2, rounds] = matches;

    assert.equal(player1s.length, 3, 'Should have 3 matches');
    assert.equal(player1s[0], 'Alice', 'First match player1 should be Alice');
    assert.equal(player2s[0], 'Bob', 'First match player2 should be Bob');
    assert.equal(scores1[0], 5, 'First match score1 should be 5');
    assert.equal(scores2[0], 3, 'First match score2 should be 3');
    assert.equal(rounds[0], 1, 'First match should be round 1');

    // Check finals match
    assert.equal(player1s[2], 'Alice', 'Finals player1 should be Alice');
    assert.equal(player2s[2], 'David', 'Finals player2 should be David');
    assert.equal(rounds[2], 2, 'Finals should be round 2');
  });

  it('Should reject invalid user ID', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();

    // Should reject when user ID is not a valid UUID (wrong length)
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          ['invalid-uuid', 'Alice', ['Alice', 'Bob'], ['Alice'], ['Bob'], [5], [3], [1], 'Alice'],
          { account: owner.account }
        );
      },
      /Invalid user ID \(must be UUID\)/,
      'Should reject invalid UUID'
    );

    // Should reject empty user ID
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          ['', 'Alice', ['Alice', 'Bob'], ['Alice'], ['Bob'], [5], [3], [1], 'Alice'],
          { account: owner.account }
        );
      },
      /Invalid user ID \(must be UUID\)/,
      'Should reject empty user ID'
    );
  });

  it('Should reject empty organizer alias', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [validUuid, '', ['Alice', 'Bob'], ['Alice'], ['Bob'], [5], [3], [1], 'Alice'],
          { account: owner.account }
        );
      },
      /Organizer alias cannot be empty/,
      'Should reject empty organizer alias'
    );
  });

  it('Should reject too few players', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [validUuid, 'Alice', ['Alice'], ['Alice'], ['Alice'], [5], [3], [1], 'Alice'],
          { account: owner.account }
        );
      },
      /Minimum 2 players required/,
      'Should reject single player'
    );
  });

  it('Should reject too many players', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    const ninePlayers = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [validUuid, 'P1', ninePlayers, ['P1'], ['P2'], [5], [3], [1], 'P1'],
          { account: owner.account }
        );
      },
      /Maximum 8 players allowed/,
      'Should reject more than 8 players'
    );
  });

  it('Should reject mismatched match arrays', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [
            validUuid,
            'Alice',
            ['Alice', 'Bob'],
            ['Alice', 'Alice'],
            ['Bob'],
            [5],
            [3],
            [1],
            'Alice',
          ],
          { account: owner.account }
        );
      },
      /Match arrays must have same length/,
      'Should reject mismatched match arrays'
    );
  });

  it('Should reject no matches', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [validUuid, 'Alice', ['Alice', 'Bob'], [], [], [], [], [], 'Alice'],
          { account: owner.account }
        );
      },
      /At least one match required/,
      'Should reject tournament with no matches'
    );
  });

  it('Should emit TournamentRecorded event', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const deploymentBlockNumber = await publicClient.getBlockNumber();

    const odUserId = '550e8400-e29b-41d4-a716-446655440000';
    const organizer = 'EventOrganizer';
    const players = ['EventOrganizer', 'Player2', 'Player3', 'Player4'];
    const matchPlayers1 = ['EventOrganizer', 'Player3', 'EventOrganizer'];
    const matchPlayers2 = ['Player2', 'Player4', 'Player3'];
    const matchScores1 = [10, 8, 11];
    const matchScores2 = [5, 6, 9];
    const matchRounds = [1, 1, 2];
    const winner = 'EventOrganizer';

    // Record a tournament
    const hash = await tournamentScores.write.recordTournament(
      [
        odUserId,
        organizer,
        players,
        matchPlayers1,
        matchPlayers2,
        matchScores1,
        matchScores2,
        matchRounds,
        winner,
      ],
      { account: owner.account }
    );

    await publicClient.waitForTransactionReceipt({ hash });

    // Check that the event was emitted
    const events = await publicClient.getContractEvents({
      address: tournamentScores.address,
      abi: tournamentScores.abi,
      eventName: 'TournamentRecorded',
      fromBlock: deploymentBlockNumber,
      strict: true,
    });

    assert.ok(events.length > 0, 'Should emit TournamentRecorded event');

    const lastEvent = events[events.length - 1];
    assert.equal(lastEvent.args.tournamentId, 0n, 'Event tournament ID should be 0');
    assert.equal(lastEvent.args.odUserId, odUserId, 'Event user ID should match');
    assert.equal(lastEvent.args.organizer, organizer, 'Event organizer should match');
    assert.equal(lastEvent.args.playerCount, 4, 'Event player count should be 4');
    assert.equal(lastEvent.args.matchCount, 3, 'Event match count should be 3');
    assert.equal(lastEvent.args.winner, winner, 'Event winner should match');
  });

  it('Should only allow owner to record tournaments', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner, attacker] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    // Attacker should not be able to record a tournament
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [validUuid, 'Alice', ['Alice', 'Bob'], ['Alice'], ['Bob'], [5], [3], [1], 'Alice'],
          { account: attacker.account }
        );
      },
      /Only owner can call this function/,
      'Should reject non-owner calls'
    );

    // Owner should be able to record
    await recordSimpleTournament(tournamentScores, { account: owner.account });

    const tournamentCount = await tournamentScores.read.getTournamentCount();
    assert.equal(tournamentCount, 1n, 'Owner should be able to record tournaments');
  });

  it('Should transfer ownership', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner, newOwner] = await viem.getWalletClients();

    // Verify initial owner
    const initialOwner = await tournamentScores.read.owner();
    assert.equal(
      initialOwner.toLowerCase(),
      owner.account.address.toLowerCase(),
      'Initial owner should be deployer'
    );

    // Transfer ownership
    const hash = await tournamentScores.write.transferOwnership([newOwner.account.address], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Verify new owner
    const currentOwner = await tournamentScores.read.owner();
    assert.equal(
      currentOwner.toLowerCase(),
      newOwner.account.address.toLowerCase(),
      'Owner should be transferred'
    );

    // Old owner should not be able to record
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [validUuid, 'Alice', ['Alice', 'Bob'], ['Alice'], ['Bob'], [5], [3], [1], 'Alice'],
          { account: owner.account }
        );
      },
      /Only owner can call this function/,
      'Old owner should not be able to record'
    );

    // New owner should be able to record
    await recordSimpleTournament(tournamentScores, { account: newOwner.account });

    const tournamentCount = await tournamentScores.read.getTournamentCount();
    assert.equal(tournamentCount, 1n, 'New owner should be able to record tournaments');
  });

  it('Should validate alias length', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    const longAlias = 'a'.repeat(51); // 51 characters, exceeds 50 limit

    // Should reject when organizer alias is too long
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [
            validUuid,
            longAlias,
            [longAlias, 'Bob'],
            [longAlias],
            ['Bob'],
            [5],
            [3],
            [1],
            longAlias,
          ],
          { account: owner.account }
        );
      },
      /Organizer alias too long/,
      'Should reject organizer alias longer than 50 characters'
    );

    // Should reject when player alias is too long
    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [
            validUuid,
            'Alice',
            ['Alice', longAlias],
            ['Alice'],
            [longAlias],
            [5],
            [3],
            [1],
            'Alice',
          ],
          { account: owner.account }
        );
      },
      /Player alias too long/,
      'Should reject player alias longer than 50 characters'
    );
  });

  it('Should reject empty player alias', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [validUuid, 'Alice', ['Alice', ''], ['Alice'], [''], [5], [3], [1], 'Alice'],
          { account: owner.account }
        );
      },
      /Player alias cannot be empty/,
      'Should reject empty player alias'
    );
  });

  it('Should reject empty match player alias', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [validUuid, 'Alice', ['Alice', 'Bob'], [''], ['Bob'], [5], [3], [1], 'Alice'],
          { account: owner.account }
        );
      },
      /Match player1 alias cannot be empty/,
      'Should reject empty match player1 alias'
    );

    await assert.rejects(
      async () => {
        await tournamentScores.write.recordTournament(
          [validUuid, 'Alice', ['Alice', 'Bob'], ['Alice'], [''], [5], [3], [1], 'Alice'],
          { account: owner.account }
        );
      },
      /Match player2 alias cannot be empty/,
      'Should reject empty match player2 alias'
    );
  });

  it('Should get match count and player count', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();

    await recordSimpleTournament(tournamentScores, { account: owner.account });

    const matchCount = await tournamentScores.read.getMatchCount([0n]);
    assert.equal(matchCount, 3n, 'Should have 3 matches');

    const playerCount = await tournamentScores.read.getPlayerCount([0n]);
    assert.equal(playerCount, 4n, 'Should have 4 players');
  });

  it('Should reject getting non-existent tournament', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');

    await assert.rejects(
      async () => {
        await tournamentScores.read.getTournament([0n]);
      },
      /Tournament does not exist/,
      'Should reject getting non-existent tournament'
    );

    await assert.rejects(
      async () => {
        await tournamentScores.read.getTournamentMatches([999n]);
      },
      /Tournament does not exist/,
      'Should reject getting matches for non-existent tournament'
    );

    await assert.rejects(
      async () => {
        await tournamentScores.read.getMatchCount([0n]);
      },
      /Tournament does not exist/,
      'Should reject getting match count for non-existent tournament'
    );

    await assert.rejects(
      async () => {
        await tournamentScores.read.getPlayerCount([0n]);
      },
      /Tournament does not exist/,
      'Should reject getting player count for non-existent tournament'
    );
  });

  it('Should record multiple tournaments', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();

    const uuid1 = '550e8400-e29b-41d4-a716-446655440001';
    const uuid2 = '550e8400-e29b-41d4-a716-446655440002';
    const uuid3 = '550e8400-e29b-41d4-a716-446655440003';

    // Record first tournament
    await recordSimpleTournament(tournamentScores, { account: owner.account }, uuid1, 'Alice');

    // Record second tournament
    await recordSimpleTournament(tournamentScores, { account: owner.account }, uuid2, 'Bob');

    // Record third tournament
    await recordSimpleTournament(tournamentScores, { account: owner.account }, uuid3, 'Charlie');

    const tournamentCount = await tournamentScores.read.getTournamentCount();
    assert.equal(tournamentCount, 3n, 'Should have 3 tournaments');

    // Verify each tournament
    const t1 = await tournamentScores.read.getTournament([0n]);
    assert.equal(t1[0], uuid1, 'First tournament user ID should match');
    assert.equal(t1[1], 'Alice', 'First tournament organizer should be Alice');

    const t2 = await tournamentScores.read.getTournament([1n]);
    assert.equal(t2[0], uuid2, 'Second tournament user ID should match');
    assert.equal(t2[1], 'Bob', 'Second tournament organizer should be Bob');

    const t3 = await tournamentScores.read.getTournament([2n]);
    assert.equal(t3[0], uuid3, 'Third tournament user ID should match');
    assert.equal(t3[1], 'Charlie', 'Third tournament organizer should be Charlie');
  });

  it('Should record 2-player tournament', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    // Simplest possible tournament: 2 players, 1 match
    const hash = await tournamentScores.write.recordTournament(
      [validUuid, 'Alice', ['Alice', 'Bob'], ['Alice'], ['Bob'], [11], [5], [1], 'Alice'],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash });

    const tournament = await tournamentScores.read.getTournament([0n]);
    assert.equal(tournament[1], 'Alice', 'Organizer should be Alice');
    assert.deepEqual(tournament[2], ['Alice', 'Bob'], 'Should have 2 players');
    assert.equal(tournament[3], 'Alice', 'Winner should be Alice');

    const matches = await tournamentScores.read.getTournamentMatches([0n]);
    assert.equal(matches[0].length, 1, 'Should have 1 match');
  });

  it('Should record 8-player tournament', async function () {
    const tournamentScores = await viem.deployContract('TournamentScores');
    const [owner] = await viem.getWalletClients();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    // Maximum size: 8 players, 7 matches
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    // Quarter-finals
    const matchPlayers1 = ['P1', 'P3', 'P5', 'P7', 'P1', 'P5', 'P1'];
    const matchPlayers2 = ['P2', 'P4', 'P6', 'P8', 'P3', 'P7', 'P5'];
    const matchScores1 = [5, 5, 5, 5, 5, 5, 5];
    const matchScores2 = [3, 3, 3, 3, 3, 3, 3];
    const matchRounds = [1, 1, 1, 1, 2, 2, 3]; // Quarter-finals, Semi-finals, Finals

    const hash = await tournamentScores.write.recordTournament(
      [
        validUuid,
        'P1',
        players,
        matchPlayers1,
        matchPlayers2,
        matchScores1,
        matchScores2,
        matchRounds,
        'P1',
      ],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash });

    const playerCount = await tournamentScores.read.getPlayerCount([0n]);
    assert.equal(playerCount, 8n, 'Should have 8 players');

    const matchCount = await tournamentScores.read.getMatchCount([0n]);
    assert.equal(matchCount, 7n, 'Should have 7 matches');
  });
});
