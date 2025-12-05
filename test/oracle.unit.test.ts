import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFixtures } from "./fixtures";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Oracle and feed tests", function () {
  it("setFeed only admin and bidWithOracle requires supported token feed", async function () {
    const { signers, contracts } = await deployFixtures();
    const { deployer, seller, bidder1 } = signers;
    const { MyNFT, NFTAuction, MockERC20, MockV3Aggregator } = contracts;

    // deployer (admin) sets feed for zero address
    await NFTAuction.connect(deployer).setFeed(ethers.ZeroAddress, await MockV3Aggregator.getAddress());

    // non-admin cannot set feed
    await expect(NFTAuction.connect(bidder1).setFeed(await MockERC20.getAddress(), await MockV3Aggregator.getAddress())).to.be.revertedWith("not authorized");

    // create auction with ERC20 bidding token
    await MyNFT.connect(deployer).mint(seller.address);
    await MyNFT.connect(seller).approve(await NFTAuction.getAddress(), 1);

    const now = await time.latest();
    const start = now + 5;
    const end = now + 50;

    await NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseEther("1"), await MockERC20.getAddress(), start, end);
    await time.increaseTo(start + 1);

    // some random token without feed used in bidWithOracle should revert when calculating USD
    await expect(
      NFTAuction.connect(bidder1).bidWithOracle(await MyNFT.getAddress(), 1, ethers.ZeroAddress, 0, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("Token not supported");
  });
});
