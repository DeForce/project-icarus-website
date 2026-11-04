<script setup lang="ts">
import { ofetch } from 'ofetch'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const navItems = computed(() => [
  { to: '/admin', label: t('admin.chanceryNav') },
  { to: '/admin/import', label: t('admin.import') },
])

const isLoginPage = computed(() => route.path === '/admin/login')

async function logout() {
  await ofetch('/api/admin/session', { method: 'DELETE' })
  void router.replace('/admin/login')
}
</script>

<template>
  <div class="terminal-shell shell-admin">
    <header class="terminal-header">
      <AppCrown :size="22" class="shell-crown" />
      <span class="terminal-header-ministry">{{ t('app.ministry') }} ·{{ t('admin.serviceAccess') }}</span>
      <span class="terminal-header-title">{{ t('admin.board') }}</span>
      <nav v-if="!isLoginPage" class="terminal-nav">
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" class="terminal-nav-link" active-class="is-active">
          {{ item.label }}
        </NuxtLink>
        <button type="button" class="terminal-nav-link terminal-nav-login nav-button" @click="logout">
          {{ t('admin.logout') }}
        </button>
      </nav>
    </header>
    <main class="terminal-main">
      <slot />
    </main>
    <footer class="terminal-footer">
      <span>{{ t('app.footer') }} ·{{ t('admin.serviceMode') }}</span>
    </footer>
  </div>
</template>

<style scoped>
.shell-crown {
  color: var(--terminal-dim);
}

.shell-admin .terminal-header {
  border-bottom-style: solid;
  border-bottom-width: 1px;
}

.nav-button {
  background: none;
  border: none;
  font: inherit;
  cursor: pointer;
  padding: 2px 8px;
}

.nav-button:hover {
  color: var(--terminal-brass);
}
</style>
