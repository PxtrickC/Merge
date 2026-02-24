import { createAppKit } from "@reown/appkit/vue"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import { mainnet } from "@reown/appkit/networks"

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [mainnet],
    projectId: config.public.REOWN_PROJECT_ID || "placeholder-project-id",
    metadata: {
      name: "Merge",
      description: "Merge NFT Dashboard",
      url: "https://merge.tina.cafe",
      icons: ["/favicon.png"],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#3333ff",
      "--w3m-border-radius-master": "2px",
    },
  })
})
