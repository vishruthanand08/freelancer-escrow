# 🧾 Freelancer Escrow Smart Contract

A decentralized Ethereum smart contract that facilitates **secure milestone-based payments** between clients and freelancers. Built with Solidity and Hardhat, it ensures trustless transactions, dispute resolution via a mediator, and milestone definitions stored via **IPFS**.

---

## 🔧 Features

- 💼 **Milestone-Based Payments**: Funds are released as the freelancer completes each milestone.
- 🔐 **Escrow System**: Client deposits full project fee upfront. Freelancer stakes a security deposit.
- ⚖️ **Dispute Resolution**: Mediator can resolve disputes and is paid a fixed fee.
- 📁 **IPFS Integration**: Project details and milestone definitions are referenced off-chain using IPFS hashes.
- ⏰ **Auto-Release**: If the client is inactive, payments can be auto-released after a 3-day grace period.

---

## 🛠 Tech Stack

- [Hardhat](https://hardhat.org/)
- [Solidity ^0.8.19](https://docs.soliditylang.org/)
- [Chai](https://www.chaijs.com/) for testing
- [Ethers.js v6](https://docs.ethers.org/v6/)

---

## 🚀 Quickstart

1. **Clone the repo**

```bash
git clone https://github.com/your-username/freelancer-escrow.git
cd freelancer-escrow
npm install
npx hardhat compile
npx hardhat test
