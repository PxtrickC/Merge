import { readFileSync } from 'fs'
import { resolve } from 'path'
import { decodeValue } from '~/utils/contract.mjs'

let cachedSummary: any = null
let cacheTime = 0

export default defineEventHandler(async (event) => {
    if (cachedSummary && Date.now() - cacheTime < 60000) {
        return cachedSummary
    }

    let tokens: any[] = []
    try {
        const dbPath = resolve(process.cwd(), 'public/data/db.json')
        const db = JSON.parse(readFileSync(dbPath, 'utf-8'))
        tokens = db.tokens || []
    } catch (e) {
        console.warn('Could not read db.json for summary, falling back to network...')
        try {
            const db: any = await $fetch('https://merge.ppatrick.xyz/data/db.json')
            tokens = db.tokens || []
        } catch (e2) {
            return { error: 'Failed to load data' }
        }
    }

    let aliveCount = 0
    let totalMass = 0
    let alphaMass = 0
    const tiers = [0, 0, 0, 0, 0] // 0-4

    for (let i = 1; i < tokens.length; i++) {
        const entry = tokens[i]
        if (!entry || entry[0] === 0 || entry[2]) continue
        aliveCount++
        const { mass, class: tier } = decodeValue(entry[0])
        totalMass += mass
        if (mass > alphaMass) alphaMass = mass
        if (tier >= 1 && tier <= 4) tiers[tier]++
    }

    cachedSummary = {
        token_count: aliveCount,
        merged_count: 28990 - aliveCount,
        total_mass: totalMass,
        alpha_mass: alphaMass,
        tier_counts: tiers,
    }
    cacheTime = Date.now()
    return cachedSummary
})
