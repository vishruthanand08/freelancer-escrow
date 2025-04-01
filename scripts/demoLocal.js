const hre = require("hardhat");
const readline = require("readline-sync");

/**
 * Helper to pause & prompt
 */
async function waitForKeypress(description) {
  console.log(`\n👉 ${description}`);
  readline.question("Press Enter to continue...\n");
}

async function main() {
  console.log("\n🎬 **Local Demo**: Showcasing All Flows in a Pure Simulation\n");

  // 1. Spin up local signers (client, freelancer, mediator)
  const signers = await hre.ethers.getSigners();
  const client = signers[0];
  const freelancer = signers[1];
  const mediator = signers[2];

  console.log("👤 Client:", client.address);
  console.log("🧑‍💻 Freelancer:", freelancer.address);
  console.log("🧑‍⚖️ Mediator:", mediator.address);

  // 2. Deploy a fresh contract with 4 milestones
  await waitForKeypress("Deploying the FreelancerEscrow contract with 4 milestones...");
  const EscrowFactory = await hre.ethers.getContractFactory("FreelancerEscrow", client);
  const stake = hre.ethers.parseEther("0.00005");
  const numMilestones = 4;
  const ipfsHash = "QmLocalSimulation";
  const projectFee = hre.ethers.parseEther("0.0002"); // total cost
  const escrow = await EscrowFactory.deploy(
    freelancer.address,
    mediator.address,
    stake,
    numMilestones,
    ipfsHash,
    { value: projectFee } // client paying the project fee
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("✅ Contract deployed at:", escrowAddress);

  // 3. Freelancer deposits stake
  await waitForKeypress("Step: Freelancer deposits stake into the contract.");
  await escrow.connect(freelancer).freelancerDepositStake({ value: stake });
  console.log("✅ Freelancer staked, contract in InProgress state.");

  // --- MILESTONE 0: Normal flow
  await waitForKeypress("Milestone 0 → Completed by freelancer, then approved by client.");
  await escrow.connect(freelancer).markMilestoneCompleted(0);
  console.log("✅ Milestone 0 completed.");
  await escrow.connect(client).approveMilestone(0);
  console.log("✅ Milestone 0 approved, payment released.");

  // --- MILESTONE 1: Dispute flow
  await waitForKeypress("Milestone 1 → We'll do a dispute & mediator resolution.");
  await escrow.connect(freelancer).markMilestoneCompleted(1);
  console.log("✅ Milestone 1 completed by freelancer.");

  // Dispute from client
  const mediationFee = await escrow.mediationFee();
  await escrow.connect(client).disputeMilestone(1, { value: mediationFee });
  console.log("⚔️ Client disputes milestone 1.");

  // Mediator resolves in favor of freelancer
  await escrow.connect(mediator).disputeResolution(1, true); // true => freelancer wins
  console.log("✅ Mediator resolved dispute for freelancer.");

  // --- MILESTONE 2: Auto-release
  await waitForKeypress("Milestone 2 → autoReleaseIfClientAbsent after 3 days.");

  await escrow.connect(freelancer).markMilestoneCompleted(2);
  console.log("✅ Milestone 2 completed by freelancer.");

  // Fast forward time
  await hre.network.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
  await hre.network.provider.send("evm_mine");

  await escrow.connect(freelancer).autoReleaseIfClientAbsent(2);
  console.log("✅ Milestone 2 auto-released.");

  // --- MILESTONE 3: Normal again
  await waitForKeypress("Milestone 3 → normal flow again.");

  await escrow.connect(freelancer).markMilestoneCompleted(3);
  console.log("✅ Milestone 3 completed.");

  await escrow.connect(client).approveMilestone(3);
  console.log("✅ Milestone 3 approved, final payments done.");

  // --- Final withdraw
  await waitForKeypress("Final step: freelancer withdraws stake + leftover funds.");
  await escrow.connect(freelancer).withdrawRemainingStake();
  console.log("💼 Freelancer withdrew remaining stake. All flows done!");

  console.log("\n** Full simulation on local Hardhat network complete! **\n");
}

main().catch((err) => {
  console.error("❌ Script error:", err.reason || err.message || err);
  process.exit(1);
});
