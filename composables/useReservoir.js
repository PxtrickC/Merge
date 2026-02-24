import { getClient } from "@reservoir0x/reservoir-sdk"
import { adaptEthersV6Signer } from "~/utils/reservoirWalletAdapter.js"
import { MERGE_CONTRACT_ADDRESS } from "~/utils/contract.mjs"

const RESERVOIR_API_BASE = "https://api.reservoir.tools"

// 60-second in-memory cache to avoid rate limit hits
const _marketCache = new Map()
const CACHE_TTL = 60 * 1000

export function useReservoir() {
  const config = useRuntimeConfig()
  const { getSigner, isConnected, isMainnet, address } = useWallet()

  const apiHeaders = computed(() => {
    const h = { "Content-Type": "application/json" }
    if (config.public.RESERVOIR_API_KEY) h["x-api-key"] = config.public.RESERVOIR_API_KEY
    return h
  })

  // ─── Query market data (floor ask + top bid) ─────────────────────────────
  async function fetchTokenMarket(tokenId) {
    const cacheKey = String(tokenId)
    const cached = _marketCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

    const url = new URL(`${RESERVOIR_API_BASE}/tokens/v7`)
    url.searchParams.set("tokens", `${MERGE_CONTRACT_ADDRESS}:${tokenId}`)
    url.searchParams.set("includeAttributes", "false")
    url.searchParams.set("includeTopBid", "true")

    const res = await fetch(url.toString(), { headers: apiHeaders.value })
    if (!res.ok) throw new Error(`Reservoir API error: ${res.status}`)

    const json = await res.json()
    if (!json.tokens || json.tokens.length === 0) return null

    const t = json.tokens[0]
    const data = {
      floorAsk: t.market?.floorAsk?.price?.amount?.native
        ? {
            price: t.market.floorAsk.price.amount.native,
            priceUsd: t.market.floorAsk.price.amount.usd ?? null,
            source: t.market.floorAsk.source?.name ?? null,
            sourceLogo: t.market.floorAsk.source?.icon ?? null,
            maker: t.market.floorAsk.maker ?? null,
          }
        : null,
      topBid: t.market?.topBid?.price?.amount?.native
        ? {
            price: t.market.topBid.price.amount.native,
            priceUsd: t.market.topBid.price.amount.usd ?? null,
            source: t.market.topBid.source?.name ?? null,
          }
        : null,
    }

    _marketCache.set(cacheKey, { data, ts: Date.now() })
    return data
  }

  // Invalidate cache for a specific token (call after trade)
  function invalidateCache(tokenId) {
    _marketCache.delete(String(tokenId))
  }

  // ─── Buy token ───────────────────────────────────────────────────────────
  async function buyToken(tokenId, { onProgress } = {}) {
    if (!isConnected.value) throw { code: "WALLET_NOT_CONNECTED" }
    if (!isMainnet.value) throw { code: "WRONG_NETWORK" }

    const signer = await getSigner()
    const wallet = adaptEthersV6Signer(signer)
    const feeAddress = config.public.PLATFORM_FEE_ADDRESS
    const feeBps = config.public.PLATFORM_FEE_BPS || "50"

    const params = {
      items: [{ token: `${MERGE_CONTRACT_ADDRESS}:${tokenId}`, quantity: 1 }],
      wallet,
      onProgress: (steps) => onProgress?.(steps),
    }

    // Add platform fee only if address is configured
    if (feeAddress) {
      params.feesOnTop = [`${feeAddress}:${feeBps}`]
    }

    await getClient()?.actions.buyToken(params)
    invalidateCache(tokenId)
  }

  // ─── List token for sale ──────────────────────────────────────────────────
  async function listToken(tokenId, { priceEth, expirationDays = 30, onProgress } = {}) {
    if (!isConnected.value) throw { code: "WALLET_NOT_CONNECTED" }
    if (!isMainnet.value) throw { code: "WRONG_NETWORK" }
    if (!priceEth || Number(priceEth) <= 0) throw { code: "INVALID_PRICE" }

    const signer = await getSigner()
    const wallet = adaptEthersV6Signer(signer)

    const expirationTime = Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60
    const weiPrice = BigInt(Math.round(Number(priceEth) * 1e18)).toString()

    const feeAddress = config.public.PLATFORM_FEE_ADDRESS
    const feeBps = config.public.PLATFORM_FEE_BPS || "50"

    const listing = {
      token: `${MERGE_CONTRACT_ADDRESS}:${tokenId}`,
      weiPrice,
      orderbook: "reservoir",
      orderKind: "seaport-v1.5",
      expirationTime: expirationTime.toString(),
      options: {
        "seaport-v1.5": { useOffChainCancellation: true },
      },
    }

    // Add platform fee only if address is configured
    if (feeAddress) {
      listing.fees = [`${feeAddress}:${feeBps}`]
    }

    await getClient()?.actions.listToken({
      listings: [listing],
      wallet,
      onProgress: (steps) => onProgress?.(steps),
    })
    invalidateCache(tokenId)
  }

  return {
    fetchTokenMarket,
    invalidateCache,
    buyToken,
    listToken,
  }
}
