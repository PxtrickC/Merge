export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.OPENSEA_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'OpenSea API key not configured' })

  const query = getQuery(event)
  const params = new URLSearchParams({ limit: '100' })
  if (query.next) params.set('next', String(query.next))

  const res = await fetch(
    `https://api.opensea.io/api/v2/listings/collection/m/all?${params}`,
    { headers: { 'x-api-key': apiKey, Accept: 'application/json' } }
  )
  if (!res.ok) {
    const text = await res.text()
    throw createError({ statusCode: res.status, statusMessage: text })
  }
  return res.json()
})
