<script setup lang="ts">
import MarkdownIt from 'markdown-it'

const props = defineProps<{ markdown: string }>()

const renderer = new MarkdownIt({ html: false, linkify: true, breaks: false })
const html = computed(() => renderer.render(props.markdown))
</script>

<template>
  <ClientOnly>
    <div class="markdown-body" v-html="html" />
    <template #fallback>
      <pre class="markdown-fallback">{{ markdown }}</pre>
    </template>
  </ClientOnly>
</template>
