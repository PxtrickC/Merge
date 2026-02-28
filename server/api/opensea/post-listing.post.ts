export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.OPENSEA_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'Missing API key' })

  const body = await readBody(event)
  if (!body.parameters || !body.signature) {
    throw createError({ statusCode: 400, statusMessage: 'Missing parameters or signature' })
  }

  const res = await fetch('https://api.opensea.io/api/v2/orders/ethereum/seaport/listings', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      parameters: body.parameters,
      signature: body.signature,
      protocol_address: body.protocol_address,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw createError({ statusCode: res.status, statusMessage: text })
  }
  return res.json()
})
