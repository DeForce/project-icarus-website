<script setup lang="ts">
const props = defineProps<{
  initial: { title: string; receivedDate: string; publicSummary: string | null }
  saving: boolean
  /** Increment to force-discard local text and adopt the current server baseline. */
  resetSignal: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  save: [fields: { title: string; receivedDate: string; publicSummary: string | null }]
  'update:dirty': [value: boolean]
}>()

const { t } = useI18n()

const draft = ref({ title: '', receivedDate: '', publicSummary: '' })
const baseline = ref({ title: '', receivedDate: '', publicSummary: '' })

function syncFromInitial() {
  const summary = props.initial.publicSummary ?? ''
  draft.value = { title: props.initial.title, receivedDate: props.initial.receivedDate, publicSummary: summary }
  baseline.value = { ...draft.value }
}

// Adopt a fresh server baseline only while clean; dirty text is never clobbered by a reload.
watch(
  () => props.initial,
  () => {
    if (!dirty.value) syncFromInitial()
  },
  { deep: true },
)

watch(
  () => props.resetSignal,
  () => syncFromInitial(),
)

const dirty = computed(
  () =>
    draft.value.title !== baseline.value.title ||
    draft.value.receivedDate !== baseline.value.receivedDate ||
    draft.value.publicSummary !== baseline.value.publicSummary,
)

watch(
  dirty,
  (value) => {
    emit('update:dirty', value)
  },
  { immediate: true },
)

function discard() {
  draft.value = { ...baseline.value }
}

function submit() {
  emit('save', {
    title: draft.value.title,
    receivedDate: draft.value.receivedDate,
    publicSummary: draft.value.publicSummary === '' ? null : draft.value.publicSummary,
  })
}

onMounted(syncFromInitial)
</script>

<template>
  <form class="terminal-form form-wide" @submit.prevent="submit">
    <label>
      {{ t('editor.field.title') }}
      <input v-model="draft.title" type="text" class="terminal-input" required :disabled="disabled || saving">
    </label>
    <label>
      {{ t('packages.received') }}
      <input v-model="draft.receivedDate" type="date" class="terminal-input" required :disabled="disabled || saving">
    </label>
    <label>
      {{ t('admin.draftSummary') }}
      <textarea v-model="draft.publicSummary" class="terminal-input" rows="2" :disabled="disabled || saving" />
    </label>
    <p v-if="dirty && !disabled" class="terminal-dim">{{ t('editor.dirty') }}</p>
    <div class="form-actions">
      <button type="submit" class="terminal-button" :disabled="disabled || saving || !dirty">
        {{ t('editor.save') }}
      </button>
      <button v-if="dirty && !disabled" type="button" class="terminal-button terminal-button-ghost" :disabled="saving" @click="discard">
        {{ t('editor.discard') }}
      </button>
    </div>
  </form>
</template>
