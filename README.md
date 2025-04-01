# 📜 Freelancer Escrow Smart Contract

A decentralized Ethereum smart contract that facilitates **secure milestone-based payments** between clients and freelancers. Built with Solidity and Hardhat, it ensures trustless transactions, dispute resolution via a mediator, and milestone definitions stored via **IPFS**.

## 🔧 Features

- 💼 **Milestone-Based Payments**: Funds are released as the freelancer completes each milestone.
- 🔐 **Escrow System**: Client deposits full project fee upfront. Freelancer stakes a security deposit.
- ⚖️ **Dispute Resolution**: Mediator can resolve disputes and is paid a fixed fee.
- 📁 **IPFS Integration**: Project details and milestone definitions are referenced off-chain using IPFS hashes.
- ⏰ **Auto-Release**: If the client is inactive, payments can be auto-released after a 3-day grace period.

## 🛠️ Tech Stack

- [Hardhat](https://hardhat.org/)
- [Solidity ^0.8.19](https://docs.soliditylang.org/)
- [Chai](https://www.chaijs.com/) for testing
- [Ethers.js v6](https://docs.ethers.org/v6/)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [readline-sync](https://www.npmjs.com/package/readline-sync)

## 🚀 Quickstart

### 1. Clone the repo

```bash
git clone https://github.com/your-username/freelancer-escrow.git
cd freelancer-escrow
npm install
```

### 2. Create a `.env` file

```env
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
CLIENT_PRIVATE_KEY="0xYOUR_CLIENT_PRIVATE_KEY"
FREELANCER_PRIVATE_KEY="0xYOUR_FREELANCER_PRIVATE_KEY"
MEDIATOR_PRIVATE_KEY="0xYOUR_MEDIATOR_PRIVATE_KEY"
ETHERSCAN_API_KEY="YOUR_ETHERSCAN_KEY"
```

### 3. Compile the contract

```bash
npx hardhat compile
```

### 4. Run tests

```bash
npx hardhat test
```

### 5. Deploy the contract to Sepolia

Make sure `scripts/deploy.js` is configured correctly, then run:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### 6. Verify the contract on Etherscan

```bash
npx hardhat verify --network sepolia <contract_address> \
  "<freelancer_address>" \
  "<mediator_address>" \
  "50000000000000" \
  3 \
  "<ipfs_hash>"
```

### 7. Simulate full project flow (locally)

To test every functionality (milestone approval, disputes, mediator resolution, auto-release):

```bash
npx hardhat run scripts/demoLocal.js
```

---

MIT License
