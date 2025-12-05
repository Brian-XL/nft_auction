import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFixtures } from "./fixtures";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NFTAuction extra coverage tests", function () {
  it("createAuction reverts on invalid parameters and auction exists", async function () {
    const { signers, contracts } = await deployFixtures();
    const { deployer, seller } = signers;
    const { MyNFT, NFTAuction } = contracts;

    // mint to seller
    await MyNFT.connect(deployer).mint(seller.address);

    const now = await time.latest();

    // startPrice zero
    await expect(
      NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, 0, ethers.ZeroAddress, now + 10, now + 20)
    ).to.be.revertedWith("Start price must be greater than 0");

    // startTime in past
    await expect(
      NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseEther("0.1"), ethers.ZeroAddress, now - 10, now + 100)
    ).to.be.revertedWith("Invalid Start time");

    // endTime <= startTime
    await expect(
      NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseEther("0.1"), ethers.ZeroAddress, now + 10, now + 5)
    ).to.be.revertedWith("Invalid time range");

    // proper approval and create
    await MyNFT.connect(seller).approve(await NFTAuction.getAddress(), 1);
    await NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseEther("0.1"), ethers.ZeroAddress, now + 20, now + 60);

    // try to create again before settled -> Auction exists
    await expect(
      NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseEther("0.1"), ethers.ZeroAddress, now + 100, now + 200)
    ).to.be.revertedWith("Auction exists");
  });

  it("bid() uses pendingRefund and refund flow", async function () {
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

    // bidder1 bids via bid() (ETH)
    await NFTAuction.connect(bidder1).bid(await MyNFT.getAddress(), 1, 0, { value: ethers.parseEther("0.2") });

    // bidder2 outbids using bid() -> bidder1 should have pendingRefund
    await NFTAuction.connect(bidder2).bid(await MyNFT.getAddress(), 1, 0, { value: ethers.parseEther("0.3") });

    const pending = await NFTAuction.pendingRefund(bidder1.address);
    expect(pending).to.equal(ethers.parseEther("0.2"));

    // refund withdraws funds
    const before = await ethers.provider.getBalance(bidder1.address);
    await NFTAuction.connect(bidder1).refund();
    const after = await ethers.provider.getBalance(bidder1.address);
    expect(after).to.be.gt(before);
  });

  it("biddingERC20 handles transferFrom failure (ok == false)", async function () {
    const { signers } = await deployFixtures();
    const { deployer, seller, bidder1 } = signers;

    // deploy a broken ERC20 that returns false on transferFrom
    const Bad = await ethers.deployContract("MockERC20Bad", ["BAD", "BAD"]);
    await Bad.waitForDeployment();
    await Bad.connect(deployer).mint(bidder1.address, ethers.parseUnits("100", 18));

    // deploy fresh NFT and auction for this test
    const MyNFT = await ethers.deployContract("MyNFT");
    await MyNFT.waitForDeployment();
    await MyNFT.connect(deployer).mint(seller.address);

    const Auction = await ethers.deployContract("NFTAuction");
    await Auction.waitForDeployment();
    await Auction.connect(deployer).initialize();

    await MyNFT.connect(seller).approve(await Auction.getAddress(), 1);
    const now = await time.latest();
    const start = now + 2;
    const end = now + 60;
    await Auction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseUnits("1", 18), await Bad.getAddress(), start, end);
    await time.increaseTo(start + 1);

    // approve (even though transferFrom will return false)
    await Bad.connect(bidder1).approve(await Auction.getAddress(), ethers.parseUnits("10", 18));

    // make a biddingERC20 attempt; because transferFrom returns false, highestBid should remain 0
    await Auction.connect(bidder1).biddingERC20(await MyNFT.getAddress(), 1, ethers.parseUnits("5", 18));
    const a = await Auction.auctions(await MyNFT.getAddress(), 1);
    expect(a.highestBid).to.equal(0);
  });
});
