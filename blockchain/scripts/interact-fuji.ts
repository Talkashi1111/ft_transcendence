import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Get private key from environment
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not found in .env file");
  }

  // Your deployed contract address
  const contractAddress = "0xc673e53845eb89Ab38166F8ACbAc92e0EB7a973D";

  console.log("🎮 TournamentScores Contract - Fuji Testnet Interaction\n");
  console.log("Contract Address:", contractAddress);
  console.log("Network: Avalanche Fuji Testnet (Chain ID: 43113)");
  console.log("---\n");

  // Load contract ABI
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/TournamentScores.sol/TournamentScores.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Create clients
  const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(),
  });

  // Create account from environment variable
  const account = privateKeyToAccount(
    privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`
  );

  const walletClient = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(),
  });

  console.log("👤 Your Account:", account.address);

  // Get the contract instance
  const TournamentScores = getContract({
    address: contractAddress,
    abi: artifact.abi,
    client: { public: publicClient, wallet: walletClient },
  });

  // Get owner
  const owner = await TournamentScores.read.owner([]);
  console.log("📋 Contract Owner:", owner);

  // Get initial match count
  const initialCount = (await TournamentScores.read.getTotalMatches([])) as bigint;
  console.log("📊 Total Matches:", initialCount.toString());
  console.log("---\n");

  // Record a match
  console.log("🎯 Recording a new match to Fuji testnet...");
  const hash = await TournamentScores.write.recordMatch([
    1n, // tournamentId
    100n, // player1Id
    "Alice", // player1Alias
    200n, // player2Id
    "Bob", // player2Alias
    5n, // score1
    3n, // score2
  ]);

  console.log("⏳ Waiting for transaction confirmation...");
  console.log("🔗 Transaction hash:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("✅ Match recorded! Block number:", receipt.blockNumber);
  console.log("---\n");

  // Wait a moment for state to propagate
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get updated match count
  const newCount = (await TournamentScores.read.getTotalMatches([])) as bigint;
  console.log("📊 Total Matches:", newCount.toString());

  // Get the match details - use the match ID from the initial count
  const matchId = initialCount; // First match is at index 0, second at 1, etc.
  console.log(`\n🔍 Match #${matchId} Details:`);
  const match = (await TournamentScores.read.getMatch([matchId])) as [
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
  console.log({
    tournamentId: match[0].toString(),
    player1Id: match[1].toString(),
    player1Alias: match[2],
    player2Id: match[3].toString(),
    player2Alias: match[4],
    score1: match[5].toString(),
    score2: match[6].toString(),
    timestamp: new Date(Number(match[7]) * 1000).toISOString(),
    recordedBy: match[8],
  });

  // Get tournament matches
  console.log("\n📋 Tournament #1 Matches:");
  const tournamentMatches = (await TournamentScores.read.getTournamentMatches([
    1n,
  ])) as bigint[];
  console.log(
    "Match IDs:",
    tournamentMatches.map((id: bigint) => id.toString())
  );

  console.log("\n🎉 Success! Your contract is live on Fuji testnet!");
  console.log(`\n🔍 View on Snowtrace: https://testnet.snowtrace.io/address/${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
