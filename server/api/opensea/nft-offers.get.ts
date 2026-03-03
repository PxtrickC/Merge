const COLLECTION_SLUG = 'm'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const apiKey = config.OPENSEA_API_KEY
    if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'Missing API key' })

    const query = getQuery(event)
    const tokenId = query.tokenId
    if (!tokenId) throw createError({ statusCode: 400, statusMessage: 'tokenId required' })

    // Use "Best Offer on NFT" endpoint — returns the actual best applicable offer
    // (considers both direct and criteria-based offers)
    const res = await fetch(
        `https://api.opensea.io/api/v2/offers/collection/${COLLECTION_SLUG}/nfts/${tokenId}/best`,
        { headers: { 'x-api-key': apiKey, Accept: 'application/json' } }
    )

    if (!res.ok) {
        throw createError({ statusCode: res.status, statusMessage: 'Failed to fetch offers' })
    }

    return res.json()
})
