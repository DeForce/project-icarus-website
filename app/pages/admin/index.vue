<script setup lang="ts">
import { ofetch } from 'ofetch'
import type { CampaignSettings, PackageInfo } from '~~/shared/types'

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

async function logout() {
  await ofetch('/api/admin/session', { method: 'DELETE' })
  void router.replace('/admin/login')
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
  return packageInfo.status === 'draft' ? `/admin/packages/${packageInfo.id}` : `/packages/${packageInfo.id}`
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
  <section class="panel">
    <h1>{{ t('admin.heading') }}</h1>
    <div class="form-actions">
      <NuxtLink class="terminal-button terminal-button-ghost" to="/admin/import">{{ t('admin.import') }}</NuxtLink>
      <button type="button" class="terminal-button terminal-button-ghost" @click="logout">{{ t('admin.logout') }}</button>
    </div>

    <h2>{{ t('admin.campaign') }}</h2>
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

    <h2>{{ t('admin.packages') }}</h2>
    <ul v-if="packagesLoaded && packages.length > 0" class="admin-package-list">
      <li v-for="packageInfo in packages" :key="packageInfo.id">
        <NuxtLink :to="packageTo(packageInfo)" class="admin-package-link">
          <span class="archive-list-title">{{ packageInfo.title }}</span>
          <span class="terminal-dim">
            {{ packageInfo.status === 'draft' ? t('admin.statusDraft') : `#${packageInfo.sequence}` }}
            ·{{ t('packages.received') }}
            {{ packageInfo.receivedDate }}
          </span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else-if="packagesLoaded" class="terminal-dim">{{ t('admin.packagesEmpty') }}</p>
    <p v-else class="terminal-dim">{{ t('archive.searching') }}</p>

    <h2>{{ t('admin.createDraft') }}</h2>
    <form class="terminal-form" @submit.prevent="createDraft">
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
      <button type="submit" class="terminal-button" :disabled="creating">{{ t('admin.createDraft') }}</button>
    </form>
  </section>
</template>
