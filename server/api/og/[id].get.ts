import { readFileSync } from 'fs'
import { resolve } from 'path'
import { decodeValue } from '~/utils/contract.mjs'
import { Resvg } from '@resvg/resvg-js'

type DbTokenEntry = [number, number, number?]

// Mirror of MergeSvg.vue radius formula (∛mass × 62035049089 / 1e6)
function computeSphereRadius(mass: number, alphaMass: number, panelSize: number): number {
  const r = Math.pow(Math.abs(mass), 1 / 3) * 62035049089 / 1_000_000
  const rMax = Math.pow(alphaMass, 1 / 3) * 62035049089 / 1_000_000
  const ratio = rMax > 0 ? r / rMax : 0
  const pct = Math.max(0.05, ratio * 0.5) // minimum 5%, maximum 50%
  return Math.round(panelSize * pct)
}

function computeRanks(tokens: any[], id: number) {
  const alive: { id: number; mass: number; merges: number }[] = []
  for (let i = 1; i < tokens.length; i++) {
    const e = tokens[i] as DbTokenEntry | null
    if (!e || e[0] === 0 || e[2]) continue  // e[2] truthy = merged into another; undefined = alive
    const { mass: m } = decodeValue(e[0])
    alive.push({ id: i, mass: m, merges: e[1] || 0 })
  }

  const entry = tokens[id] as DbTokenEntry | null
  if (!entry || entry[0] === 0) {
    return { mass: 0, tier: 1, massRank: null, merges: 0, mergesRank: null, total: 0 }
  }

  const { class: tier, mass } = decodeValue(entry[0])
  const merges = entry[1] || 0
  const total = alive.length

  const massSorted = [...alive].sort((a, b) => b.mass - a.mass || b.id - a.id)
  const mergesSorted = [...alive].sort((a, b) => (b.merges ?? 0) - (a.merges ?? 0) || b.id - a.id)

  const massRankIdx = massSorted.findIndex(t => t.id === id)
  const mergesRankIdx = mergesSorted.findIndex(t => t.id === id)
  const alphaMass = massSorted[0]?.mass || 12143 // fallback to initial max

  return {
    mass, tier, merges, total, alphaMass,
    massRank: massRankIdx >= 0 ? massRankIdx + 1 : null,
    mergesRank: mergesRankIdx >= 0 ? mergesRankIdx + 1 : null,
  }
}

