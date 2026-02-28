// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract MergeBuyWrapper {
    address public immutable seaport;
    address payable public immutable feeRecipient;
    uint256 public immutable feeBps;
    address public owner;

    constructor(address _seaport, address payable _feeRecipient, uint256 _feeBps) {
        seaport = _seaport;
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
        owner = msg.sender;
    }

    /// @notice Buy an NFT via Seaport and collect a platform fee atomically.
    /// @param seaportCalldata Full Seaport fulfillBasicOrder calldata (with selector)
    /// @param nftContract The NFT contract address
    /// @param tokenId The token ID being purchased
    /// @param listingValue Exact ETH amount required by Seaport (remainder is fee)
    function buyWithFee(
        bytes calldata seaportCalldata,
        address nftContract,
        uint256 tokenId,
        uint256 listingValue
    ) external payable {
        // Verify minimum fee is included
        uint256 minFee = listingValue * feeBps / 10000;
        require(msg.value >= listingValue + minFee, "Insufficient payment");
        uint256 fee = msg.value - listingValue;

        // 1. Call Seaport with exact listing value (NFT goes to address(this))
        (bool success,) = seaport.call{value: listingValue}(seaportCalldata);
        require(success, "Seaport failed");

        // 2. Transfer NFT to buyer
        IERC721(nftContract).transferFrom(address(this), msg.sender, tokenId);

        // 3. Send fee to recipient
        (bool feeSent,) = feeRecipient.call{value: fee}("");
        require(feeSent, "Fee failed");
    }

    // Accept ERC721 via safeTransferFrom
    function onERC721Received(address, address, uint256, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    // Rescue stuck ERC721 tokens (owner only)
    function rescueToken(address nftContract, address to, uint256 tokenId) external {
        require(msg.sender == owner, "Not owner");
        IERC721(nftContract).transferFrom(address(this), to, tokenId);
    }

    // Emergency withdraw ETH (owner only)
    function withdraw() external {
        require(msg.sender == owner, "Not owner");
        (bool s,) = owner.call{value: address(this).balance}("");
        require(s);
    }

    receive() external payable {}
}
