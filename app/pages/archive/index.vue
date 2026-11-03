<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const searchInput = ref(typeof route.query.q === 'string' ? route.query.q : '')
const debouncedSearch = ref(searchInput.value)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = value
    void router.replace({ query: value ? { q: value } : {} })
  }, 250)
})

const { data, pending, error } = useFetch('/api/public/archive', {
  query: computed(() => ({ search: debouncedSearch.value })),
  default: () => ({ categories: [], articles: [] }),
})

const categoryName = (categoryId: string) =>
  data.value.categories.find((category) => category.id === categoryId)?.name ?? t('archive.uncategorized')
</script>

<template>
  <section class="panel">
    <h1>{{ t('archive.heading') }}</h1>
    <input v-model="searchInput" type="search" class="terminal-input archive-search" :placeholder="t('archive.searchPlaceholder')">
    <p v-if="pending && debouncedSearch" class="terminal-dim">{{ t('archive.searching') }}</p>
    <p v-else-if="error" class="terminal-error">{{ t('error.loadFailed') }}</p>
    <p v-else-if="data.articles.length === 0" class="terminal-dim">{{ t('archive.empty') }}</p>
    <ul v-else class="archive-list">
      <li v-for="article in data.articles" :key="article.id">
        <NuxtLink :to="`/archive/${article.id}`" class="archive-list-link">
          <span class="archive-list-title">{{ article.title }}</span>
          <span class="archive-list-meta">{{ categoryName(article.categoryId) }}</span>
          <span class="archive-list-summary">{{ article.summary }}</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
