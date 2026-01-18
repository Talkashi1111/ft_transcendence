/**
 * Blockchain service module for interacting with TournamentScores smart contract
 *
 * This module provides functions to:
 * - Record complete tournament results on the blockchain
 * - Query tournament data from the blockchain
 * - Verify tournament authenticity
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  defineChain,
  type PublicClient,
  type WalletClient,
  type Address,
  type Abi,
  type Chain,
} from 'viem';
import { avalancheFuji } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the compiled contract ABI
const CONTRACT_ABI_PATH = path.join(
  __dirname,
  '../../../../blockchain/artifacts/contracts/TournamentScores.sol/TournamentScores.json'
);

// Cached ABI to avoid re-reading file
let cachedABI: Abi | null = null;

/**
 * Load contract ABI from file (lazy-loaded and cached)
 * Throws an error if the ABI file cannot be loaded
 */
function loadContractABI(): Abi {
  if (cachedABI !== null) {
    return cachedABI as Abi;
  }

  try {
    const contractJson = JSON.parse(fs.readFileSync(CONTRACT_ABI_PATH, 'utf-8'));
    if (!contractJson.abi) {
      throw new Error('ABI property not found in contract JSON');
    }
    cachedABI = contractJson.abi as Abi;
    return cachedABI as Abi;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load contract ABI from ${CONTRACT_ABI_PATH}: ${error.message}`);
    }
    throw new Error(`Failed to load contract ABI from ${CONTRACT_ABI_PATH}: Unknown error`);
  }
}

// Define local Hardhat chain for development
const hardhatLocal: Chain = defineChain({
  id: 31337,
  name: 'Hardhat Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
});

/**
 * Get the appropriate chain based on RPC URL
 */
function getChain(): Chain {
  const rpcUrl = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
  // Use Hardhat local chain for localhost
  if (rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost')) {
    return hardhatLocal;
  }
  return avalancheFuji;
}

/**
 * Get a Viem public client for reading blockchain data
 */
function getPublicClient(): PublicClient {
  const rpcUrl = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';

  return createPublicClient({
    chain: getChain(),
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

  // Normalize private key format (ensure it starts with 0x)
  const normalizedKey = privateKey.startsWith('0x')
    ? (privateKey as `0x${string}`)
    : (`0x${privateKey}` as `0x${string}`);

  const rpcUrl = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
  const account = privateKeyToAccount(normalizedKey);

  return createWalletClient({
    account,
    chain: getChain(),
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

  // Lazy-load the ABI (will throw if file doesn't exist)
  const abi = loadContractABI();

  const publicClient = getPublicClient();

  if (readOnly) {
    return getContract({
      address: contractAddress as Address,
      abi,
      client: publicClient,
    });
  } else {
    const walletClient = getWalletClient();
    return getContract({
      address: contractAddress as Address,
      abi,
      client: { public: publicClient, wallet: walletClient },
    });
  }
}

// ============================================
// Types
// ============================================

export interface TournamentMatch {
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  round: number;
}

export interface RecordTournamentParams {
  odUserId: string; // Organizer's UUID from database
  organizer: string; // Organizer's alias
  players: string[]; // All player aliases (2-8)
  matches: TournamentMatch[];
  winner: string;
}

export interface TournamentData {
  odUserId: string;
  organizer: string;
  players: string[];
  winner: string;
  timestamp: bigint;
  recordedBy: string;
}

export interface TournamentMatchData {
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  round: number;
}

// ============================================
// Write Functions
// ============================================

/**
 * Record a complete tournament on the blockchain in a single transaction
 *
 * @param params - Tournament data including organizer, players, matches, and winner
 * @returns Transaction hash and blockchain tournament ID
 */
export async function recordTournament(
  params: RecordTournamentParams
): Promise<{ blockchainId: bigint; txHash: string }> {
  const { odUserId, organizer, players, matches, winner } = params;

  const contract = getContractInstance(false);
  const publicClient = getPublicClient();

  // Separate match data into arrays (contract requires this format)
  const matchPlayers1 = matches.map((m) => m.player1);
  const matchPlayers2 = matches.map((m) => m.player2);
  const matchScores1 = matches.map((m) => m.score1);
  const matchScores2 = matches.map((m) => m.score2);
  const matchRounds = matches.map((m) => m.round);

  // Call the recordTournament function
  const hash = await contract.write.recordTournament([
    odUserId,
    organizer,
    players,
    matchPlayers1,
    matchPlayers2,
    matchScores1,
    matchScores2,
    matchRounds,
    winner,
  ]);

  // Wait for transaction confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Extract blockchainId from the TournamentRecorded event
  let blockchainId: bigint = 0n;

  if (receipt.logs && receipt.logs.length > 0) {
    // The first log should be the TournamentRecorded event
    // tournamentId is the first indexed parameter (topics[1])
    const tournamentRecordedLog = receipt.logs[0];
    if (
      tournamentRecordedLog.topics &&
      tournamentRecordedLog.topics.length > 1 &&
      tournamentRecordedLog.topics[1]
    ) {
      blockchainId = BigInt(tournamentRecordedLog.topics[1]);
    }
  }

  return {
    blockchainId,
    txHash: hash,
  };
}

// ============================================
// Read Functions
// ============================================

/**
 * Get tournament details by blockchain ID
 *
 * @param blockchainId - The blockchain tournament identifier
 * @returns Tournament data
 */
export async function getTournament(blockchainId: number): Promise<TournamentData> {
  const contract = getContractInstance(true);

  const result = (await contract.read.getTournament([BigInt(blockchainId)])) as [
    string, // odUserId
    string, // organizer
    string[], // players
    string, // winner
    bigint, // timestamp
    string, // recordedBy
  ];

  return {
    odUserId: result[0],
    organizer: result[1],
    players: result[2],
    winner: result[3],
    timestamp: result[4],
    recordedBy: result[5],
  };
}

/**
 * Get all matches for a tournament
 *
 * @param blockchainId - The blockchain tournament identifier
 * @returns Array of match data
 */
export async function getTournamentMatches(blockchainId: number): Promise<TournamentMatchData[]> {
  const contract = getContractInstance(true);

  const result = (await contract.read.getTournamentMatches([BigInt(blockchainId)])) as [
    string[], // player1s
    string[], // player2s
    number[], // scores1
    number[], // scores2
    number[], // rounds
  ];

  const [player1s, player2s, scores1, scores2, rounds] = result;

  return player1s.map((_, i) => ({
    player1: player1s[i],
    player2: player2s[i],
    score1: Number(scores1[i]),
    score2: Number(scores2[i]),
    round: Number(rounds[i]),
  }));
}

/**
 * Get the total number of tournaments recorded
 *
 * @returns Total tournament count
 */
export async function getTournamentCount(): Promise<bigint> {
  const contract = getContractInstance(true);

  const count = (await contract.read.getTournamentCount([])) as bigint;
  return count;
}

/**
 * Get match count for a tournament
 *
 * @param blockchainId - The blockchain tournament identifier
 * @returns Number of matches
 */
export async function getMatchCount(blockchainId: number): Promise<bigint> {
  const contract = getContractInstance(true);

  const count = (await contract.read.getMatchCount([BigInt(blockchainId)])) as bigint;
  return count;
}

/**
 * Get player count for a tournament
 *
 * @param blockchainId - The blockchain tournament identifier
 * @returns Number of players
 */
export async function getPlayerCount(blockchainId: number): Promise<bigint> {
  const contract = getContractInstance(true);

  const count = (await contract.read.getPlayerCount([BigInt(blockchainId)])) as bigint;
  return count;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if blockchain is configured and ready
 */
export function isBlockchainConfigured(): boolean {
  try {
    // Try to load ABI to verify it exists
    loadContractABI();
    return !!(process.env.CONTRACT_ADDRESS && process.env.FUJI_RPC_URL && process.env.PRIVATE_KEY);
  } catch {
    return false;
  }
}

/**
 * Get the Snowtrace URL for a transaction
 */
export function getSnowtraceUrl(txHash: string): string {
  return `https://testnet.snowtrace.io/tx/${txHash}`;
}
