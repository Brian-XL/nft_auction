import { ethers } from "hardhat";

export async function deployFixtures() {
  const [deployer, seller, bidder1, bidder2, other] = await ethers.getSigners();

  const MyNFT = await ethers.deployContract("MyNFT");
  await MyNFT.waitForDeployment();

  const NFTAuction = await ethers.deployContract("NFTAuction");
  await NFTAuction.waitForDeployment();
  await NFTAuction.connect(deployer).initialize();

  const MockERC20 = await ethers.deployContract("MockERC20", ["TKN", "TKN"]);
  await MockERC20.waitForDeployment();

  const MockV3Aggregator = await ethers.deployContract("MockV3Aggregator", [8, 3000n * 10n ** 8n]);
  await MockV3Aggregator.waitForDeployment();

  return {
    signers: { deployer, seller, bidder1, bidder2, other },
    contracts: { MyNFT, NFTAuction, MockERC20, MockV3Aggregator },
  };
}
