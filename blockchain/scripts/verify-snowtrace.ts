import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CONTRACT_ADDRESS = "0xc673e53845eb89Ab38166F8ACbAc92e0EB7a973D";
const CONTRACT_NAME = "TournamentScores";
const COMPILER_VERSION = "v0.8.28+commit.7893614a";
const OPTIMIZATION_USED = "1"; // Try with optimization
const OPTIMIZATION_RUNS = "200";
const LICENSE_TYPE = "3"; // MIT

interface SnowtraceResponse {
  status: string;
  message: string;
  result: string;
}

async function flattenContract() {
  console.log("📝 Flattening contract...\n");

  const { stdout } = await execAsync(
    `npx hardhat flatten contracts/TournamentScores.sol`
  );

  // Clean up the flattened code
  const lines = stdout.split('\n');
  const cleanedLines: string[] = [];
  let firstSPDX = false;

  for (const line of lines) {
    // Skip dotenv output and empty lines at the start
    if (line.includes('[dotenv@') || line.includes('Nothing to compile')) {
      continue;
    }

    // Handle SPDX licenses - keep only the first one
    if (line.includes('SPDX-License-Identifier')) {
      if (!firstSPDX) {
        cleanedLines.push(line);
        firstSPDX = true;
      }
    } else {
      cleanedLines.push(line);
    }
  }

  // Remove leading empty lines
  while (cleanedLines.length > 0 && cleanedLines[0].trim() === '') {
    cleanedLines.shift();
  }

  return cleanedLines.join('\n');
}

async function verifyOnSnowTrace(sourceCode: string) {
  console.log("🚀 Verifying contract on Snowtrace...\n");

  const params: Record<string, string> = {
    contractaddress: CONTRACT_ADDRESS,
    sourceCode: sourceCode,
    codeformat: "solidity-single-file",
    contractname: CONTRACT_NAME,
    compilerversion: COMPILER_VERSION,
    optimizationUsed: OPTIMIZATION_USED,
    licenseType: LICENSE_TYPE,
    apikey: "placeholder", // Snowtrace doesn't require a real API key
  };

  if (OPTIMIZATION_USED === "1") {
    params.runs = OPTIMIZATION_RUNS;
  }

  const formData = new URLSearchParams(params);

  const response = await fetch(
    "https://api-testnet.snowtrace.io/api?module=contract&action=verifysourcecode",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    }
  );

  const result = (await response.json()) as SnowtraceResponse;
  console.log("📋 Response from Snowtrace:");
  console.log(JSON.stringify(result, null, 2));

  if (result.status === "1") {
    console.log("\n✅ Contract verification submitted successfully!");
    console.log(`📝 GUID: ${result.result}`);
    console.log("\n⏳ Checking verification status in 10 seconds...");

    // Wait and check status
    await new Promise(resolve => setTimeout(resolve, 10000));
    await checkVerificationStatus(result.result);
  } else {
    console.log("\n❌ Verification failed:");
    console.log(result.result);
  }
}

async function checkVerificationStatus(guid: string) {
  const response = await fetch(
    `https://api-testnet.snowtrace.io/api?module=contract&action=checkverifystatus&guid=${guid}`
  );

  const result = (await response.json()) as SnowtraceResponse;
  console.log("\n📊 Verification Status:");
  console.log(JSON.stringify(result, null, 2));

  if (result.status === "1") {
    console.log("\n🎉 Contract successfully verified!");
    console.log(`🔍 View on Snowtrace: https://testnet.snowtrace.io/address/${CONTRACT_ADDRESS}#code`);
  } else {
    console.log("\n⏳ Verification still pending. Check manually at:");
    console.log(`https://testnet.snowtrace.io/address/${CONTRACT_ADDRESS}#code`);
  }
}

async function main() {
  console.log("🎮 TournamentScores Contract Verification\n");
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`Compiler: ${COMPILER_VERSION}`);
  console.log(`Optimization: ${OPTIMIZATION_USED === "1" ? "Yes (200 runs)" : "No"}`);
  console.log("---\n");

  try {
    const flattenedCode = await flattenContract();
    await verifyOnSnowTrace(flattenedCode);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
