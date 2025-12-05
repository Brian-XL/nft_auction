// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MyNFT is ERC721{
    event Mint(address indexed to, uint tokenId);

    address public admin;
    uint private _nextTokenId;
    string public baseURI;

    struct NFT {
        address owner;
        uint tokenId;
    }

    constructor() ERC721("MyNFT", "MNFT"){
        admin = msg.sender;
        _nextTokenId = 1;
        baseURI = "ipfs://dirCID/";
    }

    modifier OnlyOwner {
        require(msg.sender == admin, "only admin can mint");
        _;
    }

    function mint(address to) external OnlyOwner {
        _safeMint(to, _nextTokenId);
        unchecked {
            _nextTokenId++;
        }
    }

    function setBaseURI(string memory URI) public OnlyOwner{
        baseURI = URI;
    }
    
    // get metadata ipfs uri
    function tokenURI(uint tokenId) public view override returns(string memory) {
        require(_ownerOf(tokenId) != address(0), "token not exists");
        return string(abi.encodePacked(baseURI, tokenId, ".json"));
    }
}