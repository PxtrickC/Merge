import { readFileSync } from 'fs'
import { resolve } from 'path'
import { decodeValue } from '~/utils/contract.mjs'

let cachedTokens: any[] | null = null
let cacheTime = 0

export default defineEventHandler(async (event) => {
    const idStr = getRouterParam(event, 'id')
    const id = parseInt(idStr ?? '', 10)
    if (isNaN(id) || id <= 0) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })
    }

    if (!cachedTokens || Date.now() - cacheTime > 60000) {
        let db: any
        try {
            const dbPath = resolve(process.cwd(), 'public/data/db.json')
            db = JSON.parse(readFileSync(dbPath, 'utf-8'))
        } catch (e) {
            console.warn('Could not read db.json from fs, falling back to canonical URL...')
            try {
                db = await $fetch('https://merge.ppatrick.xyz/data/db.json')
                if (typeof db === 'string') db = JSON.parse(db)
            } catch (e2) {
                db = { tokens: [] }
            }
        }
        cachedTokens = db.tokens || []
        cacheTime = Date.now()
    }

    const entry = cachedTokens![id]
    if (!entry || entry[0] === 0) {
        return { id, error: 'Not found or invalid' }
    }

    const { class: tier, mass } = decodeValue(entry[0])
    const merges = entry[1] || 0
    const isMerged = !!entry[2]
    const mergedTo = entry[2]

    const alive = []
    for (let i = 1; i < cachedTokens!.length; i++) {
        const e = cachedTokens![i]
        if (!e || e[0] === 0 || e[2]) continue
        const decoded = decodeValue(e[0])
        alive.push({ id: i, mass: decoded.mass, merges: e[1] || 0 })
    }

    const massSorted = [...alive].sort((a, b) => b.mass - a.mass || b.id - a.id)
    const mergesSorted = [...alive].sort((a, b) => (b.merges ?? 0) - (a.merges ?? 0) || b.id - a.id)

    const massRank = massSorted.findIndex(t => t.id === id)
    const mergesRank = mergesSorted.findIndex(t => t.id === id)

    return {
        id,
        mass,
        tier,
        merges,
        isMerged,
        mergedTo,
        massRank: massRank >= 0 ? massRank + 1 : null,
        mergesRank: mergesRank >= 0 ? mergesRank + 1 : null,
        totalAlive: alive.length,
        alphaMass: massSorted[0]?.mass || 12143
    }
})
