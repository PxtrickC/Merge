// Platform fee: 1% from buyer only (OpenSea rejects third-party seller fees)
export const PLATFORM_FEE_BPS = 100 // 100 basis points = 1%

// Seaport 1.6 on Ethereum mainnet
export const SEAPORT_ADDRESS = '0x0000000000000068F116a894984e2DB1123eB395'

// OpenSea conduit (used for NFT approvals)
export const OPENSEA_CONDUIT_KEY = '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000'
export const OPENSEA_CONDUIT_ADDRESS = '0x1E0049783F008A0085193E00003D00cd54003c71'

// Merge collection on OpenSea
export const COLLECTION_SLUG = 'm'

// MergeBuyWrapperV2 — atomic Seaport fulfillment + fee swapped to ASH
export const WRAPPER_ADDRESS = '0xf84109d2D2C314aF28043c0AD03b48225E83eFb9'
export const WRAPPER_ABI = [
  'function buyWithFee(bytes calldata seaportCalldata, address nftContract, uint256 tokenId, uint256 listingValue) external payable',
]
