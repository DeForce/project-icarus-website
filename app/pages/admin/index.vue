<script setup lang="ts">
import { ofetch } from 'ofetch'
import type { CampaignSettings, PackageInfo } from '~~/shared/types'

definePageMeta({ layout: 'admin' })

const { t } = useI18n()
const router = useRouter()

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

// --- Campaign settings form -------------------------------------------------

const campaign = ref<CampaignSettings | null>(null)
const campaignBaseline = ref<CampaignSettings | null>(null)
const campaignDraft = ref({ shipName: '', currentDate: '' })
const savingCampaign = ref(false)
const campaignConflict = ref(false)

const campaignDirty = computed(() => {
  const baseline = campaignBaseline.value
  if (!baseline) return false
  return campaignDraft.value.shipName !== baseline.shipName || campaignDraft.value.currentDate !== baseline.currentDate
})

function adoptCampaign(settings: CampaignSettings) {
  campaign.value = settings
  campaignBaseline.value = settings
  campaignDraft.value = { shipName: settings.shipName, currentDate: settings.currentDate }
}

async function loadCampaign() {
  try {
    adoptCampaign(await ofetch<CampaignSettings>('/api/admin/campaign'))
    campaignConflict.value = false
  } catch {
    campaignConflict.value = true
  }
}

async function saveCampaign() {
  const baseline = campaignBaseline.value
  if (!baseline) return
  savingCampaign.value = true
  campaignConflict.value = false
  try {
    const updated = await $fetch<CampaignSettings>('/api/admin/campaign', {
      method: 'PUT',
      body: {
        shipName: campaignDraft.value.shipName,
        currentDate: campaignDraft.value.currentDate,
        expectedRevision: baseline.revision,
      },
    })
    adoptCampaign(updated)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 409) {
      campaignConflict.value = true
    } else {
      throw error
    }
  } finally {
    savingCampaign.value = false
  }
}

// --- Package list ------------------------------------------------------------

const packages = ref<PackageInfo[]>([])
const packagesLoaded = ref(false)

async function loadPackages() {
  packages.value = await ofetch<PackageInfo[]>('/api/admin/packages')
  packagesLoaded.value = true
}

function packageTo(packageInfo: PackageInfo): string {
  return `/admin/packages/${packageInfo.id}`
}

function statusLabel(packageInfo: PackageInfo): string {
  return packageInfo.status === 'draft' ? t('admin.chipDraft') : t('admin.chipPublished', { seq: packageInfo.sequence ?? 0 })
}

// --- Draft creation ----------------------------------------------------------

const draftDraft = ref({ title: '', receivedDate: '', publicSummary: '' })
const creating = ref(false)

async function createDraft() {
  creating.value = true
  try {
    const created = await $fetch<PackageInfo>('/api/admin/packages', {
      method: 'POST',
      body: {
        title: draftDraft.value.title,
        receivedDate: draftDraft.value.receivedDate,
        publicSummary: draftDraft.value.publicSummary || undefined,
      },
    })
    void router.push(`/admin/packages/${created.id}`)
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  void loadCampaign()
  void loadPackages()
})
</script>

<template>
  <section>
    <div class="panel panel-svc">
      <h2 style="margin-top: 0">{{ t('admin.campaignOrder') }}</h2>
      <div v-if="campaignConflict" class="conflict-banner">
        <p>{{ t('editor.conflict') }}</p>
        <button type="button" class="terminal-button" @click="loadCampaign">{{ t('editor.reload') }}</button>
      </div>
      <form v-if="campaignBaseline" class="terminal-form" @submit.prevent="saveCampaign">
        <label>
          {{ t('admin.shipName') }}
          <input v-model="campaignDraft.shipName" type="text" class="terminal-input" required :disabled="savingCampaign">
        </label>
        <label>
          {{ t('admin.currentDate') }}
          <input v-model="campaignDraft.currentDate" type="date" class="terminal-input" required :disabled="savingCampaign">
        </label>
        <p v-if="campaignDirty" class="terminal-dim">{{ t('editor.dirty') }}</p>
        <div class="form-actions">
          <button type="submit" class="terminal-button" :disabled="savingCampaign || !campaignDirty">
            {{ t('editor.save') }}
          </button>
        </div>
      </form>
      <p v-else class="terminal-dim">{{ t('archive.searching') }}</p>
    </div>

    <h2>{{ t('admin.chanceryNav') }}</h2>
    <table v-if="packagesLoaded && packages.length > 0" class="data-table">
      <thead>
        <tr>
          <th>{{ t('admin.colTitle') }}</th>
          <th>{{ t('admin.colChanges') }}</th>
          <th>{{ t('admin.colStatus') }}</th>
          <th>{{ t('admin.colReceived') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="packageInfo in packages" :key="packageInfo.id">
          <td :data-label="t('admin.colTitle')">
            <NuxtLink :to="packageTo(packageInfo)">
              <span class="cell-title">{{ packageInfo.title }}</span>
            </NuxtLink>
          </td>
          <td :data-label="t('admin.colChanges')">
            <span class="cell-dim">{{ t('admin.changeCount', { count: packageInfo.changeCount }) }}</span>
          </td>
          <td :data-label="t('admin.colStatus')">
            <span class="chip-status" :class="packageInfo.status === 'draft' ? 'draft' : 'pub'">{{ statusLabel(packageInfo) }}</span>
          </td>
          <td :data-label="t('admin.colReceived')">
            <span class="cell-dim">{{ packageInfo.receivedDate }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="packagesLoaded" class="terminal-dim">{{ t('admin.packagesEmpty') }}</p>
    <p v-else class="terminal-dim">{{ t('archive.searching') }}</p>

    <h2>{{ t('admin.createDraft') }}</h2>
    <div class="panel">
      <form class="terminal-form form-wide" @submit.prevent="createDraft">
        <label>
          {{ t('admin.draftTitle') }}
          <input v-model="draftDraft.title" type="text" class="terminal-input" required :disabled="creating">
        </label>
        <label>
          {{ t('admin.draftDate') }}
          <input v-model="draftDraft.receivedDate" type="date" class="terminal-input" required :disabled="creating">
        </label>
        <label>
          {{ t('admin.draftSummary') }}
          <textarea v-model="draftDraft.publicSummary" class="terminal-input" rows="2" :disabled="creating" />
        </label>
        <div class="form-actions">
          <button type="submit" class="terminal-button" :disabled="creating">{{ t('admin.createDraft') }}</button>
        </div>
      </form>
    </div>
  </section>
</template>
