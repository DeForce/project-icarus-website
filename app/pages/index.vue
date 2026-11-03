<script setup lang="ts">
const { t } = useI18n()
const { data: campaign } = useFetch('/api/public/campaign', {
  default: () => ({ shipName: '', currentDate: '' }),
})
const shipName = computed(() => campaign.value.shipName || t('app.shipFallback'))
const campaignLead = computed(() => `${shipName.value} · ${campaign.value.currentDate}`)

const services = computed(() => [
  { to: '/archive', title: t('services.archive'), hint: t('services.archiveHint') },
  { to: '/map', title: t('services.map'), hint: t('services.mapHint') },
  { to: '/packages', title: t('services.packages'), hint: t('services.packagesHint') },
])
</script>

<template>
  <section class="panel">
    <h1>{{ t('services.heading') }}</h1>
    <p class="terminal-lead">{{ campaignLead }}</p>
    <div class="service-grid">
      <NuxtLink v-for="service in services" :key="service.to" :to="service.to" class="service-card">
        <span class="service-card-title">{{ service.title }}</span>
        <span class="service-card-hint">{{ service.hint }}</span>
      </NuxtLink>
    </div>
  </section>
</template>
