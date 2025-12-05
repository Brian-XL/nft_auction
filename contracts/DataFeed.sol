// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract DataFeed {
    AggregatorV3Interface dataFeed;

    constructor() {
        dataFeed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);  // ETH/USD (Sepolia)
    }

    function getPrice() external view returns(int price){
        (, int256 answer,,,) = dataFeed.latestRoundData();
        price = answer; // 示例：ETH/USD = 3000_00000000   (8 decimals)
    }
}