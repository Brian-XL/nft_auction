const { ethers, upgrades, run } = require("hardhat");

async function main() {
    const AuctionFactory = await ethers.getContractFactory("NFTAuction");
    const auction = await upgrades.deployProxy(AuctionFactory, [], {
        initializer: "initialize",
        kind: "uups",
    });
    await auction.waitForDeployment();

    const proxyAddress = await auction.getAddress();
    console.log("Proxy deployed:", proxyAddress);

    // try to get implementation address (ERC1967) and verify if ETHERSCAN_API_KEY provided
    try {
        const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        console.log("Implementation address:", implAddress);

        if (process.env.ETHERSCAN_API_KEY) {
            console.log("Verifying implementation on Etherscan...");
            try {
                await run("verify:verify", { address: implAddress });
                console.log("Verification submitted.");
            } catch (vErr) {
                console.warn("Verification failed:", (vErr as any).message || vErr);
            }
        }
    } catch (err) {
        console.warn("Could not read implementation address:", (err as any).message || err);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});