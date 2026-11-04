<script setup lang="ts">
import { ofetch } from 'ofetch'
import type { ImportPreview } from '~~/shared/types'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const { t } = useI18n()

const { data: session, pending: sessionPending } = useFetch('/api/admin/session', {
  default: () => ({ authenticated: false }),
})

if (import.meta.client) {
  watchEffect(() => {
    if (!sessionPending.value && !session.value.authenticated) {
      void router.replace('/admin/login')
    }
  })
}

const yamlText = ref('')

const preview = ref<ImportPreview | null>(null)
const problems = ref<Array<{ path: string; message: string }>>([])
const previewedText = ref<string | null>(null)
const previewing = ref(false)
const importing = ref(false)
const conflict = ref(false)

const previewStale = computed(() => previewedText.value !== null && yamlText.value !== previewedText.value)

function onFilePicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    yamlText.value = String(reader.result ?? '')
    preview.value = null
    previewedText.value = null
  }
  reader.readAsText(file)
}

async function requestPreview() {
  previewing.value = true
  problems.value = []
  conflict.value = false
  try {
    preview.value = await ofetch<ImportPreview>('/api/admin/import/preview', {
      method: 'POST',
      body: { yaml: yamlText.value },
    })
    previewedText.value = yamlText.value
  } catch (error) {
    preview.value = null
    captureProblems(error)
  } finally {
    previewing.value = false
  }
}

function captureProblems(error: unknown) {
  if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 422) {
    // ofetch exposes the parsed h3 error body on `error.data`; the problems payload nests one level deeper.
    const payload = (error as { data?: { data?: { problems?: Array<{ path: string; message: string }> } } }).data?.data
    problems.value = payload?.problems ?? []
  }
}

async function runImport() {
  if (!preview.value) return
  importing.value = true
  problems.value = []
  conflict.value = false
  try {
    const result = await ofetch<{ packageId: string }>('/api/admin/import/run', {
      method: 'POST',
      body: {
        yaml: yamlText.value,
        expectedPackageId: preview.value.packageId,
        expectedPackageRevision: preview.value.expectedPackageRevision,
      },
    })
    void router.push(`/admin/packages/${result.packageId}`)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 409) {
      conflict.value = true
    } else {
      captureProblems(error)
    }
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <section class="panel">
    <h1>{{ t('import.heading') }}</h1>
    <p class="terminal-dim">{{ t('import.hint') }}</p>
    <NuxtLink class="terminal-button terminal-button-ghost" to="/admin">{{ t('admin.heading') }}</NuxtLink>

    <div v-if="conflict" class="conflict-banner">
      <p>{{ t('import.conflict') }}</p>
      <button
        type="button"
        class="terminal-button"
        @click="
          conflict = false;
          preview = null;
          previewedText = null;
        "
      >
        {{ t('editor.reload') }}
      </button>
    </div>

    <form class="terminal-form form-wide" @submit.prevent="requestPreview">
      <label>
        {{ t('import.paste') }}
        <textarea
          v-model="yamlText"
          class="terminal-input terminal-textarea terminal-textarea-tall"
          rows="16"
          spellcheck="false"
          :disabled="importing"
        />
      </label>
      <label>
        {{ t('import.file') }}
        <input
          ref="fileInput"
          type="file"
          accept=".yaml,.yml,text/yaml"
          class="terminal-input"
          :disabled="importing"
          @change="onFilePicked"
        >
      </label>
      <button type="submit" class="terminal-button" :disabled="previewing || importing || yamlText.trim() === ''">
        {{ t('import.preview') }}
      </button>
    </form>

    <p v-if="previewStale" class="terminal-error">{{ t('import.previewStale') }}</p>
    <AdminProblemList v-if="problems.length > 0" :problems="problems" />

    <div v-if="preview && !previewStale" class="import-summary">
      <h2>{{ preview.packageTitle }}</h2>
      <p class="terminal-dim">{{ preview.packageKey }} ·{{ preview.receivedDate }}</p>
      <p v-if="preview.mode === 'create'" class="terminal-dim">{{ t('import.modeCreate') }}</p>
      <p v-else class="terminal-error">{{ t('import.modeReplace', { count: preview.canceledChangeCount }) }}</p>

      <div class="summary-grid">
        <div class="sum-card">
          <b>{{ preview.createdCount }}</b>
          <span>{{ t('import.labelCreated') }}</span>
        </div>
        <div class="sum-card">
          <b>{{ preview.updatedCount }}</b>
          <span>{{ t('import.labelUpdated') }}</span>
        </div>
        <div class="sum-card">
          <b>{{ preview.removedCount }}</b>
          <span>{{ t('import.labelRemoved') }}</span>
        </div>
      </div>

      <ul class="admin-change-list">
        <li v-for="change in preview.changes" :key="change.entityKey">
          <span class="kind-tag" :class="change.kind">{{ t(`editor.kind.${change.kind}`) }}</span>
          <span class="admin-change-name">{{ change.name }}</span>
          <span class="op-tag" :class="change.operation">{{ t(`packages.operation.${change.operation}`) }}</span>
          <span v-if="change.isNew" class="terminal-dim">· new</span>
        </li>
      </ul>

      <AdminProblemList v-if="preview.problems.length > 0" :problems="preview.problems" />
      <p v-else class="ok-line">{{ t('import.noProblems') }}</p>
      <div class="form-actions">
        <button type="button" class="terminal-button" :disabled="importing || preview.problems.length > 0" @click="runImport">
          {{ t('import.confirm') }}
        </button>
      </div>
    </div>
  </section>
</template>
