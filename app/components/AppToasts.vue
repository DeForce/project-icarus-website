<script setup lang="ts">
import { ToastDescription, ToastRoot, ToastTitle, useToastManager } from 'reka-ui'

const { toasts } = useToastManager()
</script>

<template>
  <ToastRoot v-for="toast in toasts" :key="toast.id" :toast="toast" class="toast-root">
    <ToastTitle class="toast-title" />
    <ToastDescription v-if="toast.description" class="toast-description" />
  </ToastRoot>
</template>
