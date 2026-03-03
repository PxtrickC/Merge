export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const apiKey = config.OPENSEA_API_KEY
    if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'Missing API key' })

    // https://docs.opensea.io/reference/get_all_offers_on_a_collection
    const res = await fetch(
        `https://api.opensea.io/api/v2/offers/collection/m/all`,
        { headers: { 'x-api-key': apiKey, Accept: 'application/json' } }
    )

    if (!res.ok) {
        throw createError({ statusCode: res.status, statusMessage: 'Failed to fetch collection offers' })
    }

    return res.json()
})
