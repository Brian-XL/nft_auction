import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFixtures } from "./fixtures";

describe("Upgradeability helper tests", function () {
  it("testAuthorizeUpgrade reverts for non-admin and passes for admin", async function () {
    const { signers, contracts } = await deployFixtures();
    const { deployer, other } = signers;
    const { NFTAuction } = contracts;

    // non-admin should revert
    await expect(NFTAuction.connect(other).testAuthorizeUpgrade(deployer.address)).to.be.revertedWith("not authorized");

    // admin (deployer) should succeed (no revert)
    await NFTAuction.connect(deployer).testAuthorizeUpgrade(deployer.address);
  });
});
