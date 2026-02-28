const CONTRACT = '0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.OPENSEA_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'Missing API key' })

  const query = getQuery(event)
  const tokenId = query.tokenId
  if (!tokenId) throw createError({ statusCode: 400, statusMessage: 'tokenId required' })

  const res = await fetch(
    `https://api.opensea.io/api/v2/orders/ethereum/seaport/listings?asset_contract_address=${CONTRACT}&token_ids=${tokenId}&order_by=eth_price&order_direction=asc&limit=1`,
    { headers: { 'x-api-key': apiKey, Accept: 'application/json' } }
  )
  if (!res.ok) {
    throw createError({ statusCode: res.status, statusMessage: 'Failed to fetch listing' })
  }
  return res.json()
})
