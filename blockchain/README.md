# Tournament Scores Blockchain Module

This is a Hardhat 3 project for the ft_transcendence blockchain module. It stores tournament results on the Avalanche Fuji testnet.

## 🚀 Quick Start

### View Contract & Transactions Online

Your deployed contract is live on Avalanche Fuji testnet! View it here:

**Contract Address:** [0x778ec2935D737462Af7860b6a31fD988E0b01067](https://testnet.snowtrace.io/address/0x778ec2935D737462Af7860b6a31fD988E0b01067)

**What you can see:**

- 📜 **Contract Code** - Verified Solidity source code with comments
- 📊 **Transactions** - All tournament recordings in real-time
- 💰 **Balance** - Contract's AVAX balance
- 📝 **Events** - `TournamentRecorded` events with player data
- 🔍 **Read Contract** - Query tournament details, match data, player counts
- ✍️ **Write Contract** - Record new tournaments (owner only)

**Example URLs:**

```
Contract Overview:  https://testnet.snowtrace.io/address/0x778ec2935D737462Af7860b6a31fD988E0b01067
Recent Transactions: https://testnet.snowtrace.io/address/0x778ec2935D737462Af7860b6a31fD988E0b01067#txs
Contract Code:      https://testnet.snowtrace.io/address/0x778ec2935D737462Af7860b6a31fD988E0b01067#code
```

### Test the Contract (Backend Integration)

The backend automatically interacts with the deployed contract via the API:

```bash
# Record a tournament via API (requires authentication)
curl -X POST http://localhost:3000/api/tournaments/local \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "players": ["Alice", "Bob", "Charlie", "David"],
    "matches": [
      {"player1": "Alice", "player2": "Bob", "score1": 5, "score2": 3, "round": 1},
      {"player1": "Charlie", "player2": "David", "score1": 4, "score2": 5, "round": 1},
      {"player1": "Alice", "player2": "David", "score1": 6, "score2": 4, "round": 2}
    ]
  }'

# Verify tournament on blockchain
curl http://localhost:3000/api/tournaments/blockchain/1 -b cookies.txt
```

After running, check [Snowtrace](https://testnet.snowtrace.io/address/0x778ec2935D737462Af7860b6a31fD988E0b01067#txs) to see your transaction!

## Features

- **Smart Contract**: `TournamentScores.sol` - Stores complete tournament results with all matches
- **Network**: Avalanche Fuji C-Chain testnet
- **Security**: Owner-only access control for recording tournaments
- **Testing**: Comprehensive test suite with Solidity and TypeScript tests
- **Single Transaction**: Records entire tournament (players, matches, winner) in one tx

## Security Features

### Owner Access Control

- Only the contract owner (backend server) can record tournaments
- Prevents unauthorized tournament submissions from arbitrary addresses
- Owner can transfer ownership to a new address if needed

### Overflow Protection

- Solidity 0.8.28 has built-in overflow/underflow protection
- `matchCount` is a uint256 (max value: ~10^77)
- Practically impossible to overflow - would need 10^60 matches/second for the universe's lifetime
- Uses `unchecked` block for gas optimization while maintaining safety

### Input Validation

- Organizer's database UUID must be valid (36 characters)
- Player count must be 2-8
- Match count must be at least 1
- Player aliases must not be empty and maximum 50 characters
- Scores are uint8 (0-255), suitable for pong scores
- All validations use `require()` statements with descriptive error messages

## Usage

### Running Tests

To run all the tests in the project:

```shell
pnpm test
# or
npx hardhat test
```

### Local Development & Testing

For local development, you can run a Hardhat node and deploy contracts locally:

**1. Start a local Hardhat node** (in one terminal):

```shell
pnpm run node
# or
npx hardhat node
```

This starts a local blockchain on `http://127.0.0.1:8545` with:

- Chain ID: 31337
- 20 pre-funded accounts (10,000 ETH each)
- Deterministic addresses and private keys

**2. Deploy to local node** (in another terminal):

```shell
pnpm run deploy:local
# or
npx hardhat ignition deploy ignition/modules/TournamentScores.ts --network localhost
```

This will output the deployed contract address, e.g., `0x5FbDB2315678afecb367f032d93F642f64180aa3`

**3. Interact with the deployed contract**:

```shell
npx hardhat run scripts/interact.ts --network localhost
```

This script demonstrates:

- Reading contract owner
- Recording match results
- Querying match details
- Getting tournament matches

**Note:** The contract address in `scripts/interact.ts` is hardcoded. Update it if your deployment address differs:

```typescript
const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
```

**Remember:** Restarting the Hardhat node resets the blockchain state. You'll need to redeploy contracts after each restart.

### Deploy to Avalanche Fuji Testnet

This project is configured to deploy to Avalanche Fuji C-Chain testnet.

**Prerequisites:**

1. Set up your `.env` file with your private key:
   ```
   PRIVATE_KEY=your_private_key_here
   ```
2. Get testnet AVAX from the [Avalanche Faucet](https://build.avax.network/console/primary-network/faucet)

**Deploy the contract:**

```shell
npx hardhat ignition deploy ignition/modules/TournamentScores.ts --network fuji
```

**Important:** Save the deployed contract address! You'll need it in your backend `.env` file:

```
CONTRACT_ADDRESS=0x...
```

**Verify the contract on Snowtrace:**

After deploying, verify your contract to make the source code publicly viewable:

```shell
npx hardhat run scripts/verify-snowtrace.ts --network fuji
```

This will:

- Flatten the contract code
- Submit it to Snowtrace for verification
- Display the verification status and link

You can then view your verified contract at: `https://testnet.snowtrace.io/address/<your-contract-address>#code`

**View Transactions:**

Every time the backend records a tournament, you'll see a new transaction:

1. Go to [your contract on Snowtrace](https://testnet.snowtrace.io/address/0x778ec2935D737462Af7860b6a31fD988E0b01067)
2. Click **"Transactions"** tab to see all tournament recordings
3. Click any transaction hash to see details:
   - Gas used
   - Transaction fee (in AVAX)
   - Input data (encoded tournament details) - click "Decode input data"
   - Logs/Events (decoded player data)
4. Click **"Events"** tab to see `TournamentRecorded` events with tournament IDs and winners

### Architecture Notes

**Owner Model:**

- The deploying address becomes the contract owner
- Only the owner can record tournaments (prevents unauthorized submissions)
- The backend server should use the same private key that deployed the contract
- Players never interact with the blockchain directly - backend handles all transactions

**Tournament-Centric Design:**

- Each tournament is recorded in a single transaction (gas efficient)
- Contains: organizer UUID, player aliases, all matches, winner
- Immutable once recorded - provides tamper-proof verification
- Auto-increment tournament IDs on blockchain (separate from database IDs)

## Environment Variables

**blockchain/.env:**

```
PRIVATE_KEY=your_private_key_here
```

**backend/.env:**

```
CONTRACT_ADDRESS=deployed_contract_address
PRIVATE_KEY=same_as_blockchain_private_key
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

## References & Learning Resources

### Official Documentation

- **[Avalanche Documentation](https://docs.avax.network/)** - Official Avalanche network documentation
- **[Solidity Documentation](https://docs.soliditylang.org/)** - Solidity language reference and tutorials
- **[Hardhat Documentation](https://hardhat.org/docs)** - Development environment and testing framework
- **[Viem Library](https://viem.sh/)** - TypeScript library for Ethereum interaction

### Learning & Tutorials

- **[Smart Contracts Introduction](https://ethereum.org/developers/docs/smart-contracts/)** - Comprehensive guide to understanding smart contracts, including:
  - What are smart contracts and how they work
  - Smart contract languages (Solidity)
  - Smart contract anatomy and best practices
  - Deploying and testing contracts
  - Security considerations

### Tools & Services

- **[Avalanche Fuji Faucet](https://build.avax.network/console/primary-network/faucet)** - Get free test AVAX tokens
- **[Snowtrace (Fuji)](https://testnet.snowtrace.io/)** - Avalanche testnet blockchain explorer

## Contract Version History

| Version         | Address                                                                                                                       | Description                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| v2 (current)    | [0x778ec2935D737462Af7860b6a31fD988E0b01067](https://testnet.snowtrace.io/address/0x778ec2935D737462Af7860b6a31fD988E0b01067) | Tournament-centric design. Single tx per tournament with all matches. |
| v1 (deprecated) | [0xc673e53845eb89Ab38166F8ACbAc92e0EB7a973D](https://testnet.snowtrace.io/address/0xc673e53845eb89Ab38166F8ACbAc92e0EB7a973D) | Match-centric design. One tx per match with numeric player IDs.       |
