import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFixtures } from "./fixtures";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Immediate bidding (bidding) tests", function () {
  it("bidding() refunds previous bidder immediately via transfer", async function () {
    const { signers, contracts } = await deployFixtures();
    const { deployer, seller, bidder1, bidder2 } = signers;
    const { MyNFT, NFTAuction } = contracts;

    await MyNFT.connect(deployer).mint(seller.address);
    await MyNFT.connect(seller).approve(await NFTAuction.getAddress(), 1);

    const now = await time.latest();
    const start = now + 3;
    const end = now + 60;
    await NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseEther("0.1"), ethers.ZeroAddress, start, end);

    await time.increaseTo(start + 1);

    // bidder1 initial bidding via bidding()
    await NFTAuction.connect(bidder1).bidding(await MyNFT.getAddress(), 1, { value: ethers.parseEther("0.2") });

    // record bidder1 balance before being refunded
    const before = await ethers.provider.getBalance(bidder1.address);

    // bidder2 outbids -> bidding() should transfer back to bidder1 immediately
    await NFTAuction.connect(bidder2).bidding(await MyNFT.getAddress(), 1, { value: ethers.parseEther("0.3") });

    const after = await ethers.provider.getBalance(bidder1.address);
    expect(after).to.be.gt(before);
  });
});
