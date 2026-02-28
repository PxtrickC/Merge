import { BrowserProvider, JsonRpcProvider, Contract } from 'ethers'
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI } from '~/utils/contract.mjs'

export function useWallet() {
  const address = useState('walletAddress', () => null)
  const isConnected = useState('walletConnected', () => false)
  const myTokenId = useState('walletTokenId', () => null)

  // Subscribe to AppKit account changes (client-side only)
  if (import.meta.client) {
    const { $appkit } = useNuxtApp()
    if ($appkit) {
      $appkit.subscribeAccount((account) => {
        const newAddr = account?.address || null
        const wasConnected = isConnected.value
        address.value = newAddr
        isConnected.value = !!account?.isConnected

        if (account?.isConnected && newAddr) {
          fetchMyToken(newAddr)
        } else if (wasConnected && !account?.isConnected) {
          myTokenId.value = null
        }
      })
    }
  }

  async function fetchMyToken(addr) {
    try {
      const config = useRuntimeConfig()
      const provider = new JsonRpcProvider(
        `https://eth-mainnet.g.alchemy.com/v2/${config.public.ALCHEMY_API_KEY}`
      )
      const contract = new Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)
      const id = await contract.tokenOf(addr)
      myTokenId.value = Number(id)
    } catch {
      myTokenId.value = 0 // no Merge token
    }
  }

  async function getSigner() {
    if (!import.meta.client) throw new Error('Client-side only')
    if (!window.ethereum) throw new Error('No wallet detected')
    const provider = new BrowserProvider(window.ethereum)
    return provider.getSigner()
  }

  async function getProvider() {
    if (!import.meta.client) throw new Error('Client-side only')
    if (!window.ethereum) throw new Error('No wallet detected')
    return new BrowserProvider(window.ethereum)
  }

  function openModal() {
    if (!import.meta.client) return
    const { $appkit } = useNuxtApp()
    if ($appkit) {
      $appkit.open()
    }
  }

  function disconnect() {
    if (!import.meta.client) return
    const { $appkit } = useNuxtApp()
    if ($appkit) {
      $appkit.open({ view: 'Account' })
    }
  }

  function shortAddress(addr) {
    if (!addr) return ''
    return addr.slice(0, 6) + '...' + addr.slice(-4)
  }

  return {
    address,
    isConnected,
    myTokenId,
    getSigner,
    getProvider,
    openModal,
    disconnect,
    shortAddress,
  }
}
