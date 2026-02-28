import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet } from '@reown/appkit/networks'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const projectId = config.public.WALLETCONNECT_PROJECT_ID
  if (!projectId) {
    console.warn('[AppKit] WALLETCONNECT_PROJECT_ID not set, wallet connection disabled')
    return
  }

  try {
    const appkit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [mainnet],
      projectId,
      metadata: {
        name: 'Merge',
        description: 'Merge NFT Dashboard & Marketplace',
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.png`],
      },
      features: {
        analytics: false,
      },
    })

    return { provide: { appkit } }
  } catch (err) {
    console.error('[AppKit] Failed to initialize:', err)
  }
})
