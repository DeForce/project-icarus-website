export default defineNuxtConfig({
  compatibilityDate: '2026-11-03',
  ssr: true,
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [{ code: 'ru', language: 'ru-RU', file: 'ru.json' }],
    defaultLocale: 'ru',
    strategy: 'no_prefix',
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
})
