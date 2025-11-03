import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define Hardhat localhost chain (chainId 31337)
const hardhatChain = {
  id: 31337,
  name: "Hardhat",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
} as const;

async function main() {
  // Contract address from deployment
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  console.log("🎮 TournamentScores Contract Interaction\n");
  console.log("Contract Address:", contractAddress);
  console.log("---\n");

  // Load contract ABI
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/TournamentScores.sol/TournamentScores.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Create clients
  const publicClient = createPublicClient({
    chain: hardhatChain,
    transport: http(),
  });

  // Use default Hardhat account #0
  const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  const walletClient = createWalletClient({
    account,
    chain: hardhatChain,
    transport: http(),
  });

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
  console.log("🎯 Recording a new match...");
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
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("✅ Match recorded! Transaction hash:", receipt.transactionHash);
  console.log("---\n");

  // Get updated match count
  const newCount = (await TournamentScores.read.getTotalMatches([])) as bigint;
  console.log("📊 Total Matches:", newCount.toString());

  // Get the match details
  console.log("\n🔍 Match Details:");
  const match = (await TournamentScores.read.getMatch([0n])) as [
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

  // Record another match
  console.log("\n🎯 Recording another match...");
  const hash2 = await TournamentScores.write.recordMatch([
    1n, // tournamentId
    100n, // player1Id
    "Alice", // player1Alias
    300n, // player2Id
    "Charlie", // player2Alias
    7n, // score1
    2n, // score2
  ]);
  await publicClient.waitForTransactionReceipt({ hash: hash2 });
  console.log("✅ Second match recorded!");

  // Get tournament matches
  console.log("\n📋 Tournament #1 Matches:");
  const tournamentMatches = (await TournamentScores.read.getTournamentMatches([
    1n,
  ])) as bigint[];
  console.log(
    "Match IDs:",
    tournamentMatches.map((id: bigint) => id.toString())
  );

  console.log("\n🎉 Done! Contract is working perfectly!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
