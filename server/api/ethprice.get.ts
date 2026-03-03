let cached: { usd: number; ts: number } | null = null
const TTL = 60_000 // 60 seconds

export default defineEventHandler(async () => {
    if (cached && Date.now() - cached.ts < TTL) {
        return { usd: cached.usd }
    }

    const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { headers: { Accept: 'application/json' } }
    )

    if (!res.ok) {
        // Return stale cache if available, otherwise error
        if (cached) return { usd: cached.usd }
        throw createError({ statusCode: res.status, statusMessage: 'Failed to fetch ETH price' })
    }

    const data = await res.json()
    const usd = data?.ethereum?.usd ?? null
    if (usd) cached = { usd, ts: Date.now() }
    return { usd }
})
