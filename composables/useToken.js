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

export async function useTokenMergeHistory(tokenId) {
  const mergedTo = ref(null)
  const mergedOn = ref(null)

  try {
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
    console.log('[MergeHistory] Etherscan response:', json.status, json.message, Array.isArray(json.result) ? json.result.length : json.result)

    if (json.status === '1' && Array.isArray(json.result) && json.result.length > 0) {
      const log = json.result[json.result.length - 1]
      const persistId = parseInt(log.topics[2], 16)
      const timestamp = parseInt(log.timeStamp, 16)

      mergedTo.value = persistId
      mergedOn.value = new Date(timestamp * 1000).toISOString()
    }
  } catch {
    // Token was not merged or query failed
  }

  return { mergedTo, mergedOn }
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

export async function useTokensMergedInto(tokenId) {
  const merges = ref([])

  try {
    const contract = getContract()
    // Check MassUpdate events where this token persisted (received merges)
    const filter = contract.filters.MassUpdate(null, tokenId)
    const events = await contract.queryFilter(filter)

    merges.value = events.map((event) => {
      const burnedId = Number(event.args[0])
      const mass = Number(event.args[2])
      return { id: burnedId, mass, tier: 0 }
    })
  } catch {
    merges.value = []
  }

  return merges
}

export async function useTokenMergeTimeline(tokenId) {
  const timeline = ref([])
  const initialMass = ref(null)

  try {
    const config = useRuntimeConfig()
    const apiKey = config.public.ETHERSCAN_API_KEY
    const topic2 = '0x' + tokenId.toString(16).padStart(64, '0')

    // Fetch all MassUpdate events where this token is the persist (topic2)
    const allLogs = []
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

      console.log('[MergeTimeline] Etherscan response:', json.status, json.message, 'results:', Array.isArray(json.result) ? json.result.length : json.result)

      if (json.status !== '1' || !Array.isArray(json.result) || json.result.length === 0) break
      allLogs.push(...json.result)

      if (json.result.length < 1000) break
      const lastBlock = parseInt(json.result[json.result.length - 1].blockNumber, 16)
      if (lastBlock <= fromBlock) { fromBlock = lastBlock + 1 } else { fromBlock = lastBlock }
    }

    // Sort chronologically and calculate burned mass via diffs
    allLogs.sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16))

    // Get initial mass via archive call (token's mass before first merge)
    const contract = getContract()
    if (allLogs.length > 0) {
      const firstBlock = parseInt(allLogs[0].blockNumber, 16)
      try {
        const value = await contract.getValueOf(tokenId, { blockTag: firstBlock - 1 })
        initialMass.value = decodeValue(value).mass
      } catch {
        initialMass.value = 1 // fallback if archive call fails
      }
    } else {
      try {
        const value = await contract.getValueOf(tokenId)
        initialMass.value = decodeValue(value).mass
      } catch {
        initialMass.value = null
      }
    }

    // Fetch class of each burned token via archive calls (batch of 5)
    const burnedClasses = {}
    for (let i = 0; i < allLogs.length; i += 5) {
      const batch = allLogs.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(async (log) => {
          const bid = parseInt(log.topics[1], 16)
          const block = parseInt(log.blockNumber, 16)
          const val = await contract.getValueOf(bid, { blockTag: block - 1 })
          return { id: bid, class: decodeValue(val).class }
        })
      )
      for (const r of results) {
        if (r.status === 'fulfilled') burnedClasses[r.value.id] = r.value.class
      }
    }

    let runningMass = initialMass.value
    timeline.value = allLogs.map((log) => {
      const burnedId = parseInt(log.topics[1], 16)
      const eventMass = parseInt(log.data, 16)
      const burnedMass = Math.max(eventMass - runningMass, 1)
      runningMass = eventMass
      return {
        tokenId: burnedId,
        mass: burnedMass,
        tierClass: burnedClasses[burnedId] || 1,
        date: new Date(parseInt(log.timeStamp, 16) * 1000).toISOString(),
      }
    })
  } catch (err) {
    console.error('[useTokenMergeTimeline] failed:', err)
    timeline.value = []
  }

  return { timeline, initialMass }
}
