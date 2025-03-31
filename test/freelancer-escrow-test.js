const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FreelancerEscrow", function () {
  let EscrowFactory, escrow;
  let client, freelancer, mediator, other;
  const projectFee = ethers.parseEther("3");     // Client deposits 3 ETH
  const freelancerStake = ethers.parseEther("1"); // Freelancer must stake 1 ETH
  const numMilestones = 3;
  const ipfsHash = "QmExampleIpfsHash"; // Dummy IPFS hash

  beforeEach(async function () {
    // Get signers
    [client, freelancer, mediator, other] = await ethers.getSigners();

    // Deploy from client address (client is msg.sender)
    EscrowFactory = await ethers.getContractFactory("FreelancerEscrow", client);
    escrow = await EscrowFactory.deploy(
      freelancer.address,
      mediator.address,
      freelancerStake,
      numMilestones,
      ipfsHash,
      { value: projectFee } // Client sends 3 ETH
    );

    // In Ethers v6, replace `.deployed()` with `.waitForDeployment()`
    await escrow.waitForDeployment();
  });

  it("should initialize correctly", async function () {
    expect(await escrow.client()).to.equal(client.address);
    expect(await escrow.freelancer()).to.equal(freelancer.address);
    expect(await escrow.mediator()).to.equal(mediator.address);

    const contractState = await escrow.contractState();
    expect(contractState).to.equal(0); // 0 = Created

    const storedFee = await escrow.projectFee();
    expect(storedFee).to.equal(projectFee);

    const storedHash = await escrow.projectIpfsHash();
    expect(storedHash).to.equal(ipfsHash);
  });

  it("should let freelancer deposit their stake and move to InProgress", async function () {
    // Attempt from someone who isn't freelancer -> should fail
    await expect(
      escrow.connect(client).freelancerDepositStake({ value: freelancerStake })
    ).to.be.revertedWith("Only the freelancer can deposit stake");

    // Proper deposit from freelancer
    await escrow
      .connect(freelancer)
      .freelancerDepositStake({ value: freelancerStake });

    const contractState = await escrow.contractState();
    expect(contractState).to.equal(1); // 1 = InProgress

    // Check total contract balance: projectFee (3 ETH) + stake (1 ETH) = 4 ETH
    const contractBalance = await ethers.provider.getBalance(escrow.target);
    expect(contractBalance).to.equal(ethers.parseEther("4"));
  });

  it("should let freelancer mark milestone completed", async function () {
    // Freelancer stake first
    await escrow
      .connect(freelancer)
      .freelancerDepositStake({ value: freelancerStake });

    // Mark milestone #0 complete
    await escrow.connect(freelancer).markMilestoneCompleted(0);

    const mile0 = await escrow.milestones(0);
    expect(mile0.completed).to.be.true;
    expect(mile0.approved).to.be.false;
    expect(mile0.disputed).to.be.false;
    expect(mile0.timestamp).to.be.gt(0); // Non-zero timestamp
  });

  it("should let client approve milestone and transfer partial payment", async function () {
    // Deposit stake
    await escrow
      .connect(freelancer)
      .freelancerDepositStake({ value: freelancerStake });

    // Freelancer completes milestone #0
    await escrow.connect(freelancer).markMilestoneCompleted(0);

    // Check freelancer balance (before)
    const balanceBefore = await ethers.provider.getBalance(freelancer.address);

    // Client approves milestone #0
    const tx = await escrow.connect(client).approveMilestone(0);
    await tx.wait();

    // Freelancer gets milestonePayment = projectFee (3 ETH) / numMilestones (3) = 1 ETH
    const balanceAfter = await ethers.provider.getBalance(freelancer.address);
    const diff = balanceAfter - balanceBefore;

    // Because of gas usage, just check it's ~1 ETH
    expect(diff).to.be.closeTo(
      ethers.parseEther("1"),
      ethers.parseEther("0.001")
    );

    // currentMilestone should be 1 now
    expect(await escrow.currentMilestone()).to.equal(1);
  });

  it("should allow a dispute and mediator resolution", async function () {
    // Deposit stake
    await escrow
      .connect(freelancer)
      .freelancerDepositStake({ value: freelancerStake });

    // Mark milestone #0 complete
    await escrow.connect(freelancer).markMilestoneCompleted(0);

    // Client disputes #0, paying 0.01 ETH
    await escrow.connect(client).disputeMilestone(0, {
      value: ethers.parseEther("0.01"),
    });

    // State should be Disputed
    expect(await escrow.contractState()).to.equal(2); // 2 = Disputed

    // Mediator resolves => let's say mediator rules in favor of freelancer (decision=true)
    const balanceBefore = await ethers.provider.getBalance(escrow.target);
    await escrow.connect(mediator).disputeResolution(0, true);

    // Check how much left in contract
    const balanceAfter = await ethers.provider.getBalance(escrow.target);
    const diff = balanceBefore - balanceAfter;

    // Payment to freelancer (1 ETH) + mediator fee (0.01 ETH) => 1.01 ETH
    expect(diff).to.be.closeTo(
      ethers.parseEther("1.01"),
      ethers.parseEther("0.001")
    );

    // Reverts to InProgress if not done
    expect(await escrow.contractState()).to.equal(1); // InProgress
    expect(await escrow.currentMilestone()).to.equal(1);
  });

  it("should auto-release funds if client is absent after 3 days", async function () {
    // Deposit stake
    await escrow
      .connect(freelancer)
      .freelancerDepositStake({ value: freelancerStake });

    // Mark #0 complete
    await escrow.connect(freelancer).markMilestoneCompleted(0);

    // Try auto-release immediately => should fail
    await expect(
      escrow.connect(freelancer).autoReleaseIfClientAbsent(0)
    ).to.be.revertedWith("Grace period not reached");

    // Simulate 3 days
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    // Auto-release => should succeed
    await escrow.connect(freelancer).autoReleaseIfClientAbsent(0);

    // Next milestone => #1
    expect(await escrow.currentMilestone()).to.equal(1);
  });

  it("should let freelancer withdraw stake after all milestones are completed", async function () {
    // Deposit stake
    await escrow
      .connect(freelancer)
      .freelancerDepositStake({ value: freelancerStake });

    // Complete all milestones
    for (let i = 0; i < numMilestones; i++) {
      await escrow.connect(freelancer).markMilestoneCompleted(i);
      await escrow.connect(client).approveMilestone(i);
    }

    // Should be Completed
    expect(await escrow.contractState()).to.equal(3); // 3 = Completed

    // Withdraw
    const balanceBefore = await ethers.provider.getBalance(freelancer.address);
    await escrow.connect(freelancer).withdrawRemainingStake();
    const balanceAfter = await ethers.provider.getBalance(freelancer.address);

    const diff = balanceAfter - balanceBefore;
    expect(Number(diff)).to.be.closeTo(
        Number(ethers.parseEther("1")),
        Number(ethers.parseEther("0.001"))
        );
  });
});
