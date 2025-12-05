import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "solidity-coverage";

const config: HardhatUserConfig = {
  solidity: "0.8.22",
};

export default config;