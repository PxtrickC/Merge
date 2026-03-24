import package_json from "./package.json"
import { readFileSync } from 'node:fs'

// esbuild plugin: strip `import ... with { type: 'json' }` syntax
// (needed because Vite 4's esbuild doesn't support import attributes)
const stripImportAttributes = {
    name: 'strip-import-attributes',
    setup(build) {
        build.onLoad({ filter: /node_modules[\\/]@base-org[\\/].*\.js$/ }, (args) => {
            let code = readFileSync(args.path, 'utf8')
            code = code.replace(/\bwith\s*\{\s*type\s*:\s*['"]json['"]\s*\}/g, '')
            return { contents: code, loader: 'js' }
        })
    },
}

export default defineNuxtConfig({
    ssr: true,
    routeRules: {
        '/': { ssr: false },
        '/dashboard/**': { ssr: false },
        '/leaderboard/**': { ssr: false },
        '/market/**': { ssr: false },
        '/about/**': { ssr: false },
    },

    nitro: { compressPublicAssets: true },

    runtimeConfig: {
        OPENSEA_API_KEY: "",
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
        public: {
            API_URL: "",
            CACHE_PROXY_URL: "",
            ALCHEMY_API_KEY: "",
            ETHERSCAN_API_KEY: "",
            WALLETCONNECT_PROJECT_ID: "",
            PLATFORM_FEE_WALLET: "",
            VAPID_PUBLIC_KEY: "",
            VERSION: package_json.version,
        }
    },

    build: {
        transpile: [],
    },

    devServer: {
        port: 3000,
    },

    hooks: {
        'vite:extendConfig'(config, { isClient }) {
            // Force HMR to use the dev server port (Nuxt defaults to a separate port 24678)
            if (isClient && config.server?.hmr && typeof config.server.hmr === 'object') {
                config.server.hmr.port = 3000
            }
        },
    },

    vite: {
        optimizeDeps: {
            esbuildOptions: {
                plugins: [stripImportAttributes],
            },
        },
    },

    modules: [
        ['@nuxtjs/tailwindcss'],
        ['@pinia/nuxt', { autoImports: ['defineStore', 'acceptHMRUpdate'] }],
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
            script: [
                { src: 'https://www.googletagmanager.com/gtag/js?id=G-QNXJ1ESRDL', async: true },
                { innerHTML: "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-QNXJ1ESRDL')" },
                {
                    type: 'application/ld+json',
                    innerHTML: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "WebApplication",
                        "name": "Merge Dashboard",
                        "url": "https://merge.ppatrick.xyz",
                        "description": "Live dashboard for Merge by Pak — a deflationary NFT collection. Track supply, alpha mass, tier survival, leaderboards, and trade tokens via Seaport.",
                        "applicationCategory": "FinanceApplication",
                        "operatingSystem": "Web",
                        "author": { "@type": "Person", "name": "Tina Wang" },
                        "about": {
                            "@type": "CreativeWork",
                            "name": "Merge",
                            "creator": { "@type": "Person", "name": "Pak" },
                            "description": "Merge is a deflationary NFT where tokens merge on transfer, reducing total supply over time. Started with 28,990 tokens."
                        }
                    }),
                },
            ],
            link: [
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.png' },
                { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png', sizes: '180x180' },
                { rel: 'manifest', href: '/manifest.webmanifest' },
                { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
                { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
                { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&display=swap' },
            ],
            meta: [
                { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
                { name: 'theme-color', content: '#0a0a0a' },
                { name: 'apple-mobile-web-app-capable', content: 'yes' },
                { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
                { property: 'og:type', content: 'website' },
                { property: 'og:site_name', content: 'merge.' },

                { name: 'author', content: 'Tina Wang' },
                { name: 'twitter:creator', content: '@pxtrickpin' },

                { name: 'twitter:site', content: 'https://merge.ppatrick.xyz' },
                { name: 'twitter:title', content: 'merge by pak' },
                { name: 'twitter:description', content: 'Merge is a game of extinction.' },
                { hid: 'og:title', property: 'og:title', content: 'merge by pak' },
                { hid: 'description', name: 'description', content: 'Merge is a game of extinction.' },
                { hid: 'og:description', property: 'og:description', content: 'Merge is a game of extinction.' },

                { hid: 'og:url', property: 'og:url', content: 'https://merge.ppatrick.xyz' },
                { hid: 'keywords', name: 'keywords', content: 'Merge NFT pak dashboard meta data' },

                { hid: 'twitter:card', name: 'twitter:card', content: 'summary_large_image' },
                { hid: 'twitter:image', name: 'twitter:image', content: '/images/og-preview.jpg' },
                { hid: 'og:image', property: 'og:image', content: '/images/og-preview.jpg' },
                { hid: 'og:image:width', property: 'og:image:width', content: '1400' },
                { hid: 'og:image:height', property: 'og:image:height', content: '787' },
            ]
        }
    }
})
