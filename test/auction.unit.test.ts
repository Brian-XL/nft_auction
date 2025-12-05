import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFixtures } from "./fixtures";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Auction unit tests", function () {
  it("createAuction reverts when not owner or not approved", async function () {
    const { signers, contracts } = await deployFixtures();
    const { deployer, seller, other } = signers;
    const { MyNFT, NFTAuction } = contracts;

    // mint to seller
    await MyNFT.connect(deployer).mint(seller.address);

    const now = await time.latest();
    const start = now + 5;
    const end = now + 60;

    // attempt createAuction by non-owner
    await expect(
      NFTAuction.connect(other).createAuction(await MyNFT.getAddress(), 1, ethers.parseEther("0.1"), ethers.ZeroAddress, start, end)
    ).to.be.revertedWith("Not owner");

    // owner but not approved
    await expect(
      NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseEther("0.1"), ethers.ZeroAddress, start, end)
    ).to.be.revertedWith("Need to approve the NTF to me first");

    // approve and success
    await MyNFT.connect(seller).approve(await NFTAuction.getAddress(), 1);
    await NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseEther("0.1"), ethers.ZeroAddress, start, end);

    // settle when no bids should return NFT to seller
    await time.increaseTo(end + 2);
    await NFTAuction.connect(deployer).settleAuction(await MyNFT.getAddress(), 1);
    expect(await MyNFT.ownerOf(1)).to.equal(seller.address);
  });
});
