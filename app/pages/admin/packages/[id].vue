<script setup lang="ts">
import type { ChangeDraft } from '~/composables/usePackageEditor'
import type { ChangeRecord } from '~~/shared/types'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const packageId = route.params.id as string
const editor = usePackageEditor(packageId)
const { detail, saving, conflict, isDraft, publicationProblems, unpublishBlockers } = editor

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

const { data: entityIndex, refresh: refreshEntityIndex } = useFetch('/api/admin/entity-index', {
  query: { packageId },
  default: () => [],
})

const draftMarker = computed(() => ` · ${t('editor.draftMarker')}`)

function indexName(entry: { name: string; draftOnly: boolean }): string {
  return entry.draftOnly ? entry.name + draftMarker.value : entry.name
}

const referenceOptions = computed(() => ({
  categories: entityIndex.value
    .filter((entry) => entry.kind === 'category')
    .map(({ id, name, draftOnly }) => ({ id, name: indexName({ name, draftOnly }) })),
  articles: entityIndex.value
    .filter((entry) => entry.kind === 'article')
    .map(({ id, name, draftOnly }) => ({ id, name: indexName({ name, draftOnly }) })),
  systems: entityIndex.value
    .filter((entry) => entry.kind === 'system')
    .map(({ id, name, draftOnly }) => ({ id, name: indexName({ name, draftOnly }) })),
}))

const metadataInitial = computed(() => ({
  title: detail.value?.title ?? '',
  receivedDate: detail.value?.receivedDate ?? '',
  publicSummary: detail.value?.publicSummary ?? null,
}))

// Publish gating: any open editor or dirty metadata blocks publication.
const metadataDirty = ref(false)
const changeDraft = ref<ChangeDraft | null>(null)
const publishBlocked = computed(() => metadataDirty.value || changeDraft.value !== null)

const resetSignal = ref(0)
const changeResetSignal = ref(0)
const referenceProblems = ref<Array<{ path: string; message: string }>>([])
const referencesChecked = ref(false)
const checking = ref(false)

function displayName(change: ChangeRecord): string {
  if (change.payload && typeof change.payload === 'object') {
    const candidate = change.payload as { name?: unknown; title?: unknown }
    if (typeof candidate.name === 'string') return candidate.name
    if (typeof candidate.title === 'string') return candidate.title
  }
  return change.entityId
}

function startNewChange() {
  changeDraft.value = { entityId: undefined, kind: 'category', payload: { name: '', parentId: null, order: 0 } }
  changeResetSignal.value++
}

function startEditChange(change: ChangeRecord) {
  if (!change.payload) return
  changeDraft.value = { entityId: change.entityId, kind: change.kind, payload: change.payload }
  changeResetSignal.value++
}

async function onSaveMetadata(fields: { title: string; receivedDate: string; publicSummary: string | null }) {
  const result = await editor.saveMetadata(fields)
  // Adopt the freshly saved server state as the new baseline; text is already stored.
  if (result !== undefined) resetSignal.value++
}

async function onSaveChange(draft: ChangeDraft) {
  const result = await editor.saveChange(draft)
  if (result !== undefined) {
    changeDraft.value = null
    // New draft entities must appear in the reference pickers immediately.
    void refreshEntityIndex()
  }
}

async function onCancelChange(entityId: string) {
  const result = await editor.cancelChange(entityId)
  if (result !== undefined) void refreshEntityIndex()
}

async function onDeleteDraft() {
  if (!window.confirm(`${t('editor.deleteDraft')}?`)) return
  const result = await editor.deleteDraft()
  if (result !== undefined) void router.replace('/admin')
}

async function onCheckReferences() {
  checking.value = true
  try {
    referenceProblems.value = await editor.checkReferences()
    referencesChecked.value = true
  } finally {
    checking.value = false
  }
}

async function onPublish() {
  try {
    const published = await editor.publish()
    if (published) {
      changeDraft.value = null
      void router.replace(`/packages/${packageId}`)
    }
  } catch (error) {
    await editor.capturePublicationError(error)
  }
}

async function onUnpublish() {
  if (!window.confirm(t('editor.unpublishConfirm'))) return
  await editor.unpublish()
}

function reloadAfterConflict() {
  conflict.value = false
  metadataDirty.value = false
  changeDraft.value = null
  resetSignal.value++
  changeResetSignal.value++
  void editor.load()
}

onMounted(() => {
  void editor.load()
})
</script>

