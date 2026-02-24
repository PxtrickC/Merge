import package_json from "./package.json"
import { nodePolyfills } from "vite-plugin-node-polyfills"

export default defineNuxtConfig({
    ssr: false,
    
    nitro: { compressPublicAssets: true },

    runtimeConfig: {
        public: {
            API_URL: "",
            CACHE_PROXY_URL: "",
            ALCHEMY_API_KEY: "",
            ETHERSCAN_API_KEY: "",
            VERSION: package_json.version,
            REOWN_PROJECT_ID: "",
            RESERVOIR_API_KEY: "",
            PLATFORM_FEE_ADDRESS: "",
            PLATFORM_FEE_BPS: "50",
        }
    },

    vite: {
        plugins: [
            nodePolyfills(),
        ],
        define: { global: "globalThis" },
        optimizeDeps: {
            // Exclude packages that use import-attributes syntax (requires esbuild 0.21+)
            // @base-org/account (via @coinbase/wallet-sdk) uses `import x with { type: 'json' }`
            // which is unsupported in Vite 4's bundled esbuild 0.19.x
            exclude: ["@base-org/account", "@coinbase/wallet-sdk"],
            include: [
                "events",
                "dayjs",
                "dayjs/locale/en.js",
                "dayjs/plugin/relativeTime.js",
                "dayjs/plugin/updateLocale.js",
                "@walletconnect/core",
                "@walletconnect/environment",
                "@walletconnect/events",
                "@walletconnect/heartbeat",
                "@walletconnect/jsonrpc-http-connection",
                "@walletconnect/jsonrpc-provider",
                "@walletconnect/jsonrpc-types",
                "@walletconnect/jsonrpc-utils",
                "@walletconnect/jsonrpc-ws-connection",
                "@walletconnect/keyvaluestorage",
                "@walletconnect/logger",
                "@walletconnect/relay-api",
                "@walletconnect/relay-auth",
                "@walletconnect/safe-json",
                "@walletconnect/sign-client",
                "@walletconnect/time",
                "@walletconnect/types",
                "@walletconnect/universal-provider",
                "@walletconnect/utils",
                "@walletconnect/window-getters",
                "@walletconnect/window-metadata",
                "@reown/appkit-common",
                "@reown/appkit",
                "@reown/appkit-adapter-ethers",
                "@reservoir0x/reservoir-sdk",
                "qrcode",
            ],
        },
    },

    build: {
        transpile: ["@reown/appkit", "@reown/appkit-adapter-ethers"],
    },

    modules: [
        ['@nuxtjs/tailwindcss'],
        ['@pinia/nuxt', { autoImports: ['defineStore', 'acceptHMRUpdate'] }]
    ],

    imports: {
        dirs: ['stores'],
    },

    css: [
        "@/assets/css/base.postcss"
    ],

    app: {
        head: {
            title: 'Merge',
            htmlAttrs: { lang: 'en' },
            link: [
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.png' },
                { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
                { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
                { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&display=swap' },
            ],
            meta: [
                { property: 'og:type', content: 'website' },
                { property: 'og:site_name', content: 'Merge' },
                
                { name: 'author', content: 'Tina Wang' },
                { name: 'twitter:creator', content: '@ItsTinaWang' },

                { name: 'twitter:site', content: 'https://merge.tina.cafe/' },
                { name: 'twitter:title', content: 'Merge' },
                { name: 'twitter:description', content: 'Metadata Dashboard' },
                { hid: 'og:title', property: 'og:title', content: 'Merge' },
                { hid: 'description', name: 'description', content: 'Metadata Dashboard' },
                { hid: 'og:description', property: 'og:description', content: 'Metadata Dashboard' },

                { hid: 'og:url', property: 'og:url', content: 'https://merge.tina.cafe/' },
                { hid: 'keywords', name: 'keywords', content: 'Merge NFT pak dashboard meta data' },

                { name: 'twitter:card', content: 'summary' },
                { name: 'twitter:image', content: '/preview.jpg' },
                { property: 'og:image', content: '/preview.jpg' },
                { property: 'og:image:width', content: '630' },
                { property: 'og:image:height', content: '630' },
            ]
        }
    }
})
