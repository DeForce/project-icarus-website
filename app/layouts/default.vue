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

const tabIcons: Record<string, string> = {
  '/': '▦',
  '/archive': '≡',
  '/map': '✦',
  '/packages': '▤',
}
</script>

<template>
  <div class="terminal-shell">
    <header class="terminal-header">
      <AppCrown :size="22" class="shell-crown" />
      <span class="terminal-header-ministry">{{ t('app.ministry') }}</span>
      <span class="terminal-header-title">{{ t('app.title') }}</span>
      <span class="terminal-header-ship">{{ shipName }}</span>
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
      <slot />
    </main>
    <footer class="terminal-footer">
      <span>{{ t('app.footer') }}</span>
      <NuxtLink to="/admin/login" class="terminal-footer-service">{{ t('app.serviceAccess') }}</NuxtLink>
    </footer>
    <nav class="tabbar" aria-label="terminal-tabs">
      <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" active-class="active">
        <span class="tabbar-ico" aria-hidden="true">{{ tabIcons[item.to] }}</span>
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.shell-crown {
  color: var(--terminal-brass);
}
</style>
