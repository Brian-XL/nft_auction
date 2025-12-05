const hre = require("hardhat");

async function main() {
    const dataFeed = await hre.ethers.getContractFactory("DataFeed");
    const contract = await dataFeed.deploy();
    await contract.waitForDeployment();

    console.log("contract deployed at: ", await contract.getAddress());
    console.log("eth to usd:");
    console.log(await contract.getPrice());
}

main().catch((err)=>{
    console.log(err);
    process.exit(1);
})