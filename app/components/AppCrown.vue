<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 22 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="app-crown"
  >
    <path d="M3 18h18" />
    <path d="M4 18 3 8l4.5 3.5L12 5l4.5 6.5L21 8l-1 10" />
    <path d="M5.5 21h13" />
    <circle cx="12" cy="9.5" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="4.6" cy="10.5" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="19.4" cy="10.5" r="0.6" fill="currentColor" stroke="none" />
  </svg>
</template>
