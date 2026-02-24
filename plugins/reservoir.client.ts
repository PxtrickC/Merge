import { createClient } from "@reservoir0x/reservoir-sdk"

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  createClient({
    chains: [
      {
        id: 1,
        baseApiUrl: "https://api.reservoir.tools",
        default: true,
        apiKey: config.public.RESERVOIR_API_KEY || undefined,
      },
    ],
  })
})
