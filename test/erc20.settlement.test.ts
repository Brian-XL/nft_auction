import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFixtures } from "./fixtures";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ERC20 settlement tests", function () {
  it("settleAuction transfers ERC20 to seller", async function () {
    const { signers, contracts } = await deployFixtures();
    const { deployer, seller, bidder1 } = signers;
    const { MyNFT, NFTAuction, MockERC20 } = contracts;

    // mint nft and token
    await MyNFT.connect(deployer).mint(seller.address);
    await MockERC20.connect(deployer).mint(bidder1.address, ethers.parseUnits("100", 18));

    // create and initialize fresh auction for clarity
    await MyNFT.connect(seller).approve(await NFTAuction.getAddress(), 1);
    const now = await time.latest();
    const start = now + 2;
    const end = now + 60;
    await NFTAuction.connect(seller).createAuction(await MyNFT.getAddress(), 1, ethers.parseUnits("1", 18), await MockERC20.getAddress(), start, end);

    await MockERC20.connect(bidder1).approve(await NFTAuction.getAddress(), ethers.parseUnits("5", 18));
    await time.increaseTo(start + 1);

    // bidder1 bids with ERC20
    await NFTAuction.connect(bidder1).biddingERC20(await MyNFT.getAddress(), 1, ethers.parseUnits("5", 18));

    // move to end and settle
    await time.increaseTo(end + 2);
    const sellerBefore = await MockERC20.balanceOf(seller.address);
    await NFTAuction.connect(deployer).settleAuction(await MyNFT.getAddress(), 1);
    const sellerAfter = await MockERC20.balanceOf(seller.address);
    expect(sellerAfter).to.equal(sellerBefore + ethers.parseUnits("5", 18));
  });
});
