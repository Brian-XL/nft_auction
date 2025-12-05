import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NFT Auction - unit and integration tests", function () {
  it("should mint NFT and serve tokenURI", async function () {
    const [deployer, seller] = await ethers.getSigners();
    const MyNFT = await ethers.deployContract("MyNFT");
    await MyNFT.waitForDeployment();

    // deployer is admin and can mint
    await MyNFT.connect(deployer).mint(seller.address);
    expect(await MyNFT.ownerOf(1)).to.equal(seller.address);

    // tokenURI contains default base
    const uri = await MyNFT.tokenURI(1);
    expect(uri).to.contain("ipfs://dirCID/");

    // admin can change baseURI
    await MyNFT.connect(deployer).setBaseURI("ipfs://new/");
    expect(await MyNFT.tokenURI(1)).to.contain("ipfs://new/");
  });

  it("should create ETH auction, accept bids, refund and settle", async function () {
    const [deployer, seller, bidder1, bidder2] = await ethers.getSigners();

    const MyNFT = await ethers.deployContract("MyNFT");
    await MyNFT.waitForDeployment();
    await MyNFT.connect(deployer).mint(seller.address);

    const NFTAuction = await ethers.deployContract("NFTAuction");
    await NFTAuction.waitForDeployment();
    await NFTAuction.connect(deployer).initialize();

    // seller approve auction
    await MyNFT.connect(seller).approve(await NFTAuction.getAddress(), 1);

    const now = await time.latest();
    const start = now + 5;
    const end = now + 60;

    // create auction
    await NFTAuction.connect(seller).createAuction(
      await MyNFT.getAddress(),
      1,
      ethers.parseEther("0.1"),
      ethers.ZeroAddress,
      start,
      end
    );

    // move to start
    await time.increaseTo(start + 1);

    // first bid by bidder1
    await NFTAuction.connect(bidder1).bid(await MyNFT.getAddress(), 1, 0, { value: ethers.parseEther("0.2") });
    let auct = await NFTAuction.auctions(await MyNFT.getAddress(), 1);
    expect(auct.highestBid).to.equal(ethers.parseEther("0.2"));
    expect(auct.highestBidder).to.equal(bidder1.address);

    // second bid by bidder2
    await NFTAuction.connect(bidder2).bid(await MyNFT.getAddress(), 1, 0, { value: ethers.parseEther("0.3") });
    auct = await NFTAuction.auctions(await MyNFT.getAddress(), 1);
    expect(auct.highestBid).to.equal(ethers.parseEther("0.3"));
    expect(auct.highestBidder).to.equal(bidder2.address);

    // previous bidder (bidder1) should have refund available
    const pending1 = await NFTAuction.pendingRefund(bidder1.address);
    expect(pending1).to.equal(ethers.parseEther("0.2"));

    // bidder1 withdraw refund
    const beforeBal = await ethers.provider.getBalance(bidder1.address);
    const tx = await NFTAuction.connect(bidder1).refund();
    await tx.wait();
    const afterBal = await ethers.provider.getBalance(bidder1.address);
    expect(afterBal).to.be.gt(beforeBal);

    // move to end and settle
    await time.increaseTo(end + 2);
    await NFTAuction.connect(deployer).settleAuction(await MyNFT.getAddress(), 1);

    // NFT should be owned by bidder2
    expect(await MyNFT.ownerOf(1)).to.equal(bidder2.address);
  });

  it("should support ERC20 bidding and bidWithOracle flows", async function () {
    const [deployer, seller, bidder1, bidder2] = await ethers.getSigners();

    const MyNFT = await ethers.deployContract("MyNFT");
    await MyNFT.waitForDeployment();
    await MyNFT.connect(deployer).mint(seller.address);

    const MockERC20 = await ethers.deployContract("MockERC20", ["TKN", "TKN"]);
    await MockERC20.waitForDeployment();
    await MockERC20.connect(deployer).mint(bidder1.address, ethers.parseUnits("1000", 18));
    await MockERC20.connect(deployer).mint(bidder2.address, ethers.parseUnits("1000", 18));

    const auction = await ethers.deployContract("NFTAuction");
    await auction.waitForDeployment();
    await auction.connect(deployer).initialize();

    // deploy mocks for price feeds
    const ethFeed = await ethers.deployContract("MockV3Aggregator", [8, 3000n * 10n ** 8n]);
    await ethFeed.waitForDeployment();
    const tknFeed = await ethers.deployContract("MockV3Aggregator", [8, 10n * 10n ** 8n]);
    await tknFeed.waitForDeployment();

    // set price feeds on auction contract (admin)
    await auction.connect(deployer).setFeed(ethers.ZeroAddress, await ethFeed.getAddress());
    await auction.connect(deployer).setFeed(await MockERC20.getAddress(), await tknFeed.getAddress());

    // seller approves auction to transfer NFT
    await MyNFT.connect(seller).approve(await auction.getAddress(), 1);

    const now = await time.latest();
    const start = now + 3;
    const end = now + 50;

    // create auction for ERC20 token (startPrice before biddingToken)
    await auction.connect(seller).createAuction(
      await MyNFT.getAddress(),
      1,
      ethers.parseEther("1"),
      await MockERC20.getAddress(),
      start,
      end
    );

    await time.increaseTo(start + 1);

    // bidder1 approve and bid
    await MockERC20.connect(bidder1).approve(await auction.getAddress(), ethers.parseUnits("10", 18));
    await auction.connect(bidder1).biddingERC20(await MyNFT.getAddress(), 1, ethers.parseUnits("5", 18));

    let a = await auction.auctions(await MyNFT.getAddress(), 1);
    expect(a.highestBidder).to.equal(bidder1.address);

    // bidder2 uses bidWithOracle with ETH to outbid based on USD value
    // current tkn price 10 => 5 * 10 = 50 USD. ETH price 3000, so 0.02 ETH ~ 60 USD
    await auction.connect(bidder2).bidWithOracle(await MyNFT.getAddress(), 1, ethers.ZeroAddress, 0, { value: ethers.parseEther("0.02") });

    a = await auction.auctions(await MyNFT.getAddress(), 1);
    expect(a.highestBidder).to.equal(bidder2.address);
    expect(a.biddingToken).to.equal(ethers.ZeroAddress);

    // move to end and settle
    await time.increaseTo(end + 2);
    await auction.connect(deployer).settleAuction(await MyNFT.getAddress(), 1);

    expect(await MyNFT.ownerOf(1)).to.equal(bidder2.address);
  });
});
