export default defineNuxtConfig({
  compatibilityDate: '2026-08-28',
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  typescript: {
    strict: true,
    typeCheck: true
  },
  runtimeConfig: {
    databasePath: process.env.DATABASE_PATH || '.data/vuag.db',
    marketCacheTtlMs: Number(process.env.MARKET_CACHE_TTL_MS || 900000),
    demoMode: process.env.DEMO_MODE === 'true',
    public: {
      refreshIntervalMs: Number(process.env.NUXT_PUBLIC_REFRESH_INTERVAL_MS || 900000)
    }
  },
  nitro: {
    preset: 'node-server'
  },
  app: {
    head: {
      title: 'VUAG Portfolio',
      meta: [
        { name: 'description', content: 'A private fantasy VUAG portfolio and UK tax exposure tracker.' },
        { name: 'theme-color', content: '#0b1120' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192x192.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
      ]
    }
  },
  ui: {
    colorMode: true
  }
})
