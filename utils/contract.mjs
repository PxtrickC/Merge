export const MERGE_CONTRACT_ADDRESS = "0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab"
export const NIFTY_OMNIBUS_ADDRESS = "0xe052113bd7d7700d623414a0a4585bcae754e9d5"

export const MERGE_ABI = [
  "function totalSupply() view returns (uint256)",
  "function massOf(uint256 tokenId) view returns (uint256)",
  "function getValueOf(uint256 tokenId) view returns (uint256)",
  "function decodeClassAndMass(uint256 value) view returns (uint256, uint256)",
  "function getMergeCount(uint256 tokenId) view returns (uint256)",
  "function exists(uint256 tokenId) view returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event MassUpdate(uint256 indexed tokenIdBurned, uint256 indexed tokenIdPersist, uint256 mass)",
]

// The contract encodes value = class * 10^8 + mass
// class (1-4) directly maps to tier in the frontend:
//   class 1 / tier 1 → black bg, white circle (most common)
//   class 2 / tier 2 → black bg, yellow circle
//   class 3 / tier 3 → blue bg, white circle
//   class 4 / tier 4 → red bg, white circle (rarest)
//   alpha (mass >= alpha_mass) → white bg, black circle

const CLASS_DIVISOR = 100_000_000

export function decodeValue(rawValue) {
  const v = Number(rawValue)
  return {
    class: Math.floor(v / CLASS_DIVISOR),
    mass: v % CLASS_DIVISOR,
  }
}
