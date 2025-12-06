import { FastifyRequest, FastifyReply } from 'fastify';
import * as blockchainService from './blockchain.service.js';
import type { RecordMatchRequest } from './blockchain.schema.js';

/**
 * Get all matches for a tournament
 */
export async function getTournamentMatchesHandler(
  request: FastifyRequest<{ Params: { tournamentId: string } }>,
  reply: FastifyReply
) {
  try {
    const tournamentId = parseInt(request.params.tournamentId, 10);

    if (isNaN(tournamentId)) {
      return reply.code(400).send({ error: 'Invalid tournament ID' });
    }

    // Get match IDs for the tournament
    const matchIds = await blockchainService.getTournamentMatches(tournamentId);

    // Fetch details for each match
    const matches = await Promise.all(
      matchIds.map(async (matchId) => {
        const match = await blockchainService.getMatch(Number(matchId));
        return {
          matchId: matchId.toString(),
          tournamentId: match.tournamentId.toString(),
          player1Id: match.player1Id.toString(),
          player1Alias: match.player1Alias,
          player2Id: match.player2Id.toString(),
          player2Alias: match.player2Alias,
          score1: match.score1.toString(),
          score2: match.score2.toString(),
          timestamp: match.timestamp.toString(),
          recordedBy: match.recordedBy,
        };
      })
    );

    return reply.status(200).send({
      tournamentId,
      matchIds: matchIds.map((id) => id.toString()),
      matches,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch tournament matches' });
  }
}

/**
 * Record a new match on the blockchain
 */
export async function recordMatchHandler(
  request: FastifyRequest<{ Body: RecordMatchRequest }>,
  reply: FastifyReply
) {
  try {
    const { tournamentId, player1Id, player1Alias, player2Id, player2Alias, score1, score2 } =
      request.body;

    const result = await blockchainService.recordMatch(
      tournamentId,
      player1Id,
      player1Alias,
      player2Id,
      player2Alias,
      score1,
      score2
    );

    return reply.status(200).send({
      success: true,
      matchId: result.matchId.toString(),
      txHash: result.txHash,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      success: false,
      matchId: '0',
      txHash: '',
    });
  }
}

/**
 * Get total number of matches recorded
 */
export async function getTotalMatchesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const total = await blockchainService.getTotalMatches();
    return reply.status(200).send({ total: total.toString() });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch total matches' });
  }
}
