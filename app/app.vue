<script setup lang="ts">
import { ToastProvider, ToastViewport } from 'reka-ui'
</script>

<template>
  <ToastProvider>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ToastViewport class="toast-viewport" />
  </ToastProvider>
</template>

<!-- biome-ignore lint/suspicious/useScopedStyles: the toast viewport renders outside this component tree. -->
<style>
.toast-viewport {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 50;
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
