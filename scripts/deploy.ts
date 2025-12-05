const { ethers, upgrades } = require("hardhat");

async function main() {
    const AuctionFactory = await ethers.getContractFactory("NFTAuction");
    const auction = await upgrades.deployProxy(AuctionFactory, [], {
        initializer: "initialize",
        kind: "uups"
    });
    await auction.waitForDeployment();

    console.log("Proxy deployed: ", auction.getAddress());

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});