<script setup lang="ts">
import { SelectContent, SelectItem, SelectPortal, SelectRoot, SelectTrigger, SelectValue } from 'reka-ui'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const searchInput = ref(typeof route.query.q === 'string' ? route.query.q : '')
const debouncedSearch = ref(searchInput.value)
const categoryFilter = ref('')
const sort = ref<'received' | 'title' | 'category'>('received')
const searchField = ref<HTMLInputElement | null>(null)

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

const sortOptions = computed(
  () =>
    [
      { value: 'received', label: t('archive.sortReceived') },
      { value: 'title', label: t('archive.sortTitle') },
      { value: 'category', label: t('archive.sortCategory') },
    ] as const,
)

const categoryName = (categoryId: string) =>
  data.value.categories.find((category) => category.id === categoryId)?.name ?? t('archive.uncategorized')

const visibleArticles = computed(() => {
  const query = debouncedSearch.value.trim().toLowerCase()
  const filtered = categoryFilter.value
    ? data.value.articles.filter((article) => article.categoryId === categoryFilter.value)
    : [...data.value.articles]

  const byTitle = (left: { title: string }, right: { title: string }) => left.title.localeCompare(right.title, 'ru')
  filtered.sort((left, right) => {
    if (sort.value === 'title') return byTitle(left, right)
    if (sort.value === 'category') {
      const byCategory = categoryName(left.categoryId).localeCompare(categoryName(right.categoryId), 'ru')
      return byCategory !== 0 ? byCategory : byTitle(left, right)
    }
    return (left.receivedDate ?? '').localeCompare(right.receivedDate ?? '') || byTitle(left, right)
  })

  // Pin highlighted (title-matching) hits on top when searching, mirroring server relevance.
  if (query !== '') {
    filtered.sort((left, right) => Number(right.title.toLowerCase().includes(query)) - Number(left.title.toLowerCase().includes(query)))
  }
  return filtered
})

interface Segment {
  text: string
  hit: boolean
}

function highlightSegments(title: string): Segment[] {
  const query = debouncedSearch.value.trim().toLowerCase()
  if (query === '') return [{ text: title, hit: false }]
  const index = title.toLowerCase().indexOf(query)
  if (index < 0) return [{ text: title, hit: false }]
  return [
    { text: title.slice(0, index), hit: false },
    { text: title.slice(index, index + query.length), hit: true },
    { text: title.slice(index + query.length), hit: false },
  ].filter((segment) => segment.text !== '')
}

function onGlobalKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (event.key !== '/' || (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
  event.preventDefault()
  searchField.value?.focus()
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  clearTimeout(debounceTimer)
})
</script>

<template>
  <section class="panel">
    <h1>{{ t('archive.heading') }}</h1>

    <div class="archive-toolbar">
      <div class="archive-search-row">
        <div class="archive-search-wrap">
          <input
            ref="searchField"
            v-model="searchInput"
            type="search"
            class="terminal-input archive-search"
            :placeholder="t('archive.searchPlaceholder')"
          >
          <span class="archive-kbd-hint">{{ t('archive.searchKeyHint') }}</span>
        </div>
        <SelectRoot v-model="sort">
          <SelectTrigger class="terminal-input" :aria-label="t('archive.sortLabel')">
            <SelectValue />
          </SelectTrigger>
          <SelectPortal>
            <SelectContent position="popper" class="select-content">
              <SelectItem v-for="option in sortOptions" :key="option.value" :value="option.value" class="picker-option">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>
      </div>

      <div class="archive-chips">
        <button type="button" class="chip" :class="{ on: categoryFilter === '' }" @click="categoryFilter = ''">
          {{ t('archive.allCategories') }}
        </button>
        <button
          v-for="category in data.categories"
          :key="category.id"
          type="button"
          class="chip"
          :class="{ on: categoryFilter === category.id }"
          @click="categoryFilter = category.id"
        >
          {{ category.name }}
        </button>
      </div>

      <p class="archive-result-line">
        {{ t('archive.found', { count: visibleArticles.length }) }}
      </p>
    </div>

    <p v-if="pending && debouncedSearch" class="terminal-dim">{{ t('archive.searching') }}</p>
    <p v-else-if="error" class="terminal-error">{{ t('error.loadFailed') }}</p>
    <div v-else-if="visibleArticles.length === 0" class="archive-empty">
      <b>{{ t('archive.empty') }}</b>
      <br>
      <span class="terminal-dim">{{ t('archive.emptyHint') }}</span>
    </div>
    <ul v-else class="archive-list">
      <li v-for="article in visibleArticles" :key="article.id">
        <NuxtLink :to="`/archive/${article.id}`" class="archive-list-link">
          <span class="archive-list-title">
            <template v-for="(segment, index) in highlightSegments(article.title)" :key="index">
              <mark v-if="segment.hit">{{ segment.text }}</mark>
              <template v-else>{{ segment.text }}</template>
            </template>
          </span>
          <span class="archive-list-meta">
            <span>{{ categoryName(article.categoryId) }}</span>
            <span v-if="article.receivedDate">{{ article.receivedDate }}</span>
          </span>
          <span class="archive-list-summary">{{ article.summary }}</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
