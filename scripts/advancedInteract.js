/*******************************************************************************************
 * advancedInteract.js
 * 
 * A fully revamped, user-friendly CLI to interact with FreelancerEscrow on Sepolia.
 * 
 * 1) It displays project details (fee, stake, IPFS hash).
 * 2) Lets you choose roles: client, freelancer, mediator.
 * 3) Offers intuitive menu actions: deposit stake, mark complete, approve, dispute, resolve, auto-release, withdraw.
 * 4) Allows quick role switching or exit.
 * 5) Also shows milestone status for better clarity.
 *******************************************************************************************/

const { ethers } = require("hardhat");
const readline = require("readline-sync");
require("dotenv").config();

// Change these to your actual deployed contract info
const CONTRACT_ADDRESS = "0x4d7716677fD79c921B2E18Ef49378e653403eE9f";
const ABI = require("../artifacts/contracts/FreelancerEscrow.sol/FreelancerEscrow.json").abi;

const privateKeys = {
  client: process.env.CLIENT_PRIVATE_KEY,
  freelancer: process.env.FREELANCER_PRIVATE_KEY,
  mediator: process.env.MEDIATOR_PRIVATE_KEY,
};

async function getRoleSigner(role) {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  return new ethers.Wallet(privateKeys[role], provider);
}

