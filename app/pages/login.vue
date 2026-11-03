<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <section class="panel">
    <h1>{{ t('login.crewHeading') }}</h1>
    <p class="terminal-dim">{{ t('login.crewUnavailable') }}</p>
  </section>
</template>
