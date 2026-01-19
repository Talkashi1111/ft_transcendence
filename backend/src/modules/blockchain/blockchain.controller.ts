import { FastifyRequest, FastifyReply } from 'fastify';
import * as blockchainService from './blockchain.service.js';
import type { RecordTournamentRequest } from './blockchain.schema.js';
import { prisma } from '../../utils/prisma.js';

/**
 * Record a completed local tournament on the blockchain
 *
 * Flow:
 * 1. Validate request (players, matches)
 * 2. Derive winner from match results
 * 3. Save to database (LocalTournament + MatchHistory)
 * 4. Record on blockchain
 * 5. Update database with blockchain ID and txHash
 */
export async function recordTournamentHandler(
  request: FastifyRequest<{ Body: RecordTournamentRequest }>,
  reply: FastifyReply
) {
  try {
    const { players, matches } = request.body;
    const { id: userId } = request.user as { id: string; email: string };

    // Get user's current alias
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { alias: true },
    });

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    // Derive winner from tournament matches
    // The winner is the player who won the final match (highest round)
    const finalMatch = matches.reduce((prev, curr) => (curr.round > prev.round ? curr : prev));
    const winner = finalMatch.score1 > finalMatch.score2 ? finalMatch.player1 : finalMatch.player2;

    // 1. Save to database first
    const tournament = await prisma.localTournament.create({
      data: {
        organizerId: userId,
        organizerAlias: user.alias,
        playerCount: players.length,
        winner,
        matches: {
          create: matches.map((match, index) => ({
            mode: 'TOURNAMENT',
            player1Id: userId, // Organizer is always player1 for DB relation
            player1Alias: match.player1,
            player2Alias: match.player2,
            score1: match.score1,
            score2: match.score2,
            round: match.round,
            matchOrder: index,
          })),
        },
      },
    });

    // 2. Record on blockchain
    const blockchainResult = await blockchainService.recordTournament({
      odUserId: userId,
      organizer: user.alias,
      players,
      matches,
      winner,
    });

    // 3. Update database with blockchain info
    await prisma.localTournament.update({
      where: { id: tournament.id },
      data: {
        blockchainId: Number(blockchainResult.blockchainId),
        txHash: blockchainResult.txHash,
        recordedAt: new Date(),
      },
    });

    return reply.status(201).send({
      success: true,
      tournamentId: tournament.id,
      blockchainId: blockchainResult.blockchainId.toString(),
      txHash: blockchainResult.txHash,
      snowtraceUrl: blockchainService.getSnowtraceUrl(blockchainResult.txHash),
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to record tournament' });
  }
}

/**
 * Get tournament data from blockchain for verification
 */
export async function getTournamentFromBlockchainHandler(
  request: FastifyRequest<{ Params: { blockchainId: string } }>,
  reply: FastifyReply
) {
  try {
    const blockchainId = parseInt(request.params.blockchainId, 10);

    if (isNaN(blockchainId) || blockchainId < 0) {
      return reply.code(400).send({ error: 'Invalid blockchain ID' });
    }

    // Get tournament data from blockchain
    const tournament = await blockchainService.getTournament(blockchainId);
    const matches = await blockchainService.getTournamentMatches(blockchainId);

    return reply.status(200).send({
      blockchainId: blockchainId.toString(),
      odUserId: tournament.odUserId,
      organizer: tournament.organizer,
      players: tournament.players,
      winner: tournament.winner,
      timestamp: tournament.timestamp.toString(),
      recordedBy: tournament.recordedBy,
      matches,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch tournament from blockchain' });
  }
}

/**
 * Get total number of tournaments on blockchain
 */
export async function getTournamentCountHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const count = await blockchainService.getTournamentCount();
    return reply.status(200).send({ count: count.toString() });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch tournament count' });
  }
}

/**
 * Get user's tournament history from database
 */
export async function getUserTournamentsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id: userId } = request.user as { id: string; email: string };

    const tournaments = await prisma.localTournament.findMany({
      where: { organizerId: userId },
      orderBy: { playedAt: 'desc' },
      include: {
        matches: {
          orderBy: [{ round: 'asc' }, { matchOrder: 'asc' }],
          select: {
            player1Alias: true,
            player2Alias: true,
            score1: true,
            score2: true,
            round: true,
          },
        },
      },
    });

    return reply.status(200).send({
      tournaments: tournaments.map((t) => ({
        id: t.id,
        blockchainId: t.blockchainId,
        organizerAlias: t.organizerAlias,
        playerCount: t.playerCount,
        winner: t.winner,
        txHash: t.txHash,
        createdAt: t.playedAt.toISOString(),
        recordedAt: t.recordedAt?.toISOString() ?? null,
        matches: t.matches,
      })),
      total: tournaments.length,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch user tournaments' });
  }
}

/**
 * Get recent global tournament history from database
 */
export async function getGlobalTournamentsHandler(
  request: FastifyRequest<{ Querystring: { limit?: string } }>,
  reply: FastifyReply
) {
  try {
    const limit = Math.min(parseInt(request.query.limit || '20', 10), 50);

    const tournaments = await prisma.localTournament.findMany({
      orderBy: { playedAt: 'desc' },
      take: limit,
      include: {
        matches: {
          orderBy: [{ round: 'asc' }, { matchOrder: 'asc' }],
          select: {
            player1Alias: true,
            player2Alias: true,
            score1: true,
            score2: true,
            round: true,
          },
        },
      },
    });

    const total = await prisma.localTournament.count();

    return reply.status(200).send({
      tournaments: tournaments.map((t) => ({
        id: t.id,
        blockchainId: t.blockchainId,
        organizerAlias: t.organizerAlias,
        playerCount: t.playerCount,
        winner: t.winner,
        txHash: t.txHash,
        createdAt: t.playedAt.toISOString(),
        recordedAt: t.recordedAt?.toISOString() ?? null,
        matches: t.matches,
      })),
      total,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch global tournaments' });
  }
}
