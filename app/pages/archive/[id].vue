<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { data, error } = useFetch(() => `/api/public/articles/${route.params.id}`, {
  default: () => null,
})
</script>

<template>
  <section>
    <template v-if="data">
      <nav class="crumbs" :aria-label="t('archive.crumbsLabel')">
        <NuxtLink to="/archive">{{ t('nav.archive') }}</NuxtLink>
        <span>/{{ data.categoryName }} /{{ data.title }}</span>
      </nav>

      <article class="document">
        <div v-if="data.receivedDate" class="document-stamp">
          {{ t('archive.receivedStamp') }}
          <br>
          {{ data.receivedDate }}
        </div>

        <div class="document-head">
          <h1 class="serif">{{ data.title }}</h1>
          <div class="document-reg">
            {{ data.categoryName }}
            <span v-if="data.receivedDate">·{{ data.receivedDate }}</span>
          </div>
        </div>

        <MarkdownBody :markdown="data.bodyMarkdown" />

        <div v-if="data.relatedArticles.length > 0" class="document-related">
          <b>{{ t('archive.related') }}</b>
          <NuxtLink v-for="related in data.relatedArticles" :key="related.id" :to="`/archive/${related.id}`">
            {{ related.title }}
          </NuxtLink>
        </div>
      </article>

      <NuxtLink class="terminal-button" to="/archive">{{ t('archive.back') }}</NuxtLink>
    </template>

    <section v-else-if="error" class="panel">
      <h1>{{ t('error.notFound') }}</h1>
      <NuxtLink class="terminal-button" to="/archive">{{ t('archive.back') }}</NuxtLink>
    </section>
    <p v-else class="terminal-dim">{{ t('archive.searching') }}</p>
  </section>
</template>
