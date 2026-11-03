<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { data, error } = useFetch(() => `/api/public/articles/${route.params.id}`, {
  default: () => null,
})
</script>

<template>
  <section class="panel">
    <template v-if="data">
      <h1>{{ data.title }}</h1>
      <p class="terminal-dim">{{ data.categoryName }}</p>
      <MarkdownBody :markdown="data.bodyMarkdown" />
      <nav v-if="data.relatedArticles.length > 0" class="related-nav">
        <h2>{{ t('archive.related') }}</h2>
        <ul>
          <li v-for="related in data.relatedArticles" :key="related.id">
            <NuxtLink :to="`/archive/${related.id}`">{{ related.title }}</NuxtLink>
          </li>
        </ul>
      </nav>
      <NuxtLink class="terminal-button" to="/archive">{{ t('archive.back') }}</NuxtLink>
    </template>
    <template v-else-if="error">
      <h1>{{ t('error.notFound') }}</h1>
      <NuxtLink class="terminal-button" to="/archive">{{ t('archive.back') }}</NuxtLink>
    </template>
    <p v-else class="terminal-dim">{{ t('archive.searching') }}</p>
  </section>
</template>
