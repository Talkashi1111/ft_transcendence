# Tournament Scores Blockchain Module

This is a Hardhat 3 project for the ft_transcendence blockchain module. It stores tournament match scores on the Avalanche Fuji testnet.

## Features

- **Smart Contract**: `TournamentScores.sol` - Stores match results with player IDs and aliases
- **Network**: Avalanche Fuji C-Chain testnet
- **Security**: Owner-only access control for recording matches
- **Testing**: Comprehensive test suite with Solidity and TypeScript tests

## Security Features

### Owner Access Control

- Only the contract owner (backend server) can record matches
- Prevents unauthorized match submissions from arbitrary addresses
- Owner can transfer ownership to a new address if needed

### Overflow Protection

- Solidity 0.8.28 has built-in overflow/underflow protection
- `matchCount` is a uint256 (max value: ~10^77)
- Practically impossible to overflow - would need 10^60 matches/second for the universe's lifetime
- Uses `unchecked` block for gas optimization while maintaining safety

### Input Validation

- Tournament ID must be greater than 0
- Player IDs must be greater than 0 and different from each other
- Aliases must not be empty and maximum 50 characters
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
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
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

### Architecture Notes

**Owner Model:**

- The deploying address becomes the contract owner
- Only the owner can record matches (prevents unauthorized submissions)
- The backend server should use the same private key that deployed the contract
- Players never interact with the blockchain directly - backend handles all transactions

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

## References

- [Avalanche Fuji Testnet](https://docs.avax.network/build/dapp/testnet-workflow)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Viem Library](https://viem.sh/)
