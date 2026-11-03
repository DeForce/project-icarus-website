<script setup lang="ts">
defineProps<{ problems: ReadonlyArray<{ path: string; message: string }> }>()

const { t } = useI18n()
</script>

<template>
  <div v-if="problems.length > 0" class="problem-list">
    <p class="terminal-error">{{ t('import.problems') }}:</p>
    <ul>
      <li v-for="(problem, index) in problems" :key="index"><code>{{ problem.path }}</code> —{{ problem.message }}</li>
    </ul>
  </div>
</template>
