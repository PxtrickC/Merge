import { Redis } from '@upstash/redis'

function hashEndpoint(endpoint: string): string {
  let hash = 0
  for (let i = 0; i < endpoint.length; i++) {
    const chr = endpoint.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const redis = new Redis({
    url: config.UPSTASH_REDIS_REST_URL as string,
    token: config.UPSTASH_REDIS_REST_TOKEN as string,
  })

  const body = await readBody(event)

  if (!body?.endpoint) {
    throw createError({ statusCode: 400, statusMessage: 'Missing endpoint' })
  }

  const key = `push:sub:${hashEndpoint(body.endpoint)}`
  await redis.del(key)
  await redis.srem('push:subscriptions', key)

  return { ok: true }
})
