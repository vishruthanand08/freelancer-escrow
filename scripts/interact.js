const { ethers } = require("hardhat");
const readline = require("readline-sync");
require("dotenv").config();

const CONTRACT_ADDRESS = "0xd4D19B6C4ba8D6c4068F42a7F2b883b4Fc91558c"; // ✅ Replace if needed
const ABI = require("../artifacts/contracts/FreelancerEscrow.sol/FreelancerEscrow.json").abi;

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

  const privateKeys = {
    client: process.env.CLIENT_PRIVATE_KEY,
    freelancer: process.env.FREELANCER_PRIVATE_KEY,
    mediator: process.env.MEDIATOR_PRIVATE_KEY,
  };

  while (true) {
    console.log("\n🎭 Choose your role:");
    console.log("1. 👤 Client");
    console.log("2. 🧑‍💻 Freelancer");
    console.log("3. 🧑‍⚖️ Mediator");
    const roleChoice = readline.question("Enter choice (1-3): ");

    let role;
    if (roleChoice === "1") role = "client";
    else if (roleChoice === "2") role = "freelancer";
    else if (roleChoice === "3") role = "mediator";
    else {
      console.log("❌ Invalid role.");
      continue;
    }

    const signer = new ethers.Wallet(privateKeys[role], provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    console.log(`🔐 Connected as ${role} (${signer.address})`);

    while (true) {
      console.log("\nOptions:");
      console.log("1. 💰 Deposit Freelancer Stake");
      console.log("2. ✅ Mark Milestone Complete");
      console.log("3. 📝 Approve Milestone");
      console.log("4. ⚔️ Dispute Milestone");
      console.log("5. ⚖️ Resolve Dispute");
      console.log("6. ⏳ Auto-Release Milestone");
      console.log("7. 💼 Withdraw Remaining Stake");
      console.log("8. 🔁 Switch Role");
      console.log("9. 🚪 Exit");

      const choice = readline.question("Choose an action (1-9): ");

      try {
        if (choice === "1") {
          const value = readline.question("Enter stake amount in ETH: ");
          await contract.freelancerDepositStake({ value: ethers.parseEther(value) });
          console.log("✅ Stake deposited.");
        } else if (choice === "2") {
          const idx = readline.question("Milestone index to mark complete: ");
          await contract.markMilestoneCompleted(Number(idx));
          console.log("✅ Milestone marked complete.");
        } else if (choice === "3") {
          const idx = readline.question("Milestone index to approve: ");
          await contract.approveMilestone(Number(idx));
          console.log("✅ Milestone approved.");
        } else if (choice === "4") {
          const idx = readline.question("Milestone index to dispute: ");
          const fee = await contract.mediationFee();
          await contract.disputeMilestone(Number(idx), { value: fee });
          console.log("✅ Dispute submitted.");
        } else if (choice === "5") {
          const idx = readline.question("Milestone index to resolve: ");
          const winner = readline.question("Who wins? (freelancer/client): ");
          const decision = winner.toLowerCase() === "freelancer";
          await contract.disputeResolution(Number(idx), decision);
          console.log("✅ Dispute resolved.");
        } else if (choice === "6") {
          const idx = readline.question("Milestone index to auto-release: ");
          await contract.autoReleaseIfClientAbsent(Number(idx));
          console.log("✅ Milestone auto-released.");
        } else if (choice === "7") {
          await contract.withdrawRemainingStake();
          console.log("✅ Stake withdrawn.");
        } else if (choice === "8") {
          break; // 🔁 Back to role selection
        } else if (choice === "9") {
          console.log("👋 Exiting.");
          process.exit(0);
        } else {
          console.log("❌ Invalid option.");
        }
      } catch (err) {
        const reason = err?.error?.reason || err?.reason || err?.message || "Unknown error";
        console.log("❌ Error:", reason);
      }
    }
  }
}

main();
