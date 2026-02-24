import { BrowserProvider } from "ethers"
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider, useAppKit, useDisconnect } from "@reown/appkit/vue"

export function useWallet() {
  // Global state — same pattern as useDB.js (useState = Nuxt SSR-safe global ref)
  const address = useState("walletAddress", () => null)
  const isConnected = useState("walletConnected", () => false)
  const chainId = useState("walletChainId", () => null)

  // Call AppKit composables synchronously (required by Vue's composition rules).
  // With ssr:false this always runs on the client at runtime.
  // The try/catch covers the nuxt generate prerender pass where the plugin hasn't run.
  try {
    const account = useAppKitAccount()
    const network = useAppKitNetwork()

    watchEffect(() => {
      address.value = account.value?.address ?? null
      isConnected.value = account.value?.isConnected ?? false
      chainId.value = network.value?.chainId ?? null
    })
  } catch {
    // AppKit not initialized (nuxt generate prerender pass) — silent fallback
  }

  // Get ethers v6 Signer from the connected wallet provider
  async function getSigner() {
    const { walletProvider } = useAppKitProvider("eip155")
    if (!walletProvider.value) throw new Error("No wallet provider available")
    const provider = new BrowserProvider(walletProvider.value, chainId.value ?? "any")
    return await provider.getSigner()
  }

  function openModal() {
    const { open } = useAppKit()
    open()
  }

  function disconnect() {
    const { disconnect: _disconnect } = useDisconnect()
    _disconnect()
  }

  const isMainnet = computed(() => chainId.value === 1)

  const shortAddress = computed(() => {
    if (!address.value) return null
    return address.value.slice(0, 6) + "…" + address.value.slice(-4)
  })

  return {
    address,
    isConnected,
    chainId,
    isMainnet,
    shortAddress,
    getSigner,
    openModal,
    disconnect,
  }
}
