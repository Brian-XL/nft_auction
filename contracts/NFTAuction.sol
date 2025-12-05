// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

struct Auction {
    address seller;
    uint startPrice;
    uint highestBid;
    address highestBidder;
    address biddingToken;           // 如果为 address(0)，表示 ETH；否则 ERC20
    uint256 startTime;
    uint256 endTime;
    bool settled;
}

contract NFTAuction is Initializable, UUPSUpgradeable {
    address public admin;
    mapping(address => mapping(uint256 => Auction)) public auctions;

    mapping(address => uint) public pendingRefund;
    mapping(address => address) public feeds;

    event AuctionCreated(address _nft, uint _tokenId, address seller);
    event BidPlaced(address _nft, uint _tokenId, address _bidder, uint _bid);
    event AuctionSettled(address _nft, uint _tokenId, address _bidder, uint _price);

    function initialize() public initializer {
        admin = msg.sender;
        feeds[address(0)] = 0x694AA1769357215DE4FAC081bf1f309aDC325306;  //ETH to USD
        feeds[0x835EF3b3D6fB94B98bf0A3F5390668e4B83731c5] = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;  //WBTC to USD
        feeds[0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238] = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E;  //USDC to USD
    }

    function _authorizeUpgrade(address newImplementation) internal override view {
        require(msg.sender == admin, "not authorized");
    }


    // 创建拍卖
    function createAuction(
        address nftAddr,
        uint tokenId,
        uint startPrice,
        address biddingToken,
        uint startTime,
        uint endTime
    ) public payable {
        require(startPrice > 0, "Start price must be greater than 0");
        require(block.timestamp < startTime, "Invalid Start time");
        require(endTime > startTime, "Invalid time range");
        require(auctions[nftAddr][tokenId].seller == address(0) || 
                auctions[nftAddr][tokenId].settled == true, "Auction exists");

        require(IERC721(nftAddr).ownerOf(tokenId) == msg.sender, "Not owner");
        require(IERC721(nftAddr).getApproved(tokenId) == address(this) || IERC721(nftAddr).isApprovedForAll(msg.sender, address(this)), "Need to approve the NTF to me first");

        IERC721(nftAddr).safeTransferFrom(msg.sender, address(this), tokenId);

        Auction memory auction = Auction(
            msg.sender,
            startPrice,
            0,
            address(0),
            biddingToken,
            startTime,
            endTime,
            false
        );
        auctions[nftAddr][tokenId] = auction;

        emit AuctionCreated(nftAddr, tokenId, msg.sender);
    }

    // ETH 出价
    function bidding(address nftAddr, uint tokenId) public payable {
        Auction storage auction = auctions[nftAddr][tokenId];
        
        require(block.timestamp >= auction.startTime && block.timestamp <= auction.endTime, "Auction finished");
        require(auction.biddingToken == address(0), "Token Mismatched");
        require(msg.value > auction.startPrice && msg.value > auction.highestBid, "Your bidding is too low");

        if(auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }
        // 有可能会重入攻击。 解决办法：退款不马上转账，而是存到pendingRefund变量，让用户自己提取
        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;
        emit BidPlaced(nftAddr, tokenId, msg.sender, msg.value);

    }


    // ERC20 出价
    function biddingERC20(address nftAddr, uint tokenId, uint amount) external {
        Auction storage auction = auctions[nftAddr][tokenId];
        uint _hBid = auction.highestBid;
        address _hBidder = auction.highestBidder;
        address _tokenAddr = auction.biddingToken;

        require(block.timestamp >= auction.startTime && block.timestamp <= auction.endTime, "Auction closed");
        require(_tokenAddr != address(0), "Token Mismatched");
        require(amount > auction.startPrice && amount > _hBid, "Insufficient bidding price");

        IERC20 erc20Token = IERC20(_tokenAddr);
        require(erc20Token.balanceOf(msg.sender) >= amount, "No enough Balance");
        require(erc20Token.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");
        
        bool _ok = erc20Token.transferFrom(msg.sender, address(this), amount);
        if (_ok) {
            auction.highestBid = amount;
            auction.highestBidder = msg.sender;
        }
        
        if(_hBidder != address(0)) {
            erc20Token.transfer(_hBidder, _hBid);
        }
        emit BidPlaced(nftAddr, tokenId, msg.sender, amount);
    }

    // 根据卖家创建时规定的token自动判断
    function bid(address nftAddr, uint tokenId, uint amount) external payable {
        Auction storage auction = auctions[nftAddr][tokenId];
        uint _hBid = auction.highestBid;
        address _hBidder = auction.highestBidder;

        require(auction.startTime <= block.timestamp && block.timestamp <= auction.endTime, "Auction ended");
        
        if(auction.biddingToken == address(0)) {
            //ETH
            require(msg.value > auction.startPrice && msg.value > _hBid, "Not enough ETH");
            
            auction.highestBid = msg.value;
            auction.highestBidder = msg.sender;
            
            if(_hBidder != address(0)) {
                pendingRefund[_hBidder] += _hBid;
            }
            emit BidPlaced(nftAddr, tokenId, msg.sender, msg.value);

        } else {
            // ERC20
            IERC20 _token = IERC20(auction.biddingToken);
            require(_token.balanceOf(msg.sender) >= amount 
                    && _token.allowance(msg.sender, address(this)) >= amount, "Not enough ERC20 token");

            _token.transferFrom(msg.sender, address(this), amount);
            auction.highestBid = amount;
            auction.highestBidder = msg.sender;

            if(_hBidder != address(0)) {
                _token.transfer(_hBidder, _hBid);
            }
            emit BidPlaced(nftAddr, tokenId, msg.sender, amount);
        }

    }

    // withdraw ETH
    function refund() external {
        uint amount = pendingRefund[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingRefund[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    // 谁来调用  A:中标用户或卖家自己点击确认   B:链下后端定时扫描   C:Keeper 网络（Chainlink Automation)
    function settleAuction(address nftAddr, uint tokenId) external {
        Auction storage auction = auctions[nftAddr][tokenId];
        
        require(block.timestamp > auction.endTime, "Not ended");
        require(auction.settled == false, "It has already been settled");

        auction.settled = true;     //防止可重入

        // 如果无人出价，退还 NFT 给卖家
        if(auction.highestBid == 0) {
            IERC721(nftAddr).safeTransferFrom(address(this), auction.seller, tokenId);
            return;
        }

        // 1. NFT transfer 给最高出价者
        IERC721(nftAddr).safeTransferFrom(address(this), auction.highestBidder, tokenId);
        // 2. 转给卖家 money
        if(auction.biddingToken == address(0)) {
            payable(auction.seller).transfer(auction.highestBid);
        } else{
            IERC20(auction.biddingToken).transfer(auction.seller, auction.highestBid);
        }

        emit AuctionSettled(nftAddr, tokenId, auction.highestBidder, auction.highestBid);
    }


    // 允许多种token出价，自动换算价值
    function bidWithOracle(address nftAddr, uint tokenId, address erc20, uint amount) external payable {
        Auction storage auction = auctions[nftAddr][tokenId];
        require(auction.startTime <= block.timestamp && block.timestamp <= auction.endTime, "Auction ended");
        
        address _hToken = auction.biddingToken;
        address _hBidder = auction.highestBidder;
        uint _hBid = auction.highestBid;
        uint _hUSDValue = getUSDValue(_hToken, _hBid);

        if(erc20 == address(0)) {
            uint _bidUSDValue = getUSDValue(erc20, msg.value);
            require(_bidUSDValue > _hUSDValue, "bid too low");
            auction.highestBid = msg.value;

        } else {
            uint _bidUSDValue = getUSDValue(erc20, amount);
            require(_bidUSDValue > _hUSDValue, "bid too low");
            IERC20(erc20).transferFrom(msg.sender, address(this), amount);
            auction.highestBid = amount;
        }
        auction.highestBidder = msg.sender;
        auction.biddingToken = erc20;

        // refund
        if(_hToken == address(0)) {
            payable(_hBidder).transfer(_hBid);
        } else {
            IERC20(_hToken).transfer(_hBidder, _hBid);
        }

    }

    function getUSDValue(address _token, uint amount) internal view returns(uint) {
        address dataFeed = feeds[_token];
        require(dataFeed != address(0), "Token not supported");
        AggregatorV3Interface aggregator = AggregatorV3Interface(dataFeed);
        (, int256 answer, , ,) = aggregator.latestRoundData();

        return amount * (uint256(answer) / 10 ** aggregator.decimals());
    }

}
