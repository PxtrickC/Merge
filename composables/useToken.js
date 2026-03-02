import { ethers } from "ethers"
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI, TRANSFER_TOPIC, NIFTY_OMNIBUS_ADDRESS, decodeValue } from "~/utils/contract.mjs"

const ZERO_ADDRESS = '0x' + '0'.repeat(64)
const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api'
const DEPLOY_BLOCK = 13_755_675
const MASS_UPDATE_TOPIC = '0x7ba170514e8ea35827dbbd10c6d3376ca77ff64b62e4b0a395bac9b142dc81dc'

let _provider = null
let _contract = null

function getContract() {
  if (_contract) return _contract

  const config = useRuntimeConfig()
  const apiKey = config.public.ALCHEMY_API_KEY
  const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`

  _provider = new ethers.JsonRpcProvider(rpcUrl)
  _contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, _provider)
  return _contract
}

export async function useToken(tokenId) {
  const token = ref(null)
  const loading = ref(true)
  const error = ref(null)

  try {
    const contract = getContract()
    const exists = await contract.exists(tokenId)

    if (exists) {
      const [value, mergeCount, ownerAddr] = await Promise.all([
        contract.getValueOf(tokenId),
        contract.getMergeCount(tokenId),
        contract.ownerOf(tokenId),
      ])
      const { class: classVal, mass } = decodeValue(value)

      let owner = ownerAddr
      let ownerName = null
      if (ownerAddr.toLowerCase() === NIFTY_OMNIBUS_ADDRESS.toLowerCase()) {
        ownerName = 'NG Omnibus'
      } else {
        try {
          const name = await _provider.lookupAddress(ownerAddr)
          if (name) ownerName = name
        } catch {}
      }

      token.value = {
        id: Number(tokenId),
        mass,
        class: classVal,
        tier: classVal,
        merges: Number(mergeCount),
        merged: false,
        owner,
        ownerName,
      }
    } else {
      // Burned token — find MassUpdate event via Etherscan API (Alchemy queryFilter hangs)
      const config = useRuntimeConfig()
      const esKey = config.public.ETHERSCAN_API_KEY
      const topic1 = '0x' + tokenId.toString(16).padStart(64, '0')

      const url = new URL(ETHERSCAN_BASE)
      url.searchParams.set('chainid', '1')
      url.searchParams.set('module', 'logs')
      url.searchParams.set('action', 'getLogs')
      url.searchParams.set('address', MERGE_CONTRACT_ADDRESS)
      url.searchParams.set('topic0', MASS_UPDATE_TOPIC)
      url.searchParams.set('topic1', topic1)
      url.searchParams.set('topic0_1_opr', 'and')
      url.searchParams.set('fromBlock', DEPLOY_BLOCK.toString())
      url.searchParams.set('toBlock', 'latest')
      url.searchParams.set('page', '1')
      url.searchParams.set('offset', '10')
      if (esKey) url.searchParams.set('apikey', esKey)

      const res = await fetch(url)
      const json = await res.json()
      console.log('[useToken burned] Etherscan response:', json.status, json.message, Array.isArray(json.result) ? json.result.length : json.result)

      if (json.status === '1' && Array.isArray(json.result) && json.result.length > 0) {
        const log = json.result[json.result.length - 1]
        const block = parseInt(log.blockNumber, 16)
        const persistId = parseInt(log.topics[2], 16)
        const timestamp = parseInt(log.timeStamp, 16)
        try {
          const [value, mergeCount] = await Promise.all([
            contract.getValueOf(tokenId, { blockTag: block - 1 }),
            contract.getMergeCount(tokenId, { blockTag: block - 1 }),
          ])
          const { class: classVal, mass } = decodeValue(value)
          token.value = {
            id: Number(tokenId),
            mass,
            class: classVal,
            tier: classVal,
            merges: Number(mergeCount),
            merged: true,
            mergedTo: persistId,
            mergedOn: new Date(timestamp * 1000).toISOString(),
            owner: null,
            ownerName: null,
          }
        } catch {
          token.value = { id: Number(tokenId), mass: 0, class: 0, tier: 0, merges: 0, merged: true, mergedTo: persistId, mergedOn: new Date(timestamp * 1000).toISOString(), owner: null, ownerName: null }
        }
      } else {
        token.value = { id: Number(tokenId), mass: 0, class: 0, tier: 0, merges: 0, merged: true, mergedTo: null, mergedOn: null, owner: null, ownerName: null }
      }
    }
  } catch (err) {
    error.value = err
    token.value = null
  } finally {
    loading.value = false
  }

  return { token, loading, error }
}

export async function useTokenTransfers(tokenId) {
  const transfers = ref([])

  try {
    const config = useRuntimeConfig()
    const apiKey = config.public.ETHERSCAN_API_KEY

    // Pad tokenId to 32-byte hex topic
    const topic3 = '0x' + tokenId.toString(16).padStart(64, '0')

    const url = new URL(ETHERSCAN_BASE)
    url.searchParams.set('chainid', '1')
    url.searchParams.set('module', 'logs')
    url.searchParams.set('action', 'getLogs')
    url.searchParams.set('address', MERGE_CONTRACT_ADDRESS)
    url.searchParams.set('topic0', TRANSFER_TOPIC)
    url.searchParams.set('topic3', topic3)
    url.searchParams.set('topic0_3_opr', 'and')
    url.searchParams.set('fromBlock', DEPLOY_BLOCK.toString())
    url.searchParams.set('toBlock', 'latest')
    url.searchParams.set('page', '1')
    url.searchParams.set('offset', '1000')
    if (apiKey) url.searchParams.set('apikey', apiKey)

    const res = await fetch(url)
    const json = await res.json()

    if (json.status === '1' && Array.isArray(json.result)) {
      const parsed = json.result.map((log) => ({
        from: '0x' + log.topics[1].slice(26),
        to: '0x' + log.topics[2].slice(26),
        isMint: log.topics[1] === ZERO_ADDRESS,
        date: new Date(parseInt(log.timeStamp, 16) * 1000).toISOString(),
      }))

      // Resolve ENS names for all unique addresses
      const addrs = new Set()
      for (const tx of parsed) {
        if (!tx.isMint) addrs.add(tx.from)
        addrs.add(tx.to)
      }
      const ensMap = { [NIFTY_OMNIBUS_ADDRESS]: 'NG Omnibus' }
      const provider = getContract().runner
      await Promise.all([...addrs].map(async (addr) => {
        try {
          const name = await provider.lookupAddress(addr)
          if (name) ensMap[addr] = name
        } catch {
          // ENS lookup failed for this address
        }
      }))

      transfers.value = parsed.map((tx) => ({
        ...tx,
        fromName: ensMap[tx.from] || null,
        toName: ensMap[tx.to] || null,
      }))
    }
  } catch (err) {
    console.error('[useTokenTransfers] failed:', err)
    transfers.value = []
  }

  return { transfers }
}

export async function useTokenMergeTimeline(tokenId, { dbRef, mergedIntoIndexRef, etherscanApiKey } = {}) {
  const timeline = ref([])
  const initialMass = ref(null)

  try {
    const db = dbRef
    const mergedIntoIdx = mergedIntoIndexRef

    if (!db) return { timeline, initialMass }

    // Wait for db.json to load (uses passed-in ref, no Nuxt context needed)
    if (!db.value?.tokens) {
      await new Promise((resolve) => {
        const stop = watch(db, (v) => {
          if (v?.tokens) { stop(); resolve() }
        }, { immediate: true })
      })
    }

    const burnedIds = mergedIntoIdx?.value?.get(tokenId) || []
    if (burnedIds.length === 0) {
      const entry = db.value.tokens[tokenId]
      if (entry) initialMass.value = decodeValue(entry[0]).mass
      return { timeline, initialMass }
    }

    // Read burned token data from db.json (class, mass) — zero RPC calls
    const burnedTokens = []
    let totalBurnedMass = 0
    for (const bid of burnedIds) {
      const entry = db.value.tokens[bid]
      if (!entry) continue
      const { class: tierClass, mass } = decodeValue(entry[0])
      totalBurnedMass += mass
      burnedTokens.push({ tokenId: bid, tierClass, mass })
    }

    // Calculate initial mass from db.json
    const persistEntry = db.value.tokens[tokenId]
    if (persistEntry) {
      const currentMass = decodeValue(persistEntry[0]).mass
      initialMass.value = currentMass - totalBurnedMass
      if (initialMass.value < 1) initialMass.value = 1
    }

    // Fetch timestamps from Etherscan (no archive RPC calls needed)
    const timestampMap = new Map() // burnedId → ISO date string
    try {
      const apiKey = etherscanApiKey
      const topic2 = '0x' + tokenId.toString(16).padStart(64, '0')

      let fromBlock = DEPLOY_BLOCK
      while (true) {
        const url = new URL(ETHERSCAN_BASE)
        url.searchParams.set('chainid', '1')
        url.searchParams.set('module', 'logs')
        url.searchParams.set('action', 'getLogs')
        url.searchParams.set('address', MERGE_CONTRACT_ADDRESS)
        url.searchParams.set('topic0', MASS_UPDATE_TOPIC)
        url.searchParams.set('topic2', topic2)
        url.searchParams.set('topic0_2_opr', 'and')
        url.searchParams.set('fromBlock', fromBlock.toString())
        url.searchParams.set('toBlock', 'latest')
        url.searchParams.set('page', '1')
        url.searchParams.set('offset', '1000')
        if (apiKey) url.searchParams.set('apikey', apiKey)

        const res = await fetch(url)
        const json = await res.json()

        if (json.status !== '1' || !Array.isArray(json.result) || json.result.length === 0) break

        for (const log of json.result) {
          const burnedId = parseInt(log.topics[1], 16)
          const ts = parseInt(log.timeStamp, 16)
          timestampMap.set(burnedId, new Date(ts * 1000).toISOString())
        }

        if (json.result.length < 1000) break
        const lastBlock = parseInt(json.result[json.result.length - 1].blockNumber, 16)
        if (lastBlock <= fromBlock) { fromBlock = lastBlock + 1 } else { fromBlock = lastBlock }
      }
    } catch (err) {
      console.warn('[useTokenMergeTimeline] Etherscan timestamp fetch failed, showing without dates:', err)
    }

    // Combine db.json data with Etherscan timestamps
    timeline.value = burnedTokens.map((t) => ({
      ...t,
      date: timestampMap.get(t.tokenId) || null,
    }))

    // Sort: tokens with dates by date desc, tokens without dates at the end
    timeline.value.sort((a, b) => {
      if (a.date && b.date) return new Date(b.date) - new Date(a.date)
      if (a.date) return -1
      if (b.date) return 1
      return b.tokenId - a.tokenId
    })
  } catch (err) {
    console.error('[useTokenMergeTimeline] failed:', err)
    timeline.value = []
  }

  return { timeline, initialMass }
}
