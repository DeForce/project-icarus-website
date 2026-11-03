<script setup lang="ts">
interface Option {
  id: string
  name: string
}

const props = defineProps<{
  /** Single mode: selected id or null. Multi mode: selected ids. */
  modelValue: string | null | string[]
  options: ReadonlyArray<Option>
  multiple?: boolean
  /** Single mode only: allow clearing the selection back to null. */
  nullable?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | null | string[]] }>()

const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const filterText = ref('')
const open = ref(false)
const activeIndex = ref(0)

const isMulti = computed(() => props.multiple === true)

const selectedIds = computed(() => (isMulti.value ? (props.modelValue as string[]) : []))

const selectedSingle = computed(() => {
  if (isMulti.value || props.modelValue === null) return null
  return props.options.find((option) => option.id === props.modelValue) ?? null
})

const selectedOptions = computed(() => props.options.filter((option) => selectedIds.value.includes(option.id)))

const visibleOptions = computed(() => {
  const filter = filterText.value.trim().toLowerCase()
  return props.options.filter((option) => {
    if (isMulti.value && selectedIds.value.includes(option.id)) return false
    return filter === '' || option.name.toLowerCase().includes(filter)
  })
})

watch(visibleOptions, () => {
  activeIndex.value = 0
})

function pick(option: Option) {
  if (isMulti.value) {
    emit('update:modelValue', [...selectedIds.value, option.id])
    filterText.value = ''
    activeIndex.value = 0
  } else {
    emit('update:modelValue', option.id)
    closeAndShowSelection()
  }
}

function remove(optionId: string) {
  if (!isMulti.value) return
  emit(
    'update:modelValue',
    selectedIds.value.filter((id) => id !== optionId),
  )
}

function clear() {
  emit('update:modelValue', null)
  filterText.value = ''
}

function closeAndShowSelection() {
  open.value = false
  filterText.value = selectedSingle.value?.name ?? ''
}

function onFocus() {
  open.value = true
  if (!isMulti.value) filterText.value = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    open.value = true
    activeIndex.value = Math.min(activeIndex.value + 1, visibleOptions.value.length - 1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
    return
  }
  if (event.key === 'Enter' && open.value) {
    const option = visibleOptions.value[activeIndex.value]
    if (option) {
      event.preventDefault()
      pick(option)
    }
    return
  }
  if (event.key === 'Escape') {
    if (open.value) closeAndShowSelection()
    else filterText.value = selectedSingle.value?.name ?? ''
  }
}

function onOutsideClick(event: MouseEvent) {
  if (root.value && event.target instanceof Node && !root.value.contains(event.target)) {
    closeAndShowSelection()
  }
}

onMounted(() => {
  document.addEventListener('click', onOutsideClick)
  filterText.value = selectedSingle.value?.name ?? ''
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onOutsideClick)
})
</script>

<template>
  <div ref="root" class="entity-picker">
    <div v-if="isMulti && selectedOptions.length > 0" class="picker-chips">
      <span v-for="option in selectedOptions" :key="option.id" class="picker-chip">
        {{ option.name }}
        <button
          type="button"
          class="picker-chip-remove"
          :aria-label="t('editor.picker.clear')"
          :disabled="disabled"
          @click="remove(option.id)"
        >
          ×
        </button>
      </span>
    </div>
    <div class="picker-control">
      <input
        v-model="filterText"
        type="text"
        class="terminal-input"
        :aria-expanded="open"
        :placeholder="t('editor.picker.search')"
        :disabled="disabled"
        @focus="onFocus"
        @input="open = true"
        @keydown="onKeydown"
      >
      <button
        v-if="!isMulti && nullable && selectedSingle && !disabled"
        type="button"
        class="picker-clear"
        :aria-label="t('editor.picker.clear')"
        @click="clear"
      >
        ×
      </button>
    </div>
    <div v-if="open" class="picker-dropdown">
      <button
        v-for="(option, index) in visibleOptions"
        :key="option.id"
        type="button"
        class="picker-option"
        :class="{ active: index === activeIndex }"
        :disabled="disabled"
        @click="pick(option)"
        @mouseenter="activeIndex = index"
      >
        {{ option.name }}
      </button>
      <p v-if="visibleOptions.length === 0" class="picker-empty">{{ t('editor.picker.empty') }}</p>
    </div>
  </div>
</template>
