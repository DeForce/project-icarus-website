<script setup lang="ts">
const props = defineProps<{
  modelValue: number | null
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const NBSP = '\u00A0'

/** Groups digits in threes with non-breaking spaces: 10000000 -> 10 000 000. */
function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

function parseInteger(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  if (digits === '') return null
  return Math.min(Number(digits), Number.MAX_SAFE_INTEGER)
}

const display = ref('')

watch(
  () => props.modelValue,
  (value) => {
    display.value = value === null ? '' : groupDigits(String(value))
  },
  { immediate: true },
)

function onInput(event: Event) {
  const parsed = parseInteger((event.target as HTMLInputElement).value)
  emit('update:modelValue', parsed)
  display.value = parsed === null ? '' : groupDigits(String(parsed))
}
</script>

<template>
  <input v-model="display" type="text" inputmode="numeric" class="terminal-input" :disabled="disabled" @input="onInput">
</template>
