export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.OPENSEA_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'Missing API key' })

  const body = await readBody(event)
  if (!body.orderHash || !body.protocolAddress || !body.fulfillerAddress) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  const res = await fetch('https://api.opensea.io/api/v2/listings/fulfillment_data', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      listing: {
        hash: body.orderHash,
        chain: 'ethereum',
        protocol_address: body.protocolAddress,
      },
      fulfiller: {
        address: body.fulfillerAddress,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw createError({ statusCode: res.status, statusMessage: text })
  }
  return res.json()
})
