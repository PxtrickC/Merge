/**
 * Send push notifications for new merge events.
 *
 * Reads latest_merges.json, compares against last-sent timestamp in Redis,
 * sends notifications for new events, updates the marker.
 *
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
 *      UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
 *      NUXT_PUBLIC_ALCHEMY_API_KEY (optional, for token image in notification)
 */
import webpush from "web-push"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "public", "data")

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  console.error("Missing VAPID env vars")
  process.exit(1)
}
if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error("Missing UPSTASH env vars")
  process.exit(1)
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// ---------------------------------------------------------------------------
// Upstash REST helpers
// ---------------------------------------------------------------------------
async function redis(...args) {
  const res = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  })
  const json = await res.json()
  if (json.error) throw new Error(`Redis error: ${json.error}`)
  return json.result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ALCHEMY_KEY = process.env.NUXT_PUBLIC_ALCHEMY_API_KEY
const MERGE_CONTRACT = "0xc3f8a0F5841aBFf777d3eefA5047e8D413a1C9AB"

const TIER_EMOJI = { 1: '⚪', 2: '🟡', 3: '🔵', 4: '🔴' }

function fmt(n) {
  return n.toLocaleString('en-US')
}

function getAliveCount() {
  const db = JSON.parse(readFileSync(join(DATA_DIR, "db.json"), "utf-8"))
  return db.tokens.filter(t => t && t[2] === 0).length
}

async function getTokenImage(tokenId) {
  if (!ALCHEMY_KEY) return null
  try {
    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTMetadata?contractAddress=${MERGE_CONTRACT}&tokenId=${tokenId}&refreshCache=false`
    const res = await fetch(url)
    const json = await res.json()
    return json.image?.pngUrl || json.image?.thumbnailUrl || json.image?.cachedUrl || null
  } catch {
    return null
  }
}

function mergeLine(e) {
  const be = TIER_EMOJI[e.tier] || '⚪'
  const pe = TIER_EMOJI[e.merged_to.tier] || '⚪'
  const pBefore = e.merged_to.mass - e.mass
  return `${be} (${fmt(e.mass)}) #${e.id} → ${pe} (${fmt(pBefore)}) #${e.merged_to.id} = ${pe} (${fmt(e.merged_to.mass)}) #${e.merged_to.id}`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🔔 Push notification sender\n")

  // 1. Read latest_merges.json
  const merges = JSON.parse(readFileSync(join(DATA_DIR, "latest_merges.json"), "utf-8"))
  if (!merges.length) {
    console.log("  No merges in latest_merges.json")
    return
  }

  // 2. Get last-sent timestamp from Redis
  const lastSentISO = await redis("GET", "push:last_sent")
  const lastSent = lastSentISO ? new Date(lastSentISO).getTime() : 0
  console.log(`  Last sent: ${lastSentISO || "never"}`)

  // 3. Filter new events (latest_merges.json is sorted newest-first)
  const newEvents = merges.filter((m) => new Date(m.merged_on).getTime() > lastSent)

  if (newEvents.length === 0) {
    console.log("  No new events since last notification")
    return
  }

  console.log(`  ${newEvents.length} new merge event(s) to notify\n`)

  // 4. Build notification payload
  const aliveCount = getAliveCount()
  const remain = `${fmt(aliveCount)}/28,990 remain`
  const e = newEvents[0]
  const image = await getTokenImage(e.merged_to.id)

  let payload
  if (newEvents.length === 1) {
    payload = {
      title: mergeLine(e),
      body: remain,
      tag: `merge-${e.id}`,
      url: `/${e.merged_to.id}`,
      ...(image && { image }),
    }
  } else {
    payload = {
      title: `${mergeLine(e)} (+${newEvents.length - 1})`,
      body: remain,
      tag: "merge-batch",
      url: `/${e.merged_to.id}`,
      ...(image && { image }),
    }
  }

  const payloadStr = JSON.stringify(payload)

  // 5. Fetch all subscription keys from Redis
  const subKeys = await redis("SMEMBERS", "push:subscriptions")
  if (!subKeys || subKeys.length === 0) {
    console.log("  No subscribers registered")
    // Still update last_sent so we don't re-process these events
    await redis("SET", "push:last_sent", newEvents[0].merged_on)
    return
  }

  console.log(`  Sending to ${subKeys.length} subscriber(s)...`)

  // 6. Fetch each subscription and send
  const expiredKeys = []
  let successCount = 0

  for (const key of subKeys) {
    const subJson = await redis("GET", key)
    if (!subJson) {
      expiredKeys.push(key)
      continue
    }

    let subscription
    try {
      subscription = typeof subJson === "string" ? JSON.parse(subJson) : subJson
    } catch {
      expiredKeys.push(key)
      continue
    }

    try {
      await webpush.sendNotification(subscription, payloadStr)
      successCount++
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log(`    Removing expired subscription: ${key}`)
        expiredKeys.push(key)
      } else {
        console.error(`    Failed to send to ${key}:`, err.statusCode || err.message)
      }
    }
  }

  // 7. Clean up expired subscriptions
  for (const key of expiredKeys) {
    await redis("DEL", key)
    await redis("SREM", "push:subscriptions", key)
  }

  // 8. Update last-sent timestamp
  await redis("SET", "push:last_sent", newEvents[0].merged_on)

  console.log(`\n  Sent: ${successCount}/${subKeys.length}, Expired: ${expiredKeys.length}`)
  console.log("Done! 🔔")
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