<template>
  <section class="panel">
    <template v-if="detail">
      <p class="terminal-dim">
        {{ detail.status === 'draft' ? t('admin.statusDraft') : t('admin.statusPublished') }} ·
        {{ t('editor.revision') }}
        {{ detail.revision }}
      </p>
      <h1>{{ detail.title }}</h1>

      <div v-if="conflict" class="conflict-banner">
        <p>{{ t('editor.conflict') }}</p>
        <button type="button" class="terminal-button" @click="reloadAfterConflict">{{ t('editor.reload') }}</button>
      </div>

      <template v-if="isDraft">
        <h2>{{ t('editor.metadata') }}</h2>
        <AdminMetadataForm
          :initial="metadataInitial"
          :saving="saving"
          :reset-signal="resetSignal"
          @update:dirty="metadataDirty = $event"
          @save="onSaveMetadata"
        />

        <h2>{{ t('editor.changes') }}</h2>
        <p v-if="detail.changes.length === 0" class="terminal-dim">{{ t('editor.changesEmpty') }}</p>
        <ul v-else class="admin-change-list">
          <li v-for="change in detail.changes" :key="change.entityId">
            <span class="terminal-dim">[{{ t(`packages.operation.${change.operation}`) }}]</span>
            <span class="admin-change-name">{{ displayName(change) }}</span>
            <span class="terminal-dim">{{ t(`editor.kind.${change.kind}`) }}</span>
            <span class="admin-change-actions">
              <button
                v-if="change.payload"
                type="button"
                class="terminal-button terminal-button-small"
                :disabled="saving"
                @click="startEditChange(change)"
              >
                {{ t('editor.editChange') }}
              </button>
              <button
                type="button"
                class="terminal-button terminal-button-small terminal-button-ghost"
                :disabled="saving"
                @click="onCancelChange(change.entityId)"
              >
                {{ t('editor.cancelChange') }}
              </button>
            </span>
          </li>
        </ul>

        <button v-if="changeDraft === null" type="button" class="terminal-button" :disabled="saving" @click="startNewChange">
          {{ t('editor.addChange') }}
        </button>
        <div v-else class="change-editor-panel">
          <AdminChangeEditor
            :initial="changeDraft.entityId ? changeDraft : null"
            :options="referenceOptions"
            :saving="saving"
            :reset-signal="changeResetSignal"
            @save="onSaveChange"
            @close="changeDraft = null"
          />
        </div>

        <h2>{{ t('editor.preview') }}</h2>
        <button type="button" class="terminal-button" :disabled="saving || checking" @click="onCheckReferences">
          {{ t('editor.preview') }}
        </button>
        <p v-if="referencesChecked && referenceProblems.length === 0" class="terminal-dim">
          {{ t('editor.previewClean') }}
        </p>
        <AdminProblemList v-if="referenceProblems.length > 0" :problems="referenceProblems" />

        <h2>{{ t('editor.publish') }}</h2>
        <p v-if="publishBlocked" class="terminal-dim">{{ t('editor.publishBlocked') }}</p>
        <p v-if="publicationProblems.length > 0" class="terminal-error">{{ t('editor.publishFailed') }}</p>
        <AdminProblemList v-if="publicationProblems.length > 0" :problems="publicationProblems" />
        <div class="form-actions">
          <button type="button" class="terminal-button" :disabled="saving || publishBlocked" @click="onPublish">
            {{ t('editor.publish') }}
          </button>
          <button type="button" class="terminal-button terminal-button-ghost" :disabled="saving" @click="onDeleteDraft">
            {{ t('editor.deleteDraft') }}
          </button>
        </div>
      </template>

      <template v-else>
        <p class="terminal-dim">{{ t('editor.publishedView') }}</p>
        <NuxtLink class="terminal-button" :to="`/packages/${packageId}`">{{ t('packages.heading') }}</NuxtLink>
        <div class="form-actions">
          <button type="button" class="terminal-button terminal-button-ghost" :disabled="saving" @click="onUnpublish">
            {{ t('editor.unpublish') }}
          </button>
        </div>
        <div v-if="unpublishBlockers.length > 0" class="problem-list">
          <p class="terminal-error">{{ t('editor.unpublishBlocked') }}</p>
          <ul>
            <li v-for="blocker in unpublishBlockers" :key="blocker.id">{{ blocker.title }}</li>
          </ul>
        </div>
      </template>
    </template>
    <p v-else-if="editor.loadError.value" class="terminal-error">{{ t('editor.notFound') }}</p>
    <p v-else class="terminal-dim">{{ t('archive.searching') }}</p>
  </section>
</template>
