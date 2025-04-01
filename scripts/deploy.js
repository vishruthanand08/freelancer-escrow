const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deploying contract with:", deployer.address);
  console.log("Deployer balance (ETH):", ethers.formatEther(balance));

  const Escrow = await ethers.getContractFactory("FreelancerEscrow");

  const freelancer = "0x733dADD6FE52C2Db97cF8b8307435aafc277E139";
  const mediator = "0x67aeC5bbfF28B6919B63C0aDeeFcB8a632C6214d";
  const stake = ethers.parseEther("0.00005");
  const milestones = 3;
  const ipfsHash = "QmExampleIpfsHash";
  const projectFee = ethers.parseEther("0.0001");

  const escrow = await Escrow.deploy(
    freelancer,
    mediator,
    stake,
    milestones,
    ipfsHash,
    { value: projectFee }
  );

  await escrow.waitForDeployment();
  console.log("FreelancerEscrow deployed to:", escrow.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
