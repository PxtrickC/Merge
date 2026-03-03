export default defineEventHandler(async () => {
    const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) throw createError({ statusCode: res.status, statusMessage: 'Failed to fetch ETH price' })
    const data = await res.json()
    return { usd: data?.ethereum?.usd ?? null }
})
