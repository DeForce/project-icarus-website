<script setup lang="ts">
import { ToastProvider, ToastViewport } from 'reka-ui'
</script>

<template>
  <ToastProvider>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <AppToasts />
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

.toast-root {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--terminal-panel);
  border: 1px solid var(--terminal-border);
  border-top: 3px solid var(--terminal-brass);
  padding: 12px 16px;
  color: var(--terminal-text);
  font-family: var(--terminal-font);
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.toast-title {
  color: var(--terminal-brass);
  letter-spacing: 0.04em;
}

.toast-description {
  color: var(--terminal-dim);
}
</style>
