export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.OPENSEA_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'Missing API key' })

  const res = await fetch('https://api.opensea.io/api/v2/collections/m', {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw createError({ statusCode: res.status, statusMessage: 'Failed to fetch collection' })
  }
  return res.json()
})
