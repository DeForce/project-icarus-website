<script setup lang="ts">
import { changeHref } from '~/utils/package-change-link'

const { t } = useI18n()
const route = useRoute()

const { data, error } = useFetch(() => `/api/public/packages/${route.params.id}`, {
  default: () => null,
})

const changeLinks = computed(() => {
  const changes = data.value?.changes ?? []
  return changes.map((change) => ({ change, href: changeHref(change) }))
})
</script>

<template>
  <section class="panel">
    <template v-if="data">
      <h1>#{{ data.sequence }} ·{{ data.title }}</h1>
      <p class="terminal-dim">{{ t('packages.received') }} {{ data.receivedDate }}</p>
      <p v-if="data.publicSummary" class="terminal-lead">{{ data.publicSummary }}</p>
      <h2>{{ t('packages.changes') }}</h2>
      <p v-if="data.changes.length === 0" class="terminal-dim">{{ t('packages.changesEmpty') }}</p>
      <ul v-else class="change-list">
        <li v-for="{ change, href } in changeLinks" :key="change.entityId">
          <span class="terminal-dim">[{{ t(`packages.operation.${change.operation}`) }}]</span>
          <NuxtLink v-if="href !== null" :to="href">{{ change.name }}</NuxtLink>
          <span v-else>{{ change.name }}</span>
        </li>
      </ul>
      <NuxtLink class="terminal-button" to="/packages">{{ t('packages.heading') }}</NuxtLink>
    </template>
    <template v-else-if="error">
      <h1>{{ t('error.notFound') }}</h1>
      <NuxtLink class="terminal-button" to="/packages">{{ t('packages.heading') }}</NuxtLink>
    </template>
    <p v-else class="terminal-dim">{{ t('archive.searching') }}</p>
  </section>
</template>
