import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFixtures } from "./fixtures";

describe("MyNFT unit tests", function () {
  it("only admin can mint and set baseURI", async function () {
    const { signers, contracts } = await deployFixtures();
    const { deployer, other } = signers;
    const { MyNFT } = contracts;

    // deployer is admin, can mint to other
    await MyNFT.connect(deployer).mint(other.address);
    expect(await MyNFT.ownerOf(1)).to.equal(other.address);

    // non-admin cannot mint
    await expect(MyNFT.connect(other).mint(other.address)).to.be.revertedWith("only admin can mint");

    // admin can set baseURI
    await MyNFT.connect(deployer).setBaseURI("ipfs://unit/");
    expect(await MyNFT.tokenURI(1)).to.contain("ipfs://unit/");
  });
});
