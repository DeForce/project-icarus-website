<script setup lang="ts">
const { t } = useI18n()
const { data, error } = useFetch('/api/public/packages', {
  default: () => [],
})
</script>

<template>
  <section class="panel">
    <h1>{{ t('packages.heading') }}</h1>
    <p v-if="error" class="terminal-error">{{ t('error.loadFailed') }}</p>
    <p v-else-if="data.length === 0" class="terminal-dim">{{ t('packages.empty') }}</p>
    <ul v-else class="package-list">
      <li v-for="entry in data" :key="entry.id">
        <NuxtLink :to="`/packages/${entry.id}`" class="package-list-link">
          <span class="package-list-seq">#{{ entry.sequence }}</span>
          <span class="archive-list-title">{{ entry.title }}</span>
          <span class="terminal-dim">{{ t('packages.received') }} {{ entry.receivedDate }}</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
