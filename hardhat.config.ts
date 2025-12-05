import { HardhatUserConfig } from "hardhat/config";
require('dotenv').config();
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-verify";

const { SEPOLIA_RPC_URL, PRIVATE_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: "0.8.22",
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL ?? "",
      accounts: PRIVATE_KEY?[PRIVATE_KEY]:[]
    },
  },
};

export default config;