import { ethers } from "ethers"
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI, decodeValue } from "~/utils/contract.mjs"

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

    const [value, mergeCount, exists] = await Promise.all([
      contract.getValueOf(tokenId),
      contract.getMergeCount(tokenId),
      contract.exists(tokenId),
    ])

    const { class: classVal, mass } = decodeValue(value)

    token.value = {
      id: Number(tokenId),
      mass,
      class: classVal,
      tier: classVal, // class = tier directly
      merges: Number(mergeCount),
      merged: !exists,
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
    const contract = getContract()
    // Check MassUpdate events where this token was burned
    const filter = contract.filters.MassUpdate(tokenId)
    const events = await contract.queryFilter(filter)

    if (events.length > 0) {
      const event = events[events.length - 1]
      const persistId = Number(event.args[1])
      const block = await event.getBlock()

      mergedTo.value = persistId
      mergedOn.value = new Date(block.timestamp * 1000).toISOString()
    }
  } catch {
    // Token was not merged or query failed
  }

  return { mergedTo, mergedOn }
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