async function connectContract(signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

/**
 * Helper function to display milestone data from getMilestoneStatus().
 */
async function showMilestoneStatus(contract, i) {
  const [completed, approved, disputed, timestamp] = await contract.getMilestoneStatus(i);
  console.log(` Milestone #${i} → Completed: ${completed}, Approved: ${approved}, Disputed: ${disputed}, Timestamp: ${timestamp}`);
}

/**
 * Main CLI loop
 */
async function main() {
  console.log("\n🚀 Welcome to the Revamped FreelancerEscrow CLI!\n");
  console.log("This script will let you pick roles, view contract info, and execute major actions.\n");

  // Just pick any valid role initially so we can read basic contract data
  const initSigner = await getRoleSigner("client");
  const initContract = await connectContract(initSigner);

  // Show basic contract details
  const contractState = await initContract.contractState();
  const fee = await initContract.projectFee();
  const stake = await initContract.freelancerStake();
  const ipfsHash = await initContract.projectIpfsHash();
  const milestones = await initContract.numMilestones();
  let currentMilestone = await initContract.currentMilestone();
  
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`Contract State: ${["Created", "InProgress", "Disputed", "Completed"][contractState]}`);
  console.log(`Project Fee (ETH): ${ethers.formatEther(fee)}`);
  console.log(`Freelancer Stake (ETH): ${ethers.formatEther(stake)}`);
  console.log(`Num Milestones: ${milestones}`);
  console.log(`Current Milestone Index: ${currentMilestone}\n`);
  console.log(`IPFS Hash: ${ipfsHash}`);
  console.log("");

  // Show all milestone statuses at the start
  console.log("Milestone Statuses:");
  for (let i = 0; i < milestones; i++) {
    await showMilestoneStatus(initContract, i);
  }

  // Outer loop: role picking
  while (true) {
    console.log("\nChoose a role to act as:");
    console.log("1) Client");
    console.log("2) Freelancer");
    console.log("3) Mediator");
    console.log("4) Exit");

    const roleChoice = readline.question("Select role (1-4): ");
    let role;

    if (roleChoice === "1") role = "client";
    else if (roleChoice === "2") role = "freelancer";
    else if (roleChoice === "3") role = "mediator";
    else if (roleChoice === "4") {
      console.log("\n👋 Exiting the CLI. Goodbye!\n");
      process.exit(0);
    } else {
      console.log("❌ Invalid role choice. Try again.\n");
      continue;
    }

    // Create contract with chosen role
    const signer = await getRoleSigner(role);
    const contract = await connectContract(signer);

    console.log(`\n🔐 You are now acting as: ${role} (${signer.address})`);

    // Inner loop: menu of actions
    while (true) {
      currentMilestone = await contract.currentMilestone();
      const stateIndex = await contract.contractState();
      const stateString = ["Created", "InProgress", "Disputed", "Completed"][stateIndex];

      console.log(`\n[Contract State: ${stateString}, Current Milestone: ${currentMilestone}]`);
      console.log("Milestone statuses:");
      for (let i = 0; i < milestones; i++) {
        await showMilestoneStatus(contract, i);
      }

      console.log("\nActions:");
      console.log("1) Deposit Freelancer Stake");
      console.log("2) Mark Milestone Complete");
      console.log("3) Approve Milestone");
      console.log("4) Dispute Milestone");
      console.log("5) Resolve Dispute (mediator only)");
      console.log("6) Auto-Release Milestone (freelancer only)");
      console.log("7) Withdraw Remaining Stake (freelancer only)");
      console.log("8) Switch Role");
      console.log("9) Exit CLI");

      const action = readline.question("\nChoose an action (1-9): ");
      if (action === "9") {
        console.log("\n👋 Exiting the CLI. Goodbye!\n");
        process.exit(0);
      }
      if (action === "8") {
        console.log("\n🔁 Switching role...\n");
        break; // break out of the action menu, back to role selection
      }

      try {
        switch (action) {
          case "1": {
            // deposit stake
            const stakeAmount = ethers.formatEther(await contract.freelancerStake());
            console.log(`Required Stake: ${stakeAmount} ETH`);
            console.log("Attempting deposit...");
            const tx = await contract.freelancerDepositStake({ value: ethers.parseEther(stakeAmount) });
            await tx.wait();
            console.log("✅ Stake deposited.");
            break;
          }
          case "2": {
            // Mark milestone complete
            const mileIndex = Number(readline.question("Enter milestone index to complete: "));
            const tx = await contract.markMilestoneCompleted(mileIndex);
            await tx.wait();
            console.log(`✅ Milestone #${mileIndex} marked complete.`);
            break;
          }
          case "3": {
            // Approve milestone
            const mileIndex = Number(readline.question("Enter milestone index to approve: "));
            const tx = await contract.approveMilestone(mileIndex);
            await tx.wait();
            console.log(`✅ Milestone #${mileIndex} approved.`);
            break;
          }
          case "4": {
            // Dispute milestone
            const mileIndex = Number(readline.question("Enter milestone index to dispute: "));
            const fee = await contract.mediationFee();
            console.log(`Mediation fee required: ${ethers.formatEther(fee)} ETH`);
            const tx = await contract.disputeMilestone(mileIndex, { value: fee });
            await tx.wait();
            console.log("✅ Dispute submitted.");
            break;
          }
          case "5": {
            // Resolve dispute (mediator only)
            const mileIndex = Number(readline.question("Enter milestone index to resolve: "));
            const winner = readline.question("Who wins? (freelancer/client): ").toLowerCase();
            const decision = winner === "freelancer";
            const tx = await contract.disputeResolution(mileIndex, decision);
            await tx.wait();
            console.log(`✅ Dispute resolved. Winner = ${winner}`);
            break;
          }
          case "6": {
            // Auto-release (freelancer only)
            const mileIndex = Number(readline.question("Enter milestone index to auto-release: "));
            const tx = await contract.autoReleaseIfClientAbsent(mileIndex);
            await tx.wait();
            console.log(`✅ Milestone #${mileIndex} auto-released.`);
            break;
          }
          case "7": {
            // Withdraw stake
            const tx = await contract.withdrawRemainingStake();
            await tx.wait();
            console.log("✅ Stake withdrawn.");
            break;
          }
          default: {
            console.log("❌ Invalid action. Try again.");
            break;
          }
        }
      } catch (err) {
        const reason = err?.reason || err?.error?.reason || err?.message || "Unknown error";
        console.log(`❌ Transaction failed: ${reason}`);
      }
    }
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err.reason || err.message);
  process.exit(1);
});
