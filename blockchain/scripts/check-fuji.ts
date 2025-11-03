import {
  createPublicClient,
  http,
  getContract,
} from "viem";
import { avalancheFuji } from "viem/chains";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const contractAddress = "0xc673e53845eb89Ab38166F8ACbAc92e0EB7a973D";

  console.log("🔍 Checking TournamentScores Contract on Fuji Testnet\n");
  console.log("Contract Address:", contractAddress);
  console.log("---\n");

  // Load contract ABI
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/TournamentScores.sol/TournamentScores.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Create public client (read-only)
  const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(),
  });

  // Get the contract instance
  const TournamentScores = getContract({
    address: contractAddress,
    abi: artifact.abi,
    client: { public: publicClient },
  });

  // Get owner
  const owner = await TournamentScores.read.owner([]);
  console.log("📋 Contract Owner:", owner);

  // Get total match count
  const totalMatches = (await TournamentScores.read.getTotalMatches([])) as bigint;
  console.log("📊 Total Matches:", totalMatches.toString());

  if (totalMatches > 0n) {
    console.log("\n📋 All Matches:");
    for (let i = 0n; i < totalMatches; i++) {
      const match = (await TournamentScores.read.getMatch([i])) as [
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
      console.log(`\n🔍 Match #${i}:`);
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
    }

    // Check tournament #1 matches
    console.log("\n📋 Tournament #1 Matches:");
    const tournamentMatches = (await TournamentScores.read.getTournamentMatches([
      1n,
    ])) as bigint[];
    console.log("Match IDs:", tournamentMatches.map((id: bigint) => id.toString()));
  } else {
    console.log("\nℹ️  No matches recorded yet");
  }

  console.log(`\n🔍 View on Snowtrace: https://testnet.snowtrace.io/address/${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
