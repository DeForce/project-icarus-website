<script setup lang="ts">
const { t } = useI18n()
const { data: campaign } = useFetch('/api/public/campaign', {
  default: () => ({ shipName: '', currentDate: '' }),
})
const shipName = computed(() => campaign.value.shipName || t('app.shipFallback'))

const navItems = computed(() => [
  { to: '/', label: t('nav.services') },
  { to: '/archive', label: t('nav.archive') },
  { to: '/map', label: t('nav.map') },
  { to: '/packages', label: t('nav.packages') },
])
</script>

<template>
  <div class="terminal-shell">
    <header class="terminal-header">
      <span class="terminal-header-ship">{{ shipName }}</span>
      <span class="terminal-header-title">{{ t('app.title') }}</span>
      <nav class="terminal-nav">
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" class="terminal-nav-link" active-class="is-active">
          {{ item.label }}
        </NuxtLink>
        <NuxtLink to="/login" class="terminal-nav-link terminal-nav-login" active-class="is-active">
          {{ t('nav.login') }}
        </NuxtLink>
      </nav>
    </header>
    <main class="terminal-main">
      <NuxtPage />
    </main>
    <footer class="terminal-footer">
      <span>{{ t('app.footer') }}</span>
      <NuxtLink to="/admin/login" class="terminal-footer-service">{{ t('app.serviceAccess') }}</NuxtLink>
    </footer>
  </div>
</template>
