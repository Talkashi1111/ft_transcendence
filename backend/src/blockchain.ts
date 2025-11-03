/**
 * Blockchain helper module for interacting with TournamentScores smart contract
 *
 * This module provides functions to:
 * - Record tournament match results on the blockchain
 * - Query match data from the blockchain
 * - Get tournament match history
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  type PublicClient,
  type WalletClient,
  type Address,
  type Abi,
} from 'viem';
import { avalancheFuji } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

// Path to the compiled contract ABI
const CONTRACT_ABI_PATH = path.join(
  __dirname,
  '../../blockchain/artifacts/contracts/TournamentScores.sol/TournamentScores.json'
);

// Load contract ABI
let contractABI: Abi | null = null;
try {
  const contractJson = JSON.parse(fs.readFileSync(CONTRACT_ABI_PATH, 'utf-8'));
  contractABI = contractJson.abi;
} catch (error) {
  console.error('Failed to load contract ABI:', error);
  contractABI = null;
}

/**
 * Get a Viem public client for reading blockchain data
 */
function getPublicClient(): PublicClient {
  const rpcUrl = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';

  return createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl),
  });
}

/**
 * Get a Viem wallet client for sending transactions
 */
function getWalletClient(): WalletClient {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in environment variables');
  }

  const rpcUrl = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(rpcUrl),
  });
}

/**
 * Get the TournamentScores contract instance
 */
function getContractInstance(readOnly: boolean = false) {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error('CONTRACT_ADDRESS not found in environment variables');
  }

  if (!contractABI) {
    throw new Error('Contract ABI not loaded');
  }

  const publicClient = getPublicClient();

  if (readOnly) {
    return getContract({
      address: contractAddress as Address,
      abi: contractABI,
      client: publicClient,
    });
  } else {
    const walletClient = getWalletClient();
    return getContract({
      address: contractAddress as Address,
      abi: contractABI,
      client: { public: publicClient, wallet: walletClient },
    });
  }
}

/**
 * Record a tournament match result on the blockchain
 *
 * @param tournamentId - The tournament identifier
 * @param player1Id - Database ID of player 1
 * @param player1Alias - Alias/username of player 1
 * @param player2Id - Database ID of player 2
 * @param player2Alias - Alias/username of player 2
 * @param score1 - Score of player 1
 * @param score2 - Score of player 2
 * @returns Transaction receipt and match ID
 */
export async function recordMatch(
  tournamentId: number,
  player1Id: number,
  player1Alias: string,
  player2Id: number,
  player2Alias: string,
  score1: number,
  score2: number
): Promise<{ matchId: bigint; txHash: string }> {
  const contract = getContractInstance(false);
  const publicClient = getPublicClient();

  // Call the recordMatch function
  const hash = await contract.write.recordMatch(
    [
      BigInt(tournamentId),
      BigInt(player1Id),
      player1Alias,
      BigInt(player2Id),
      player2Alias,
      BigInt(score1),
      BigInt(score2),
    ],
    {} as Record<string, never>
  );

  // Wait for transaction confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Extract matchId from the MatchRecorded event
  let matchId: bigint = 0n;

  if (receipt.logs && receipt.logs.length > 0) {
    // The first log should be the MatchRecorded event
    // matchId is the first indexed parameter (after topics[0] which is the event signature)
    const matchRecordedLog = receipt.logs[0];
    if (matchRecordedLog.topics && matchRecordedLog.topics.length > 1 && matchRecordedLog.topics[1]) {
      matchId = BigInt(matchRecordedLog.topics[1]);
    }
  }

  return {
    matchId,
    txHash: hash,
  };
}

/**
 * Get match details by match ID
 *
 * @param matchId - The match identifier
 * @returns Match data
 */
export async function getMatch(matchId: number): Promise<{
  tournamentId: bigint;
  player1Id: bigint;
  player1Alias: string;
  player2Id: bigint;
  player2Alias: string;
  score1: bigint;
  score2: bigint;
  timestamp: bigint;
  recordedBy: string;
}> {
  const contract = getContractInstance(true);

  const result = await contract.read.getMatch([BigInt(matchId)]) as [
    bigint,
    bigint,
    string,
    bigint,
    string,
    bigint,
    bigint,
    bigint,
    string
  ];

  return {
    tournamentId: result[0],
    player1Id: result[1],
    player1Alias: result[2],
    player2Id: result[3],
    player2Alias: result[4],
    score1: result[5],
    score2: result[6],
    timestamp: result[7],
    recordedBy: result[8],
  };
}

/**
 * Get all match IDs for a tournament
 *
 * @param tournamentId - The tournament identifier
 * @returns Array of match IDs
 */
export async function getTournamentMatches(tournamentId: number): Promise<bigint[]> {
  const contract = getContractInstance(true);

  const matchIds = await contract.read.getTournamentMatches([BigInt(tournamentId)]) as bigint[];
  return matchIds;
}

/**
 * Get the total number of matches recorded
 *
 * @returns Total match count
 */
export async function getTotalMatches(): Promise<bigint> {
  const contract = getContractInstance(true);

  const count = await contract.read.getTotalMatches([]) as bigint;
  return count;
}

/**
 * Check if blockchain is configured and ready
 */
export function isBlockchainConfigured(): boolean {
  return !!(
    contractABI &&
    process.env.CONTRACT_ADDRESS &&
    process.env.FUJI_RPC_URL &&
    process.env.PRIVATE_KEY
  );
}
