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

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid subscription object' })
  }

  const subscription = {
    endpoint: body.endpoint,
    keys: {
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
  }

  const key = `push:sub:${hashEndpoint(subscription.endpoint)}`
  await redis.set(key, JSON.stringify(subscription))
  await redis.sadd('push:subscriptions', key)

  return { ok: true }
})