export default defineEventHandler(async (event) => {
  const idStr = getRouterParam(event, 'id')
  const id = parseInt(idStr ?? '', 10)

  // ── Load db.json ────────────────────────────────────────────────────────
  let db: any
  try {
    const host = getRequestHeader(event, 'host') || 'merge.ppatrick.xyz'
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
    const url = `${protocol}://${host}/data/db.json`

    db = await $fetch(url)
    if (typeof db === 'string') db = JSON.parse(db)
  } catch (e) {
    console.warn('Could not fetch db.json via HTTP, falling back to fs...', e)
    const dbPath = resolve(process.cwd(), 'public/data/db.json')
    try {
      db = JSON.parse(readFileSync(dbPath, 'utf-8'))
    } catch (fsErr) {
      db = { tokens: [] }
    }
  }
  const tokens: any[] = db?.tokens ?? []

  // ── Token stats & ranks ─────────────────────────────────────────────────
  const { mass, tier, merges, massRank, mergesRank, total, alphaMass } = computeRanks(tokens, id)

  // ── Canvas ──────────────────────────────────────────────────────────────
  const W = 1200
  const H = 630
  const spherePanel = 630   // square left panel

  // ── Sphere geometry ─────────────────────────────────────────────────────
  const cx = Math.round(spherePanel / 2)
  const cy = Math.round(H / 2)
  const safeMass = Math.abs(mass) || 0
  const hasToken = safeMass > 0
  const sphereR = hasToken ? computeSphereRadius(safeMass, alphaMass, spherePanel) : 0

  // White bg + black sphere = mass rank #1 (largest in the universe)
  const isAlpha = massRank === 1

  // ── Left sphere panel palette (matches MergeSvg.vue) ───────────────────
  let sphereBg: string, sphereFill: string
  if (isAlpha) {
    sphereBg = '#ffffff'; sphereFill = '#000000'
  } else {
    switch (tier) {
      case 2: sphereBg = '#000000'; sphereFill = '#ffcc33'; break
      case 3: sphereBg = '#3333ff'; sphereFill = '#ffffff'; break
      case 4: sphereBg = '#ff3333'; sphereFill = '#ffffff'; break
      default: sphereBg = '#000000'; sphereFill = '#ffffff'; break
    }
  }

  // ── Right panel colors (Synced with TokenDrawer.vue) ───────────────────
  let panelBg: string, textPrimary: string, textMuted: string
  if (isAlpha) {
    panelBg = '#ffffff'; textPrimary = '#111111'; textMuted = '#666666'
  } else {
    switch (tier) {
      case 2: panelBg = '#000000'; textPrimary = '#ffcc33'; textMuted = '#c99e20'; break
      case 3: panelBg = '#3333ff'; textPrimary = '#ffffff'; textMuted = 'rgba(255, 255, 255, 0.75)'; break
      case 4: panelBg = '#ff3333'; textPrimary = '#ffffff'; textMuted = 'rgba(255, 255, 255, 0.75)'; break
      default: panelBg = '#0a0a0a'; textPrimary = '#ffffff'; textMuted = '#888888'; break
    }
  }

  // ── Right panel text X origin ───────────────────────────────────────────
  const rx = H + 40  // text starts at H px = left side is a perfect H×H square

  // ── Badges ──────────────────────────────────────────────────────────────
  type Badge = { bg: string; fg: string; border: string; label: string }

  let tierBadge: Badge
  switch (tier) {
    case 2: tierBadge = { bg: '#1a1400', fg: '#fc3', border: '#3d3200', label: 'TIER 2' }; break
    case 3: tierBadge = { bg: '#2222aa', fg: '#ffffff', border: '#1a1a88', label: 'TIER 3' }; break
    case 4: tierBadge = { bg: '#aa2222', fg: '#ffffff', border: '#881a1a', label: 'TIER 4' }; break
    default: tierBadge = { bg: '#111', fg: '#fff', border: '#2a2a2a', label: 'TIER 1' }; break
  }
  const baseBadge = isAlpha
    ? { bg: '#e5e5e5', fg: '#111', border: '#bbb' }
    : { bg: '#ffffff', fg: '#000000', border: '#ffffff' }
  const classNum = !isNaN(id) ? String(id).slice(-2) : null

  const badges: Badge[] = []
  if (isAlpha) badges.push({ bg: '#000000', fg: '#ffffff', border: '#444444', label: 'ALPHA' })
  badges.push(tierBadge)
  if (merges > 0) badges.push({ ...baseBadge, label: `MERGES ${merges}` })
  if (classNum !== null) badges.push({ ...baseBadge, label: `CLASS ${classNum}` })

  // ── Adaptive font size ──────────────────────────────────────────────────
  // Compute early so all Y positions derive from it
  const massStr = `m(${hasToken ? String(safeMass) : '\u2014'})`
  const massFontSize = massStr.length <= 8 ? 108 : massStr.length <= 10 ? 96 : 80

  // ── Badge render constants ──────────────────────────────────────────────
  const BADGE_H = 46
  const BADGE_PAD_X = 22
  const BADGE_GAP = 8
  const BADGE_FONT = 22
  const CHAR_W = 12.8

  // ── Vertical layout anchors (top → bottom) ──────────────────────────────
  //   MERGE label  y = 28
  //   m(mass)      y = 28 + massFontSize
  //   #id          y = idY
  //   badges       y = badgeY    (idY + 46)
  //   rank blocks  y = statStartY (badgeY + BADGE_H + 36)
  //   price block  y = PRICE_Y_LABEL (STAT_Y_DENOM + 18 + 44)
  const idY = massFontSize + 110
  const badgeY = idY + 30
  const statStartY = badgeY + BADGE_H + 60
  const STAT_Y_LABEL = statStartY
  const STAT_Y_NUM = statStartY + 64
  const STAT_Y_DENOM = STAT_Y_NUM + 32
  const STAT_COL2_X = Math.round(W * 0.75)
  const PRICE_Y_LABEL = STAT_Y_DENOM + 64
  const PRICE_Y_VAL = PRICE_Y_LABEL + 64

  // ── Shared text style constants ────────────────────────────────────────
  const F = `font-family="'HND','DM Sans',system-ui,-apple-system,sans-serif"`
  // FL = label style — change here to update ALL four section labels at once
  const FL = `${F} font-size="34" font-weight="600" letter-spacing="0"`
  const massRankSvg = massRank && total ? `
    <text x="${rx}" y="${STAT_Y_LABEL}" fill="${textPrimary}" ${FL}>Mass Rank</text>
    <text x="${rx}" y="${STAT_Y_NUM}" fill="${textPrimary}" ${F} font-size="44" font-weight="700" letter-spacing="-1">#${massRank}</text>
    <text x="${rx}" y="${STAT_Y_DENOM}" fill="${textMuted}" ${F} font-size="24" font-weight="400">/ ${total}</text>` : ''

  const mergesRankSvg = mergesRank && total ? `
    <text x="${STAT_COL2_X}" y="${STAT_Y_LABEL}" fill="${textPrimary}" ${FL}>Merges Rank</text>
    <text x="${STAT_COL2_X}" y="${STAT_Y_NUM}" fill="${textPrimary}" ${F} font-size="44" font-weight="700" letter-spacing="-1">#${mergesRank}</text>
    <text x="${STAT_COL2_X}" y="${STAT_Y_DENOM}" fill="${textMuted}" ${F} font-size="24" font-weight="400">/ ${total}</text>` : ''

  // ── Badges SVG ──────────────────────────────────────────────────────────
  let badgeX = rx
  const badgesSvg = badges.map((b) => {
    const bw = Math.ceil(b.label.length * CHAR_W) + BADGE_PAD_X * 2
    const out = `<rect x="${badgeX}" y="${badgeY}" width="${bw}" height="${BADGE_H}" rx="4" fill="${b.bg}" stroke="${b.border}" stroke-width="2"/>
    <text x="${badgeX + bw / 2}" y="${badgeY + BADGE_H / 2}" dominant-baseline="central" text-anchor="middle" fill="${b.fg}" ${F} font-size="${BADGE_FONT}" font-weight="600" letter-spacing="0.5">${b.label}</text>`
    badgeX += bw + BADGE_GAP
    return out
  }).join('\n    ')

  // ── OpenSea price data (best-effort, 4s timeout) ────────────────────────
  const OS_CONTRACT = '0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab'
  const OS_SLUG = 'm'
  const osKey = useRuntimeConfig().OPENSEA_API_KEY
  const osHeaders: Record<string, string> = { 'x-api-key': String(osKey), Accept: 'application/json' }

  let listPrice: number | null = null
  let topOffer: number | null = null

  if (hasToken && osKey) {
    const timeout = (ms: number) => new Promise<null>(r => setTimeout(() => r(null), ms))
    const safe = (p: Promise<any>) => Promise.race([p.catch(() => null), timeout(4000)])

    const [listData, offerData] = await Promise.all([
      safe(fetch(
        `https://api.opensea.io/api/v2/orders/ethereum/seaport/listings?asset_contract_address=${OS_CONTRACT}&token_ids=${id}&order_by=eth_price&order_direction=asc&limit=1`,
        { headers: osHeaders }
      ).then(r => r.ok ? r.json() : null)),
      safe(fetch(
        `https://api.opensea.io/api/v2/offers/collection/${OS_SLUG}/nfts/${id}/best`,
        { headers: osHeaders }
      ).then(r => r.ok ? r.json() : null)),
    ])

    const firstOrder = listData?.orders?.[0]
    if (firstOrder?.current_price) {
      listPrice = Number(firstOrder.current_price) / 1e18
    }
    if (offerData?.price) {
      topOffer = Number(offerData.price.value) / Math.pow(10, offerData.price.decimals ?? 18)
    }
  }

  const fmtEth = (v: number) => parseFloat(v.toFixed(4)).toString()

  // BUY FOR always shows (— when not listed); TOP OFFER only when available
  const buyForVal = listPrice !== null ? `${fmtEth(listPrice)}<tspan fill="${textPrimary}" font-size="24" font-weight="400" dx="4"> ETH</tspan>` : `<tspan fill="${textMuted}">\u2014</tspan>`
  const priceSvg = `
    <text x="${rx}" y="${PRICE_Y_LABEL}" fill="${textPrimary}" ${FL}>Buy For</text>
    <text x="${rx}" y="${PRICE_Y_VAL}" fill="${textPrimary}" ${F} font-size="44" font-weight="700" letter-spacing="-1">${buyForVal}</text>
    ${topOffer !== null ? `<text x="${STAT_COL2_X}" y="${PRICE_Y_LABEL}" fill="${textPrimary}" ${FL}>Top Offer</text>
    <text x="${STAT_COL2_X}" y="${PRICE_Y_VAL}" fill="${textPrimary}" ${F} font-size="44" font-weight="700" letter-spacing="-1">${fmtEth(topOffer!)}<tspan fill="${textPrimary}" font-size="24" font-weight="400" dx="4"> WETH</tspan></text>` : ''}`

  // ── SVG output ──────────────────────────────────────────────────────────
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- Left: sphere panel -->
  <rect x="0" y="0" width="${spherePanel}" height="${H}" fill="${sphereBg}"/>
  <circle cx="${cx}" cy="${cy}" r="${sphereR}" fill="${sphereFill}"/>

  <!-- Right: info panel -->
  <rect x="${spherePanel}" y="0" width="${W - spherePanel}" height="${H}" fill="${panelBg}"/>


  <!-- m(mass) — dominant headline -->
  <text x="${rx}" y="${38 + massFontSize}" fill="${textPrimary}" ${F} font-size="${massFontSize}" font-weight="600" letter-spacing="-2">${massStr}</text>

  <!-- #id -->
  <text x="${rx}" y="${idY}" fill="${textPrimary}" ${F} font-size="52" font-weight="400" letter-spacing="-1">#${isNaN(id) ? '\u2014' : id}</text>

  <!-- Badges: TIER, MERGES, CLASS -->
  ${badgesSvg}

  <!-- Rank stat blocks -->
  ${massRankSvg}
  ${mergesRankSvg}

  <!-- Price: BUY FOR / TOP OFFER -->
  ${priceSvg}

</svg>`

  // Convert SVG to PNG using resvg
  let fontPath: string | undefined
  try {
    const tmpFontPath = '/tmp/HND.ttf'
    const { existsSync, writeFileSync } = await import('fs')
    if (existsSync(tmpFontPath)) {
      fontPath = tmpFontPath
    } else {
      // Load from Nitro internal storage (bundled safely in Vercel)
      const raw = await useStorage('assets:server').getItemRaw('fonts/HND.ttf')
      if (raw) {
        writeFileSync(tmpFontPath, Buffer.from(raw))
        fontPath = tmpFontPath
      } else {
        // Fallback to local resolve for dev
        const localPath = resolve('server/assets/fonts/HND.ttf')
        if (existsSync(localPath)) fontPath = localPath
      }
    }
  } catch (err) {
    console.warn('Could not load HND.ttf font, falling back to system fonts:', err)
  }

  try {
    const resvg = new Resvg(svg, {
      font: {
        loadSystemFonts: true,
        fontFiles: fontPath ? [fontPath] : [],
        defaultFontFamily: 'HND',
      },
    })
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=31536000')
    return pngBuffer
  } catch (renderErr) {
    console.error('Failed to render PNG via resvg, falling back to raw SVG:', renderErr)
    setHeader(event, 'Content-Type', 'image/svg+xml')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=31536000')
    return svg
  }
})
